# 02_01_agentic_rag — Wyjaśnienie przykładu

---

# Porcja 1: Ogólna architektura — „co tu w ogóle jest?"

Przykład `02_01_agentic_rag` to **interaktywny agent konwersacyjny**, który potrafi przeszukiwać pliki z lekcjami AI_devs i odpowiadać na pytania na ich podstawie. Działa w terminalu (REPL — Read-Eval-Print Loop).

## Struktura plików

```
02_01_agentic_rag/
├── app.js                 ← punkt wejścia (uruchomienie)
├── mcp.json               ← konfiguracja serwera MCP (dostęp do plików)
├── package.json           ← zależności (tylko @modelcontextprotocol/sdk)
├── src/
│   ├── agent.js           ← główna pętla agenta (mózg)
│   ├── config.js          ← konfiguracja modelu + prompt systemowy
│   ├── repl.js            ← interfejs terminala (input/output)
│   ├── mcp/
│   │   └── client.js      ← klient MCP (komunikacja z serwerem plików)
│   └── helpers/
│       ├── api.js         ← komunikacja z LLM (OpenAI/OpenRouter API)
│       ├── logger.js      ← kolorowe logi w terminalu
│       ├── shutdown.js    ← obsługa graceful shutdown
│       └── stats.js       ← śledzenie zużycia tokenów
└── demo/
    └── example.md         ← nagrany przykład sesji
```

## Przepływ danych

```
Użytkownik → REPL → Agent → LLM (model językowy)
                       ↕
                   MCP Server (operacje na plikach)
```

1. Użytkownik wpisuje pytanie w terminalu
2. Agent wysyła je do LLM razem z historią konwersacji i listą dostępnych narzędzi
3. LLM decyduje: odpowiedzieć, czy najpierw użyć narzędzia (np. przeszukać pliki)
4. Jeśli narzędzie — MCP Server wykonuje operację na plikach, wynik wraca do LLM
5. Pętla powtarza się aż LLM uzna, że ma wystarczający kontekst do odpowiedzi
6. Odpowiedź wyświetlana użytkownikowi, historia zapisywana na potrzeby kolejnych pytań

## Kluczowy wzorzec

Agent sam decyduje, ile razy i jakie narzędzia wywoła. Nie ma sztywnego przepływu — to LLM steruje procesem eksploracji plików. Dlatego mówi się o **agentic** RAG (w odróżnieniu od klasycznego RAG, gdzie wyszukiwanie jest jednorazowe i deterministyczne).

---

# Porcja 2: Punkt wejścia — `app.js`

To jest „main" całej aplikacji. Plik jest krótki, ale pokazuje ważny wzorzec — **sekwencję inicjalizacji agenta**.

## Co się dzieje krok po kroku

```
1. Pokaż ostrzeżenie o tokenach → zapytaj czy kontynuować
2. Połącz się z MCP Server (dostęp do plików)
3. Pobierz listę dostępnych narzędzi
4. Stwórz interfejs readline (terminal input)
5. Zarejestruj graceful shutdown (sprzątanie przy Ctrl+C)
6. Uruchom pętlę REPL (interakcja z użytkownikiem)
```

## Kluczowe elementy

**Potwierdzenie uruchomienia** (linie 14-30) — agent może zużyć dużo tokenów, więc przed startem pyta użytkownika. Praktyczny detal: wskazuje plik `demo/example.md` jako alternatywę (nagrany przykład sesji, zero kosztów).

**Inicjalizacja MCP** (linie 41-44):
```js
mcpClient = await createMcpClient();
const mcpTools = await listMcpTools(mcpClient);
```
Najpierw tworzy połączenie z serwerem MCP, potem pobierz listę narzędzi. Te narzędzia (np. `list_files`, `search_files`, `read_file`) zostaną później przekazane do LLM, żeby wiedział, czym może operować.

**Graceful shutdown** (linie 48-52):
```js
const shutdown = onShutdown(async () => {
  logStats();        // pokaż statystyki tokenów
  rl?.close();       // zamknij readline
  if (mcpClient) await closeMcpClient(mcpClient);  // zamknij MCP
});
```
Rejestruje handler na `SIGINT`/`SIGTERM` (Ctrl+C). Ważne: **najpierw loguje statystyki** (ile tokenów zużyto), potem sprząta zasoby. Bez tego po Ctrl+C nie zobaczyłbyś podsumowania kosztów.

