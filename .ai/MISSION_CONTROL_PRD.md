# ai_d3vs_4_mission_control

## Wizja

Narzędzie do rozwiązywania zadań z kursu AI_devs 4 w formie rozszerzalnego task runnera. Każde zadanie to oddzielny moduł korzystający ze wspólnej infrastruktury (Hub API, LLM, logowanie, serwer HTTP). Architektura przygotowana na przyszły web UI, ale w pierwszym etapie skupiona na pięknym CLI.

## Czego NIE budujemy

- Frameworka do agentów AI ogólnego zastosowania
- Abstrakcji nad LLM API (wrapper tak, ale cienki — nie LangChain)
- Systemu, który sam rozwiązuje zadania — to Ty piszesz logikę, framework daje Ci narzędzia
- Własnego MCP serwera — MCP serwery żyją w osobnych repozytoriach (patrz sekcja MCP)

## Decyzje architektoniczne

### Function Calling (Tools) jako domyślny mechanizm

Interakcja LLM z narzędziami odbywa się przez **Function Calling / Tools** — standard obsługiwany
przez wszystkie modele dostępne na OpenRouter. To interfejs LLM ↔ kod taska.

**MCP** to osobna warstwa — protokół do **wystawiania** narzędzi tak, by różni klienci
(Claude Code, Cursor, własna apka) mogli z nich korzystać. MCP pod spodem i tak korzysta
z Function Calling. Nie jest to "albo-albo".

Praktycznie:
- **90% zadań z kursu** — Tools w kodzie taska, zero MCP
- **Zadania wymagające MCP serwera** — serwer budowany osobno (template: `iceener/streamable-mcp-server-template`), task łączy się z nim jako MCP client
- **Podłączanie narzędzi do Claude Code / Cursor** — osobne MCP repo per narzędzie

W `core` przewidujemy helper do **łączenia się z MCP serwerem jako klient** (gdy task tego potrzebuje),
ale NIE do bycia MCP serwerem.

### Wyłącznie OpenRouter

Jeden provider, jeden API key, dostęp do wszystkich modeli. Brak vendor lock-in na poziomie
SDK — używamy OpenAI-compatible API, które OpenRouter udostępnia. Jeśli kiedyś trzeba będzie
dodać bezpośredni dostęp do Anthropic/OpenAI, interfejs `LLMClient` to umożliwia bez zmian w taskach.

### Hono jako HTTP framework

Lekki (14KB), uniwersalny (Node.js, Bun, Cloudflare Workers, Deno), Web Standards API.
Używany zarówno dla opcjonalnego serwera tasków (etap 1), jak i przyszłego web API (etap 2).
Bonus: template MCP od iceenera też używa Hono — spójna wiedza.

---

## Etap 1: CLI Task Runner

### Cel

Uruchamianie zadań jedną komendą z czytelnym, kolorowym outputem w terminalu. Dodanie nowego zadania = stworzenie jednego pliku.

### Uruchamianie

```bash
pnpm task people          # uruchom zadanie
pnpm task --list          # lista wszystkich zadań z ich statusem
pnpm task people --dry    # pokaż co zrobi, bez wysyłania do hub
```

### Struktura monorepo

