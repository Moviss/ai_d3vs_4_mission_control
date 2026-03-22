# Wyjaśnienie: 01_01_grounding — Grounding Tool

## Porcja 1: Ogólna architektura i cel narzędzia

### Co robi to narzędzie?

Grounding Tool przetwarza notatki w formacie Markdown i generuje interaktywny dokument HTML, w którym **kluczowe pojęcia są podświetlone**. Po najechaniu/kliknięciu na podświetlone frazy pojawia się tooltip z opisem pobranym z internetu oraz linkami do źródeł.

Lekcja opisuje to tak: LLM wybiera z treści **słowa kluczowe, definicje i koncepcje**, a następnie każda fraza trafia do wyszukiwarki w celu uzyskania pogłębionego opisu.

### Pipeline — 4 etapy przetwarzania

Aplikacja działa sekwencyjnie w 4 krokach, widocznych wprost w `app.js`:

```javascript
// app.js — główna orkiestracja
console.log("1. Extracting concepts...");
const conceptsData = await extractConcepts(paragraphs, sourceFile);

console.log("2. Deduplicating concepts...");
const dedupeData = await dedupeConcepts(conceptsData);

console.log("3. Web search grounding...");
const searchData = await searchConcepts(conceptsData, dedupeData);

console.log("4. Generating HTML...");
await generateAndApplyTemplate(markdown, conceptsData, dedupeData, searchData);
```

Każdy etap:
1. **Extract** — wyciąga pojęcia z poszczególnych akapitów
2. **Dedupe** — łączy duplikaty i aliasy w grupy
3. **Search** — wyszukuje informacje w internecie dla każdej grupy
4. **Ground** — generuje HTML z podświetleniami i tooltipami

### Struktura katalogów

```
01_01_grounding/
├── app.js                  # Entry point — orkiestracja pipeline'u
├── template.html           # Szablon HTML z CSS + JS dla tooltipów
├── notes/                  # Źródłowe pliki .md do przetworzenia
├── output/                 # Wyniki: concepts.json, dedupe.json, search_results.json, grounded.html
└── src/
    ├── config.js           # Ścieżki, modele, parametry CLI
    ├── api.js              # Wrapper nad Responses API (fetch + retry)
    ├── pipeline/           # 4 etapy pipeline'u + filtr koncepcji
    │   ├── extract.js
    │   ├── dedupe.js
    │   ├── search.js
    │   ├── ground.js
    │   └── concept-filter.js
    ├── prompts/            # Prompt builders dla każdego etapu
    │   ├── extract.js
    │   ├── dedupe.js
    │   ├── search.js
    │   └── ground.js
    ├── schemas/            # JSON Schema (Structured Output) dla każdego etapu
    │   ├── extract.js
    │   ├── dedupe.js
    │   ├── search.js
    │   ├── ground.js
    │   └── categories.js
    └── utils/              # Helpery: pliki, hash, tekst
        ├── file.js
        ├── hash.js
        └── text.js
```

### Kluczowa decyzja architektoniczna

Kod jest zorganizowany wokół **separacji promptów, schematów i logiki pipeline'u**. Każdy etap ma swój:
- **prompt** (`prompts/*.js`) — instrukcja dla LLM
- **schema** (`schemas/*.js`) — struktura odpowiedzi (Structured Output)
- **pipeline step** (`pipeline/*.js`) — logika orkiestracji, cachowania i walidacji

To oznacza, że zmiana promptu nie wymaga dotykania logiki przetwarzania i odwrotnie. W lekcji Adam podkreśla, że dla nas istotne są przede wszystkim **schematy JSON** i **instrukcje** — reszta to detale implementacji.

### Wzorzec: tekst dzielony na fragmenty

Mimo że cały tekst zmieściłby się w oknie kontekstowym, aplikacja przetwarza go **akapit po akapicie**. Dlaczego? Lekcja wyjaśnia wprost:

> Skupienie uwagi modelu na mniejszym zakresie sprawia, że skuteczność modelu jest wyższa. Co więcej, otwiera to przestrzeń do zastosowania mniejszych, tańszych i szybszych modeli.

To fundamentalny wzorzec w generatywnych aplikacjach — **dekompozycja problemu** zamiast wrzucania wszystkiego naraz.

