# Plan implementacji Mission Control

> Dokument rozbija etap 1 (CLI Task Runner) z PRD na atomowe kroki implementacyjne.
> Każdy krok kończy się **weryfikowalnym rezultatem** — można go uruchomić/przetestować.

---

## Krok 1: Scaffold monorepo

**Cel:** Działająca struktura pnpm workspaces z TypeScript, Biome i wspólną konfiguracją.

### Pliki do stworzenia:

```
package.json              # workspace root, scripts: "task" → "pnpm --filter @mission/cli start"
pnpm-workspace.yaml       # packages: ["packages/*"]
tsconfig.base.json        # strict, ESM, target ES2024, paths
.env.example              # OPENROUTER_API_KEY=, AG3NTS_API_KEY=
.gitignore                # node_modules, dist, .env, *.tsbuildinfo
biome.json                # formatter + linter config
```

```
packages/core/
├── package.json          # name: @mission/core, type: module, exports
├── tsconfig.json         # extends ../../tsconfig.base.json
└── src/
    └── index.ts          # pusty barrel export (placeholder)

packages/cli/
├── package.json          # name: @mission/cli, depends on @mission/core, bin: mission
├── tsconfig.json         # extends ../../tsconfig.base.json
└── src/
    └── index.ts          # placeholder: console.log("Mission Control CLI")
```

### Decyzje:
- **tsx** jako dev runner (zero build step w dev) — `tsx packages/cli/src/index.ts`
- **tsconfig.base.json** z `composite: true` i project references dla incremental builds
- Node.js 24 — `"engines": { "node": ">=24" }` w root package.json
- `"type": "module"` we wszystkich package.json

### Weryfikacja:
```bash
pnpm install              # instalacja działa
pnpm --filter @mission/cli start   # wypisuje "Mission Control CLI"
pnpm biome check .        # zero błędów
```

---

## Krok 2: Typy i kontrakty (`core/types.ts`)

**Cel:** Zdefiniować wszystkie interfejsy zanim zaczniemy implementację — reszta kodu będzie typowana od początku.

### `packages/core/src/types.ts`:

```typescript
// TaskDefinition — kontrakt eksportowany przez każdy task
interface TaskDefinition {
  name: string;
  title: string;
  season: number;
  episode: number;
  server?: boolean;        // czy potrzebuje HTTP servera
  run(ctx: TaskContext): Promise<void>;
}

// TaskContext — wstrzykiwane do run()
interface TaskContext {
  hub: HubClient;
  llm: LLMClient;
  log: Logger;
  data: string;            // ścieżka do katalogu data/ taska
  server: TaskServer;      // null jeśli task nie deklaruje server: true
  env: EnvConfig;
}

// HubClient
interface HubClient {
  verify(task: string, answer: unknown): Promise<HubResponse>;
  fetchData(path: string): Promise<string | Buffer>;
  post(endpoint: string, body: unknown): Promise<unknown>;
}

interface HubResponse {
  code: number;
  message: string;
}

// LLMClient
interface LLMClient {
  chat(opts: ChatOptions): Promise<ChatResult>;
  structured<T>(opts: StructuredOptions): Promise<T>;
}

interface ChatOptions {
  model?: string;
  system?: string;
  messages: Message[];
  tools?: ToolDefinition[];
  maxIterations?: number;
}

interface StructuredOptions {
  model?: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;  // JSON Schema
  images?: string[];
}

interface ChatResult {
  content: string;
  usage: TokenUsage;
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;  // USD
}

// Logger
interface Logger {
  step(msg: string): void;
  success(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  flag(result: HubResponse): void;
  info(msg: string): void;
  detail(msg: string): void;    // wcięty sub-info
}

// TaskServer
interface TaskServer {
  app: Hono;
  start(port?: number): Promise<{ url: string; port: number }>;
  stop(): Promise<void>;
  url: string;
}

// Tool definitions (Function Calling)
interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;  // JSON Schema
  execute: (args: unknown) => Promise<unknown>;
}

// Message (OpenAI-compatible)
interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

// Env
interface EnvConfig {
  openrouterApiKey: string;
  ag3ntsApiKey: string;
  [key: string]: string;
}

// Task status tracking
interface TaskStatus {
  status: "new" | "pending" | "completed" | "failed";
  flag?: string;
  lastRun?: string;
  cost?: number;
}
```

### Weryfikacja:
- `pnpm biome check .` przechodzi
- Import typów z `@mission/core` w cli działa (TSC nie zgłasza błędów)

---

## Krok 3: Konfiguracja środowiska (`core/env.ts`)

**Cel:** Ładowanie i walidacja zmiennych środowiskowych z `.env`.

