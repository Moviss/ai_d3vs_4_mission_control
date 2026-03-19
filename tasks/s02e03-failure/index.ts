import type { TaskDefinition, ToolDefinition } from "@mission/core";

/**
 * FAILURE TASK — Analiza logów awarii elektrowni
 *
 * Cel: Skondensować ogromny plik logów (~2137 linii) do max 1500 tokenów,
 * zachowując zdarzenia istotne dla analizy przyczyny awarii.
 *
 * Architektura: DETERMINISTYCZNY BASELINE + AGENT DO FEEDBACKU
 *
 * Faza 1 (deterministyczna):
 *   - Parsowanie i indeksowanie logów
 *   - Deduplikacja: unikalne typy zdarzeń (per severity+body)
 *   - Budżetowanie tokenów: CRIT → ERRO → WARN (priorytetowo)
 *   - Formatowanie i submit
 *
 * Faza 2 (agentic, tylko jeśli faza 1 nie wystarczy):
 *   - Agent z narzędziami do przeszukiwania logów
 *   - Reaguje na feedback techników (np. "brakuje FIRMWARE")
 *   - Max 4 dodatkowe submisje
 */

const TOKEN_LIMIT = 1500;
const TOKEN_BUDGET_CRIT = 1200;
const TOKEN_BUDGET_ERRO = 1400;

function estimateTokens(text: string): number {
	return Math.ceil(text.length / 3.5);
}

// ═══════════════════════════════════════════════════════════════════════
// PARSING & DEDUPLICATION
// ═══════════════════════════════════════════════════════════════════════

interface ParsedLine {
	timestamp: string; // "YYYY-MM-DD HH:MM"
	severity: string; // CRIT | ERRO | WARN | INFO
	body: string; // everything after [SEVERITY] — includes component + description
	raw: string;
}

function parseLine(line: string): ParsedLine | null {
	const match = line.match(
		/\[(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})(?::\d{2})?\]\s*\[(CRIT|ERRO|WARN|INFO|ERROR|CRITICAL|WARNING)\]\s*(.*)/,
	);
	if (!match) return null;
	const [, date, time, sev, body] = match;
	const normSev =
		sev === "CRITICAL"
			? "CRIT"
			: sev === "ERROR"
				? "ERRO"
				: sev === "WARNING"
					? "WARN"
					: sev;
	return { timestamp: `${date} ${time}`, severity: normSev, body: body.trim(), raw: line };
}

/** Deduplicate by body text, keeping first occurrence of each unique message */
function dedup(lines: ParsedLine[]): ParsedLine[] {
	const seen = new Set<string>();
	const result: ParsedLine[] = [];
	for (const line of lines) {
		if (!seen.has(line.body)) {
			seen.add(line.body);
			result.push(line);
		}
	}
	return result;
}

/** Format a parsed line for output */
function formatLine(p: ParsedLine): string {
	return `[${p.timestamp}] [${p.severity}] ${p.body}`;
}

/** Build condensed logs deterministically with token budgeting */
function buildBaseline(allParsed: ParsedLine[]): string {
	const bySeverity = { CRIT: [] as ParsedLine[], ERRO: [] as ParsedLine[], WARN: [] as ParsedLine[] };
	for (const p of allParsed) {
		if (p.severity in bySeverity) {
			bySeverity[p.severity as keyof typeof bySeverity].push(p);
		}
	}

	// Deduplicate each severity group
	const critUniq = dedup(bySeverity.CRIT);
	const erroUniq = dedup(bySeverity.ERRO);
	const warnUniq = dedup(bySeverity.WARN);

	// Build output with priority: CRIT → ERRO → WARN
	const selected: ParsedLine[] = [];

	// All unique CRITs always go in
	for (const p of critUniq) selected.push(p);

	// Add ERROs up to budget
	for (const p of erroUniq) {
		const draft = [...selected, p].map(formatLine).join("\n");
		if (estimateTokens(draft) > TOKEN_BUDGET_ERRO) break;
		selected.push(p);
	}

	// Add WARNs up to budget
	for (const p of warnUniq) {
		const draft = [...selected, p].map(formatLine).join("\n");
		if (estimateTokens(draft) > TOKEN_LIMIT) break;
		selected.push(p);
	}

	// Sort chronologically
	selected.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

	return selected.map(formatLine).join("\n");
}