## Porcja 2: Structured Output — schematy JSON i ekstrakcja koncepcji

### Czym jest Structured Output?

Structured Output to mechanizm API (OpenAI, Anthropic, Gemini), który **gwarantuje**, że odpowiedź modelu będzie miała dokładnie taką strukturę JSON, jakiej oczekujemy. Przekazujemy JSON Schema w polu `response_format` / `text.format`, a model generuje tekst zgodny z tym schematem.

Kluczowa uwaga z lekcji: struktura jest gwarantowana, ale **wartości** zależą od jakości **nazw i opisów** w schemacie. To dlatego `description` przy każdym polu jest tak ważne.

### Taksonomia kategorii

Punkt wyjścia to lista kategorii w `schemas/categories.js`:

```javascript
export const CONCEPT_CATEGORIES = [
  "claim",      // twierdzenie weryfikowalne
  "result",     // wynik/odkrycie
  "method",     // procedura/algorytm
  "metric",     // miara ilościowa
  "resource",   // narzędzie/dataset
  "definition", // definicja terminu
  "term",       // termin domenowy
  "entity",     // osoba/organizacja/produkt
  "reference"   // cytowane źródło
];
```

Ta lista jest używana jako `enum` w schemacie ekstrakcji — model **musi** wybrać jedną z tych wartości. To ogranicza przestrzeń odpowiedzi i zwiększa spójność klasyfikacji.

### Schema ekstrakcji — `schemas/extract.js`

Schemat wymusza na modelu zwrócenie tablicy koncepcji, każda z precyzyjnie zdefiniowanymi polami:

```javascript
extractSchema = {
  type: "json_schema",
  name: "concept_extraction",
  strict: true,  // ← gwarancja struktury
  schema: {
    properties: {
      concepts: {
        type: "array",
        items: {
          properties: {
            label:        // kanoniczna nazwa koncepcji
            category:     // enum z CONCEPT_CATEGORIES
            needsSearch:  // czy wymaga weryfikacji w internecie
            searchQuery:  // zapytanie do wyszukiwarki (lub null)
            reason:       // uzasadnienie ekstrakcji
            surfaceForms: // dokładne frazy z tekstu (3-12 słów)
          }
        }
      }
    }
  }
};
```

Zwróć uwagę na kilka rzeczy:

1. **`strict: true`** — wymusza 100% zgodność ze schematem. Bez tego model mógłby dodać własne pola lub pominąć wymagane.

2. **`surfaceForms`** — to nie jest dowolny opis, lecz **dokładne fragmenty tekstu** skopiowane z akapitu. Dzięki temu w etapie Ground można je znaleźć i owinąć tagiem HTML. Opis mówi: "Short key phrases (3-12 words) copied exactly from the paragraph."

3. **`needsSearch` + `searchQuery`** — model sam decyduje, które koncepcje wymagają weryfikacji w internecie. Dobrze znane terminy (`needsSearch: false`) nie generują zbędnych zapytań do wyszukiwarki.

4. **`reason`** — pole "reasoning" generowane **przed** innymi wartościami. Lekcja podkreśla, że kolejność pól ma znaczenie: "reasoning generowany jako pierwszy wpłynie na określenie sentiment". Tu `reason` pomaga modelowi lepiej sklasyfikować koncepcję.

### Prompt ekstrakcji — `prompts/extract.js`

Prompt składa się z dwóch części: **stałych wytycznych** i **dynamicznego kontekstu**:

```javascript
// Stałe wytyczne — EXTRACTION_GUIDELINES
`Goal: extract verifiable claims and key terms that benefit from grounding via web search.

Categories:
- claim: a verifiable statement with facts, dates, counts, or attributions
- definition: an explicit definition or explanation of a term
...

surfaceForms rules (CRITICAL):
- surfaceForms are SHORT KEY PHRASES, NOT entire sentences.
- Ideal length: 3-12 words. Never exceed 15 words.
- GOOD: 'introduced by Google researchers in 2017'
- BAD: 'The transformer was introduced by Google researchers in 2017.' (too long)
...`
```