**REPL** (linia 54) — tu zaczyna się właściwa interakcja. `runRepl` dostaje trzy rzeczy: klienta MCP, listę narzędzi, readline. Od tego momentu użytkownik rozmawia z agentem.

## Wzorzec architektoniczny

`app.js` to **orkiestrator** — sam nie zawiera logiki biznesowej. Łączy moduły, zarządza cyklem życia (init → run → cleanup) i obsługuje błędy na najwyższym poziomie. Każdy moduł (MCP, REPL, shutdown, stats) jest niezależny.

---

# Porcja 3: Konfiguracja i prompt systemowy — `src/config.js`

Ten plik to **mózg decyzyjny agenta zakodowany w tekście**. Choć jest krótki, to właśnie tu definiuje się, jak agent myśli i działa.

## Parametry modelu

```js
export const api = {
  model: resolveModelForProvider("gpt-5.2"),
  maxOutputTokens: 16384,
  reasoning: { effort: "medium", summary: "auto" },
```

- **model** — `resolveModelForProvider` to helper, który dodaje prefix `openai/` gdy używasz OpenRoutera (bo OpenRouter wymaga formatu `openai/gpt-5.2`)
- **maxOutputTokens: 16384** — limit odpowiedzi modelu. Wysoki, bo agent może generować długie syntezy z wielu dokumentów
- **reasoning** — model ma wbudowany tryb "myślenia". `effort: "medium"` to kompromis — nie marnuje tokenów na proste zapytania, ale potrafi rozumować przy trudniejszych. `summary: "auto"` oznacza, że podsumowanie reasoning jest generowane automatycznie

## Prompt systemowy — sekcje

Prompt ma **4 sekcje**, każda pełni inną rolę. To bezpośrednie odzwierciedlenie tego, co lekcja S02E01 nazywa **generalizowaniem zasad**:

**1. Wstęp** (kim jesteś, co masz robić):
> "You are an agent that answers questions by searching and reading available documents."

Krótko i na temat. Nie mówi JAK szukać — to jest w kolejnych sekcjach.

**2. SEARCH GUIDANCE** — serce agenta. Cztery fazy:
- **Scan** — zacznij od przeglądu struktury (foldery, pliki, nagłówki)
- **Deepen** — iteracyjne pogłębianie: szukaj → czytaj fragmenty → zbieraj nowe terminy → szukaj ponownie → powtarzaj
- **Explore** — szukaj powiązań: przyczyna/skutek, problem/rozwiązanie, ograniczenia/obejścia
- **Verify coverage** — zanim odpowiesz, sprawdź czy masz wszystko

Te zasady są **generyczne** — nie mówią "szukaj frazy X w pliku Y". Działają niezależnie od tego, jakie dokumenty wrzucisz do workspace.

**3. EFFICIENCY** — ograniczniki:
```
- NEVER read entire files upfront
- Do NOT jump to reading fragments after just one or two searches
- Exhaust your keyword variations first
```

Bez tej sekcji agent miałby tendencję do natychmiastowego czytania całych plików (kosztowne w tokenach). Te reguły wymuszają strategię: **najpierw szukaj, potem czytaj tylko to, co potrzebne**.

**4. CONTEXT** — jedyny fragment specyficzny dla tego zastosowania:
> "Your knowledge base consists of AI_devs course materials stored as S01*.md files. The content is written in Polish — use Polish keywords when searching."

Lekcja podkreślała, że agent sam odkrył, iż dokumenty są po polsku (obserwacja otoczenia). Ale autor zdecydował się dodać tę wskazówkę do promptu — bo to **tani sposób na uniknięcie pierwszej nieudanej iteracji** (szukanie po angielsku, brak wyników, dopiero potem korekta).

## Dlaczego to jest dobrze zaprojektowane?

Prompt rozdziela **co agent ma robić** (SEARCH GUIDANCE) od **jak ma to robić efektywnie** (EFFICIENCY) od **gdzie** (CONTEXT). Gdybyś podmienił CONTEXT na "dokumenty prawne po angielsku w formacie PDF" — reszta promptu nadal działa. To właśnie ta **generalizacja**, o której mówi lekcja.

