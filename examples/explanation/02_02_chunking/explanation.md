# Wyjaśnienie: 02_02_chunking — Strategie podziału tekstu na chunki

## Porcja 1: Ogólna architektura i cel przykładu

### Po co to jest?

Lekcja S02E02 omawia łączenie LLM z zewnętrznymi źródłami wiedzy (RAG). Kluczowy problem: **jak podzielić długi dokument na mniejsze fragmenty (chunki)**, aby agent mógł je później skutecznie wyszukiwać i wykorzystywać?

Ten przykład implementuje **4 strategie chunkingu** na tym samym tekście i pozwala porównać wyniki.

### Struktura projektu

```
02_02_chunking/
├── app.js                         # Entry point — orkiestruje wszystkie strategie
├── src/
│   ├── api.js                     # Wrapper na Responses API (OpenAI/OpenRouter)
│   ├── utils.js                   # Budowanie indeksu nagłówków, szukanie sekcji
│   └── strategies/
│       ├── characters.js          # Strategia 1: podział po znakach
│       ├── separators.js          # Strategia 2: podział rekurencyjny po separatorach
│       ├── context.js             # Strategia 3: separator + wzbogacenie LLM
│       └── topics.js              # Strategia 4: AI identyfikuje tematy
├── workspace/
│   └── example.md                 # Dokument wejściowy (artykuł o prompt engineering)
└── context.md                     # Kontekst lekcji (materiał dydaktyczny)
```

### Przepływ danych

```
example.md  ──►  app.js  ──►  4 strategie  ──►  4 pliki JSONL
                                  │
                          characters (local)
                          separators (local)
                          context   (LLM)
                          topics    (LLM)
```

Każda strategia produkuje tablicę obiektów `{ content, metadata }` — to jest **ustandaryzowany format chunka**. Metadane różnią się w zależności od strategii, ale zawsze zawierają `strategy` i `index`.

### Punkt wejścia: `app.js`

```js
const main = async () => {
  await confirmRun();                              // ostrzeżenie o zużyciu tokenów
  const text = await readFile(INPUT, "utf-8");     // wczytanie dokumentu
  const opts = { source: INPUT };                  // metadane źródła

  await save("characters", chunkByCharacters(text));
  await save("separators", chunkBySeparators(text, opts));
  await save("context", await chunkWithContext(text, opts));    // async — LLM
  await save("topics", await chunkByTopics(text, opts));        // async — LLM
};
```

Kluczowa obserwacja: strategie `characters` i `separators` są **czysto lokalne** (bez LLM), a `context` i `topics` **zużywają tokeny**. Dlatego skrypt pyta o potwierdzenie przed startem i wskazuje na gotowe wyniki w `workspace/`.

Wyniki zapisywane są jako **JSONL** (JSON Lines) — po jednym obiekcie JSON na linię. To popularny format do przechowywania dokumentów/chunków, bo łatwo go streamować i przetwarzać linia po linii.

## Porcja 2: Narzędzia pomocnicze — `utils.js` i `api.js`

Zanim wejdziemy w strategie, warto zrozumieć dwa moduły współdzielone między nimi.

### `api.js` — wrapper na LLM

```js
export const chat = async (input, instructions, model = DEFAULT_MODEL) => {
  const body = { model, input };
  if (instructions) body.instructions = instructions;

  const res = await fetch(RESPONSES_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  const message = data.output.find((item) => item.type === "message");
  return message?.content?.[0]?.text ?? "";
};
```

Minimalistyczny wrapper — wysyła `input` (treść) i `instructions` (system prompt) do Responses API. Używa `gpt-4.1-mini` jako domyślnego modelu. Zwraca czysty string z odpowiedzią. Korzystają z niego strategie `context` i `topics`.

### `utils.js` — indeks nagłówków i lokalizacja sekcji

Ten moduł rozwiązuje problem: **"z jakiej sekcji dokumentu pochodzi dany chunk?"**. To ważne dla metadanych — agent nie tylko dostaje treść chunka, ale wie, skąd ona pochodzi.

**`buildHeadingIndex(text)`** — skanuje tekst i buduje posortowaną listę nagłówków:

```js
// 1. Markdown nagłówki: ## Tytuł, ### Podtytuł
const mdRegex = /^(#{1,6})\s+(.+)$/gm;

// 2. Plain-text nagłówki: krótka linia po pustej linii, po której od razu jest treść
const plainRegex = /(?:^|\n\n)([^\n]{1,80})\n(?=[A-Za-z"'\[(])/gm;
```