```javascript
// Dynamiczny kontekst — buildExtractPrompt
`Document context: paragraph ${index + 1} of ${total}
Paragraph type: ${paragraphType}
Target concepts: ${targetCount} (fewer for headers, more for body)

--- Paragraph ---
${paragraph}`
```

Ważne wzorce:
- **Few-shot w opisach** — zamiast osobnej sekcji `<examples>`, przykłady dobre i złe są wbudowane wprost w wytyczne (`GOOD:` / `BAD:`). To kompaktowy sposób na few-shot.
- **Target count** — prompt mówi modelowi ile koncepcji wyciągnąć (0-1 dla nagłówków, 2-5 dla body). To "miękki" limit — ostateczne ograniczenie egzekwuje `concept-filter.js`.
- **Paragraph type** — model dostaje informację czy to nagłówek czy akapit, co wpływa na strategię ekstrakcji.

### Jak to jest wywoływane — `pipeline/extract.js`

```javascript
const data = await callResponses({
  model: models.extract,
  input,                        // prompt z buildExtractPrompt
  textFormat: extractSchema,    // JSON Schema → Structured Output
  reasoning: { effort: "medium" } // model "myśli" ale nie za długo
});

const result = parseJsonOutput(data, `extract: paragraph ${item.index + 1}`);
```

Parametr `reasoning: { effort: "medium" }` to ciekawy detal — model używa wewnętrznego chain-of-thought, ale z ograniczonym budżetem tokenów. Dla ekstrakcji koncepcji nie potrzeba głębokiego rozumowania.

### Wzorzec: schemat jako kontrakt

JSON Schema pełni tu podwójną rolę:
1. **Techniczny kontrakt** — gwarantuje parsowanie bez błędów (`JSON.parse` nigdy nie rzuci wyjątku)
2. **Instrukcja dla modelu** — nazwy pól i opisy kierują generowaniem wartości

To dokładnie to, o czym mówi lekcja: "Wartości są generowane przez model na podstawie treści (input) oraz nazw i opisów. Muszą być zrozumiałe, a jednocześnie zwięzłe."

## Porcja 3: Filtrowanie koncepcji, deduplikacja i cachowanie

### Filtr koncepcji — `pipeline/concept-filter.js`

Model nie zawsze generuje idealne wyniki. Nawet z `strict: true` wartości mogą być nietrafione — np. surfaceForm może nie istnieć w tekście lub być za długi. Dlatego po każdym wywołaniu LLM wyniki przechodzą przez **deterministyczny filtr**:

```javascript
const normalizeSurfaceForms = (surfaceForms, paragraph) => {
  // 1. Odrzuć jeśli nie jest stringiem
  // 2. Usuń składnię markdown (##, *, etc.)
  // 3. Odrzuć jeśli > 100 znaków (prawdopodobnie całe zdanie)
  // 4. Odrzuć jeśli fraza nie występuje dosłownie w akapicie
  // 5. Deduplikacja
};
```

Kluczowy jest punkt 4 — **weryfikacja obecności w tekście źródłowym**. Model mógł "wymyślić" frazę lub lekko ją zmienić. Filtr sprawdza:

```javascript
if (!paragraph.includes(trimmed) && !cleanParagraph.includes(trimmed)) {
  return; // odrzuć — nie ma takiej frazy w tekście
}
```

Po normalizacji koncepcji następuje **limitowanie**:

```javascript
export const filterConcepts = ({ concepts, paragraph, paragraphType }) => {
  const maxCount = paragraphType === "header" ? MAX_HEADER : MAX_BODY;
  // MAX_HEADER = 1, MAX_BODY = 5

  // Sortuj po długości label (dłuższe = bardziej specyficzne)
  const sorted = Array.from(deduped.values())
    .sort((a, b) => b.label.length - a.label.length);

  return sorted.slice(0, maxCount);
};
```

To jest wzorzec **"ufaj, ale weryfikuj"** — LLM generuje, kod waliduje. Prompt mówi "target 2-5 koncepcji", ale to filtr ma ostatnie słowo.

### Deduplikacja — `pipeline/dedupe.js`

Po ekstrakcji koncepcji ze wszystkich akapitów mogą pojawić się duplikaty. Na przykład "GPT-4" w akapicie 3 i "model GPT-4" w akapicie 7 to ta sama koncepcja.