---

# Porcja 4: MCP — czym jest i jak działa klient (`mcp.json` + `src/mcp/client.js`)

## Czym jest MCP?

**Model Context Protocol** — otwarty standard (stworzony przez Anthropic) definiujący, jak aplikacja AI komunikuje się z zewnętrznymi narzędziami. Zamiast pisać integrację z każdym narzędziem osobno, MCP daje uniwersalny interfejs:

```
Aplikacja AI  ←→  MCP Client  ←→  MCP Server  ←→  Zasoby (pliki, bazy, API...)
```

Pomyśl o tym jak o **USB dla AI** — jeden standard, wiele urządzeń. W tym przykładzie "urządzeniem" jest serwer plików (`files-mcp`), który udostępnia operacje na systemie plików.

## Konfiguracja — `mcp.json`

```json
{
  "mcpServers": {
    "files": {
      "command": "npx",
      "args": ["tsx", "../mcp/files-mcp/src/index.ts"],
      "env": {
        "LOG_LEVEL": "info",
        "FS_ROOT": "."
      }
    }
  }
}
```

- **`"files"`** — nazwa serwera (można mieć wiele: `"files"`, `"database"`, `"web"` itd.)
- **`command` + `args`** — jak uruchomić serwer. Tu: `npx tsx` odpala TypeScriptowy plik serwera
- **`FS_ROOT: "."`** — korzeń systemu plików dla agenta. Kropka = katalog projektu. Agent nie wyjdzie poza ten folder (sandboxing)

## Klient MCP — `src/mcp/client.js`

Plik eksportuje 5 funkcji:

**`createMcpClient()`** — nawiązuje połączenie z serwerem:
```js
const transport = new StdioClientTransport({
  command: serverConfig.command,   // "npx"
  args: serverConfig.args,         // ["tsx", "../mcp/files-mcp/src/index.ts"]
  env: { PATH, HOME, ...serverConfig.env },
  cwd: PROJECT_ROOT,
  stderr: "inherit"                // błędy serwera widoczne w terminalu
});
await client.connect(transport);
```

Kluczowy detal: transport to **stdio** — klient i serwer komunikują się przez stdin/stdout jak dwa procesy w pipe. Serwer MCP jest **osobnym procesem** uruchamianym jako child process.

**`listMcpTools()`** — pyta serwer "jakie masz narzędzia?":
```js
const result = await client.listTools();
return result.tools;  // np. [{name: "list_files", description: "...", inputSchema: {...}}, ...]
```

**`callMcpTool()`** — wywołuje konkretne narzędzie. Wynik próbuje sparsować jako JSON, a jak się nie da — zwraca surowy tekst.

**`mcpToolsToOpenAI()`** — **most między MCP a LLM**:
```js
mcpTools.map((tool) => ({
  type: "function",
  name: tool.name,
  description: tool.description,
  parameters: tool.inputSchema,
  strict: false
}));
```

MCP definiuje narzędzia w swoim formacie, ale API OpenAI oczekuje formatu `function`. Ta funkcja tłumaczy jedno na drugie. Dzięki temu **agent LLM nie wie, że używa MCP** — widzi zwykłe function calls.

**`closeMcpClient()`** — zamknięcie z obsługą błędów (serwer mógł już się wyłączyć).

## Dlaczego MCP zamiast zwykłych funkcji?

Mógłbyś napisać `fs.readdir()` i `fs.readFile()` bezpośrednio. Ale MCP daje:
- **Standaryzację** — zamień serwer plików na serwer bazy danych bez zmiany kodu agenta
- **Izolację** — serwer działa w osobnym procesie, agent nie ma bezpośredniego dostępu do fs
- **Reużywalność** — ten sam serwer MCP możesz podpiąć pod Claude Desktop, Cursor, czy innego klienta

---

# Porcja 5: Główna pętla agenta — `src/agent.js`

To jest **najważniejszy plik** w całym przykładzie. Implementuje wzorzec "agentic loop" — pętlę, w której LLM sam decyduje, kiedy skończyć.

## Wykonanie narzędzi