```
ai_d3vs_4_mission_control/
├── package.json              # workspace root (pnpm workspaces)
├── pnpm-workspace.yaml
├── tsconfig.json             # base tsconfig
├── .env                      # OPENROUTER_API_KEY, AG3NTS_API_KEY (gitignored)
├── .gitignore
│
├── packages/
│   ├── core/                 # logika niezależna od UI
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── hub.ts            # klient Hub API (verify, fetchData)
│   │       ├── llm.ts            # wrapper LLM — OpenRouter, structured output, tools
│   │       ├── server.ts         # opcjonalny Hono HTTP server per task
│   │       ├── files.ts          # helpers do czytania/zapisywania plików taskowych
│   │       ├── task-registry.ts  # odkrywanie i rejestracja tasków
│   │       ├── types.ts          # wspólne typy (TaskDefinition, TaskContext, etc.)
│   │       └── index.ts          # public API
│   │
│   └── cli/                  # terminal UI
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts          # entry point CLI
│           ├── logger.ts         # kolorowe logi, ikony, progress
│           └── ui.ts             # formatowanie outputu (tabelki, boxy, summary)
│
├── tasks/                    # TUTAJ ŻYJĄ ZADANIA
│   ├── s01e01-people/
│   │   ├── index.ts          # eksportuje TaskDefinition
│   │   └── data/             # pliki lokalne zadania (cache, CSV, JSON)
│   ├── s01e02-findhim/
│   │   └── index.ts
│   ├── s01e03-proxy/
│   │   ├── index.ts
│   │   └── routes.ts         # ten task potrzebuje endpointów Hono
│   └── ...
│
├── docs/                     # treści lekcji (markdown) kopiowane z 4th-devs
│   ├── s01e01.md
│   ├── s01e02.md
│   └── ...
│
└── examples/                 # kopiowane przykłady kodu z 4th-devs (opcjonalnie)
```

### Kontrakt taska

Każdy task to moduł eksportujący obiekt `TaskDefinition`:

```typescript
// tasks/s01e01-people/index.ts

import type { TaskDefinition } from '@mission/core';

export default {
  name: 'people',
  title: 'Filtruj osoby z transportu',
  season: 1,
  episode: 1,

  // opcjonalnie — task potrzebuje serwera HTTP
  // server: { routes: './routes.ts' },

  async run(ctx) {
    // ctx daje dostęp do całej infrastruktury:
    //   ctx.hub     — Hub API client
    //   ctx.llm     — LLM client (structured output, chat, vision...)
    //   ctx.log     — logger (step, success, warn, error, flag)
    //   ctx.data    — ścieżka do katalogu data/ tego taska
    //   ctx.server  — HTTP server (jeśli task go zadeklarował)
    //   ctx.env     — zmienne środowiskowe

    ctx.log.step('Pobieranie danych z hubu...');
    const csv = await ctx.hub.fetchData('people.csv');

    ctx.log.step('Filtrowanie osób...');
    const filtered = filterPeople(csv);

    ctx.log.step('Tagowanie zawodów przez LLM...');
    const tagged = await ctx.llm.structured({
      model: 'gpt-4.1-mini',
      system: 'Przypisz tagi do zawodów...',
      user: JSON.stringify(filtered),
      schema: tagsSchema,
    });

    ctx.log.step('Wysyłanie odpowiedzi...');
    const result = await ctx.hub.verify('people', tagged);
    ctx.log.flag(result);
  },
} satisfies TaskDefinition;
```

### Logger CLI — jak ma wyglądać output

Inspiracja: screenshot 3 (CLI z ikonami). Styl terminalowy, ale czytelny:

```
┌─────────────────────────────────────────────────┐
│  MISSION CONTROL  ·  AI_devs 4                  │
│  S01E01 · people · Filtruj osoby z transportu   │
└─────────────────────────────────────────────────┘

  ⬇  Pobieranie danych z hubu...
     people.csv — 847 rekordów

  ⚙  Filtrowanie osób...
     Mężczyźni 20-40 lat, Grudziądz → 12 osób

  🤖 Tagowanie zawodów przez LLM...
     Model: gpt-4.1-mini
     12 rekordów → 4 z tagiem "transport"
  ✓  Tagowanie zakończone — 617+246 tokens

  📡 Wysyłanie odpowiedzi do Hub...
     POST https://hub.ag3nts.org/verify
  ✓  Response: { "code": 0, "message": "{FLG:****}" }

  🏁 {FLG:JAKIES_SLOWO}

  ────────────────────────────────────────
  Koszt: $0.003 | 2 wywołania LLM | 1.2s
```

### Komponenty core

#### `hub.ts` — Hub API Client

```typescript
interface HubClient {
  // Wyślij odpowiedź i odbierz flagę
  verify(task: string, answer: unknown): Promise<HubResponse>;

  // Pobierz plik danych (CSV, JSON, tekst, obraz)
  fetchData(path: string): Promise<string | Buffer>;

  // Surowy POST do dowolnego endpointu hub
  post(endpoint: string, body: unknown): Promise<unknown>;
}
```