Wynik to tablica `{ position, level, title }` — pozycja w tekście, poziom zagnieżdżenia i tytuł. Dwuetapowe wykrywanie jest sprytne: obsługuje zarówno standardowy markdown, jak i artykuły, gdzie nagłówki nie mają `#` (jak `example.md` w tym przykładzie).

**`findSection(text, chunkContent, headings)`** — dla danego chunka znajduje najbliższy wcześniejszy nagłówek:

```js
// Bierze próbkę ze środka chunka (40%), nie z początku
const mid = Math.floor(chunkContent.length * 0.4);
const sample = chunkContent.slice(mid, mid + 100);
const pos = text.indexOf(sample);

// Iteruje po nagłówkach — ostatni przed pozycją chunka wygrywa
let current = null;
for (const h of headings) {
  if (h.position <= pos) current = h;
  else break;
}
```

Dlaczego próbka ze **środka**, a nie z początku? Bo chunki mają **overlap** (nakładanie się). Początek chunka N może być końcem chunka N-1, więc `indexOf` znalazłby złą pozycję. Próbka ze środka jest unikalna dla danego chunka.

### Dlaczego to ważne?

Lekcja podkreśla, że chunki bez metadanych o źródle są mało użyteczne. Agent, który znajdzie fragment tekstu, musi wiedzieć:
- **z jakiego pliku** pochodzi (`source`)
- **z jakiej sekcji** (`section`)

Te informacje służą zarówno modelowi (lepszy kontekst = lepsze odpowiedzi), jak i interfejsowi użytkownika (wyświetlanie odnośników do oryginału).

## Porcja 3: Strategia Characters — podział po znakach

### Idea

Najprostsza możliwa strategia: tniemy tekst na kawałki o stałej długości (domyślnie 1000 znaków), z nakładką (overlap) 200 znaków. Zero inteligencji — czysta matematyka.

### Implementacja

```js
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

export const chunkByCharacters = (text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) => {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    chunks.push(text.slice(start, start + size));
    start += size - overlap;   // przesuń okno o (1000 - 200) = 800 znaków
  }

  return chunks.map((content, i) => ({
    content,
    metadata: { strategy: "characters", index: i, chars: content.length, size, overlap },
  }));
};
```

### Jak działa okno przesuwne?

```
Tekst:    |████████████████████████████████████████████████|
Chunk 0:  |▓▓▓▓▓▓▓▓▓▓|                                    (0–1000)
Chunk 1:        |▓▓▓▓▓▓▓▓▓▓|                              (800–1800)
Chunk 2:              |▓▓▓▓▓▓▓▓▓▓|                        (1600–2600)
                ^^^^^^
                overlap — 200 znaków wspólnych między sąsiednimi chunkami
```

Każdy krok przesuwa okno o `size - overlap = 800` znaków. Overlap sprawia, że zdanie przecięte na granicy chunka N pojawi się w całości w chunka N+1 (lub odwrotnie). Bez overlapu wyszukiwanie mogłoby nie trafić we fragment, który akurat wpadł na granicę.

### Metadane

```json
{
  "content": "...fragment tekstu...",
  "metadata": {
    "strategy": "characters",
    "index": 3,
    "chars": 1000,
    "size": 1000,
    "overlap": 200
  }
}
```

Minimalne metadane — brak informacji o sekcji czy źródle. To celowe: strategia jest "głupia" i nie próbuje rozumieć struktury dokumentu.

### Kiedy to ma sens?

- **Nieustrukturyzowany tekst** — surowe logi, transkrypcje, OCR-owany tekst bez nagłówków
- **Szybki prototyp** — chcesz coś zaindeksować natychmiast, bez myślenia o strukturze
- **Baseline** — punkt odniesienia do porównania z lepszymi strategiami

### Główna wada

Chunk może zaczynać się w środku zdania i kończyć w środku innego. Model dostaje wyrwany fragment bez kontekstu — nie wie, z jakiej sekcji pochodzi ani o czym jest dokument. To jak wyrwanie losowej strony z książki — bez okładki i spisu treści.

## Porcja 4: Strategia Separators — podział rekurencyjny

### Idea