export default {
	name: "failure",
	title: "Kompresja logów awarii elektrowni do 1500 tokenów",
	season: 2,
	episode: 3,
	async run(ctx) {
		const apiKey = ctx.env.ag3ntsApiKey;

		// ═══════════════════════════════════════════════════════════════
		// FAZA 1: DETERMINISTYCZNY BASELINE
		// ═══════════════════════════════════════════════════════════════

		ctx.log.step("Pobieranie pliku logów");
		const response = await fetch(
			`https://hub.ag3nts.org/data/${apiKey}/failure.log`,
		);
		const rawLogs = await response.text();
		const allLines = rawLogs.split("\n").filter((l) => l.trim());
		ctx.log.info(`${allLines.length} linii, ~${estimateTokens(rawLogs)} tokenów`);

		ctx.log.step("Parsowanie i deduplikacja");
		const allParsed = allLines.map(parseLine).filter((p): p is ParsedLine => p !== null);

		const sevCounts: Record<string, number> = {};
		for (const p of allParsed) {
			sevCounts[p.severity] = (sevCounts[p.severity] ?? 0) + 1;
		}
		ctx.log.info(`Parsed: ${allParsed.length}, Severity: ${JSON.stringify(sevCounts)}`);

		ctx.log.step("Budowanie baseline (deterministycznie)");
		const baseline = buildBaseline(allParsed);
		const baselineTokens = estimateTokens(baseline);
		const baselineLines = baseline.split("\n").length;
		ctx.log.info(`Baseline: ${baselineLines} linii, ~${baselineTokens} tokenów`);

		ctx.log.step("Wysyłka baseline do Centrali");
		ctx.log.send(`Baseline (~${baselineTokens} tok, ${baselineLines} linii)`);
		const baseResult = await ctx.hub.verify("failure", { logs: baseline });

		if (baseResult.code === 0) {
			ctx.log.flag(baseResult);
			return;
		}

		ctx.log.warn(`Feedback: ${baseResult.message}`);

		// ═══════════════════════════════════════════════════════════════
		// FAZA 2: AGENT DO FEEDBACKU
		// ═══════════════════════════════════════════════════════════════

		ctx.log.step("Uruchamianie agenta do iteracji na feedbacku");

		let flagFound = false;
		let submitCount = 0;
		const feedbackHistory = [baseResult.message];

		const tools: ToolDefinition[] = [
			{
				name: "search_logs",
				description:
					"Search ALL logs by keyword (case-insensitive). Optionally filter by severity. Returns ORIGINAL log lines. Use this to find events for components mentioned in technician feedback.",
				parameters: {
					type: "object",
					properties: {
						query: { type: "string", description: "Keyword to search (case-insensitive)" },
						severity: {
							type: "string",
							enum: ["CRIT", "ERRO", "WARN", "INFO", "ALL"],
							description: "Filter by severity. Default: ALL",
						},
						limit: { type: "number", description: "Max lines. Default: 50" },
					},
					required: ["query"],
				},
				execute: async (args: unknown) => {
					const { query, severity = "ALL", limit = 50 } = args as {
						query: string;
						severity?: string;
						limit?: number;
					};
					const q = query.toLowerCase();
					let matches = allLines.filter((l) => l.toLowerCase().includes(q));
					if (severity !== "ALL") {
						matches = matches.filter((l) => l.includes(`[${severity}]`));
					}
					return {
						totalMatches: matches.length,
						returnedLines: Math.min(matches.length, limit),
						lines: matches.slice(0, limit).join("\n"),
					};
				},
			},
			{
				name: "count_tokens",
				description: "Estimate token count. Limit is 1500. Call before submit.",
				parameters: {
					type: "object",
					properties: {
						text: { type: "string", description: "Text to count" },
					},
					required: ["text"],
				},
				execute: async (args: unknown) => {
					const { text } = args as { text: string };
					const est = estimateTokens(text);
					return {
						estimatedTokens: est,
						tokenLimit: TOKEN_LIMIT,
						withinLimit: est <= TOKEN_LIMIT,
						lines: text.split("\n").filter((l) => l.trim()).length,
					};
				},
			},
			{
				name: "submit_answer",
				description: "Submit condensed logs. Returns feedback or flag.",
				parameters: {
					type: "object",
					properties: {
						logs: {
							type: "string",
							description:
								"Log entries, newline-separated. Format: [YYYY-MM-DD HH:MM] [SEVERITY] COMPONENT description",
						},
					},
					required: ["logs"],
				},
				execute: async (args: unknown) => {
					const { logs } = args as { logs: string };
					const est = estimateTokens(logs);
					if (est > TOKEN_LIMIT * 1.3) {
						return { error: `Too long (~${est} tokens, limit ${TOKEN_LIMIT}).` };
					}

					submitCount++;
					if (submitCount > 4) {
						return { error: "Max submissions reached. Stop." };
					}

					ctx.log.send(`Wysyłka #${submitCount + 1} (~${est} tok, ${logs.split("\n").length} linii)`);
					const result = await ctx.hub.verify("failure", { logs });

					if (result.code === 0) {
						ctx.log.flag(result);
						flagFound = true;
						return { code: 0, message: result.message };
					}

					ctx.log.warn(`Feedback: ${result.message}`);

					const isDuplicate = feedbackHistory.includes(result.message);
					feedbackHistory.push(result.message);

					if (isDuplicate) {
						return {
							code: result.code,
							message: result.message,
							WARNING:
								"SAME feedback as before! Change strategy: search ALL severities (including INFO) for the component, include MORE events, use ORIGINAL log text.",
						};
					}
					return { code: result.code, message: result.message };
				},
			},
		];

		const result = await ctx.llm.chat({
			model: "google/gemini-2.5-flash",
			system: `You are a power plant failure analyst. A deterministic baseline of condensed logs was already submitted but rejected. Your job: fix the logs based on technician feedback and resubmit.

You MUST call submit_answer to complete. NEVER respond with just text.

## TECHNICIAN FEEDBACK ON BASELINE
${baseResult.message}

## CURRENT BASELINE LOGS (that were rejected)
${baseline}

## YOUR APPROACH
1. Read the feedback — identify which component/device is missing or unclear.
2. Call search_logs for that component with severity=ALL (including INFO!) to find ALL related events.
3. Add the missing events to the baseline. You may need to remove some lower-priority events to stay within 1500 tokens.
4. Call count_tokens to verify under 1500 tokens.
5. Call submit_answer with the improved logs.
6. If feedback mentions another component, repeat.

## FORMAT — STRICT
Each line: [YYYY-MM-DD HH:MM] [SEVERITY] COMPONENT_ID description
- HH:MM timestamps (no seconds), NO colon after component ID
- One event per line, chronological order
- Base every line on a REAL log entry from search results
- Do NOT use "(5x)" deduplication counts`,
			messages: [
				{
					role: "user",
					content: `The baseline was rejected. Fix it based on the feedback and resubmit.`,
				},
			],
			tools,
			maxIterations: 20,
		});

		if (!flagFound) {
			ctx.log.error("Agent zakończył pracę bez uzyskania flagi");
			ctx.log.detail(result.content);
		}
	},
} satisfies TaskDefinition;