Deduplikacja to **osobne wywołanie LLM** z własnym schematem:

```javascript
// schemas/dedupe.js
dedupeSchema = {
  schema: {
    properties: {
      groups: {
        items: {
          properties: {
            canonical:  // preferowana nazwa grupy
            ids:        // numery koncepcji należących do grupy
            aliases:    // alternatywne nazwy
            rationale:  // uzasadnienie grupowania
          }
        }
      }
    }
  }
};
```

Prompt jest restrykcyjny — celowo ogranicza agresywność grupowania:

```javascript
`Group concepts only when they are strict paraphrases of the same claim or term.
Do NOT group related-but-distinct ideas (cause/effect, property vs consequence,
part/whole, example vs category, metric vs definition).
Only group items with the same category; if categories differ, keep them separate.
If unsure, do not group.`
```

Dlaczego taka ostrożność? Bo zbyt agresywne grupowanie straciłoby niuanse — "transformer architecture" i "attention mechanism" są powiązane, ale to różne koncepcje zasługujące na osobne tooltipe.

Na wejściu model dostaje ponumerowaną listę koncepcji (tylko te z `needsSearch: true`), a na wyjściu — grupy z kanonicznymi nazwami. W etapie Search wyszukiwanie odbywa się per **grupa**, nie per koncepcja — to eliminuje redundantne zapytania.

### System cachowania

Każdy etap pipeline'u zapisuje wyniki do pliku JSON w `output/`:
- `concepts.json` — wyniki ekstrakcji
- `dedupe.json` — wyniki deduplikacji
- `search_results.json` — wyniki wyszukiwania

Przy kolejnym uruchomieniu każdy etap sprawdza, czy może pominąć przetwarzanie:

```javascript
// extract.js — cache per akapit
const paragraphHash = hashText(paragraph);
const cached = entryByIndex.get(index);

if (cached && cached.hash === paragraphHash && !cli.force) {
  console.log(`  [${index + 1}/${paragraphs.length}] Cached`);
  continue; // pomiń — akapit się nie zmienił
}
```

```javascript
// dedupe.js — cache na podstawie hash'y koncepcji
const sameConceptsHash = existing?.conceptsHash === conceptsData.conceptsHash;
if (sameSource && sameCounts && sameSourceHash && sameConceptsHash && !cli.force) {
  console.log("   Using cached dedupe data");
  return existing;
}
```

Cachowanie jest **kaskadowe** — zmiana tekstu źródłowego invaliduje ekstrakcję, co zmienia `conceptsHash`, co invaliduje deduplikację, co zmienia `dedupeHash`, co invaliduje wyszukiwanie.

Zapis odbywa się przez `safeWriteJson` — atomowy zapis przez plik tymczasowy + rename:

```javascript
export const safeWriteJson = async (filePath, data) => {
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, JSON.stringify(data, null, 2) + "\n", "utf8");
  await rename(tempPath, filePath); // atomowa operacja na fs
};
```

Gdyby skrypt padł w trakcie zapisu, plik `.tmp` nie nadpisze istniejącego poprawnego pliku.

### Wzorzec: przetwarzanie równoległe w grupach

Zarówno ekstrakcja, wyszukiwanie, jak i grounding wysyłają zapytania **równolegle**, ale z limitem `CONCURRENCY = 5`:

```javascript
const batches = chunk(pending, CONCURRENCY);

for (const batch of batches) {
  const results = await Promise.all(
    batch.map((item) => extractSingleParagraph(item, total))
  );
  // zapisz wyniki po każdej grupie
  await updateAndPersist(conceptsData, ...);
}
```

Lekcja mówi wprost: "Zapytania wysyłane są równolegle oraz w grupach. W ten sposób zmniejszam czas wykonania zadania, a jednocześnie unikam uderzenia w rate-limit API."

Zapis po **każdej grupie** (nie dopiero na końcu) to dodatkowe zabezpieczenie — jeśli grupa 4/10 padnie, wyniki grup 1-3 są już na dysku.

## Porcja 4: Web search, generowanie HTML i szablon tooltipów

### Etap 3: Wyszukiwanie w internecie — `pipeline/search.js`