Zamiast ciąć tekst w losowym miejscu, **szanujemy strukturę dokumentu**. Dzielimy najpierw po nagłówkach, potem po akapitach, zdaniach, a na końcu po słowach. To podejście rekurencyjne — schodzimy na coraz drobniejszy poziom separatorów tylko wtedy, gdy chunk jest wciąż za duży.

### Hierarchia separatorów

```js
const SEPARATORS = ["\n## ", "\n### ", "\n\n", "\n", ". ", " "];
//                   nagłówek h2  h3    akapit  linia  zdanie  słowo
```

Kolejność ma znaczenie — preferujemy cięcie na granicach o największym znaczeniu semantycznym. Nagłówek H2 to naturalna granica tematu, akapit to granica myśli, zdanie to granica wypowiedzi.

### Algorytm `split()` — serce strategii

```js
const split = (text, size, overlap, separators, stats) => {
  if (text.length <= size) return [text];           // 1. Mieści się? Gotowe.

  const sep = separators.find((s) => text.includes(s));  // 2. Znajdź pierwszy pasujący separator
  if (!sep) return [text];                               //    Brak? Zwróć jak jest.

  const parts = text.split(sep);                    // 3. Podziel tekst
  const chunks = [];
  let current = "";

  for (const part of parts) {                       // 4. Sklejaj części aż zmieszczą się w limicie
    const candidate = current ? current + sep + part : part;
    if (candidate.length > size && current) {
      chunks.push(current);
      const overlapText = pickOverlap(current, overlap, sep);
      current = overlapText ? overlapText + sep + part : part;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  // 5. Rekurencja — jeśli chunk nadal za duży, spróbuj z kolejnym separatorem
  const remaining = separators.slice(separators.indexOf(sep) + 1);
  return chunks.flatMap((c) =>
    c.length > size && remaining.length ? split(c, size, overlap, remaining, stats) : [c]
  );
};
```

Wizualizacja na przykładzie:

```
Dokument (5000 znaków)
  │
  ├─ split po "\n## "  →  [Sekcja A (3000), Sekcja B (2000)]
  │                          │
  │                          ├─ za duża! split po "\n### "  →  [A1 (1800), A2 (1200)]
  │                          │                                    │
  │                          │                                    ├─ za duża! split po "\n\n" → [A1a, A1b]
  │                          │                                    │                              ✓ ok    ✓ ok
  │                          │                                    └─ ✓ ok
  │                          └─ ✓ ok
  └─ ✓ ok
```

### Overlap — sprytniejszy niż w `characters`

Funkcja `pickOverlap()` nie bierze surowych N ostatnich znaków. Szuka **granicy wiersza lub słowa** w ogonie chunka:

```js
const pickOverlap = (text, overlap, sep) => {
  const start = Math.max(0, text.length - overlap);
  const tail = text.slice(start);

  let idx = tail.search(/\n/);          // szukaj nowej linii
  if (idx === -1) idx = tail.search(/\s/);  // albo przynajmniej spacji

  let overlapText = text.slice(start + idx + 1);

  if (sep && overlapText.startsWith(sep)) {
    overlapText = overlapText.slice(sep.length);  // usuń separator z początku
  }
  return overlapText;
};
```

Dzięki temu overlap zaczyna się od pełnego słowa/linii, a nie od urwanego fragmentu. Stats (`trimmed`, `dropped`) informują, ile razy overlap został przycięty lub pominięty.

### Metadane — bogaciejsze niż w `characters`

```js
return chunks.map((content, i) => ({
  content,
  metadata: {
    strategy: "separators",
    index: i,
    chars: content.length,
    section: findSection(text, content, headings),  // ← z utils.js!
    source: source ?? null,                          // ← ścieżka pliku
  },
}));
```

Dzięki `buildHeadingIndex` + `findSection` z `utils.js`, każdy chunk wie, z jakiej sekcji pochodzi (np. `"## Latent Space"`). To ogromna różnica wobec strategii `characters` — agent widzi kontekst.

### Kiedy to ma sens?

- **Ustrukturyzowane dokumenty** — markdown, artykuły, dokumentacja z nagłówkami
- **Większość zastosowań produkcyjnych** — to de facto standard w wielu systemach RAG
- Dobry balans między prostotą a jakością

### Główna wada

