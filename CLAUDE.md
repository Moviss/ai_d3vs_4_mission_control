# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI_devs 4 course task runner — an extensible CLI tool where each course task is a separate module using shared infrastructure (Hub API, LLM, logging, HTTP server). Written in Polish context (course materials, variable names in task logic may be Polish).

## Tech Stack

- **Language:** TypeScript (ESM)
- **Runtime:** Node.js 24+
- **Package manager:** pnpm (workspaces)
- **LLM provider:** OpenRouter exclusively (OpenAI-compatible API)
- **HTTP framework:** Hono
- **Linting:** Biome
- **Testing:** Vitest

## Monorepo Structure

- `packages/core/` — shared logic: Hub API client, LLM wrapper, HTTP server, task registry, types
- `packages/cli/` — terminal UI: entry point, colored logger, output formatting
- `tasks/` — individual course tasks, each in `s{SS}e{EE}-{name}/` folder with `index.ts` exporting `TaskDefinition`
- `lessons/` — lesson content (markdown) from the course
- `examples/ai_devs_course/` — **git submodule** pointing to [i-am-alice/4th-devs](https://github.com/i-am-alice/4th-devs) (course code examples, read-only)
- `.env` — `OPENROUTER_API_KEY`, `AG3NTS_API_KEY` (gitignored)

## Commands

```bash
pnpm task <name>          # run a task
pnpm task --list          # list all tasks with status
pnpm task <name> --dry    # dry run (no hub submission)
```

## Architecture Decisions

- **Function Calling (Tools)** is the default LLM↔code mechanism, not MCP. MCP servers live in separate repos.
- **LLM client** is a thin wrapper over OpenRouter, not an abstraction framework. No LangChain.
- **Tasks are self-contained** — each exports a `TaskDefinition` with `name`, `title`, `season`, `episode`, and `run(ctx)`. The `ctx` provides `hub`, `llm`, `log`, `data`, `server`, `env`.
- **Task discovery** is automatic via scanning `tasks/*/index.ts`.
- **HTTP server** (Hono) starts only when a task declares `server: true`.
- **Cost tracking** — every LLM call logs tokens and calculates cost in USD.
- **Status tracking** — `tasks/.status.json` persists task completion state and flags.

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
    // Use ctx.hub, ctx.llm, ctx.log, ctx.data, ctx.server, ctx.env
  },
} satisfies TaskDefinition;
```

## Git Conventions

- Use [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages (e.g. `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
- **Never** add `Co-Authored-By` or any AI attribution lines to commit messages.

## PRD

Full product requirements document is at `.ai/MISSION_CONTROL_PRD.md`.
