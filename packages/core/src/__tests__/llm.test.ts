import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLLMClient } from "../llm.js";
import type { EnvConfig, Logger, ToolDefinition } from "../types.js";

const env: EnvConfig = {
	openrouterApiKey: "test-openrouter-key",
	ag3ntsApiKey: "test-ag3nts-key",
};

const logger: Logger = {
	step: vi.fn(),
	fetch: vi.fn(),
	process: vi.fn(),
	llm: vi.fn(),
	send: vi.fn(),
	success: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
	flag: vi.fn(),
	info: vi.fn(),
	detail: vi.fn(),
};

function mockOpenRouterResponse(
	content: string,
	usage = { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
) {
	return new Response(
		JSON.stringify({
			choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
			usage,
		}),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
}

function mockToolCallResponse(toolCalls: { id: string; name: string; arguments: string }[]) {
	return new Response(
		JSON.stringify({
			choices: [
				{
					message: {
						role: "assistant",
						content: null,
						tool_calls: toolCalls.map((tc) => ({
							id: tc.id,
							type: "function",
							function: { name: tc.name, arguments: tc.arguments },
						})),
					},
					finish_reason: "tool_calls",
				},
			],
			usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
		}),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
}

describe("createLLMClient", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("chat", () => {
		it("sends correct request to OpenRouter", async () => {
			vi.mocked(fetch).mockResolvedValue(mockOpenRouterResponse("Hello world"));

			const llm = createLLMClient(env, logger);
			const result = await llm.chat({
				messages: [{ role: "user", content: "Hi" }],
			});

			expect(result.content).toBe("Hello world");
			expect(result.usage.promptTokens).toBe(10);
			expect(result.usage.completionTokens).toBe(5);

			const [url, init] = vi.mocked(fetch).mock.calls[0];
			expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
			const body = JSON.parse(init?.body as string);
			expect(body.model).toBe("openai/gpt-4.1-mini");
			expect(body.messages).toEqual([{ role: "user", content: "Hi" }]);
		});

		it("prepends system message when provided", async () => {
			vi.mocked(fetch).mockResolvedValue(mockOpenRouterResponse("response"));

			const llm = createLLMClient(env, logger);
			await llm.chat({
				system: "You are helpful",
				messages: [{ role: "user", content: "Hi" }],
			});

			const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
			expect(body.messages[0]).toEqual({ role: "system", content: "You are helpful" });
			expect(body.messages[1]).toEqual({ role: "user", content: "Hi" });
		});

		it("uses custom model when specified", async () => {
			vi.mocked(fetch).mockResolvedValue(mockOpenRouterResponse("response"));

			const llm = createLLMClient(env, logger);
			await llm.chat({
				model: "openai/gpt-4.1",
				messages: [{ role: "user", content: "Hi" }],
			});

			const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
			expect(body.model).toBe("openai/gpt-4.1");
		});
	});

	describe("chat with tool calling", () => {
		it("executes tool calling loop (2 iterations)", async () => {
			const getTempTool: ToolDefinition = {
				name: "get_temperature",
				description: "Get temperature for a city",
				parameters: { type: "object", properties: { city: { type: "string" } } },
				execute: vi.fn().mockResolvedValue({ temp: 22 }),
			};

			// First call: model requests tool
			vi.mocked(fetch)
				.mockResolvedValueOnce(
					mockToolCallResponse([
						{
							id: "call_1",
							name: "get_temperature",
							arguments: '{"city":"Warsaw"}',
						},
					]),
				)
				// Second call: model returns final answer
				.mockResolvedValueOnce(mockOpenRouterResponse("The temperature in Warsaw is 22C"));

			const llm = createLLMClient(env, logger);
			const result = await llm.chat({
				messages: [{ role: "user", content: "What is the temperature in Warsaw?" }],
				tools: [getTempTool],
			});

			expect(fetch).toHaveBeenCalledTimes(2);
			expect(getTempTool.execute).toHaveBeenCalledWith({ city: "Warsaw" });
			expect(result.content).toBe("The temperature in Warsaw is 22C");
			expect(result.usage.promptTokens).toBe(30); // 20 + 10
			expect(result.usage.completionTokens).toBe(15); // 10 + 5
		});

		it("handles unknown tool gracefully", async () => {
			vi.mocked(fetch)
				.mockResolvedValueOnce(
					mockToolCallResponse([
						{
							id: "call_1",
							name: "unknown_tool",
							arguments: "{}",
						},
					]),
				)
				.mockResolvedValueOnce(mockOpenRouterResponse("I couldn't use that tool"));

			const llm = createLLMClient(env, logger);
			const result = await llm.chat({
				messages: [{ role: "user", content: "test" }],
				tools: [],
			});

			expect(logger.warn).toHaveBeenCalledWith("Unknown tool: unknown_tool");
			expect(result.content).toBe("I couldn't use that tool");
		});

		it("warns when max iterations reached", async () => {
			// Always return tool calls — never settles
			vi.mocked(fetch).mockImplementation(() =>
				Promise.resolve(mockToolCallResponse([{ id: "call_1", name: "tool_a", arguments: "{}" }])),
			);

			const toolA: ToolDefinition = {
				name: "tool_a",
				description: "test tool",
				parameters: {},
				execute: vi.fn().mockResolvedValue("ok"),
			};

			const llm = createLLMClient(env, logger);
			await llm.chat({
				messages: [{ role: "user", content: "loop" }],
				tools: [toolA],
				maxIterations: 2,
			});

			expect(fetch).toHaveBeenCalledTimes(2);
			expect(logger.warn).toHaveBeenCalledWith("Tool calling loop reached max iterations (2)");
		});
	});

	describe("structured", () => {
		it("sends json_schema response_format", async () => {
			vi.mocked(fetch).mockResolvedValue(
				mockOpenRouterResponse(JSON.stringify({ name: "John", age: 30 })),
			);

			const llm = createLLMClient(env, logger);
			const schema = {
				type: "object",
				properties: { name: { type: "string" }, age: { type: "number" } },
			};
			const result = await llm.structured<{ name: string; age: number }>({
				system: "Extract person info",
				user: "John is 30 years old",
				schema,
			});

			expect(result.data).toEqual({ name: "John", age: 30 });
			expect(result.usage.promptTokens).toBe(10);

			const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
			expect(body.response_format).toEqual({
				type: "json_schema",
				json_schema: { name: "response", strict: true, schema },
			});
		});

		it("falls back to prompt-based extraction when json_schema unsupported", async () => {
			vi.mocked(fetch)
				// First call fails with json_schema error
				.mockResolvedValueOnce(new Response("json_schema not supported", { status: 400 }))
				// Fallback call succeeds
				.mockResolvedValueOnce(mockOpenRouterResponse(JSON.stringify({ result: "ok" })));

			const llm = createLLMClient(env, logger);
			const result = await llm.structured<{ result: string }>({
				system: "Extract data",
				user: "some input",
				schema: { type: "object", properties: { result: { type: "string" } } },
			});

			expect(logger.warn).toHaveBeenCalledWith(
				"json_schema not supported, falling back to prompt-based extraction",
			);
			expect(result.data).toEqual({ result: "ok" });
		});
	});

	describe("cost calculation", () => {
		it("calculates cost for known model", async () => {
			vi.mocked(fetch).mockResolvedValue(
				new Response(
					JSON.stringify({
						choices: [{ message: { role: "assistant", content: "hi" }, finish_reason: "stop" }],
						usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
					}),
					{ status: 200 },
				),
			);

			const llm = createLLMClient(env, logger);
			const result = await llm.chat({
				model: "openai/gpt-4.1-mini",
				messages: [{ role: "user", content: "hi" }],
			});

			// gpt-4.1-mini: input $0.40/1M, output $1.60/1M
			// cost = (1000 * 0.4 + 500 * 1.6) / 1_000_000 = (400 + 800) / 1_000_000 = 0.0012
			expect(result.usage.cost).toBeCloseTo(0.0012, 6);
		});

		it("returns 0 cost for unknown model", async () => {
			vi.mocked(fetch).mockResolvedValue(
				new Response(
					JSON.stringify({
						choices: [{ message: { role: "assistant", content: "hi" }, finish_reason: "stop" }],
						usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
					}),
					{ status: 200 },
				),
			);

			const llm = createLLMClient(env, logger);
			const result = await llm.chat({
				model: "unknown/model",
				messages: [{ role: "user", content: "hi" }],
			});

			expect(result.usage.cost).toBe(0);
		});
	});
});