Chunki nie wiedzą, o czym jest **reszta dokumentu**. Mają `section`, ale brak szerszego kontekstu. Jeśli chunk mówi o "tym podejściu", a definicja "podejścia" jest w innej sekcji — model nie połączy kropek.

## Porcja 5: Strategia Context — wzbogacanie chunków przez LLM

### Idea

Ta strategia to implementacja techniki **Contextual Retrieval** opublikowanej przez [Anthropic](https://www.anthropic.com/engineering/contextual-retrieval). Pomysł jest prosty: weź chunki ze strategii `separators`, a potem **poproś LLM o wygenerowanie krótkiego kontekstu** dla każdego z nich. Kontekst opisuje, jak dany fragment wpisuje się w całość dokumentu.

### Implementacja — zaskakująco krótka

Cały moduł to 31 linii. Większość pracy robi `separators` — tu dochodzi tylko warstwa LLM:

```js
import { chat } from "../api.js";
import { chunkBySeparators } from "./separators.js";

const enrichChunk = async (chunk) => {
  const context = await chat(
    `<chunk>${chunk.content}</chunk>`,
    "Generate a very short (1-2 sentence) context that situates this chunk within the overall document. Return ONLY the context, nothing else."
  );
  return {
    content: chunk.content,
    metadata: { ...chunk.metadata, strategy: "context", context },
  };
};
```

Kluczowe decyzje projektowe:

1. **Kompozycja, nie duplikacja** — `chunkWithContext` wywołuje `chunkBySeparators` i dobudowuje na jego wynikach. Nie reimplementuje podziału.
2. **XML-owy separator** — treść chunka owinięta w `<chunk>...</chunk>`. Lekcja S02E02 omawia tagi XML jako najlepszą praktykę oddzielania sekcji promptu.
3. **Kontekst w metadanych** — trafia do `metadata.context`, nie do `content`. Oryginalna treść chunka pozostaje nienaruszona.

### Sekwencyjne przetwarzanie

```js
export const chunkWithContext = async (text, opts = {}) => {
  const base = chunkBySeparators(text, opts);

  for (const [i, chunk] of base.entries()) {
    process.stdout.write(`  context: enriching ${i + 1}/${base.length}\r`);
    enriched.push(await enrichChunk(chunk));
  }

  return enriched;
};
```

Chunki wzbogacane są **sekwencyjnie** (`for...of` + `await`), nie równolegle. Dlaczego?
- **Rate limiting** — zbyt wiele równoległych requestów może trafić w limity API
- **Koszt kontroli** — łatwiej przerwać, gdy widzisz postęp (`enriching 5/23`)
- Tradeoff: wolniej, ale bezpieczniej. W produkcji można by dodać `Promise.all` z batching.

### Jak wygląda wzbogacony chunk?

```json
{
  "content": "If we break this problem down into smaller steps and provide feedback...",
  "metadata": {
    "strategy": "context",
    "index": 7,
    "chars": 892,
    "section": "## Broken Complexity",
    "source": "workspace/example.md",
    "context": "This chunk describes how breaking complex problems into smaller steps improves LLM reasoning accuracy, as part of a broader article on prompt engineering techniques."
  }
}
```

Pole `context` daje wyszukiwarce **dodatkowy sygnał semantyczny**. Gdy agent szuka "technik poprawiania rozumowania LLM", sam chunk może nie zawierać tych słów — ale kontekst je ma.

### Dlaczego to działa?

Lekcja wskazuje na artykuł Anthropic o Contextual Retrieval. Główny insight:
- Chunk w izolacji traci kontekst ("to podejście" — jakie podejście?)
- LLM widzi chunk w otoczeniu i potrafi wygenerować 1-2 zdania, które **wypełniają tę lukę**
- Przy wyszukiwaniu semantycznym (embedding), kontekst poprawia dopasowanie — embedding obejmuje zarówno `content`, jak i `context`

### Kiedy to ma sens?

- **Dokumenty, gdzie kontekst jest kluczowy** — raporty, artykuły naukowe, regulaminy
- **Gdy masz budżet na tokeny** — każdy chunk = 1 request do LLM
- **Hybrydowy RAG** — kontekst poprawia zarówno wyszukiwanie semantyczne, jak i full-text

### Główna wada

- **Koszt** — N chunków = N wywołań LLM. Dla 1000 dokumentów po 20 chunków = 20 000 requestów
- **Jakość kontekstu** — LLM widzi tylko pojedynczy chunk, nie cały dokument. Kontekst może być nieprecyzyjny
- **Czas indeksowania** — sekwencyjne przetwarzanie jest wolne

## Porcja 6: Strategia Topics — AI tworzy chunki od podstaw

### Idea

Odwrócenie podejścia. Zamiast dzielić tekst programistycznie i ewentualnie wzbogacać LLM-em, **oddajemy cały dokument modelowi** i prosimy go o identyfikację logicznych tematów. Model sam decyduje, gdzie ciąć.

### Implementacja

```js
export const chunkByTopics = async (text, { source } = {}) => {
  const raw = await chat(
    text,
    `You are a document chunking expert. Break the provided document into logical topic-based chunks.

Rules:
- Each chunk must contain ONE coherent topic or idea
- Preserve the original text — do NOT summarise or rewrite
- Return a JSON array of objects: [{ "topic": "short topic label", "content": "original text for this topic" }]
- Return ONLY the JSON array, no markdown fences or explanation`
  );

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    parsed = JSON.parse(cleaned);
  }

  const headings = buildHeadingIndex(text);

  return parsed.map((item, i) => ({
    content: item.content,
    metadata: {
      strategy: "topics",
      index: i,
      topic: item.topic,
      chars: item.content.length,
      section: findSection(text, item.content, headings),
      source: source ?? null,
    },
  }));
};
```

### Anatomia promptu

Prompt jest precyzyjny i zawiera kilka ważnych zabezpieczeń:

1. **"Preserve the original text — do NOT summarise or rewrite"** — model ma wyciąć fragmenty z oryginału, nie parafrazować. To kluczowe — chcemy indeksować prawdziwy tekst, nie interpretację modelu.
2. **"Return ONLY the JSON array"** — wymuszenie czystego outputu bez markdownowych bloków kodu ani komentarzy.
3. **Struktura `{ topic, content }`** — `topic` to etykieta (metadane), `content` to oryginalny tekst.

### Defensywne parsowanie JSON

```js
try {
  parsed = JSON.parse(raw);
} catch {
  const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  parsed = JSON.parse(cleaned);
}
```

Mimo instrukcji "no markdown fences", modele często owijają JSON w ` ```json ... ``` `. Kod najpierw próbuje sparsować surowy output, a jak się nie uda — czyści markdown fences i próbuje ponownie. Pragmatyczne podejście do nieprzewidywalności LLM.

### Metadane — najbogatsze ze wszystkich strategii

```json
{
  "content": "Speaking about prompt engineering techniques, I should mention...",
  "metadata": {
    "strategy": "topics",
    "index": 4,
    "topic": "Latent Space Activation",
    "chars": 1243,
    "section": "## Latent Space",
    "source": "workspace/example.md"
  }
}
```

Pole `topic` to **semantyczna etykieta wygenerowana przez AI** — nie nazwa nagłówka, lecz opis tematu chunka. To daje wyszukiwarce kolejny sygnał: oprócz samej treści i sekcji, mamy krótki opis tego, o czym jest fragment.

### Fundamentalna różnica wobec pozostałych strategii

| Aspekt | characters / separators | context | topics |
|--------|------------------------|---------|--------|
| Kto dzieli tekst? | Kod | Kod (separator), LLM dodaje kontekst | **LLM** |
| Granice chunków | Znaki / separatory | Separatory | **Granice tematyczne** |
| Oryginalna treść zachowana? | Tak | Tak | **Zależy od modelu** |
| Liczba wywołań LLM | 0 | N (per chunk) | **1** (cały dokument) |

Kluczowa obserwacja: strategia `topics` to **tylko 1 wywołanie LLM** (za to z całym dokumentem jako inputem), podczas gdy `context` to **N wywołań** (po jednym na chunk). Koszt per-token może być podobny, ale latencja zupełnie inna.

### Kiedy to ma sens?

- **Dokumenty o nieoczywistej strukturze** — treść bez nagłówków, gdzie tematy przeplatają się
- **Gdy zależy nam na semantycznie spójnych chunkach** — każdy fragment = jeden temat
- **Tworzenie indeksu opartego na tematach** — pole `topic` świetnie sprawdza się jako filtr w wyszukiwaniu

### Główne ryzyka

- **Model może parafrazować** — mimo instrukcji "preserve original text", LLM potrafi subtelnie zmienić treść. W produkcji warto weryfikować, czy `content` faktycznie istnieje w oryginale.
- **Limit okna kontekstowego** — cały dokument musi zmieścić się w jednym requeście. Dla długich dokumentów (100k+ znaków) to może być problem.
- **Niestabilność outputu** — ten sam dokument przy kolejnym uruchomieniu może dać inne podziały. Chunki nie są deterministyczne.

## Porcja 7: Podsumowanie — porównanie strategii i wnioski z lekcji

### Zestawienie czterech strategii

| | Characters | Separators | Context | Topics |
|---|---|---|---|---|
| **Podział** | Stała liczba znaków | Rekurencyjny po separatorach | Jak separators + kontekst LLM | LLM identyfikuje tematy |
| **Rozumie strukturę?** | Nie | Tak (nagłówki, akapity) | Tak + szerszy kontekst | Tak (semantycznie) |
| **Metadane** | Minimalne | `section`, `source` | `section`, `source`, `context` | `section`, `source`, `topic` |
| **Wywołania LLM** | 0 | 0 | N (per chunk) | 1 (cały dokument) |
| **Determinizm** | Tak | Tak | Nie | Nie |
| **Koszt** | Zero | Zero | Wysoki | Średni |
| **Czas indeksowania** | Natychmiastowy | Natychmiastowy | Wolny (sekwencyjny) | Szybki (1 request) |

### Wzorce projektowe widoczne w kodzie

**1. Kompozycja strategii** — `context` buduje na `separators`, nie reimplementuje podziału. To wzorzec warstwowy: prosta strategia jako fundament, LLM jako warstwa wzbogacająca.

**2. Ustandaryzowany format wyjścia** — każda strategia zwraca `{ content, metadata }`. Dzięki temu `app.js` traktuje je jednakowo (`save()` serializuje do JSONL). W produkcji ten sam format trafia do indeksu wyszukiwania niezależnie od strategii.

**3. Metadane rosną z inteligencją strategii** — od samego `index` i `chars`, przez `section` i `source`, aż po `context` i `topic`. To odzwierciedla kompromis: więcej metadanych = lepsze wyszukiwanie, ale też większy koszt.

**4. Graceful degradation** — `pickOverlap` w separators loguje `trimmed`/`dropped` zamiast rzucać błąd. Parsowanie JSON w `topics` ma fallback. Kod zakłada, że LLM jest nieprzewidywalny, i się zabezpiecza.

### Wnioski z lekcji S02E02

Lekcja formułuje kilka kluczowych zasad, które ten przykład ilustruje:

1. **"Jak tworzyć dokumenty?" musi uwzględniać "jak agent będzie do nich docierał?"** — strategia chunkingu powinna być dobrana do mechanizmu wyszukiwania. Full-text search lepiej działa z `separators` (naturalne frazy), semantic search lepiej z `context`/`topics` (bogatsze znaczenie).

2. **Ograniczenie treści jednorazowo wczytywanych do kontekstu** — chunki o 1000 znakach to nie przypadek. Lekcja mówi o 200-500 słów / 500-4000 tokenów jako optymalnym zakresie. Za duże chunki rozmywają uwagę modelu, za małe tracą kontekst.

3. **Metadane o źródle są niezbędne** — nie tylko dla modelu (lepsze odpowiedzi), ale też dla UI (wyświetlanie odnośników, cytowanie oryginału).

4. **Nie ma jednej najlepszej strategii** — lekcja jawnie mówi: pytaj "które podejście jest najlepsze **dla mojego problemu**?", a nie "które jest najlepsze?". Ten przykład daje narzędzia do porównania.

### Kiedy wybrać którą strategię?

```
Czy dokument ma strukturę (nagłówki, sekcje)?
├── Nie  → characters (lub topics jeśli masz budżet)
└── Tak  → separators jako baseline
           ├── Potrzebujesz lepszego wyszukiwania? → context
           └── Tematy się przeplatają / brak jasnych granic? → topics
```

### Co dalej w kursie?

Ten przykład przygotowuje grunt pod **02_02_hybrid_rag** — pełny system RAG z SQLite, FTS5 (full-text search) i sqlite-vec (semantic search). Tam te chunki trafiają do prawdziwego indeksu, a agent przeszukuje je hybrydowo łącząc oba mechanizmy.

