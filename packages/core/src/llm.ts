import type {
	ChatOptions,
	ChatResult,
	EnvConfig,
	LLMClient,
	Logger,
	Message,
	StructuredOptions,
	TokenUsage,
	ToolCall,
	ToolDefinition,
} from "./types.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-haiku-4.5";
const DEFAULT_MAX_ITERATIONS = 5;

// Pricing per 1M tokens (USD) — frequently used models
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
	"anthropic/claude-haiku-4.5": { input: 0.8, output: 4 },
	"anthropic/claude-sonnet-4": { input: 3, output: 15 },
	"anthropic/claude-opus-4": { input: 15, output: 75 },
	"openai/gpt-4.1-mini": { input: 0.4, output: 1.6 },
	"openai/gpt-4.1": { input: 2, output: 8 },
	"openai/gpt-4.1-nano": { input: 0.1, output: 0.4 },
	"google/gemini-2.5-flash": { input: 0.15, output: 0.6 },
	"google/gemini-2.5-pro": { input: 1.25, output: 10 },
};

interface OpenRouterResponse {
	choices: {
		message: {
			role: "assistant";
			content: string | null;
			tool_calls?: ToolCall[];
		};
		finish_reason: string;
	}[];
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

function calculateCost(
	model: string,
	usage: { prompt_tokens: number; completion_tokens: number },
): number {
	const pricing = MODEL_PRICING[model];
	if (!pricing) return 0;

	return (
		(usage.prompt_tokens * pricing.input + usage.completion_tokens * pricing.output) / 1_000_000
	);
}

function accumulateUsage(
	total: TokenUsage,
	model: string,
	response: OpenRouterResponse,
): TokenUsage {
	const usage = response.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
	const promptTokens = total.promptTokens + usage.prompt_tokens;
	const completionTokens = total.completionTokens + usage.completion_tokens;

	return {
		promptTokens,
		completionTokens,
		totalTokens: promptTokens + completionTokens,
		cost: total.cost + calculateCost(model, usage),
	};
}

function toolDefsToOpenRouter(tools: ToolDefinition[]): unknown[] {
	return tools.map((t) => ({
		type: "function",
		function: {
			name: t.name,
			description: t.description,
			parameters: t.parameters,
		},
	}));
}

async function callOpenRouter(
	apiKey: string,
	model: string,
	messages: Message[],
	tools?: unknown[],
	responseFormat?: unknown,
): Promise<OpenRouterResponse> {
	const body: Record<string, unknown> = { model, messages };

	if (tools && tools.length > 0) {
		body.tools = tools;
	}
	if (responseFormat) {
		body.response_format = responseFormat;
	}

	const response = await fetch(OPENROUTER_URL, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`OpenRouter API error ${response.status}: ${text}`);
	}

	return (await response.json()) as OpenRouterResponse;
}