### `packages/core/src/env.ts`:
- Używa wbudowanego `--env-file=.env` z Node.js 24 (lub `dotenv` jako fallback)
- Eksportuje `loadEnv(): EnvConfig`
- Rzuca czytelny błąd jeśli brakuje wymaganych zmiennych (`OPENROUTER_API_KEY`, `AG3NTS_API_KEY`)

### Uwagi:
- Node.js 24 ma natywne `--env-file` — ale pnpm scripts mogą nie przekazać flagi, więc lepiej użyć `dotenv` w kodzie i dodać go jako dependency core
- Alternatywnie: zero dependency — ręczny parser `.env` (kilka linii) — warto rozważyć

### Weryfikacja:
- Bez `.env` → czytelny error
- Z `.env` → poprawny obiekt EnvConfig

---

## Krok 4: Hub API Client (`core/hub.ts`)

**Cel:** Komunikacja z `https://hub.ag3nts.org` — wysyłanie odpowiedzi (`verify`) i pobieranie danych.

### Implementacja:
- `createHubClient(env: EnvConfig): HubClient`
- `verify(task, answer)` → POST `https://hub.ag3nts.org/verify` z `{ apikey, task, answer }`
- `fetchData(path)` → GET `https://hub.ag3nts.org/dane/{path}` — auto-detect `text` vs `buffer` na podstawie content-type
- `post(endpoint, body)` → generyczny POST z apikey
- Logowanie requestów/response (callback do loggera)
- Obsługa błędów HTTP (retry na 503 z backoff — lekcja S01E05 podkreśla to)

### Zależności:
- `env.ts` (krok 3) — potrzebuje `AG3NTS_API_KEY`
- Natywny `fetch` (Node.js 24)

### Weryfikacja:
- Unit test (vitest): mockowany fetch, sprawdzenie payloadu
- Opcjonalnie: ręczny test z prawdziwym API key (`pnpm tsx test-hub.ts`)

---

## Krok 5: Logger CLI (`cli/logger.ts`)

**Cel:** Kolorowy, czytelny output w terminalu z ikonami i wcięciami.

### Implementacja:
- Użyj `chalk` do kolorów (jedyny dependency CLI poza core)
- Implementuje interfejs `Logger` z `types.ts`
- Metody:
  - `step(msg)` → `  ⬇  msg` (cyan)
  - `success(msg)` → `  ✓  msg` (green)
  - `warn(msg)` → `  ⚠  msg` (yellow)
  - `error(msg)` → `  ✗  msg` (red)
  - `flag(result)` → `  🏁  {FLG:...}` (bold magenta) lub error jeśli code !== 0
  - `info(msg)` → `  ℹ  msg` (dim)
  - `detail(msg)` → `     msg` (dim, wcięty — sub-info bez ikony)
- `createBanner(task: TaskDefinition)` → rysuje box z nazwą taska (jak w PRD)
- `createSummary(stats)` → linia podsumowująca (koszt, wywołania LLM, czas)

### Zależności:
- `chalk` (jedyna zależność)

### Weryfikacja:
- Odpalenie demo scriptu wyświetlającego wszystkie typy logów
- Wizualna inspekcja w terminalu

---

## Krok 6: LLM Client (`core/llm.ts`)

**Cel:** Cienki wrapper na OpenRouter API z obsługą structured output i tool calling loop.

### Implementacja:

#### `createLLMClient(env: EnvConfig, logger: Logger): LLMClient`

**`chat(opts)`:**
- POST do `https://openrouter.ai/api/v1/chat/completions`
- Header: `Authorization: Bearer ${env.openrouterApiKey}`
- Jeśli `opts.tools` podane → tool calling loop (max `opts.maxIterations` iteracji, domyślnie 5)
- W każdej iteracji: jeśli `finish_reason === "tool_calls"` → wykonaj narzędzia → dodaj wyniki → powtórz
- Loguje każdą iterację i koszt tokenów
- Zwraca `ChatResult` z contentem i usage

**`structured<T>(opts)`:**
- Używa `response_format: { type: "json_schema", json_schema: { name: "response", schema: opts.schema } }`
- Buduje messages z `system` + `user`
- Parsuje odpowiedź jako JSON i zwraca T
- Jeśli model nie obsługuje json_schema → fallback na prompt-based JSON extraction

**Śledzenie kosztów:**
- Cennik modeli jako prosta mapa `model → { input: $/1M, output: $/1M }`
- Obliczanie kosztu z `usage.prompt_tokens` i `usage.completion_tokens`
- Domyślny model: `anthropic/claude-haiku-4.5` (tani, szybki)