Po deduplikacji mamy grupy koncepcji z kanonicznymi nazwami. Teraz dla każdej grupy (z `needsSearch: true`) aplikacja szuka informacji w internecie.

#### Dwa tryby wyszukiwania — OpenAI vs OpenRouter

Kod obsługuje dwóch providerów z **różnym mechanizmem web search**:

```javascript
const buildSearchRequest = ({ model, input }) => {
  if (AI_PROVIDER === "openrouter") {
    // OpenRouter — web search przez sufiks ":online" w nazwie modelu
    return {
      model,  // np. "gpt-5.4:online"
      input,
      textFormat: searchSchema
    };
  }

  // OpenAI — natywne narzędzie web_search
  return {
    model,
    input,
    tools: [{ type: "web_search" }],
    include: ["web_search_call.action.sources"],
    textFormat: searchSchema
  };
};
```

U OpenAI web search to **narzędzie** (tool) — model sam decyduje kiedy je wywołać. W OpenRouter to **cecha modelu** aktywowana sufiksem `:online`. Efekt jest podobny, ale implementacja po stronie providera zupełnie inna.

#### Schema wyszukiwania

```javascript
searchSchema = {
  schema: {
    properties: {
      summary:   // zwięzłe streszczenie oparte na źródłach
      keyPoints: // 2-4 kluczowe fakty
      sources:   // tytuł + URL dla każdego źródła
    }
  }
};
```

Model dostaje prompt z nazwą koncepcji, ewentualnym zapytaniem i aliasami:

```javascript
`Use web search to verify and expand on this concept.
Concept: ${concept.canonical}
Search query: ${concept.searchQuery}
Also known as: ${concept.aliases.join(", ")}`
```

#### Wyciąganie źródeł z odpowiedzi — `api.js: extractSources()`

Źródła mogą pojawić się w odpowiedzi API w dwóch miejscach:
1. **`web_search_call.action.sources`** — jawne źródła z narzędzia search
2. **`url_citation`** — cytaty inline osadzone w tekście odpowiedzi

Funkcja `extractSources` rekurencyjnie przeszukuje całą odpowiedź, zbiera oba typy i deduplikuje po URL:

```javascript
const collectCitations = (node) => {
  if (!node || typeof node !== "object") return;
  const citation = node.url_citation;
  if (citation?.url) {
    citationSources.push({ title: citation.title ?? null, url: citation.url });
  }
  for (const value of Object.values(node)) {
    collectCitations(value);  // rekurencja po całym drzewie odpowiedzi
  }
};
```

### Etap 4: Generowanie HTML — `pipeline/ground.js`

Ostatni etap łączy wszystko w interaktywny dokument.

#### Budowanie grounding items

Dla każdej grupy koncepcji tworzony jest obiekt z:
- **surfaceForms** — dokładne frazy do podświetlenia (posortowane od najdłuższych)
- **paragraphIndices** — w których akapitach się pojawiają
- **dataAttr** — JSON zakodowany jako atrybut HTML (`data-grounding`), zawierający summary + sources

```javascript
const dataAttr = escapeAttribute(
  JSON.stringify({
    summary,   // streszczenie ze search (max 420 znaków)
    sources    // [{ title, url }, ...]
  })
);
```

Ten JSON trafia potem do atrybutu HTML `data-grounding="..."` i jest parsowany przez JavaScript w przeglądarce przy kliknięciu na tooltip.

#### Grounding per akapit

Każdy akapit jest wysyłany do LLM z listą koncepcji, które w nim występują. Model opakowuje frazy w tagi `<span>`:

```javascript
// prompt ground.js
`Convert this single paragraph into semantic HTML.
Highlight concepts by wrapping exact surfaceForms with:
<span class="grounded" data-grounding="...">phrase</span>

Rules:
- Only wrap phrases that appear verbatim in the paragraph
- Use the provided dataAttr value verbatim for data-grounding
- Prefer the longest matching surfaceForm when multiple overlaps exist
- Avoid wrapping the same concept multiple times`
```

Jeśli akapit nie ma żadnych koncepcji do podświetlenia, LLM nie jest wywoływany — zamiast tego działa prosty konwerter `convertToBasicHtml`:

