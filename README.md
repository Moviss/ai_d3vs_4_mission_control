# Mission Control — AI_devs 4

Extensible task runner for [AI_devs 4](https://www.aidevs.pl/) course assignments. Each task is a self-contained module backed by shared infrastructure: Hub API client, LLM wrapper (OpenRouter), colored CLI logger, and optional HTTP server (Hono).

## Prerequisites

- **Node.js** 24+
- **pnpm** (install: `corepack enable && corepack prepare pnpm@latest --activate`)

## Getting Started

```bash
# Clone with submodules (course examples repo)
git clone --recurse-submodules <repo-url>
cd ai_d3vs_4_mission_control

# If already cloned without --recurse-submodules:
git submodule update --init

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Fill in: OPENROUTER_API_KEY, AG3NTS_API_KEY
```

## Usage

Task name accepts any of these forms:

```bash
pnpm task people          # by task name
pnpm task s01e01          # by episode code
pnpm task s01e01-people   # by full directory name
pnpm task --list          # list all tasks with status
pnpm task people --dry    # dry run (no hub submission)
```

### Example output

```
┌────────────────────────────────────────────────┐
│  MISSION CONTROL  ·  AI_devs 4                 │
│  S01E01 · people · Filtruj osoby z transportu  │
└────────────────────────────────────────────────┘

[01] ⬇ Pobieranie danych z hubu...                [0.0s]
       people.csv — 24417 rekordów
[02] ⚙ Filtrowanie osób...                        [1.4s]
       Mężczyźni 20-40 lat, Grudziądz → 31 osób
[03] 🤖 Tagowanie zawodów przez LLM...             [1.4s]
       Model: gpt-4.1-mini
       Structured output — 2825+353 tokens ($0.0017)
       ✔ 31 rekordów → 5 z tagiem "transport"
[04] 📡 Wysyłanie odpowiedzi do Hub...             [5.8s]

  ────────────────────────────────────────────────────
  🏁 {FLG:SURVIVORS}
  ────────────────────────────────────────────────────

  ✔ TASK COMPLETED  $0.0017 | 1 LLM call | 5.8s
```

## Adding a New Task

Create `tasks/s{SS}e{EE}-{name}/index.ts` exporting a `TaskDefinition`:

```typescript
import type { TaskDefinition } from '@mission/core';

export default {
  name: 'taskname',
  title: 'Task description',
  season: 1,
  episode: 1,
  async run(ctx) {
    ctx.log.fetch('Downloading data...');
    const data = await ctx.hub.fetchData('file.csv');

    ctx.log.llm('Classifying with LLM...');
    const result = await ctx.llm.structured({
      model: 'openai/gpt-4.1-mini',
      system: 'Classify items...',
      user: data,
      schema: { /* JSON Schema */ },
    });

    ctx.log.send('Submitting answer...');
    const response = await ctx.hub.verify('taskname', result);
    ctx.log.flag(response);
  },
} satisfies TaskDefinition;
```

### TaskContext API

| Property | Type | Description |
|----------|------|-------------|
| `ctx.hub` | `HubClient` | Hub API — `verify()`, `fetchData()`, `post()` |
| `ctx.llm` | `LLMClient` | LLM — `chat()` (with tool calling), `structured()` |
| `ctx.log` | `Logger` | Logging — `fetch()`, `process()`, `llm()`, `send()`, `step()`, `success()`, `detail()`, `warn()`, `error()`, `flag()` |
| `ctx.data` | `string` | Path to task's `data/` directory for caching files |
| `ctx.server` | `TaskServer` | Hono HTTP server (for tasks with `server: true`) |
| `ctx.env` | `EnvConfig` | Environment variables |

## Project Structure

```
ai_d3vs_4_mission_control/
├── packages/
│   ├── core/                  # Shared logic (hub client, LLM, server, task registry)
│   └── cli/                   # Terminal UI (logger, output formatting)
├── tasks/                     # Course task solutions (s01e01-name/, s01e02-name/, ...)
├── lessons/                   # Lesson content in markdown
├── examples/
│   └── ai_devs_course/        # Course examples repo (git submodule)
└── .ai/                       # Project docs (PRD, implementation plan)
```

## Claude Code Skills

### `/aidevs4-explain <example-name>`

Generates a detailed, step-by-step explanation of a course code example. Reads the corresponding lesson and all source files, then delivers knowledge in digestible chunks — one at a time, waiting for confirmation before proceeding.

All chunks are saved to a single file at `examples/explanation/<example-name>/explanation.md` for future reference.

```
/aidevs4-explain 02_01_agentic_rag
```

## Course Examples (git submodule)

The `examples/ai_devs_course/` directory is a [git submodule](https://git-scm.com/book/en/v2/Git-Tools-Submodules) pointing to [i-am-alice/4th-devs](https://github.com/i-am-alice/4th-devs) — code examples from each lesson.

```bash
# Pull latest updates
cd examples/ai_devs_course && git pull origin main && cd ../..
```

## Tech Stack

| Component | Choice |
|-----------|--------|
| Language | TypeScript (ESM) |
| Runtime | Node.js 24+ |
| Package manager | pnpm workspaces |
| LLM provider | OpenRouter (OpenAI-compatible API) |
| HTTP framework | Hono |
| Linting | Biome |
| Testing | Vitest |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | API key for [OpenRouter](https://openrouter.ai/) (LLM access) |
| `AG3NTS_API_KEY` | API key for [Hub](https://hub.ag3nts.org/) (task verification) |