```js
const runTool = async (mcpClient, toolCall) => {
  const args = JSON.parse(toolCall.arguments);
  const result = await callMcpTool(mcpClient, toolCall.name, args);
  return { type: "function_call_output", call_id: toolCall.call_id, output: JSON.stringify(result) };
};

const runTools = (mcpClient, toolCalls) =>
  Promise.all(toolCalls.map(tc => runTool(mcpClient, tc)));
```

Dwa detale:
- **`call_id`** — każde wywołanie narzędzia ma unikalny identyfikator. LLM wysyła `call_id` w żądaniu, a my go zwracamy z wynikiem. Dzięki temu model wie, który wynik odpowiada któremu wywołaniu.
- **`Promise.all`** — jeśli LLM zażąda kilku narzędzi naraz, wszystkie wykonują się **równolegle**. Oszczędność czasu.

## Pętla agenta — `run()`

Serce systemu. Rozbijmy ją na etapy:

**Przygotowanie:**
```js
const tools = mcpToolsToOpenAI(mcpTools);
const messages = [...conversationHistory, { role: "user", content: query }];
```
Tłumaczy narzędzia MCP na format OpenAI i buduje tablicę wiadomości: wcześniejsza historia + nowe pytanie.

**Pętla:**
```
for (let step = 1; step <= MAX_STEPS; step++) {
    1. Wyślij messages + tools do LLM
    2. Odbierz odpowiedź
    3. Sprawdź: czy LLM chce wywołać narzędzia?
       ├─ NIE → zwróć tekst odpowiedzi + historię → KONIEC
       └─ TAK → wykonaj narzędzia → dodaj wyniki do messages → wróć do 1.
}
```

Wizualnie dla zapytania "co mówią lekcje o cache?":

```
Krok 1: LLM → "chcę list_files(.)"              → wynik: [s01e01.md, s01e02.md, ...]
Krok 2: LLM → "chcę search_files('cache')"       → wynik: [s01e02.md:42, s01e05.md:88, ...]
Krok 3: LLM → "chcę read_file(s01e02.md, 40-50)" → wynik: "...fragment o cache..."
Krok 4: LLM → "chcę read_file(s01e05.md, 85-95)" → wynik: "...fragment o cache..."
Krok 5: LLM → (brak tool calls) → "Cache jest omawiany w dwóch lekcjach..." → KONIEC
```

**Warunek zakończenia:**
```js
if (toolCalls.length === 0) {
  const text = extractText(response) ?? "No response";
  messages.push(...response.output);
  return { response: text, conversationHistory: messages };
}
```
Gdy LLM nie żąda żadnych narzędzi — to sygnał, że ma wystarczający kontekst i jest gotowy odpowiedzieć.

**Akumulacja kontekstu:**
```js
messages.push(...response.output);   // dodaj odpowiedź LLM (z tool calls)
const results = await runTools(mcpClient, toolCalls);
messages.push(...results);           // dodaj wyniki narzędzi
```
Każdy krok **dodaje** do `messages`. LLM w kolejnym kroku widzi **całą dotychczasową historię** — swoje wcześniejsze decyzje i wyniki narzędzi. Dzięki temu może budować coraz lepsze zapytania (to jest ta "obserwacja otoczenia" z lekcji).

**Safety net:**
```js
throw new Error(`Max steps (${MAX_STEPS}) reached`);
```
50 kroków to zabezpieczenie przed nieskończoną pętlą (i nieskończonymi kosztami).

## `createConversation()`

```js
export const createConversation = () => ({ history: [] });
```

Fabryka pustego stanu konwersacji. Każda nowa rozmowa zaczyna z czystą historią. Ale **między pytaniami w tej samej sesji** historia jest zachowana — dlatego możesz zadawać pytania uzupełniające i agent pamięta kontekst.

---

# Porcja 6: Komunikacja z LLM — `src/helpers/api.js`

Ten plik to **warstwa transportowa** — odpowiada za wysyłanie requestów do API modelu i parsowanie odpowiedzi.

## Funkcja `chat()`

```js
export const chat = async ({
  model = api.model,
  input,
  tools,
  toolChoice = "auto",
  instructions = api.instructions,
  maxOutputTokens = api.maxOutputTokens,
  reasoning = api.reasoning
}) => {
```