### Zależności:
- `env.ts` (krok 3) — `OPENROUTER_API_KEY`
- `types.ts` (krok 2) — Message, ToolCall, ToolDefinition
- Logger (krok 5) — logowanie iteracji i kosztów

### Wzorzec z istniejącego kodu:
Bazujemy na `lessons/zadania/01-03/src/llm.ts` — ten sam pattern, ale:
- Wyciągnięte z jednego taska do reużywalnego modułu
- Dodane śledzenie tokenów/kosztów
- Dodany structured output
- Logger zamiast `console.log`

### Weryfikacja:
- Unit test: mockowany fetch, sprawdzenie tool calling loop (2 iteracje)
- Unit test: structured output parsowanie
- Opcjonalnie: test z prawdziwym API (`pnpm tsx test-llm.ts`)

---

## Krok 7: Task Registry (`core/task-registry.ts`)

**Cel:** Automatyczne odkrywanie tasków ze skanowania `tasks/*/index.ts`.

### Implementacja:

```typescript
async function discoverTasks(tasksDir: string): Promise<Map<string, TaskDefinition>>
```

- Skanuje `tasks/*/index.ts` za pomocą `fs.readdir` + `fs.stat`
- Dynamiczny import każdego `index.ts` (`await import(path)`)
- Walidacja: każdy moduł musi eksportować default satisfying `TaskDefinition`
- Buduje `Map<name, TaskDefinition>`
- Sortuje po `season` → `episode`

**Status tracking:**
```typescript
function loadStatus(tasksDir: string): Record<string, TaskStatus>
function saveStatus(tasksDir: string, status: Record<string, TaskStatus>): void
```
- Czyta/zapisuje `tasks/.status.json`
- Aktualizacja po zakończeniu taska (completed/failed, flag, koszt)

### Weryfikacja:
- Stworzenie dummy taska `tasks/s00e00-test/index.ts`
- `discoverTasks()` znajduje go i poprawnie parsuje
- Usunięcie dummy taska po teście

---

## Krok 8: File helpers (`core/files.ts`)

**Cel:** Proste helpery do zarządzania plikami danych taska.

### Implementacja:
- `getDataDir(taskDir: string): string` — zwraca/tworzy `{taskDir}/data/`
- `readDataFile(taskDir: string, filename: string): string | Buffer`
- `writeDataFile(taskDir: string, filename: string, content: string | Buffer): void`
- `dataFileExists(taskDir: string, filename: string): boolean`

### Uwagi:
- Proste wrappery na `fs/promises`
- Auto-tworzenie katalogu `data/` jeśli nie istnieje

### Weryfikacja:
- Unit test: zapis + odczyt pliku

---

## Krok 9: HTTP Server (`core/server.ts`)

**Cel:** Opcjonalny Hono server startowany gdy task deklaruje `server: true`.

### Implementacja:

```typescript
function createTaskServer(): TaskServer
```

- Tworzy instancję `new Hono()`
- `start(port?)` → `serve({ fetch: app.fetch, port })` z `@hono/node-server`
- Automatyczny wybór wolnego portu jeśli nie podany (port 0 → OS przydziela)
- `stop()` → zamyka serwer
- `url` → `http://localhost:${port}`
- Middleware: request logging, error handling

### Zależności:
- `hono` + `@hono/node-server`

### Weryfikacja:
- Test: start server → fetch endpointu → stop server

---

## Krok 10: Task Runner / CLI entry point (`cli/index.ts`)

**Cel:** Główny entry point CLI — parsowanie argumentów, budowanie contextu, uruchamianie taska.

### Implementacja:

**Parsowanie argumentów (ręczne, bez library):**
```bash
pnpm task <name>          # uruchom task
pnpm task --list          # lista tasków
pnpm task <name> --dry    # dry run
```

- `process.argv` parsowany ręcznie (3 argumenty max — nie potrzeba yargs)

**Flow uruchamiania taska:**
1. `loadEnv()` → walidacja zmiennych środowiskowych
2. `discoverTasks()` → buduje rejestr
3. Szuka taska po `name`
4. Buduje `TaskContext`:
   - `hub` ← `createHubClient(env)`
   - `llm` ← `createLLMClient(env, logger)`
   - `log` ← `createLogger()`
   - `data` ← ścieżka do `tasks/{taskDir}/data/`
   - `server` ← `createTaskServer()` (jeśli `task.server === true`)
   - `env` ← EnvConfig
5. Wyświetla banner
6. `await task.run(ctx)`
7. Wyświetla summary (koszt, czas, wywołania LLM)
8. Jeśli server był uruchomiony → `ctx.server.stop()`
9. Aktualizuje `.status.json`

