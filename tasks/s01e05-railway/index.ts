import type { Logger, TaskDefinition, ToolDefinition } from "@mission/core";

/**
 * RAILWAY TASK — Aktywacja trasy kolejowej X-01
 *
 * Architektura: AGENT Z NARZĘDZIAMI (tool calling loop)
 *
 * Warstwy:
 * 1. Transport (callRailwayAPI) — surowy fetch z obsługą 503, rate limits, retry
 * 2. Narzędzia (call_railway_api tool) — adapter LLM <-> API
 * 3. Agent (LLM chat z tools) — autonomicznie nawiguje API
 *
 * Dlaczego agent, a nie deterministyczny skrypt?
 * - API jest samo-dokumentujące — nie znamy akcji z góry
 * - Dokumentacja z `help` opisuje sekwencję kroków, ale może się zmienić
 * - LLM potrafi adaptować się do błędów i zmieniać strategię
 * - To ćwiczenie z budowania agentów (lekcja S01E05)
 *
 * Dlaczego NIE używamy ctx.hub.verify?
 * - hub.verify() zwraca HubResponse (parsed JSON) — gubi nagłówki HTTP
 * - Potrzebujemy nagłówków rate limit (X-RateLimit-*, Retry-After)
 * - Potrzebujemy więcej retries niż domyślne 3 w hub client
 * - Potrzebujemy obsługi 429 (Too Many Requests)
 */

const HUB_URL = "https://hub.ag3nts.org/verify";
const MAX_RETRIES = 10;
const MAX_BACKOFF_MS = 30_000;

// ═══════════════════════════════════════════════════════════════════
// WARSTWA 1: TRANSPORT — surowy fetch z obsługą błędów i rate limits
// ═══════════════════════════════════════════════════════════════════

/**
 * Stan rate limitera — współdzielony między wywołaniami.
 * Przechowuje timestamp (ms) kiedy limit się resetuje.
 */
let rateLimitResetAt = 0;

/**
 * Parsuje nagłówki rate limit z odpowiedzi HTTP.
 *
 * API może używać różnych konwencji nagłówków:
 * - X-RateLimit-Remaining / X-RateLimit-Reset (popularny standard)
 * - RateLimit-Remaining / RateLimit-Reset (nowy RFC draft)
 * - Retry-After (standardowy HTTP header)
 *
 * Reset może być:
 * - Unix timestamp w sekundach (np. 1710000000)
 * - Unix timestamp w milisekundach (np. 1710000000000)
 * - Liczba sekund do odczekania (np. 5)
 */
function parseRateLimitHeaders(
	headers: Headers,
	log: Logger,
): { remaining: number | null; resetAt: number | null } {
	const remaining = headers.get("x-ratelimit-remaining") ?? headers.get("ratelimit-remaining");

	const reset =
		headers.get("x-ratelimit-reset") ??
		headers.get("ratelimit-reset") ??
		headers.get("retry-after");

	let resetAt: number | null = null;
	if (reset) {
		const val = Number(reset);
		if (val > 1e12) {
			// Already in milliseconds
			resetAt = val;
		} else if (val > 1e9) {
			// Unix timestamp in seconds — convert to ms
			resetAt = val * 1000;
		} else if (val > 0) {
			// Relative seconds from now
			resetAt = Date.now() + val * 1000;
		}
	}

	// Log rate limit status for debugging
	if (remaining !== null || resetAt !== null) {
		const remainStr = remaining !== null ? `remaining=${remaining}` : "";
		const resetStr = resetAt ? `reset in ${((resetAt - Date.now()) / 1000).toFixed(1)}s` : "";
		log.detail(`Rate limit: ${[remainStr, resetStr].filter(Boolean).join(", ")}`);
	}

	return { remaining: remaining !== null ? Number(remaining) : null, resetAt };
}

/**
 * Główna funkcja transportu — wywołuje Railway API z pełną obsługą błędów.
 *
 * Flow:
 * 1. Sprawdź czy musimy czekać na reset rate limitu
 * 2. Wyślij request
 * 3. Parsuj nagłówki rate limit i zaktualizuj stan
 * 4. Na 503 → exponential backoff + retry
 * 5. Na 429 → czekaj na reset + retry
 * 6. Na sukces → zwróć sparsowane body
 */