#### `llm.ts` — LLM Client

Cienki wrapper, NIE abstrakcja nad wszystkimi providerami.
Obsługuje to co realnie potrzebne w zadaniach:

```typescript
interface LLMClient {
  // Structured output — najczęstszy use case
  structured<T>(opts: {
    model?: string;
    system: string;
    user: string;
    schema: JsonSchema;
    images?: string[];    // vision
  }): Promise<T>;

  // Prosty chat (zwraca tekst)
  chat(opts: {
    model?: string;
    system?: string;
    messages: Message[];
  }): Promise<string>;

  // Streaming (na później)
  // stream(...): AsyncIterable<string>;
}
```

Wyłącznie OpenRouter (OpenAI-compatible Chat Completions API).
Wszystkie modele dostępne przez jeden endpoint i jeden klucz.

#### `server.ts` — HTTP Server (opcjonalny, Hono)

Niektóre taski potrzebują serwera (proxy, webhooki, callback endpoints).
Server startuje tylko gdy task go wymaga:

```typescript
interface TaskServer {
  // Startuje Hono server na wolnym porcie lub podanym
  start(port?: number): Promise<{ url: string; port: number }>;

  // Zwraca instancję Hono app do dodawania routes
  app: Hono;

  // Zatrzymuje po zakończeniu taska
  stop(): Promise<void>;
}
```

Przykład użycia w tasku:

```typescript
// tasks/s01e03-proxy/index.ts
export default {
  name: 'proxy',
  server: true,  // sygnalizuje że potrzebuje serwera

  async run(ctx) {
    ctx.server.app.post('/api/proxy', async (c) => {
      const body = await c.req.json();
      // ... logika proxy
      return c.json({ reply: response });
    });

    await ctx.server.start(3000);
    ctx.log.step(`Server listening on ${ctx.server.url}`);

    // rejestracja URL w hubie, oczekiwanie na requesty, etc.
  },
};
```

#### `tools.ts` — Function Calling helpers

Helpery do definiowania narzędzi i obsługi tool-calling loop:

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: JsonSchema;
  execute: (args: unknown) => Promise<unknown>;
}