**`--list`:**
- Tabela: season/episode, name, title, status (z `.status.json`)
- Kolorowe statusy: ✓ DONE (green), ○ PENDING (yellow), · NEW (dim), ✗ FAILED (red)

**`--dry`:**
- Ustawia flagę w contexcie
- Hub client w dry mode loguje co by wysłał, ale nie wysyła
- Przydatne do debugowania

**Error handling:**
- Try/catch wokół `task.run(ctx)`
- Czytelny error z stack trace (w dev) lub message (w prod)
- Aktualizacja statusu na "failed"

### UI (`cli/ui.ts`):
- `printBanner(task)` — box z headerem (jak w PRD)
- `printTaskList(tasks, statuses)` — tabelka z listą tasków
- `printSummary(stats)` — linia podsumowania

### Weryfikacja:
- `pnpm task --list` → wyświetla pustą tabelę (brak tasków)
- Po dodaniu dummy taska → pojawia się na liście

---

## Krok 11: Integracja i core barrel export

**Cel:** Upewnić się, że `@mission/core` eksportuje spójne publiczne API.

### `packages/core/src/index.ts`:
```typescript
export type { TaskDefinition, TaskContext, HubClient, LLMClient, ... } from './types.js';
export { createHubClient } from './hub.js';
export { createLLMClient } from './llm.js';
export { createTaskServer } from './server.js';
export { discoverTasks, loadStatus, saveStatus } from './task-registry.js';
export { loadEnv } from './env.js';
export { getDataDir, readDataFile, writeDataFile } from './files.js';
```

### Weryfikacja:
- Pełny dry-run: `pnpm task --list` działa end-to-end
- Wszystkie typy rozwiązują się poprawnie
- Biome check przechodzi

---

## Krok 12: Task S01E01 — `sendit` (deklaracja transportowa)

**Cel:** Pierwszy prawdziwy task — migracja z `lessons/zadania/01-04/send.ts`. Prosty task bez LLM — weryfikuje infrastrukturę hub.

> **Uwaga:** Mimo że plik jest w `01-04`, treść lekcji S01E01 opisuje task "sendit" jako ćwiczenie z pierwszej lekcji. Nazwa "sendit" pochodzi z verify endpointu.

### `tasks/s01e01-sendit/index.ts`:
- Pobiera dokumentację z `https://hub.ag3nts.org/dane/doc/index.md`
- Buduje deklarację transportową na podstawie reguł z dokumentacji
- Wysyła przez `ctx.hub.verify('sendit', { declaration })`
- Loguje wynik i flagę

### Migracja z starego kodu:
- Stary: bezpośredni fetch + hardcoded API key
- Nowy: `ctx.hub.fetchData('doc/index.md')` + `ctx.hub.verify()` + `ctx.log`

### Weryfikacja:
```bash
pnpm task sendit          # uruchamia task, odbiera flagę
pnpm task sendit --dry    # pokazuje co wyśle bez wysyłania
pnpm task --list          # sendit widoczny na liście
```

---

## Krok 13: Task S01E02 — `findhim` (zlokalizuj osobę)

**Cel:** Task korzystający z Hub API (location + access level). Bez LLM, ale z logiką biznesową.

### `tasks/s01e02-findhim/index.ts`:
- `ctx.hub.post('api/location', { name, surname })` — koordynaty osób
- `ctx.hub.post('api/accesslevel', { name, surname, birthYear })` — poziom dostępu
- Logika Haversine (odległość od elektrowni) — przeniesiona z `lessons/zadania/01-02/solution.js`
- Cache danych w `data/` (żeby nie odpytywać API wielokrotnie)
- `ctx.hub.verify('findhim', answer)`

### Weryfikacja:
```bash
pnpm task findhim         # uruchamia task, odbiera flagę
```

---

## Krok 14: Task S01E03 — `proxy` (agent z narzędziami)

**Cel:** Pierwszy task z LLM i function calling + HTTP server. Waliduje pełen stos: Hono server + LLM tool loop.

### `tasks/s01e03-proxy/index.ts`:
- `server: true` — potrzebuje endpointu HTTP
- Definiuje narzędzia: `check_package`, `redirect_package`
- Route `POST /` → przyjmuje `{ sessionID, msg }` → LLM z tools → odpowiedź
- Sesje w pamięci (Map)
- System prompt z regułami biznesowymi (przekierowanie paczek z reaktorem)
- Rejestracja URL w hubie

### Migracja z `lessons/zadania/01-03/`:
- Stary: Express + własny LLM client + dotenv
- Nowy: Hono (z `ctx.server.app`) + `ctx.llm.chat({ tools })` + `ctx.env`
- Reuse tool definitions z istniejącego kodu, ale adapted do `ToolDefinition` interfejsu