Wszystkie parametry mają **domyślne wartości z `config.js`**. Dzięki temu w `agent.js` wystarczy:
```js
const response = await chat({ input: messages, tools });
```

Warunki `if` przy budowaniu body sprawiają, że do requestu trafiają **tylko te pola, które są potrzebne**. Wysyłanie pustej tablicy `tools: []` mogłoby zmylić API.

`tool_choice: "auto"` mówi modelowi: "sam zdecyduj, czy chcesz użyć narzędzia, czy odpowiedzieć tekstem". To jest kluczowe dla wzorca agentic — model sam steruje przepływem.

**Ważne:** to jest **Responses API** (OpenAI), nie starsze Chat Completions API. Różnica:
- `input` zamiast `messages`
- `instructions` zamiast wiadomości z `role: "system"`
- odpowiedź w `output[]` zamiast `choices[].message`

`recordUsage(data.usage)` po każdym requeście rejestruje zużycie tokenów w globalnym liczniku.

## Ekstrakcja danych z odpowiedzi

Responses API zwraca tablicę `output[]` zawierającą **mieszankę różnych typów**. Trzy helpery wyciągają to, co potrzebne:

**`extractToolCalls()`** — filtruje elementy typu `function_call`:
```js
response.output.filter((item) => item.type === "function_call");
// → [{name: "search_files", arguments: '{"query":"cache"}', call_id: "abc123"}]
```

**`extractText()`** — wyciąga tekst odpowiedzi. Zwraca `null` jeśli model wywołał narzędzia zamiast generować tekst.

**`extractReasoning()`** — wyciąga reasoning (wewnętrzne "myślenie" modelu). Powiązane z `reasoning: { summary: "auto" }` z configa — model myśli "w głowie", a tu wyciągamy streszczenie do logowania.

## Kluczowy wzorzec: odpowiedź to ALBO narzędzia ALBO tekst

W jednej odpowiedzi model zwraca:
- **Tool calls** → agent jest w trakcie pracy (szuka, czyta)
- **Tekst** → agent skończył i daje odpowiedź

To jest "sygnał stopu" z pętli w `agent.js`: `if (toolCalls.length === 0)` → koniec.

---

# Porcja 7: REPL i helpery — `repl.js`, `stats.js`, `shutdown.js`

## REPL — `src/repl.js`

Interfejs użytkownika. Prosta pętla `while(true)` z trzema komendami:

```js
while (true) {
  const input = await rl.question("You: ");

  if (input === "exit")  → break (koniec)
  if (input === "clear") → resetuj konwersację + statystyki
  if (pusty)             → continue (ignoruj)

  // Właściwe pytanie:
  const result = await run(input, { mcpClient, mcpTools, conversationHistory });
  conversation.history = result.conversationHistory;
}
```

Kluczowe miejsce — **mechanizm pamięci między pytaniami**:
```js
const result = await run(input, {
  mcpClient, mcpTools,
  conversationHistory: conversation.history  // ← przekaż dotychczasową historię
});
conversation.history = result.conversationHistory;  // ← zaktualizuj historię
```

Każde wywołanie `run()` dostaje historię i zwraca ją rozszerzoną. Dzięki temu po pytaniu "opowiedz o cache" możesz zapytać "a w której lekcji?" i agent wie, o czym mówisz.

Komenda **`clear`** resetuje zarówno historię jak i statystyki — czysta sesja bez zmiany procesu.

`.catch(() => "exit")` — jeśli readline zamknięty z zewnątrz (Ctrl+D), traktuje to jak "exit" zamiast rzucać błąd.

## Stats — `src/helpers/stats.js`

Globalny licznik tokenów. Wzorzec: **moduł ze stanem** (mutable singleton):

```js
let totalTokens = { input: 0, output: 0, reasoning: 0, cached: 0, requests: 0 };
```

- **`recordUsage()`** — wywoływany po każdym requeście, sumuje tokeny
- **`logStats()`** — formatuje: `"5 requests, 12400 in (8200 cached), 3100 out (800 reasoning + 2300 visible)"`
- **`resetStats()`** — zeruje (przy `clear`)

Rozróżnienie **cached vs. non-cached** tokenów jest powiązane z lekcją S02E01 o **prompt cache**. Cached tokeny są tańsze (zwykle 50%), więc śledzenie ich udziału mówi, jak dobrze zaprojektowałeś prompt pod kątem kosztów.