// Uruchamia LLM z narzędziami, automatycznie obsługuje tool calls w pętli
async function runWithTools(opts: {
  model?: string;
  system: string;
  user: string;
  tools: ToolDefinition[];
  maxIterations?: number;  // domyślnie 5
}): Promise<string>;
```

### Kluczowe decyzje techniczne

| Decyzja | Wybór | Dlaczego |
|---------|-------|----------|
| Język | TypeScript | Typesafety na schematach, autocomplete |
| Runtime | Node.js 24+ | Natywny fetch, .env, ESM |
| Package manager | pnpm | Workspaces, szybki, oszczędza dysk |
| Monorepo | pnpm workspaces | Proste, zero dodatkowych narzędzi |
| LLM provider | OpenRouter | Jeden klucz, wszystkie modele, OpenAI-compatible API |
| HTTP framework | Hono | 14KB, Web Standards, działa wszędzie |
| Narzędzia LLM | Function Calling (Tools) | Standard, obsługiwany przez wszystkie modele |
| CLI output | chalk + własne helpery | Pełna kontrola, zero magii |
| Test | vitest (opcjonalnie) | Szybki, ESM-native |
| Linting | biome | Szybki, zero konfiguracji |

### Task discovery

Taski odkrywane automatycznie przez skanowanie `tasks/*/index.ts`.
Konwencja nazewnictwa folderów: `s{SS}e{EE}-{nazwa}` np. `s01e01-people`.

Runner przy starcie:
1. Skanuje `tasks/` i importuje każdy `index.ts`
2. Buduje rejestr tasków (name → moduł)
3. Argument CLI matchuje po `name` z `TaskDefinition`

### Tracking postępu

Prosty plik `tasks/.status.json` trzymający historię:

```json
{
  "people": { "status": "completed", "flag": "{FLG:...}", "lastRun": "2026-03-12T20:31:50Z", "cost": 0.003 },
  "findhim": { "status": "completed", "flag": "{FLG:...}", "lastRun": "2026-03-12T20:35:10Z", "cost": 0.001 },
  "proxy": { "status": "pending" }
}
```

Widoczne w `pnpm task --list`:

```
  MISSIONS                          STATUS
  ─────────────────────────────────────────
  S01E01  people     Filtruj osoby  ✓ DONE
  S01E02  findhim    Znajdź osobę   ✓ DONE
  S01E03  proxy      Proxy agent    ○ PENDING
  S01E04  sendit     Wyślij paczkę  · NEW
```

### Śledzenie kosztów

Każde wywołanie LLM loguje tokeny (input/output) i przelicza na $.
Podsumowanie na końcu każdego taska + agregat w `--list`.

---

## Etap 2: Web Dashboard (później)

### Cel

Piękny web UI w stylu "Mission Control Terminal" (screenshot 1-2)
korzystający z tego samego `core` co CLI.

### Architektura

```
packages/
  core/         # ← bez zmian, współdzielony
  cli/          # ← bez zmian, nadal działa
  web/
    server/     # API server (Hono/Express/Fastify)
    client/     # Frontend (React/Svelte/SolidJS)
```

### Backend web

- REST API lub WebSocket do uruchamiania tasków i odbierania logów
- Server-Sent Events (SSE) do streamowania logów w real-time
- Ten sam `core` — zmienia się tylko warstwa prezentacji

### Frontend

- Terminal-like UI z panelami (jak screenshot 1-2)
- Real-time logi zadania (SSE stream)
- File browser na dokumenty lekcji i dane tasków
- Dashboard z postępem wszystkich misji
- Interaktywne uruchamianie tasków z poziomu przeglądarki

### Dlaczego nie teraz

- CLI wystarczy do rozwiązywania zadań — zero overhead
- Web UI to tydzień+ pracy na sam scaffold
- Lepiej mieć 10 rozwiązanych zadań z CLI niż 0 z pięknym dashboardem
- Core się ustabilizuje po kilku taskach — wtedy łatwiej budować UI

---

## Kolejność implementacji (Etap 1)

1. **Scaffold monorepo** — `package.json`, workspaces, tsconfig, `.env`
2. **`core/hub.ts`** — klient Hub API (verify + fetchData)
3. **`core/llm.ts`** — wrapper LLM ze structured output
4. **`cli/logger.ts`** — kolorowe logi
5. **`core/task-registry.ts`** — odkrywanie tasków
6. **`cli/index.ts`** — entry point CLI
7. **Pierwszy task** — `s01e01-people` (migracja z `zadania/01-01`)
8. **Drugi task** — `s01e02-findhim` (migracja z `zadania/01-02`)
9. **`core/server.ts`** — HTTP server
10. **Trzeci task** — `s01e03-proxy` (task z serwerem)

---

## MCP — strategia

MCP serwery to **osobne projekty/repozytoria**, nie część mission-control.

```
Ekosystem:
  ai_d3vs_4_mission_control/     ← task runner (ten projekt)
  my-mcp-server-xyz/             ← osobne repo, bazowane na iceener/streamable-mcp-server-template
  my-mcp-server-abc/             ← kolejny MCP serwer
```

Mission-control może **łączyć się** z MCP serwerami jako klient (gdy task tego wymaga),
ale sam NIE jest MCP serwerem. Rozdzielenie odpowiedzialności:

| Potrzeba | Rozwiązanie |
|----------|-------------|
| Task wywołuje LLM z narzędziami | Function Calling w `core/llm.ts` i `core/tools.ts` |
| Task potrzebuje HTTP endpointów | `core/server.ts` (Hono) |
| Task łączy się z MCP serwerem | `@modelcontextprotocol/sdk` jako klient w tasku |
| Budujesz narzędzie dla Claude Code / Cursor | Osobne repo z MCP serwerem |

Helper do MCP client w core dodamy gdy pojawi się pierwsze zadanie wymagające połączenia
z MCP serwerem. Do tego czasu — YAGNI.