```javascript
const groundSingleParagraph = async (paragraph, relevantItems, index, total) => {
  if (!relevantItems.length) {
    return convertToBasicHtml(paragraph);  // bez LLM — prosty regex
  }
  // ... wywołanie LLM
};
```

`convertToBasicHtml` rozpoznaje nagłówki (`# ...`), listy (`- ...`) i zwykłe akapity — konwertuje je do odpowiednich tagów HTML bez angażowania modelu. Oszczędność tokenów i czasu.

#### Składanie finalnego dokumentu

Wszystkie fragmenty HTML trafiają do szablonu `template.html`:

```javascript
const htmlChunk = htmlParts.join("\n\n");
const template = await readFile(paths.template, "utf8");
const filled = template.replace("<!--CONTENT-->", htmlChunk);
await writeFile(paths.grounded, filled, "utf8");
```

### Szablon — `template.html`

Szablon to kompletna strona HTML z:

1. **CSS** (~800 linii) — dark theme, stylizacja tooltipów, responsywność (mobile bottom sheet), animacje, print styles
2. **HTML** — struktura tooltipa: nagłówek z terminem, body z opisem, sekcja sources z faviconami, podpowiedź klawiszowa (Esc)
3. **JavaScript** (~400 linii) — logika interakcji:

```javascript
// Parsowanie data-grounding z atrybutu HTML
function parseGrounding(text) {
  const parsed = JSON.parse(text);
  return {
    content: parsed.summary,
    sources: parsed.sources.map(source => ({
      url: source.url,
      title: source.title,
      domain: new URL(source.url).hostname.replace("www.", "")
    }))
  };
}
```

Kluczowe mechaniki tooltipa:
- **Desktop**: hover z opóźnieniem 150ms (SHOW_DELAY) + 300ms na przejechanie do tooltipa (HIDE_DELAY). Klik "przypina" tooltip.
- **Mobile**: bottom sheet z drag-to-dismiss (próg 80px), backdrop blur, body scroll lock
- **Keyboard**: Esc zamyka tooltip
- **Badge**: przy hoverze pojawia się licznik źródeł (CSS `::after` z `attr(data-source-count)`)
- **Stats**: stały wskaźnik w prawym dolnym rogu pokazuje liczbę podświetlonych koncepcji

Cała interakcja jest zbudowana bez żadnego frameworka — vanilla JS + CSS transitions/animations.

## Porcja 5: Warstwa API, odporność na błędy i podsumowanie

### Wrapper API — `api.js`

Cały kontakt z LLM przechodzi przez jedną funkcję `chat()` (alias `callResponses`). To cienki wrapper nad `fetch`, ale z kilkoma istotnymi mechanikami.

#### Budowanie żądania

```javascript
const buildRequestBody = ({ model, input, textFormat, tools, include, reasoning, previousResponseId }) => {
  const body = { model, input };
  // Dodaje opcjonalne pola tylko jeśli nie są undefined
  const optionalFields = {
    text: textFormat ? { format: textFormat } : undefined,
    tools,
    include,
    reasoning,
    previous_response_id: previousResponseId
  };
  for (const [key, value] of Object.entries(optionalFields)) {
    if (value !== undefined) body[key] = value;
  }
  return body;
};
```

Wzorzec: **nie wysyłaj pól, których nie potrzebujesz**. Zamiast `text: undefined` (co mogłoby zirytować API), pole po prostu nie istnieje w body. To ważne, bo różne etapy pipeline'u używają różnych kombinacji parametrów — extract potrzebuje `textFormat` + `reasoning`, search dodaje `tools` + `include`, itp.

#### Retry z exponential backoff

```javascript
const fetchWithRetry = async (url, options) => {
  for (let attempt = 0; attempt < api.retries; attempt++) {  // retries = 3
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), api.timeoutMs);  // 180s

    const response = await fetch(url, { ...options, signal: controller.signal });

    if (response.ok) return response;

    if (!isRetryable(response.status)) throw lastError;  // 4xx (poza 429) = nie próbuj

    const delay = api.retryDelayMs * 2 ** attempt;  // 1s, 2s, 4s
    await sleep(delay);
  }
};
```

