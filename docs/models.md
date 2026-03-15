# Dostępne modele LLM (via OpenRouter)

> Dane pobrane z OpenRouter API — 2026-03-15.
> Benchmarki: [Arena AI Leaderboard](https://arena.ai/leaderboard), [Artificial Analysis](https://artificialanalysis.ai/models).
> Ceny w USD za 1M tokenów. Wszystkie modele dostępne pod jednym kluczem `OPENROUTER_API_KEY`.

## Arena AI Rankings (2026-03-15)

Rankingi na podstawie głosowań użytkowników w [Arena AI](https://arena.ai/leaderboard).

### Overall Top 10

| # | Model | ELO | Uwagi |
|---|-------|-----|-------|
| 1 | claude-opus-4.6 | 1503 | #1 overall + #1 coding |
| 2 | claude-opus-4.6-thinking | 1503 | Wariant z thinking |
| 3 | grok-4.20-beta1 | 1496 | xAI, brak na OpenRouter |
| 4 | gemini-3.1-pro-preview | 1492 | #4 overall, #7 coding |
| 5 | gemini-3-pro | 1486 | #1 vision |
| 6 | gpt-5.4-high | 1485 | #6 coding |
| 7 | gpt-5.2-chat | 1481 | |
| 8 | gemini-3-flash | 1474 | #10 coding, #4 vision |
| 9 | grok-4.1-thinking | 1473 | xAI, brak na OpenRouter |
| 10 | claude-opus-4.5-thinking | 1472 | |

### Coding Top 5

| # | Model | ELO |
|---|-------|-----|
| 1 | claude-opus-4.6-thinking | 1552 |
| 2 | claude-opus-4.6 | 1552 |
| 3 | claude-sonnet-4.6 | 1524 |
| 4 | claude-opus-4.5-thinking | 1493 |
| 5 | claude-opus-4.5 | 1472 |

**Wniosek:** Claude dominuje coding — top 5 to wyłącznie Anthropic.

### Vision Top 5

| # | Model | ELO |
|---|-------|-----|
| 1 | gemini-3-pro | 1288 |
| 2 | gemini-3.1-pro-preview | 1279 |
| 3 | gpt-5.2-chat | 1278 |
| 4 | gemini-3-flash | 1274 |
| 5 | gemini-3-flash-thinking | 1261 |

**Wniosek:** Gemini dominuje vision — top 2 i #4-5 to Google. gemini-2.5-pro (#9, ELO 1248) to najlepszy stabilny model vision na OpenRouter.

## Szybki wybór — który model do czego?

Rekomendacje oparte na benchmarkach Arena AI + optymalizacji kosztów.

| Cel | Rekomendowany model | Koszt in/out $/1M | Źródło rekomendacji |
|-----|--------------------|--------------------|---------------------|
| Tani klasyfikator / tagger | `gpt-4.1-nano` | $0.10 / $0.40 | Najtańszy z dobrą jakością |
| Prosty chat / ekstrakcja | `gemini-2.5-flash-lite` | $0.10 / $0.40 | Multimodalny, 1M ctx |
| Workhorse (dobra jakość / cena) | `gemini-2.5-flash` | $0.30 / $2.50 | Arena #10 coding, thinking mode |
| Structured output | `gpt-4.1-mini` | $0.40 / $1.60 | Najlepszy price/quality na JSON schema |
| Vision (tani) | `gemini-2.5-flash` | $0.30 / $2.50 | Arena vision top tier, image+audio+video |
| Vision (silny) | `gemini-2.5-pro` | $1.25 / $10 | Arena vision #9 (ELO 1248) |
| Thinking / reasoning | `gemini-2.5-pro` | $1.25 / $10 | Wbudowane thinking, Arena top 10 |
| Kodowanie / agenty | `claude-sonnet-4.6` | $3.00 / $15 | Arena coding #3 (ELO 1524) |
| Najtrudniejsze zadania | `claude-opus-4.6` | $5.00 / $25 | Arena #1 overall (ELO 1503) |
| Ultra-tani bulk | `gpt-5-nano` | $0.05 / $0.40 | 400K ctx |
| Open source — tani | `llama-4-scout` | $0.08 / $0.30 | MoE 17B/109B, multimodalny |
| Open source — mocny | `deepseek-v3.2` | $0.26 / $0.38 | 164K ctx, silny tool use |
| Open source — reasoning | `deepseek-r1-0528` | $0.45 / $2.15 | Na poziomie OpenAI o1 |

## Pełna lista modeli

### Anthropic Claude

| Model | Input $/1M | Output $/1M | Context | Max output | Multimodal | Opis |
|-------|-----------|------------|---------|------------|------------|------|
| `claude-haiku-4.5` | $1.00 | $5.00 | 200K | 64K | text+image | Najszybszy Claude, blisko Sonnet 4 w jakości. Dobry do klasyfikacji, ekstrakcji, prostych tasków. |
| `claude-sonnet-4` | $3.00 | $15.00 | 200K | 64K | text+image+file | Silny w kodowaniu i rozumowaniu. Dobra precyzja i kontrolowalność. |
| `claude-sonnet-4.5` | $3.00 | $15.00 | 1M | 64K | text+image+file | SOTA na benchmarkach kodowania (SWE-bench). Zoptymalizowany pod agenty. |
| `claude-sonnet-4.6` | $3.00 | $15.00 | 1M | 128K | text+image | **Arena coding #3** (ELO 1524). Frontier w kodowaniu i agentach. Najlepszy stosunek cena/jakość w kategorii coding. |
| `claude-opus-4` | $15.00 | $75.00 | 200K | 32K | text+image+file | Starszy Opus. Drogi — preferuj 4.5 lub 4.6. |
| `claude-opus-4.5` | $5.00 | $25.00 | 200K | 64K | text+image+file | Arena coding #5 (ELO 1472). Frontier reasoning, agenty, computer use. |
| `claude-opus-4.6` | $5.00 | $25.00 | 1M | 128K | text+image | **Arena #1 overall** (ELO 1503), **#1 coding** (ELO 1552). Najsilniejszy model w ofercie. |

### OpenAI GPT

| Model | Input $/1M | Output $/1M | Context | Max output | Multimodal | Opis |
|-------|-----------|------------|---------|------------|------------|------|
| `gpt-4.1-nano` | $0.10 | $0.40 | 1M | 32K | text+image+file | Najszybszy i najtańszy w serii 4.1. Idealny do klasyfikacji i tagowania. |
| `gpt-4.1-mini` | $0.40 | $1.60 | 1M | 32K | text+image+file | Konkurencyjny z GPT-4o przy niższym koszcie. Dobry do structured output. |
| `gpt-4.1` | $2.00 | $8.00 | 1M | 32K | text+image+file | Flagship 4.1 — zaawansowane instruction following, inżynieria SW. |
| `gpt-5-nano` | $0.05 | $0.40 | 400K | 128K | text+image+file | Najmniejszy GPT-5. Ultra-tani, szybki. Ograniczone rozumowanie. |
| `gpt-5-mini` | $0.25 | $2.00 | 400K | 128K | text+image+file | Lekki GPT-5 do prostszego rozumowania. Dobry stosunek cena/jakość. |
| `gpt-5` | $1.25 | $10.00 | 400K | 128K | text+image+file | Najbardziej zaawansowany model OpenAI. Step-by-step reasoning. |
| `gpt-5-pro` | $15.00 | $120.00 | 400K | 128K | text+image+file | Maksymalna jakość GPT-5. Drogi — używać tylko gdy zwykły GPT-5 nie wystarczy. |
| `gpt-5-codex` | $1.25 | $10.00 | 400K | 128K | text+image | Zoptymalizowany pod kodowanie i długie sesje deweloperskie. |

### OpenAI o-series (reasoning)

| Model | Input $/1M | Output $/1M | Context | Max output | Opis |
|-------|-----------|------------|---------|------------|------|
| `o4-mini` | $1.10 | $4.40 | 200K | 100K | Kompaktowy reasoning model. Szybki, tool use, multimodalny. |
| `o3` | $2.00 | $8.00 | 200K | 100K | Silny w math i science. Ustępuje Claude/Gemini w Arena overall, ale dobry w chain-of-thought reasoning. |
| `o3-pro` | $20.00 | $80.00 | 200K | 100K | Więcej compute na "myślenie". Konsekwentnie lepsze odpowiedzi. Drogi. |

### Google Gemini

| Model | Input $/1M | Output $/1M | Context | Max output | Multimodal | Opis |
|-------|-----------|------------|---------|------------|------------|------|
| `gemini-2.5-flash-lite` | $0.10 | $0.40 | 1M | 64K | text+image+audio+video | Ultra-tani, szybki. Lekki reasoning. Świetny do bulk processingu. |
| `gemini-2.5-flash` | $0.30 | $2.50 | 1M | 64K | text+image+audio+video | Wbudowane thinking. Arena coding #10 (ELO 1441 — gemini-3-flash). Najlepszy price/quality multimodalny. |
| `gemini-2.5-pro` | $1.25 | $10.00 | 1M | 64K | text+image+audio+video | **Arena vision #9** (ELO 1248). Thinking mode. Najlepszy stabilny model vision. Audio+video input. |
| `gemini-3-flash-preview` | $0.50 | $3.00 | 1M | 64K | text+image+audio+video | **Arena vision #4** (ELO 1274). Preview — blisko Pro, szybki. |
| `gemini-3.1-pro-preview` | $2.00 | $12.00 | 1M | 64K | text+image+audio+video | **Arena #4 overall** (ELO 1492), **vision #2** (ELO 1279). Frontier. Preview — może się zmienić. |

### Open Source

| Model | Input $/1M | Output $/1M | Context | Max output | Multimodal | Opis |
|-------|-----------|------------|---------|------------|------------|------|
| `llama-4-scout` | $0.08 | $0.30 | 328K | 16K | text+image | Meta MoE 17B/109B. Najtańszy multimodalny z przyzwoitą jakością. |
| `llama-4-maverick` | $0.15 | $0.60 | 1M | 16K | text+image | Meta MoE 17B/400B+. 128 ekspertów. 1M context. Silniejszy od Scout. |
| `deepseek-chat-v3.1` | $0.15 | $0.75 | 32K | 7K | text-only | 671B/37B active. Hybrid reasoning (thinking + non-thinking). Tani. |
| `deepseek-v3.2` | $0.26 | $0.38 | 164K | N/A | text-only | Sparse Attention. Silny reasoning + tool use. Bardzo tani output. |
| `deepseek-v3.2-speciale` | $0.40 | $1.20 | 164K | 164K | text-only | High-compute wariant V3.2. Maksymalny reasoning i agentic performance. |
| `deepseek-r1-0528` | $0.45 | $2.15 | 164K | 64K | text-only | Open-source reasoning na poziomie o1. Pełne reasoning tokens. |

## Macierz możliwości

Które modele obsługują konkretne ficzery — ważne przy doborze do taska.

| Model | Vision | Audio/Video | Thinking | JSON Schema | Tool Use | Max ctx |
|-------|--------|-------------|----------|-------------|----------|---------|
| claude-haiku-4.5 | yes | - | - | yes | yes | 200K |
| claude-sonnet-4.6 | yes | - | - | yes | yes | 1M |
| claude-opus-4.6 | yes | - | - | yes | yes | 1M |
| gpt-4.1-nano | yes | - | - | yes | yes | 1M |
| gpt-4.1-mini | yes | - | - | yes | yes | 1M |
| gpt-4.1 | yes | - | - | yes | yes | 1M |
| gpt-5-nano | yes | - | - | yes | yes | 400K |
| gpt-5-mini | yes | - | - | yes | yes | 400K |
| gpt-5 | yes | - | - | yes | yes | 400K |
| o4-mini | yes | - | thinking | yes | yes | 200K |
| o3 | yes | - | thinking | yes | yes | 200K |
| gemini-2.5-flash-lite | yes | **yes** | - | yes | yes | 1M |
| gemini-2.5-flash | yes | **yes** | **thinking** | yes | yes | 1M |
| gemini-2.5-pro | yes | **yes** | **thinking** | yes | yes | 1M |
| gemini-3-flash-preview | yes | **yes** | **thinking** | yes | yes | 1M |
| gemini-3.1-pro-preview | yes | **yes** | **thinking** | yes | yes | 1M |
| llama-4-scout | yes | - | - | partial | partial | 328K |
| llama-4-maverick | yes | - | - | partial | partial | 1M |
| deepseek-v3.2 | - | - | - | yes | yes | 164K |
| deepseek-r1-0528 | - | - | **thinking** | yes | partial | 164K |

**Legenda:** `thinking` = model natywnie obsługuje chain-of-thought / "thinking mode". `partial` = obsługa istnieje ale mniej niezawodna.

## Strategie optymalizacji kosztów

1. **Zacznij od najtańszego** — spróbuj `gpt-4.1-nano` lub `gemini-2.5-flash-lite`. Eskaluj model tylko gdy jakość nie wystarczy.
2. **Structured output** — `gpt-4.1-mini` ma najlepszy stosunek cena/jakość dla JSON schema extraction.
3. **Tool calling** — `gemini-2.5-flash` lub `gpt-4.1-mini` dobrze obsługują function calling tanio.
4. **Reasoning** — zamiast drogiego `o3-pro`, spróbuj `deepseek-r1-0528` (10x tańszy, porównywalny).
5. **Vision** — `gemini-2.5-flash` obsługuje image+audio+video za ułamek ceny Claude.
6. **Bulk/batch** — dla masowego przetwarzania `gpt-5-nano` ($0.05/1M in) jest najtańszy.
7. **Cache responses** — jeśli task pobiera te same dane wielokrotnie, cache w `data/` zamiast ponownego przetwarzania LLM.

## Użycie w taskach

```typescript
import { Models } from '@mission/core';

// Predefiniowane stałe — bez pamiętania pełnych nazw
const result = await ctx.llm.structured({
  model: Models.CHEAP,           // gpt-4.1-nano — klasyfikacja, tagi
  system: 'Classify...',
  user: data,
  schema: mySchema,
});

// Vision — analiza obrazów
const description = await ctx.llm.structured({
  model: Models.VISION,          // gemini-2.5-flash — tani, obsługuje image+audio+video
  system: 'Describe the image',
  user: 'What is in this image?',
  schema: imageSchema,
  images: ['https://example.com/photo.jpg'],
});

// Thinking — złożone rozumowanie z chain-of-thought
const answer = await ctx.llm.chat({
  model: Models.THINKING_PRO,    // gemini-2.5-pro — wbudowane "thinking"
  messages: [{ role: 'user', content: complexQuestion }],
});
```

### Dostępne aliasy

| Alias | Model | Cena in/out $/1M | Opis |
|-------|-------|------------------|------|
| `CHEAP` | gpt-4.1-nano | $0.10 / $0.40 | Najtańszy, klasyfikacja, tagi |
| `FAST` | gemini-2.5-flash | $0.30 / $2.50 | Szybki, multimodalny |
| `BALANCED` | gpt-4.1-mini | $0.40 / $1.60 | **Domyślny.** Structured output, function calling |
| `SMART` | gemini-2.5-pro | $1.25 / $10 | Silne rozumowanie |
| `REASONING` | o3 | $2.00 / $8.00 | Głębokie chain-of-thought |
| `CODING` | claude-sonnet-4.6 | $3.00 / $15 | Kodowanie, agenty |
| `VISION_CHEAP` | gpt-4.1-nano | $0.10 / $0.40 | Najtańszy z vision (images+files) |
| `VISION` | gemini-2.5-flash | $0.30 / $2.50 | Vision + audio + video |
| `VISION_PRO` | gemini-2.5-pro | $1.25 / $10 | Silna analiza obrazów z reasoning |
| `THINKING` | gemini-2.5-flash | $0.30 / $2.50 | Wbudowane thinking, tani |
| `THINKING_PRO` | gemini-2.5-pro | $1.25 / $10 | Zaawansowane thinking |
