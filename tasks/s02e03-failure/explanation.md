# S02E03 — Failure: Kompresja logów awarii elektrowni

## Problem

Elektrownia uległa awarii. Dostajemy ogromny plik logów (~2137 linii, ~70k tokenów), który nie mieści się w żadnym rozsądnym oknie kontekstowym do jednorazowej analizy. Zadanie: wybrać zdarzenia istotne dla analizy przyczyny awarii i skompresować je do **max 1500 tokenów** — zachowując format wieloliniowy (jedno zdarzenie = jedna linia).

## Ewolucja podejścia (co nie zadziałało i dlaczego)

### Podejście 1: Jednorazowa kompresja LLM (structured output)

**Pomysł:** Pre-filtruj programistycznie (zostaw WARN/ERRO/CRIT), podaj ~890 linii do LLM, poproś o skompresowanie do 1500 tokenów.

**Problem:** 890 linii (~31k tokenów) to za dużo na jednorazową kompresję z ratio 20:1. Model albo zwracał input bez zmian (890 linii), albo po drugiej próbie kompresji wrzucał wszystko w jedną linię. Structured output (`{ logs: string }`) dodatkowo utrudniał — model nie radził sobie z generowaniem wieloliniowego stringa w JSON.

### Podejście 2: Map-reduce (chunked compression)

**Pomysł:** Podziel 890 linii na chunki po 100, skompresuj każdy osobno (map), scal wyniki i skompresuj finalnie (reduce).

**Problem:** Kompresja działała lepiej, ale feedback loop był zepsuty. Gdy technicy odpowiadali „brakuje info o FIRMWARE", agent nie miał jak wyszukać tych informacji — pełne 31k tokenów filtrowanych logów lądowały w system prompcie refinementu, co było wolne i drogie. Agent nie miał **narzędzi** do reagowania na feedback.

### Podejście 3: Pełny agent z narzędziami

**Pomysł:** Agent LLM z narzędziami do przeszukiwania logów (search, stats, context). Sam eksploruje, buduje raport, wysyła, reaguje na feedback.

**Problem:** Niedeterministyczne — zależne od decyzji LLM. W jednym uruchomieniu agent znajdował flagę za pierwszym razem ($0.04), w innym wpadał w pętlę 30 iteracji ($0.79) bez sukcesu. Problemy:
- Agent kończył pracę po 3 iteracjach bez wywołania `submit_answer`
- Deduplikacja z licznikami `"(5x)"` myliła system weryfikacji
- Agent zmyślał timestampy z sekundami
- Identyczny feedback nie prowadził do zmiany strategii

**Wnioski:** Guardy (anti-loop, max submisji, wymuszanie tool calls) pomagały, ale nie gwarantowały sukcesu. Problem fundamentalny: **selekcja zdarzeń przez LLM jest niedeterministyczna**.

### Podejście 4: Deterministyczny baseline + agent do feedbacku (finalne)

**Pomysł:** Faza 1 jest w 100% programistyczna — parsowanie, deduplikacja, budżetowanie tokenów. LLM wchodzi dopiero w fazie 2, i tylko jeśli baseline zostanie odrzucony.

**Sukces:** 3/3 uruchomienia — flaga za pierwszym razem, 0 LLM calls, $0.00, ~0.4s.

## Architektura finalnego rozwiązania