async function callRailwayAPI(
	apiKey: string,
	answer: Record<string, unknown>,
	log: Logger,
): Promise<unknown> {
	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		// Krok 1: Czekaj na rate limit reset jeśli potrzeba
		const now = Date.now();
		if (rateLimitResetAt > now) {
			const waitMs = rateLimitResetAt - now + 500; // 500ms buffer
			log.detail(`Rate limit active — waiting ${(waitMs / 1000).toFixed(1)}s`);
			await new Promise((r) => setTimeout(r, waitMs));
		}

		// Krok 2: Wyślij request
		const response = await fetch(HUB_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apikey: apiKey, task: "railway", answer }),
		});

		// Krok 3: Parsuj rate limit headers
		const rateLimit = parseRateLimitHeaders(response.headers, log);
		if (rateLimit.resetAt && rateLimit.resetAt > rateLimitResetAt) {
			rateLimitResetAt = rateLimit.resetAt;
		}

		// Krok 4: Obsługa 503 — exponential backoff
		if (response.status === 503) {
			const delay = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
			log.warn(
				`503 Service Unavailable — retry ${attempt + 1}/${MAX_RETRIES} in ${(delay / 1000).toFixed(1)}s`,
			);
			await new Promise((r) => setTimeout(r, delay));
			continue;
		}

		// Krok 5: Obsługa 429 — rate limit exceeded
		if (response.status === 429) {
			const waitMs = rateLimitResetAt > Date.now() ? rateLimitResetAt - Date.now() + 500 : 5000;
			log.warn(`429 Rate Limited — waiting ${(waitMs / 1000).toFixed(1)}s`);
			await new Promise((r) => setTimeout(r, waitMs));
			continue; // Don't count against retry limit
		}

		// Krok 6: Sukces — zwróć body
		const body = await response.json();
		return body;
	}

	throw new Error(`Railway API: max retries (${MAX_RETRIES}) exceeded`);
}

// ═══════════════════════════════════════════════════════════════════
// WARSTWA 2: NARZĘDZIA — adapter między LLM a API
// ═══════════════════════════════════════════════════════════════════

/**
 * Tworzy narzędzie `call_railway_api` dla LLM.
 *
 * Narzędzie to "ręce" agenta — LLM decyduje CO wywołać,
 * a narzędzie obsługuje JAK to wywołać (retry, rate limits, logging).
 *
 * Parametry to flat object — `action` + dowolne dodatkowe pola.
 * LLM naturalnie wywoła np. {action: "reconfigure", route: "X-01"}.
 *
 * LLM dostaje surową odpowiedź API jako JSON string.
 */
function createRailwayTool(
	apiKey: string,
	log: Logger,
	onFlag: (flag: string) => void,
): ToolDefinition {
	return {
		name: "call_railway_api",
		description:
			"Calls the railway management API. Pass action and any required/optional parameters as flat fields. " +
			"Example: {action: 'reconfigure', route: 'x-01'}. Returns the API response as JSON.",
		parameters: {
			type: "object",
			properties: {
				action: {
					type: "string",
					description:
						"API action name (e.g. 'help', 'reconfigure', 'getstatus', 'setstatus', 'save')",
				},
				route: {
					type: "string",
					description: "Route identifier in format [a-z]-[0-9]{1,2}, e.g. 'x-01'",
				},
				value: {
					type: "string",
					description: "Status value: 'RTOPEN' or 'RTCLOSE'",
				},
			},
			required: ["action"],
		},
		async execute(args) {
			const { action, ...rest } = args as Record<string, unknown>;

			const extraParams = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";
			log.info(`API -> ${action}${extraParams}`);

			try {
				const answer = { action, ...rest };
				const result = await callRailwayAPI(apiKey, answer as Record<string, unknown>, log);
				const resultStr = JSON.stringify(result, null, 2);

				log.detail(`API <- ${resultStr}`);

				// Szukaj flagi w odpowiedzi
				const flagMatch = resultStr.match(/\{FLG:[^}]+\}/);
				if (flagMatch) {
					onFlag(flagMatch[0]);
				}

				return result;
			} catch (error) {
				// Zwróć czytelny błąd do LLM zamiast rzucać wyjątek.
				// Lekcja S01E02: "Błędy takie jak 'coś poszło nie tak' oznaczają
				// przekreśloną szansę na ukończenie zadania."
				const msg = error instanceof Error ? error.message : String(error);
				log.warn(`API error: ${msg}`);

				return {
					error: true,
					message: msg,
					hint:
						"The API may be temporarily overloaded (503) or rate-limited (429). " +
						"Wait a moment and try again with the same parameters. " +
						"If the error persists, try action 'help' to verify available actions.",
				};
			}
		},
	};
}

// ═══════════════════════════════════════════════════════════════════
// WARSTWA 3: AGENT — LLM z narzędziami nawiguje API
// ═══════════════════════════════════════════════════════════════════