export function createLLMClient(env: EnvConfig, logger: Logger): LLMClient {
	const apiKey = env.openrouterApiKey;

	async function structuredFallback<T>(
		model: string,
		messages: Message[],
		schema: Record<string, unknown>,
	): Promise<T> {
		const schemaInstruction = `\n\nRespond ONLY with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}`;
		const augmented = [...messages];
		if (augmented.length > 0 && augmented[0].role === "system") {
			augmented[0] = {
				...augmented[0],
				content: (augmented[0].content ?? "") + schemaInstruction,
			};
		} else {
			augmented.unshift({ role: "system", content: schemaInstruction });
		}

		const response = await callOpenRouter(apiKey, model, augmented);
		const choice = response.choices[0];
		if (!choice) {
			throw new Error("OpenRouter returned empty choices");
		}

		const content = choice.message.content ?? "";
		// Extract JSON from possible markdown code block
		const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, content];
		return JSON.parse(jsonMatch[1]?.trim() ?? content) as T;
	}

	return {
		async chat(opts: ChatOptions): Promise<ChatResult> {
			const model = opts.model ?? DEFAULT_MODEL;
			const maxIterations = opts.maxIterations ?? DEFAULT_MAX_ITERATIONS;
			const toolDefs = opts.tools ? toolDefsToOpenRouter(opts.tools) : undefined;
			const toolMap = new Map<string, ToolDefinition>();
			if (opts.tools) {
				for (const t of opts.tools) {
					toolMap.set(t.name, t);
				}
			}

			const messages: Message[] = [];
			if (opts.system) {
				messages.push({ role: "system", content: opts.system });
			}
			messages.push(...opts.messages);

			let totalUsage: TokenUsage = {
				promptTokens: 0,
				completionTokens: 0,
				totalTokens: 0,
				cost: 0,
			};

			for (let iteration = 0; iteration < maxIterations; iteration++) {
				const response = await callOpenRouter(apiKey, model, messages, toolDefs);
				totalUsage = accumulateUsage(totalUsage, model, response);

				const choice = response.choices[0];
				if (!choice) {
					throw new Error("OpenRouter returned empty choices");
				}

				const assistantMsg = choice.message;

				// No tool calls — return final content
				if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
					return {
						content: assistantMsg.content ?? "",
						usage: totalUsage,
					};
				}

				// Add assistant message with tool calls to history
				messages.push({
					role: "assistant",
					content: assistantMsg.content,
					tool_calls: assistantMsg.tool_calls,
				});

				// Execute each tool call and add results
				for (const toolCall of assistantMsg.tool_calls) {
					const tool = toolMap.get(toolCall.function.name);
					if (!tool) {
						logger.warn(`Unknown tool: ${toolCall.function.name}`);
						messages.push({
							role: "tool",
							tool_call_id: toolCall.id,
							content: JSON.stringify({ error: `Unknown tool: ${toolCall.function.name}` }),
						});
						continue;
					}

					logger.detail(`Tool: ${toolCall.function.name}(${toolCall.function.arguments})`);

					const args = JSON.parse(toolCall.function.arguments);
					const result = await tool.execute(args);

					messages.push({
						role: "tool",
						tool_call_id: toolCall.id,
						content: typeof result === "string" ? result : JSON.stringify(result),
					});
				}

				logger.detail(
					`Iteration ${iteration + 1}/${maxIterations} — ${totalUsage.promptTokens}+${totalUsage.completionTokens} tokens`,
				);
			}

			// Exhausted iterations — return last content
			logger.warn(`Tool calling loop reached max iterations (${maxIterations})`);
			const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
			return {
				content: lastAssistant?.content ?? "",
				usage: totalUsage,
			};
		},

		async structured<T>(opts: StructuredOptions): Promise<T> {
			const model = opts.model ?? DEFAULT_MODEL;

			const messages: Message[] = [{ role: "system", content: opts.system }];

			if (opts.images && opts.images.length > 0) {
				// Vision: multipart content with images
				const content: unknown[] = [];
				for (const imageUrl of opts.images) {
					content.push({
						type: "image_url",
						image_url: { url: imageUrl },
					});
				}
				content.push({ type: "text", text: opts.user });
				messages.push({ role: "user", content: content as unknown as string });
			} else {
				messages.push({ role: "user", content: opts.user });
			}

			const responseFormat = {
				type: "json_schema",
				json_schema: {
					name: "response",
					strict: true,
					schema: opts.schema,
				},
			};

			try {
				const response = await callOpenRouter(apiKey, model, messages, undefined, responseFormat);
				const choice = response.choices[0];
				if (!choice) {
					throw new Error("OpenRouter returned empty choices");
				}

				const usage = response.usage ?? {
					prompt_tokens: 0,
					completion_tokens: 0,
					total_tokens: 0,
				};
				const cost = calculateCost(model, usage);
				logger.detail(
					`Structured output — ${usage.prompt_tokens}+${usage.completion_tokens} tokens ($${cost.toFixed(4)})`,
				);

				return JSON.parse(choice.message.content ?? "{}") as T;
			} catch (error) {
				// Fallback: prompt-based JSON extraction if json_schema not supported
				if (error instanceof Error && error.message.includes("json_schema")) {
					logger.warn("json_schema not supported, falling back to prompt-based extraction");
					return await structuredFallback<T>(model, messages, opts.schema);
				}
				throw error;
			}
		},
	};
}