```
FAZA 1 — DETERMINISTYCZNA (zawsze)
═══════════════════════════════════

  Plik logów (2137 linii, ~70k tok)
         │
         ▼
  ┌─────────────────────────────┐
  │  Parsowanie (regex)          │
  │  timestamp + severity + body │
  │  Normalizacja: HH:MM,       │
  │  CRITICAL→CRIT, ERROR→ERRO  │
  └──────────────┬──────────────┘
                 │
         ┌───────┴───────┐
         ▼               ▼
  ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ CRIT     │    │ ERRO     │    │ WARN     │
  │ dedup    │    │ dedup    │    │ dedup    │
  │ by body  │    │ by body  │    │ by body  │
  └────┬─────┘    └────┬─────┘    └────┬─────┘
       │               │               │
       ▼               ▼               ▼
  ┌─────────────────────────────────────────┐
  │  Budżetowanie tokenów:                  │
  │  1. Wszystkie unikalne CRIT (priorytet) │
  │  2. Dodawaj ERRO aż do ~1400 tok       │
  │  3. Dodawaj WARN aż do ~1500 tok       │
  │  4. Sortuj chronologicznie              │
  └──────────────┬──────────────────────────┘
                 │
                 ▼
  ┌─────────────────────────────┐
  │  Formatowanie:               │
  │  [YYYY-MM-DD HH:MM] [SEV]   │
  │  COMPONENT description       │
  └──────────────┬──────────────┘
                 │
                 ▼
           hub.verify()
                 │
           ┌─────┴─────┐
           │            │
        code=0      code≠0
           │            │
         FLAGA     przejdź do
                    FAZY 2


FAZA 2 — AGENTIC (tylko jeśli faza 1 nie wystarczy)
════════════════════════════════════════════════════

  Feedback od techników
         │
         ▼
  ┌──────────────────────────────────────┐
  │  Agent LLM (Gemini 2.5 Flash)        │
  │                                      │
  │  Narzędzia:                          │
  │  • search_logs(query, severity)      │
  │  • count_tokens(text)                │
  │  • submit_answer(logs)               │
  │                                      │
  │  Guardy:                             │
  │  • max 4 dodatkowe submisje          │
  │  • anti-loop (powtórzony feedback)   │
  │  • token guard (>1950 tok → odmowa)  │
  └──────────────────────────────────────┘
```

## Krok po kroku: co robi kod

### Parsowanie (funkcja `parseLine`, linia 44-60)

Regex wyciąga z każdej linii logu:
- **timestamp** — `YYYY-MM-DD HH:MM` (sekundy odrzucone — format wymagany przez Centralę)
- **severity** — normalizowany do CRIT/ERRO/WARN/INFO
- **body** — wszystko po `[SEVERITY]` — zawiera ID komponentu + opis zdarzenia
- **raw** — oryginalna linia

Regex: `/\[(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})(?::\d{2})?\]\s*\[(CRIT|ERRO|...)\]\s*(.*)/`

Kluczowa decyzja: `body` zawiera komponent + opis razem (np. `ECCS8 runaway outlet temperature`). Nie rozdzielamy ich — to zachowuje oryginalny tekst i unika problemów z parsowaniem.

### Deduplikacja (funkcja `dedup`, linia 63-73)

Deduplikacja po **pełnym body** — jeśli dwa zdarzenia mają identyczny tekst (np. `ECCS8 core cooling cannot maintain safe gradient`), zostaje tylko **pierwsze wystąpienie**.

Z 114 CRIT events → ~16 unikalnych typów. Z 282 ERRO → ~25 unikalnych. Z 494 WARN → ~30 unikalnych.

To jest kluczowe — bez deduplikacji same CRIT events zajmują ~3800 tokenów (ponad limit). Po deduplikacji ~500 tokenów.

### Budżetowanie tokenów (funkcja `buildBaseline`, linia 80-107)

Priorytetowa alokacja tokenów:

1. **Wszystkie unikalne CRIT** — zawsze wchodzą (priorytet absolutny). ~500 tokenów.
2. **Unikalne ERRO** — dodawane kolejno aż do budżetu 1400 tokenów. ~900 tokenów.
3. **Unikalne WARN** — dodawane aż do limitu 1500 tokenów. ~100 tokenów.

Stałe budżetowe:
- `TOKEN_BUDGET_CRIT = 1200` — nie stosowany jako hard limit, ale CRIT zawsze mieści się w ~500 tok
- `TOKEN_BUDGET_ERRO = 1400` — po dodaniu ERRO zostawiamy 100 tok na WARN
- `TOKEN_LIMIT = 1500` — twardy limit Centrali

Finalnie sortowanie chronologiczne — technicy widzą timeline awarii.

### Formatowanie (funkcja `formatLine`, linia 76-78)

Prosta konkatenacja: `[${timestamp}] [${severity}] ${body}`

Wynik: `[2026-03-18 06:04] [CRIT] ECCS8 runaway outlet temperature. Reactor trip initiated.`

Brak dwukropka po komponencie, brak sekund w timestamp — zgodne z formatem wymaganym przez Centralę.

### Faza 1: Deterministyczny submit (linia 115-133)

1. `fetch` → parsowanie → deduplikacja → budżetowanie → formatowanie
2. `hub.verify("failure", { logs: baseline })`
3. Jeśli `code === 0` → flaga, koniec. **Brak LLM calls.**

### Faza 2: Agent do feedbacku (linia 139-244)