export default {
	name: "railway",
	title: "Aktywacja trasy kolejowej X-01",
	season: 1,
	episode: 5,

	async run(ctx) {
		const apiKey = ctx.env.ag3ntsApiKey;

		// Reset rate limit state (w przypadku ponownego uruchomienia)
		rateLimitResetAt = 0;

		// ──────────────────────────────────────────────
		// FAZA 1: Pobranie dokumentacji API (deterministycznie)
		// ──────────────────────────────────────────────
		// Pierwszą akcję `help` wywołujemy bezpośrednio — nie potrzebujemy
		// LLM do zdecydowania, że trzeba zacząć od dokumentacji.
		// To oszczędza jedno wywołanie API (cenne przy restrykcyjnych limitach).

		ctx.log.step("Pobieranie dokumentacji API (help)...");
		const helpResponse = await callRailwayAPI(apiKey, { action: "help" }, ctx.log);
		const apiDocs = JSON.stringify(helpResponse, null, 2);
		ctx.log.detail(`Dokumentacja API:\n${apiDocs}`);

		// Sprawdź czy help nie zwróciło od razu flagi (mało prawdopodobne)
		const earlyFlag = apiDocs.match(/\{FLG:[^}]+\}/);
		if (earlyFlag) {
			ctx.log.flag({ code: 0, message: earlyFlag[0] });
			return;
		}

		// ──────────────────────────────────────────────
		// FAZA 2: Konfiguracja agenta
		// ──────────────────────────────────────────────
		// System prompt zawiera:
		// - Cel agenta (aktywacja trasy X-01)
		// - Pełną dokumentację API z help
		// - Reguły zachowania (oszczędzaj wywołania, czytaj błędy)

		let flagFound = false;

		const tool = createRailwayTool(apiKey, ctx.log, (flag) => {
			flagFound = true;
			ctx.log.flag({ code: 0, message: flag });
		});

		const systemPrompt = `You are an autonomous agent. Your mission: activate railway route X-01.

## API Documentation (from 'help' action)

${apiDocs}

## Rules

1. Follow the API documentation EXACTLY — use the exact action names and parameter names it describes.
2. Execute actions in the correct sequence as described in the documentation.
3. Read EVERY API response carefully — error messages tell you exactly what went wrong.
4. DO NOT call 'help' again — the documentation is above.
5. Be EFFICIENT — every API call counts. Don't make unnecessary calls.
6. If you see a flag in format {{FLG:...}} in any response, the mission is complete.
7. After completing all steps, report what you did.`;

		ctx.log.step("Agent rozpoczyna nawigację API...");

		// ──────────────────────────────────────────────
		// FAZA 3: Uruchomienie agenta (tool calling loop)
		// ──────────────────────────────────────────────
		// LLM analizuje dokumentację z help i autonomicznie wykonuje
		// kolejne akcje API w odpowiedniej kolejności.
		//
		// maxIterations = 20 — wysoka wartość, bo:
		// - Każda iteracja to jeden LLM call + potencjalnie jeden API call
		// - Nie wiemy ile kroków wymaga API (dowiemy się z help)
		// - Przy 503 tool zwraca błąd i LLM musi zdecydować co dalej
		// - Lepiej mieć zapas niż przerwać w połowie sekwencji
		//
		// Model: gpt-4.1-mini — dobry balans cena/jakość dla tool calling.
		// Lekcja mówi: "modele, które potrzebują więcej kroków, szybciej
		// wyczerpią limit" — mini jest precyzyjny i nie marnuje wywołań.

		const result = await ctx.llm.chat({
			model: "openai/gpt-4.1-mini",
			system: systemPrompt,
			messages: [
				{
					role: "user",
					content:
						"Activate railway route X-01. Analyze the API documentation and execute all required actions in the correct sequence.",
				},
			],
			tools: [tool],
			maxIterations: 20,
		});

		// ──────────────────────────────────────────────
		// FAZA 4: Podsumowanie
		// ──────────────────────────────────────────────

		ctx.log.step("Agent zakończył pracę");
		ctx.log.info(result.content);

		// Sprawdź flagę w końcowej odpowiedzi LLM (jeśli nie złapana wcześniej)
		if (!flagFound) {
			const finalFlag = result.content.match(/\{FLG:[^}]+\}/);
			if (finalFlag) {
				ctx.log.flag({ code: 0, message: finalFlag[0] });
			} else {
				ctx.log.warn("Flaga nie została znaleziona w odpowiedziach API");
			}
		}
	},
} satisfies TaskDefinition;
