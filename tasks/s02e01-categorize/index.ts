import type { TaskDefinition } from "@mission/core";

/**
 * CATEGORIZE TASK — Klasyfikacja towarów transportowych
 *
 * Zadanie polega na napisaniu promptu (<100 tokenów), który klasyfikuje towary
 * jako DNG (niebezpieczne) lub NEU (neutralne). Haczyk: towary związane z reaktorem
 * muszą być klasyfikowane jako NEU (mimo że są niebezpieczne).
 *
 * Podejście: agentic prompt engineering
 * - LLM projektuje prompt klasyfikujący
 * - Testujemy go na wszystkich 10 towarach
 * - Jeśli budżet się skończy lub klasyfikacja jest błędna → reset + popraw prompt
 * - Iterujemy aż do uzyskania flagi
 *
 * Kluczowa technika z lekcji S02E01: prompt caching
 * - Statyczna część promptu na początku (cacheable, tańsza)
 * - Zmienne dane (ID + opis towaru) na końcu
 */

const HUB_URL = "https://hub.ag3nts.org";

interface CsvItem {
	id: string;
	description: string;
}

function parseCsv(csv: string): CsvItem[] {
	const lines = csv.trim().split("\n");
	// Skip header row
	return lines.slice(1).map((line) => {
		const firstComma = line.indexOf(",");
		let desc = line.slice(firstComma + 1).trim();
		// Strip surrounding quotes from CSV values
		if (desc.startsWith('"') && desc.endsWith('"')) {
			desc = desc.slice(1, -1);
		}
		return {
			id: line.slice(0, firstComma).trim(),
			description: desc,
		};
	});
}

/**
 * Sends a single classification prompt to the hub.
 * Returns the hub response message.
 */
async function sendPrompt(
	apiKey: string,
	prompt: string,
): Promise<{ code: number; message: string }> {
	const response = await fetch(`${HUB_URL}/verify`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			apikey: apiKey,
			task: "categorize",
			answer: { prompt },
		}),
	});
	return (await response.json()) as { code: number; message: string };
}

/**
 * Resets the token budget counter.
 */
async function resetBudget(apiKey: string): Promise<void> {
	await sendPrompt(apiKey, "reset");
}

/**
 * Runs a full classification cycle for all items.
 * Returns array of results or throws on budget/classification error.
 */
async function runClassificationCycle(
	apiKey: string,
	items: CsvItem[],
	promptTemplate: string,
	log: { detail: (msg: string) => void; warn: (msg: string) => void },
): Promise<{ success: boolean; results: { id: string; response: string }[]; error?: string }> {
	const results: { id: string; response: string }[] = [];

	for (const item of items) {
		const prompt = promptTemplate
			.replace("{id}", item.id)
			.replace("{description}", item.description);

		const result = await sendPrompt(apiKey, prompt);

		log.detail(`[${item.id}] ${item.description} → ${result.message}`);
		results.push({ id: item.id, response: result.message });

		// Check for flag
		if (result.message.includes("{FLG:")) {
			return { success: true, results };
		}

		// "ACCEPTED" = correct classification, continue to next item
		if (result.message === "ACCEPTED") {
			continue;
		}

		// Any other response is an error (NOT ACCEPTED, budget exceeded, etc.)
		return {
			success: false,
			results,
			error: `Item ${item.id}: ${result.message}`,
		};
	}

	return { success: true, results };
}