Uruchamiany TYLKO jeśli faza 1 nie wystarczy. Agent dostaje:
- **Feedback techników** w system prompcie
- **Aktualny baseline** (który został odrzucony)
- **3 narzędzia**: `search_logs`, `count_tokens`, `submit_answer`

Agent wie CO było odrzucone i DLACZEGO — szuka brakujących informacji w oryginalnych logach i poprawia baseline.

Guardy w `submit_answer`:
- Token guard: odrzuca >1950 tokenów lokalnie
- Max 4 submisje agenta (+ 1 baseline = 5 total)
- Anti-loop: wykrywa identyczny feedback i wymusza zmianę strategii

## Kluczowe decyzje projektowe

### Dlaczego deduplikacja po pełnym body?

114 CRIT events → 16 unikalnych typów. Logi elektrowni są powtarzalne — te same alarmy pojawiają się co kilka minut. Technicy potrzebują wiedzieć *jakie* typy zdarzeń wystąpiły, nie *ile razy*. Deduplikacja z zachowaniem pierwszego wystąpienia daje pełny obraz bez redundancji.

### Dlaczego priorytet CRIT → ERRO → WARN?

CRIT to zdarzenia, które **bezpośrednio** doprowadziły do awarii (reactor trip, emergency shutdown). ERRO to problemy, które **eskalowały** do CRIT. WARN to wczesne sygnały. Taka hierarchia gwarantuje, że najważniejsze informacje zawsze się mieszczą.

### Dlaczego nie LLM do selekcji?

LLM jest **niedeterministyczny** — ten sam prompt może dać różne wyniki. W jednym uruchomieniu agent wybrał 16 linii i przeszedł, w innym wybrał 28 linii z deduplikacją "(5x)" i nie przeszedł. Programistyczna selekcja daje **identyczny wynik za każdym razem**.

### Dlaczego agent tylko do feedbacku?

Feedback od techników jest **nieprzewidywalny** — nie wiemy z góry, czego będą brakować. To jest idealny przypadek dla agenta: reaktywne szukanie brakujących danych na żądanie. Ale **pierwszy submit nie wymaga LLM** — wystarczy programistyczny pipeline.

### Dlaczego `estimateTokens` używa 3.5 char/token?

Konserwatywna heurystyka. Lepiej przeszacować (~1492 tok estimate vs ~1500 limit) i zmieścić się, niż niedoszacować i zostać odrzuconym.

## Wyniki

| Metryka | Wartość |
|---------|---------|
| Stabilność | 3/3 (100%) |
| Koszt | $0.00 (0 LLM calls) |
| Czas | ~0.4s |
| Baseline | 41 linii, ~1492 tokenów |
| Flaga | Za pierwszym submitem |

## Porównanie wszystkich podejść

| Aspekt | Structured output | Map-reduce | Pełny agent | **Baseline + agent** |
|--------|------------------|-----------|------------|---------------------|
| Stabilność | Niska | Średnia | Niska (1/3) | **100% (3/3)** |
| Koszt | ~$0.08 | ~$0.10 | $0.04-$0.79 | **$0.00** |
| Czas | ~130s | ~60s | 34-277s | **0.4s** |
| LLM calls | 2-4 | 10+ | 5-30 | **0** |
| Reaktywność na feedback | Słaba | Słaba | Dobra | **Dobra (faza 2)** |

## Lekcje wyniesione

1. **Deterministyczne podejście najpierw**: Jeśli problem ma strukturę (logi z severity, timestampami, komponentami), programistyczny pipeline jest szybszy, tańszy i stabilniejszy niż LLM.

2. **LLM tylko do tego, czego nie da się zaprogramować**: Feedback od techników jest wolnotekstowy i nieprzewidywalny — to idealny przypadek dla agenta. Selekcja zdarzeń po severity — nie.

3. **Deduplikacja jest kluczem kompresji**: Z 114 CRIT → 16 unikalnych (86% kompresja). Proste `Set` po treści body jest skuteczniejsze niż LLM-owa kompresja z ratio 20:1.

4. **Format ma znaczenie**: Sekundy w timestampie, dwukropek po komponencie, liczniki "(5x)" — drobne różnice w formacie mogą powodować odrzucenie przez system weryfikacji.

5. **Guardy dla agenta są konieczne**: Gdy agent wchodzi do gry (faza 2), potrzebuje: limitu submisji, wykrywania powtórzonych feedbacków, instrukcji zmiany strategii. Bez tego wchodzi w pętlę.
