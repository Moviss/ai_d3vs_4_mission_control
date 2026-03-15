# Dostępne modele LLM (via OpenRouter)

> Dane pobrane z OpenRouter API — 2026-03-15.
> Ceny w USD za 1M tokenów. Wszystkie modele dostępne pod jednym kluczem `OPENROUTER_API_KEY`.

## Szybki wybór — który model do czego?

| Cel | Rekomendowany model | Koszt ~1K tokenów | Uwagi |
|-----|--------------------|--------------------|-------|
| Tani klasyfikator / tagger | `gpt-4.1-nano` | $0.0001 in / $0.0004 out | Najtańszy z dobrą jakością |
| Prosty chat / ekstrakcja | `gemini-2.5-flash-lite` | $0.0001 / $0.0004 | Multimodalny, 1M ctx |
| Workhorse (dobra jakość / cena) | `gemini-2.5-flash` | $0.0003 / $0.0025 | Thinking, audio, video |
| Structured output / function calling | `gpt-4.1-mini` | $0.0004 / $0.0016 | Świetny do JSON schema |
| Złożone rozumowanie | `gemini-2.5-pro` | $0.00125 / $0.01 | Thinking, 1M ctx |
| Kodowanie / agenty | `claude-sonnet-4.6` | $0.003 / $0.015 | 1M ctx, 128K output |
| Najtrudniejsze zadania | `claude-opus-4.6` | $0.005 / $0.025 | 1M ctx, 128K output |
| Ultra-tani bulk processing | `gpt-5-nano` | $0.00005 / $0.0004 | 400K ctx |
| Open source — tani | `llama-4-scout` | $0.00008 / $0.0003 | 328K ctx, multimodal |
| Open source — mocny | `deepseek-v3.2` | $0.00026 / $0.00038 | 164K ctx, text-only |
| Open source — reasoning | `deepseek-r1-0528` | $0.00045 / $0.00215 | Na poziomie o1 |

## Pełna lista modeli

### Anthropic Claude

| Model | Input $/1M | Output $/1M | Context | Max output | Multimodal | Opis |
|-------|-----------|------------|---------|------------|------------|------|
| `claude-haiku-4.5` | $1.00 | $5.00 | 200K | 64K | text+image | Najszybszy Claude, blisko Sonnet 4 w jakości. Dobry do klasyfikacji, ekstrakcji, prostych tasków. |
| `claude-sonnet-4` | $3.00 | $15.00 | 200K | 64K | text+image+file | Silny w kodowaniu i rozumowaniu. Dobra precyzja i kontrolowalność. |
| `claude-sonnet-4.5` | $3.00 | $15.00 | 1M | 64K | text+image+file | SOTA na benchmarkach kodowania (SWE-bench). Zoptymalizowany pod agenty. |
| `claude-sonnet-4.6` | $3.00 | $15.00 | 1M | 128K | text+image | Najnowszy Sonnet — frontier w kodowaniu, agentach, pracy profesjonalnej. |
| `claude-opus-4` | $15.00 | $75.00 | 200K | 32K | text+image+file | Najlepszy model kodujący (w momencie wydania). Złożone, długie taski. |
| `claude-opus-4.5` | $5.00 | $25.00 | 200K | 64K | text+image+file | Frontier reasoning, inżynieria SW, agenty, computer use. |
| `claude-opus-4.6` | $5.00 | $25.00 | 1M | 128K | text+image | Najsilniejszy model Anthropic. Budowany pod agenty pracujące na całych workflow. |

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
| `o3` | $2.00 | $8.00 | 200K | 100K | Nowy standard w math, science, coding, visual reasoning. |
| `o3-pro` | $20.00 | $80.00 | 200K | 100K | Więcej compute na "myślenie". Konsekwentnie lepsze odpowiedzi. Drogi. |

### Google Gemini

| Model | Input $/1M | Output $/1M | Context | Max output | Multimodal | Opis |
|-------|-----------|------------|---------|------------|------------|------|
| `gemini-2.5-flash-lite` | $0.10 | $0.40 | 1M | 64K | text+image+audio+video | Ultra-tani, szybki. Lekki reasoning. Świetny do bulk processingu. |
| `gemini-2.5-flash` | $0.30 | $2.50 | 1M | 64K | text+image+audio+video | Workhorse Google — thinking, coding, math. Najlepszy stosunek cena/jakość w multimodalnych. |
| `gemini-2.5-pro` | $1.25 | $10.00 | 1M | 64K | text+image+audio+video | Frontier reasoning Google. Thinking mode. Audio+video input. |
| `gemini-3-flash-preview` | $0.50 | $3.00 | 1M | 64K | text+image+audio+video | Preview — blisko Pro w rozumowaniu i tool use. Szybki. |
| `gemini-3.1-pro-preview` | $2.00 | $12.00 | 1M | 64K | text+image+audio+video | Frontier reasoning. Lepszy agentic reliability i efektywność tokenów. |

### Open Source

| Model | Input $/1M | Output $/1M | Context | Max output | Multimodal | Opis |
|-------|-----------|------------|---------|------------|------------|------|
| `llama-4-scout` | $0.08 | $0.30 | 328K | 16K | text+image | Meta MoE 17B/109B. Najtańszy multimodalny z przyzwoitą jakością. |
| `llama-4-maverick` | $0.15 | $0.60 | 1M | 16K | text+image | Meta MoE 17B/400B+. 128 ekspertów. 1M context. Silniejszy od Scout. |
| `deepseek-chat-v3.1` | $0.15 | $0.75 | 32K | 7K | text-only | 671B/37B active. Hybrid reasoning (thinking + non-thinking). Tani. |
| `deepseek-v3.2` | $0.26 | $0.38 | 164K | N/A | text-only | Sparse Attention. Silny reasoning + tool use. Bardzo tani output. |
| `deepseek-v3.2-speciale` | $0.40 | $1.20 | 164K | 164K | text-only | High-compute wariant V3.2. Maksymalny reasoning i agentic performance. |
| `deepseek-r1-0528` | $0.45 | $2.15 | 164K | 64K | text-only | Open-source reasoning na poziomie o1. Pełne reasoning tokens. |

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

const answer = await ctx.llm.chat({
  model: Models.SMART,           // gemini-2.5-pro — gdy potrzeba rozumowania
  messages: [{ role: 'user', content: question }],
});
```

Dostępne predefiniowane aliasy: `CHEAP`, `FAST`, `BALANCED`, `SMART`, `REASONING`, `CODING` — patrz `packages/core/src/llm.ts`.