### Weryfikacja:
```bash
pnpm task proxy           # startuje server, rejestruje URL
# Hub wysyła requesty → serwer odpowiada → flaga
```

---

## Krok 15: Task S01E04 — `people` (filtrowanie + LLM tagging)

**Cel:** Task korzystający ze structured output LLM. Pobiera CSV, filtruje, taguje zawody przez LLM.

### `tasks/s01e04-people/index.ts`:
- `ctx.hub.fetchData('people.csv')` → parsowanie CSV
- Filtrowanie (logika biznesowa z danych)
- `ctx.llm.structured({ schema, system, user })` → tagowanie zawodów
- `ctx.hub.verify('people', tagged)`
- Cache CSV w `data/`

### Weryfikacja:
```bash
pnpm task people          # pobiera dane, filtruje, taguje, wysyła flagę
```

---

## Krok 16: Task S01E05 — `railway` (self-documenting API)

**Cel:** Task testujący interakcję z API z rate limitingiem i retry logic.

### `tasks/s01e05-railway/index.ts`:
- API z akcją `help` → self-documenting
- Rate limiting (nagłówki HTTP)
- Retry na 503 z exponential backoff
- Ograniczona liczba wywołań API do rozwiązania problemu
- Możliwe użycie LLM do planowania strategii zapytań

### Weryfikacja:
```bash
pnpm task railway         # rozwiązuje zadanie z rate-limitem
```

---

## Krok 17: Testy i quality gates

**Cel:** Minimalne testy + CI-ready setup.

### Vitest setup:
- `vitest.config.ts` w root
- `packages/core/src/__tests__/` — testy jednostkowe:
  - `hub.test.ts` — mockowany fetch, payloady
  - `llm.test.ts` — tool calling loop, structured output
  - `task-registry.test.ts` — discovery, status
- Skrypt: `pnpm test` → `vitest run`

### Biome:
- `pnpm lint` → `biome check .`
- `pnpm format` → `biome format --write .`

### Weryfikacja:
```bash
pnpm test                 # wszystkie testy przechodzą
pnpm lint                 # zero błędów
```

---

## Podsumowanie kolejności i zależności

```
Krok 1: Scaffold monorepo
  │
  ├─→ Krok 2: Typy (types.ts)
  │     │
  │     ├─→ Krok 3: Env config
  │     │     │
  │     │     ├─→ Krok 4: Hub API client
  │     │     │
  │     │     └─→ Krok 6: LLM client ←── Krok 5: Logger
  │     │
  │     ├─→ Krok 5: Logger CLI
  │     │
  │     ├─→ Krok 7: Task Registry
  │     │
  │     ├─→ Krok 8: File helpers
  │     │
  │     └─→ Krok 9: HTTP Server (Hono)
  │
  └─→ Krok 10: CLI entry point (łączy wszystko)
        │
        └─→ Krok 11: Integracja + barrel export
              │
              ├─→ Krok 12: Task sendit (S01E01) — weryfikuje hub
              │
              ├─→ Krok 13: Task findhim (S01E02) — weryfikuje hub + logikę
              │
              ├─→ Krok 14: Task proxy (S01E03) — weryfikuje LLM + server + tools
              │
              ├─→ Krok 15: Task people (S01E04) — weryfikuje structured output
              │
              ├─→ Krok 16: Task railway (S01E05) — weryfikuje retry + rate limit
              │
              └─→ Krok 17: Testy
```

## Ryzyka i mitygacja

| Ryzyko | Mitygacja |
|--------|-----------|
| OpenRouter API zmieni format odpowiedzi | Cienki wrapper — łatwa aktualizacja w jednym pliku |
| Structured output nie działa na danym modelu | Fallback na prompt-based JSON extraction w `llm.ts` |
| Hub API rate limiting | Exponential backoff w `hub.ts` (krok 4) |
| Porty zajęte przy server tasks | Automatyczny wybór wolnego portu (port 0) |
| Stare rozwiązania nie pasują do nowego API | Każdy task jest od nowa — stary kod to tylko referencja |

## Konwencje do przestrzegania we wszystkich krokach

- **Conventional Commits** — `feat:`, `fix:`, `chore:`, itd.
- **Biome** — format + lint przed każdym commitem
- **ESM only** — `import/export`, `.js` extensions w importach
- **Zero dependencies tam gdzie nie potrzeba** — natywny fetch, natywne crypto
- **Eksportuj typy oddzielnie** — `export type { ... }` z `types.ts`
