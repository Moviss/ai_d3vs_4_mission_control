# Mission Control — AI_devs 4

Extensible task runner for [AI_devs 4](https://www.aidevs.pl/) course assignments. Each task is a self-contained module backed by shared infrastructure: Hub API client, LLM wrapper (OpenRouter), colored CLI logger, and optional HTTP server (Hono).

> **Status:** Early development — core infrastructure is being built.

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

```bash
pnpm task <name>          # run a task
pnpm task --list          # list all tasks with status
pnpm task <name> --dry    # dry run (no hub submission)
```

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
└── .ai/                       # Project docs (PRD)
```

## Course Examples (git submodule)

The `examples/ai_devs_course/` directory is a [git submodule](https://git-scm.com/book/en/v2/Git-Tools-Submodules) pointing to the official course repository: [i-am-alice/4th-devs](https://github.com/i-am-alice/4th-devs).

It contains code examples published alongside each lesson. To pull the latest updates:

```bash
cd examples/ai_devs_course
git pull origin main
cd ../..

# Then commit the updated reference in your repo
git add examples/ai_devs_course
git commit -m "update course examples"
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
| `OPENROUTER_API_KEY` | API key for OpenRouter (LLM access) |
| `AG3NTS_API_KEY` | API key for Hub API (task verification) |