Podział output na **reasoning vs. visible** — reasoning to tokeny "myślenia" (nie widzisz ich w odpowiedzi), visible to faktyczny tekst. Za oba płacisz.

## Shutdown — `src/helpers/shutdown.js`

Najprostszy moduł — 19 linii. Ważny detal:

```js
let shuttingDown = false;
const handler = async () => {
  if (shuttingDown) return;  // ← guard
  shuttingDown = true;
  await cleanup();
  process.exit(0);
};
```

**`shuttingDown` flag** — bez tego dwukrotne Ctrl+C wywołałoby `cleanup()` dwa razy (np. zamykanie MCP klienta, który już jest zamykany). Klasyczny wzorzec "idempotent shutdown".

Funkcja **zwraca handler** — dzięki temu `app.js` może go wywołać ręcznie po zakończeniu REPL, nie tylko przy sygnale systemowym.

---

# Porcja 8: Podsumowanie — jak to wszystko łączy się w całość

## Przepływ od startu do odpowiedzi

```
app.js           repl.js          agent.js           api.js          mcp/client.js
  │                 │                 │                  │                 │
  ├─ confirmRun()   │                 │                  │                 │
  ├─ createMcpClient() ─────────────────────────────────────────────────►│ spawn
  ├─ listMcpTools() ────────────────────────────────────────────────────►│ tools
  ├─ runRepl() ────►│                 │                  │                 │
  │                 ├─ "You: "        │                  │                 │
  │                 ├─ run(query) ───►│                  │                 │
  │                 │                 ├─ chat() ────────►│ POST LLM        │
  │                 │                 │◄─ tool_calls ────│                 │
  │                 │                 ├─ runTools() ────────────────────►│ callMcpTool()
  │                 │                 │◄─ results ──────────────────────│
  │                 │                 ├─ chat() ────────►│ POST LLM        │
  │                 │                 │◄─ text ──────────│                 │
  │                 │◄─ {response} ───│                  │                 │
  │                 ├─ "Assistant: ..." │                 │                 │
```

## Mapowanie na koncepcje z lekcji S02E01

| Koncepcja z lekcji | Gdzie w kodzie |
|---|---|
| **Generalizowanie instrukcji** | `config.js` — sekcje SEARCH GUIDANCE i EFFICIENCY działają niezależnie od treści dokumentów |
| **Obserwacja otoczenia** | `agent.js` pętla — LLM widzi wyniki narzędzi i adaptuje kolejne zapytania |
| **Agentic RAG / Agentic Search** | cała pętla w `agent.js` — wieloetapowe szukanie sterowane przez model |
| **Prompt cache** | `config.js` — statyczny prompt systemowy + `stats.js` śledzi cached tokeny |
| **Sygnał vs. szum** | `config.js` sekcja EFFICIENCY — "never read entire files", "exhaust keyword variations first" |
| **Kontekst poza oknem** | MCP server — pliki istnieją na dysku, agent sięga po nie na żądanie |

## Czego ten przykład **nie** pokazuje (a lekcja omawia)

- **Modyfikowanie promptu systemowego w trakcie sesji** — tu prompt jest stały (co jest dobre dla cache)
- **System wieloagentowy** — jeden agent, jedna pętla
- **Workspace / współdzielenie plików między agentami** — brak podkatalogów inbox/outbox
- **Maskowanie kontekstu (prefilling)** — technika Manus, deprecated w Anthropic API
- **Tryb planowania** — brak explicit plan mode

## Architektoniczny takeaway

Cały agent to **~200 linii kodu** rozłożone na 7 plików. Złożoność nie jest w kodzie — jest w **prompcie** i **wzorcu pętli**. Kod robi trzy rzeczy:
1. Łączy LLM z narzędziami (MCP)
2. Przekazuje kontekst między krokami (messages array)
3. Pozwala LLM decydować o przepływie (tool_choice: "auto")

Reszta inteligencji jest w modelu + w instrukcji systemowej. To jest esencja tego, co lekcja nazywa przesuwaniem granicy między **logiką w kodzie** a **logiką realizowaną przez AI**.