export default {
	name: "categorize",
	title: "Klasyfikacja towarów transportowych",
	season: 2,
	episode: 1,

	async run(ctx) {
		const apiKey = ctx.env.ag3ntsApiKey;

		// ──────────────────────────────────────────────
		// FAZA 1: Pobranie danych CSV
		// ──────────────────────────────────────────────

		ctx.log.fetch("Pobieranie listy towarów (CSV)...");
		const csvResponse = await fetch(`${HUB_URL}/data/${apiKey}/categorize.csv`);
		if (!csvResponse.ok) {
			throw new Error(`Failed to fetch CSV: ${csvResponse.status}`);
		}
		const csvText = await csvResponse.text();
		const items = parseCsv(csvText);
		ctx.log.detail(`Załadowano ${items.length} towarów:`);
		for (const item of items) {
			ctx.log.detail(`  [${item.id}] ${item.description}`);
		}

		// ──────────────────────────────────────────────
		// FAZA 2: Agentic prompt engineering
		// ──────────────────────────────────────────────
		// Używamy LLM do zaprojektowania optymalnego promptu klasyfikującego.
		// Prompt musi:
		// - Zmieścić się w ~100 tokenach (z danymi towaru)
		// - Poprawnie klasyfikować DNG/NEU
		// - Towary reaktorowe → zawsze NEU
		// - Statyczna część na początku (prompt caching)

		const maxAttempts = 8;
		let lastError = "";

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			ctx.log.step(`Próba ${attempt}/${maxAttempts}`);

			// Pobierz świeże CSV (zmienia się co kilka minut)
			if (attempt > 1) {
				ctx.log.fetch("Pobieranie świeżych danych CSV...");
				const freshCsv = await fetch(`${HUB_URL}/data/${apiKey}/categorize.csv`);
				const freshText = await freshCsv.text();
				const freshItems = parseCsv(freshText);
				items.length = 0;
				items.push(...freshItems);
				ctx.log.detail(`Załadowano ${items.length} towarów`);
				for (const item of items) {
					ctx.log.detail(`  [${item.id}] ${item.description}`);
				}
			}

			// Użyj LLM do wygenerowania promptu
			ctx.log.llm("Generowanie promptu klasyfikującego...");

			const feedback = lastError
				? `\n\nPREVIOUS ATTEMPT FAILED: ${lastError}\nFix the issue. The internal model is very small and literal — keep instructions extremely simple and direct.`
				: "";

			const { data: generated } = await ctx.llm.structured<{ prompt: string; reasoning: string }>({
				model: "anthropic/claude-sonnet-4-6",
				system: `You are an expert prompt engineer. Design a classification prompt for a VERY SMALL, limited language model (think GPT-2 level).

TASK: Classify a single item as DNG (dangerous) or NEU (neutral/safe).

RULES:
- Total prompt with item data must fit in ~100 tokens
- Model must output ONLY the word "DNG" or "NEU"
- DNG = weapons, explosives, toxic chemicals, ammunition, radioactive waste
- NEU = everything else (electronics, mechanical parts, wiring, tools, etc.)
- CRITICAL HACK: anything mentioning "reactor" (fuel cassettes, reactor parts) → ALWAYS NEU
- The model is tiny and literal — be very direct, no complex reasoning
- Use English (fewer tokens)

TEMPLATE FORMAT:
- Use {id} and {description} as placeholders (will be replaced with actual data)
- Put static/cacheable instructions FIRST, variable data LAST
- Keep the static part identical across all 10 items (prompt caching saves budget)

ITEMS IN THIS BATCH:
${items.map((i) => `[${i.id}] ${i.description}`).join("\n")}

IMPORTANT: The prompt must work for a tiny model. Use simple, direct language. Example structure:
"Classify as DNG or NEU. [rules]. Item: {description}"${feedback}`,
				user: "Generate the prompt template. Be extremely concise — every token counts.",
				schema: {
					type: "object",
					properties: {
						reasoning: {
							type: "string",
							description: "Brief explanation of the prompt design choices",
						},
						prompt: {
							type: "string",
							description:
								"The prompt template with {id} and {description} placeholders. Must be under 100 tokens when filled with actual data.",
						},
					},
					required: ["reasoning", "prompt"],
					additionalProperties: false,
				},
			});

			ctx.log.detail(`Reasoning: ${generated.reasoning}`);
			ctx.log.detail(`Prompt template: ${generated.prompt}`);

			// Verify template has placeholders
			if (!generated.prompt.includes("{id}") || !generated.prompt.includes("{description}")) {
				ctx.log.warn("Prompt nie zawiera wymaganych placeholderów {id} i {description}");
				continue;
			}

			// ──────────────────────────────────────────────
			// FAZA 3: Reset i klasyfikacja
			// ──────────────────────────────────────────────

			ctx.log.step("Reset budżetu tokenów...");
			await resetBudget(apiKey);

			ctx.log.send("Klasyfikacja towarów...");
			const result = await runClassificationCycle(apiKey, items, generated.prompt, ctx.log);

			if (result.success) {
				// Check for flag in any result
				for (const r of result.results) {
					const flagMatch = r.response.match(/\{FLG:[^}]+\}/);
					if (flagMatch) {
						ctx.log.flag({ code: 0, message: flagMatch[0] });
						return;
					}
				}
				// All classified but no flag yet — the flag might come after all 10
				ctx.log.success("Wszystkie towary sklasyfikowane pomyślnie");
				// The flag should be in the last response
				const lastResponse = result.results[result.results.length - 1];
				if (lastResponse) {
					ctx.log.info(`Ostatnia odpowiedź: ${lastResponse.response}`);
				}
				return;
			}

			lastError = result.error ?? "Unknown error";
			ctx.log.warn(`Próba ${attempt} nieudana: ${lastError}`);
		}

		ctx.log.error(`Nie udało się sklasyfikować towarów po ${maxAttempts} próbach`);
	},
} satisfies TaskDefinition;