Trzy warstwy ochrony:
1. **Timeout** — `AbortController` z limitem 180 sekund. Web search + structured output mogą trwać długo.
2. **Retry** — maksymalnie 3 próby, ale tylko dla kodów 429 (rate limit), 500, 502, 503. Błąd 400 (zły request) nie jest retryowalny — ponawianie nie pomoże.
3. **Exponential backoff** — opóźnienia rosną: 1s → 2s → 4s. Przy rate limicie (429) daje to API czas na "odpoczynek".

#### Ekstrakcja odpowiedzi — trzy funkcje

API Responses zwraca złożoną strukturę. `api.js` oferuje trzy specjalizowane ekstraktory:

```javascript
// 1. Tekst — szuka output_text w odpowiedzi
export const extractText = (response) => {
  // Najpierw próbuje response.output_text (skrót)
  // Potem przeszukuje response.output → messages → content → output_text
};

// 2. JSON — parsuje tekst jako JSON
export const extractJson = (response, label) => {
  const text = extractText(response);
  return JSON.parse(text);  // dzięki strict schema nie powinno rzucić
};

// 3. Źródła — zbiera URLs z web_search_call i url_citation
export const extractSources = (response) => {
  // Rekurencyjne przeszukanie + deduplikacja po URL
};
```

`extractText` ma fallback: najpierw sprawdza `response.output_text` (wygodny skrót dostępny w nowszych wersjach API), a jeśli go nie ma — przeszukuje pełną strukturę `output[].content[].text`. To czyni kod odpornym na drobne różnice między wersjami API.

### Wzorce architektoniczne — podsumowanie

Patrząc na cały projekt, wyłania się kilka wzorców wartych zapamiętania:

#### 1. Pipeline ze stanami pośrednimi
Każdy etap produkuje plik JSON, który jest wejściem dla następnego. To nie tylko cache — to **debugowalność**. Możesz otworzyć `concepts.json` i zobaczyć dokładnie co model wyekstrahował, zanim pójdzie to dalej.

#### 2. LLM robi to, w czym jest dobry; kod robi resztę
- LLM: ekstrakcja, klasyfikacja, grupowanie, generowanie HTML
- Kod: walidacja (concept-filter), hashowanie, cache, retry, orkiestracja
- Nigdzie model nie decyduje o flow — to zawsze kod kontroluje kolejność i warunki

#### 3. Structured Output + walidacja deterministyczna
Schema gwarantuje strukturę, ale `concept-filter.js` waliduje **wartości** (czy surfaceForm istnieje w tekście, czy nie jest za długi). Podwójna siatka bezpieczeństwa.

#### 4. Odporność na awarie (resilience)
- Atomowy zapis plików (tmp + rename)
- Zapis po każdej grupie równoległych zapytań
- Kaskadowa invalidacja cache'a po hash'ach
- Retry z backoffem
- Timeout per żądanie

#### 5. Koszt i szybkość pod kontrolą
- Dekompozycja na akapity → mniejsze, tańsze zapytania
- `needsSearch: false` eliminuje zbędne web search
- Deduplikacja redukuje liczbę wyszukiwań
- `reasoning: { effort: "medium" }` — nie przepłacaj za chain-of-thought
- `convertToBasicHtml` omija LLM dla akapitów bez koncepcji
- Równoległość (CONCURRENCY=5) skraca czas bez wbijania w rate limit

### Czego ten przykład uczy w kontekście kursu

Ten przykład to **praktyczna demonstracja Structured Outputs** — głównego tematu lekcji S01E01. Pokazuje:

1. Jak projektować schematy JSON z opisami, które kierują modelem
2. Jak kolejność pól wpływa na jakość (reason → category → surfaceForms)
3. Jak łączyć Structured Output z web search
4. Jak budować wieloetapowy pipeline, gdzie wynik jednego LLM jest wejściem dla drugiego
5. Jak adresować niedeterminizm modelu — walidacja, filtrowanie, cache z hash'ami

Lekcja mówi: "programowanie generatywnych aplikacji wiąże się z łączeniem deterministycznej natury kodu z niedeterministycznymi wynikami zwracanymi przez modele AI". Ten projekt jest dokładną ilustracją tej zasady.
