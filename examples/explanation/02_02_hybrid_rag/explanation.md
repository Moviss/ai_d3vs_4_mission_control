# Wyjaśnienie: 02_02_hybrid_rag — Hybrydowy RAG Agent

## Porcja 1: Ogólna architektura i przepływ danych

### Czym jest ten przykład?

To kompletna implementacja **hybrydowego systemu RAG** (Retrieval-Augmented Generation) — agenta konwersacyjnego, który odpowiada na pytania przeszukując zaindeksowaną bazę dokumentów. "Hybrydowy" oznacza, że łączy **dwie techniki wyszukiwania**:

- **Full-Text Search (FTS5/BM25)** — dopasowanie leksykalne (po słowach kluczowych)
- **Vector Similarity Search (sqlite-vec)** — dopasowanie semantyczne (po znaczeniu)

Wyniki z obu metod są łączone algorytmem **Reciprocal Rank Fusion (RRF)**.

### Architektura na wysokim poziomie

```
workspace/           SQLite (hybrid.db)           Agent
  *.md, *.txt  ──►  ┌─────────────────┐     ┌──────────────┐
  (dokumenty)        │ documents       │     │ chat loop    │
                     │ chunks          │◄────│ (Responses   │
  indeksowanie ──►   │ chunks_fts (FTS)│     │  API)        │
  + embedding        │ chunks_vec (vec)│     │              │
                     └─────────────────┘     │ tool: search │
                            ▲                └──────┬───────┘
                            │                       │
                            └───── hybrid search ───┘
```

### Przepływ danych — dwa odrębne procesy

**1. Indeksowanie (startup)**
```
Pliki .md/.txt → chunk (podział na fragmenty) → embed (wektory) → INSERT do SQLite
```

**2. Wyszukiwanie (runtime)**
```
Pytanie użytkownika → Agent generuje 2 zapytania:
  • keywords (dla FTS)
  • semantic (dla wektorów)
→ Oba wyniki łączone przez RRF
→ Top wyniki trafiają do kontekstu LLM
→ LLM generuje odpowiedź
```

### Struktura plików

| Plik | Rola |
|------|------|
| `app.js` | Entry point — inicjalizacja DB, indeksowanie, uruchomienie REPL |
| `src/config.js` | Konfiguracja modelu i system prompt agenta |
| `src/db/index.js` | Inicjalizacja SQLite + FTS5 + sqlite-vec |
| `src/db/chunking.js` | Podział tekstu na fragmenty (separator-based) |
| `src/db/embeddings.js` | Generowanie embeddingów przez API |
| `src/db/indexer.js` | Orkiestracja indeksowania plików z workspace |
| `src/db/search.js` | Wyszukiwanie: FTS, vector, hybrid + RRF |
| `src/agent/index.js` | Pętla agentowa (chat → tool calls → results) |
| `src/agent/tools.js` | Definicja narzędzia `search` dla agenta |
| `src/repl.js` | Interaktywna pętla konwersacji (REPL) |
| `src/mcp/client.js` | Klient MCP (przygotowany, ale nieużywany) |
| `src/helpers/*` | Logger, stats, API wrapper, shutdown |

### Kluczowa decyzja: SQLite jako jedyny silnik

Zamiast sięgać po Elasticsearch czy Qdrant, przykład używa **jednej bazy SQLite** z dwoma rozszerzeniami:
- **FTS5** — wbudowane w SQLite wyszukiwanie pełnotekstowe (BM25)
- **sqlite-vec** — rozszerzenie do wyszukiwania wektorowego (cosine similarity)

To świadomy wybór — lekcja podkreśla, że nie zawsze potrzebujemy pełnoprawnych silników wyszukiwania. Dla wewnętrznych baz wiedzy o umiarkowanej skali SQLite z rozszerzeniami to wystarczające rozwiązanie o **znacznie niższej złożoności architektonicznej**.

### Zależności

```json
{
  "better-sqlite3": "^11.8.1",   // synchroniczny, natywny driver SQLite
  "sqlite-vec": "^0.1.6",         // rozszerzenie wektorowe
  "@modelcontextprotocol/sdk": "^1.12.1"  // MCP (przygotowane na przyszłość)
}
```

Minimalna lista — tylko baza danych i opcjonalny MCP. Cała komunikacja z LLM idzie przez natywne `fetch` do Responses API.

## Porcja 2: Schemat bazy danych i proces indeksowania

### Schemat SQLite (`src/db/index.js`)

Baza składa się z **4 tabel** — 2 zwykłych i 2 wirtualnych:

```sql
-- 1. Tabela dokumentów — jeden wiersz = jeden plik z workspace/
CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL UNIQUE,    -- nazwa pliku (np. "fts.md")
  content TEXT NOT NULL,          -- pełna treść pliku
  hash TEXT NOT NULL,             -- SHA-256 treści (do wykrywania zmian)
  indexed_at TEXT DEFAULT (datetime('now'))
);

-- 2. Tabela chunków — fragmenty dokumentów po podziale
CREATE TABLE chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,          -- treść fragmentu
  chunk_index INTEGER NOT NULL,   -- numer fragmentu w dokumencie
  section TEXT,                   -- nagłówek sekcji, do której należy chunk
  chars INTEGER NOT NULL          -- długość w znakach
);

-- 3. FTS5 — wirtualna tabela full-text search (external content)
CREATE VIRTUAL TABLE chunks_fts USING fts5(
  content,
  content='chunks',        -- ← dane bierze z tabeli chunks
  content_rowid='id'       -- ← mapuje rowid na chunks.id
);

-- 4. sqlite-vec — wirtualna tabela wektorowa
CREATE VIRTUAL TABLE chunks_vec USING vec0(
  chunk_id INTEGER PRIMARY KEY,
  embedding float[1536]    -- ← 1536 wymiarów (text-embedding-3-small)
);
```

### Dlaczego "external content" w FTS5?

FTS5 w trybie `content='chunks'` nie przechowuje kopii danych — odwołuje się do tabeli `chunks`. Dzięki temu **dane nie są zduplikowane** na dysku. Wymaga to jednak ręcznej synchronizacji, stąd trzy triggery:

```sql
-- Po INSERT do chunks → dodaj do indeksu FTS
CREATE TRIGGER chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, content) VALUES (new.id, new.content);
END;

-- Po DELETE → usuń z indeksu FTS
CREATE TRIGGER chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES ('delete', old.id, old.content);
END;

-- Po UPDATE → usuń starą wersję + dodaj nową
CREATE TRIGGER chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES ('delete', old.id, old.content);
  INSERT INTO chunks_fts(rowid, content) VALUES (new.id, new.content);
END;
```

Zwróć uwagę na specjalną składnię usuwania z FTS5: `INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES ('delete', ...)` — to nie jest zwykły INSERT, lecz **komenda sterująca** FTS5.

### Magiczna liczba: 1536

```js
const EMBEDDING_DIM = 1536; // openai/text-embedding-3-small
```

Wymiar wektora **musi** zgadzać się z modelem embeddingu. `text-embedding-3-small` generuje wektory o 1536 wymiarach. Gdybyś zmienił model na inny (np. `text-embedding-3-large` = 3072 wymiary), musisz zmienić tę wartość i przebudować indeks.

### Pragmy optymalizacyjne

```js
db.pragma("journal_mode = WAL");     // Write-Ahead Logging — szybsze zapisy
db.pragma("synchronous = NORMAL");   // mniej fsync, szybciej (akceptowalne ryzyko)
db.pragma("foreign_keys = ON");      // CASCADE DELETE działa
db.pragma("busy_timeout = 5000");    // czeka 5s zamiast rzucać SQLITE_BUSY
```

WAL jest szczególnie ważny — pozwala na równoczesne odczyty i zapisy, co ma znaczenie przy indeksowaniu w tle.

### Proces indeksowania (`src/db/indexer.js`)

Funkcja `indexWorkspace` realizuje pełny pipeline:

```
1. Skanuj workspace/ → lista plików .md/.txt
2. Dla każdego pliku:
   a. Oblicz SHA-256 treści
   b. Sprawdź, czy dokument jest już w bazie z tym samym hashem
      → TAK: skip (bez zmian)
      → NIE (nowy lub zmieniony): usuń stary + zaindeksuj od nowa
   c. Podziel na chunki (chunkBySeparators)
   d. INSERT document + chunks (triggery wypełnią FTS5)
   e. Wygeneruj embeddingi w batchach po 20
   f. INSERT wektory do chunks_vec
3. Usuń z bazy dokumenty, których pliki już nie istnieją na dysku
```

Kluczowe elementy:

- **Hash-based change detection** — jeśli hash pliku się nie zmienił, indeksowanie jest pomijane. To sprawia, że restart aplikacji jest szybki.
- **Pełna reindeksacja przy zmianie** — nie próbuje diffować chunków, po prostu usuwa stary dokument i indeksuje od nowa. Prostsze i mniej podatne na błędy.
- **Batch embedding** — embeddingi generowane po 20 na raz (stała `BATCH_SIZE = 20`), co redukuje liczbę wywołań API.
- **Pruning** — na końcu usuwa z bazy dokumenty, których pliki zostały usunięte z dysku.

## Porcja 3: Chunking — podział tekstu na fragmenty

### Strategia: separator-based (recursive) chunking

Plik `src/db/chunking.js` implementuje **rekurencyjny podział tekstu** oparty na hierarchii separatorów. To jedna z czterech strategii opisanych w lekcji — tu wybrano strategię nr 2 (separatory), jako dobry kompromis między prostotą a jakością.

### Konfiguracja

```js
const CHUNK_SIZE = 1000;    // max ~1000 znaków na chunk
const CHUNK_OVERLAP = 200;  // 200 znaków nakładki między sąsiednimi chunkami
const SEPARATORS = ["\n## ", "\n### ", "\n\n", "\n", ". ", " "];
//                   ↑ h2     ↑ h3      ↑ par   ↑ ln  ↑ zd  ↑ słowo
```

### Jak działa rekurencyjny podział?

Algorytm próbuje dzielić tekst **najgrubszym** możliwym separatorem. Jeśli powstały fragment jest nadal za duży, schodzi do następnego poziomu:

```
Tekst wejściowy
  │
  ├─ Spróbuj podzielić po "\n## " (nagłówki h2)
  │   └─ Fragment > 1000 znaków?
  │       ├─ Spróbuj po "\n### " (nagłówki h3)
  │       │   └─ Nadal za duży?
  │       │       ├─ Spróbuj po "\n\n" (akapity)
  │       │       │   └─ Nadal za duży?
  │       │       │       ├─ Spróbuj po "\n" (linie)
  │       │       │       │   └─ ... po ". " (zdania) → po " " (słowa)
```

Konkretny algorytm w funkcji `split()`:

```js
const split = (text, size, overlap, separators) => {
  if (text.length <= size) return [text];  // ← base case: mieści się

  const sep = separators.find((s) => text.includes(s));  // ← znajdź najgrubszy separator
  if (!sep) return [text];  // ← brak separatora, zwróć jako jest

  const parts = text.split(sep);
  const chunks = [];
  let current = "";

  for (const part of parts) {
    const candidate = current ? current + sep + part : part;
    if (candidate.length > size && current) {
      chunks.push(current);                              // ← chunk gotowy
      const overlapText = pickOverlap(current, overlap, sep);  // ← weź ogon
      current = overlapText ? overlapText + sep + part : part;  // ← nowy chunk z nakładką
    } else {
      current = candidate;  // ← akumuluj dalej
    }
  }
  if (current) chunks.push(current);

  // Rekurencja: za duże chunki dziel drobniejszym separatorem
  const remaining = separators.slice(separators.indexOf(sep) + 1);
  return chunks.flatMap((c) =>
    c.length > size && remaining.length ? split(c, size, overlap, remaining) : [c]
  );
};
```

**Kluczowa idea:** algorytm "sklejania" — nie tworzy chunka z każdej części po splicie, lecz **akumuluje** sąsiednie części dopóki nie przekroczą limitu. Dzięki temu chunki mają zbliżoną długość, a nie przypadkowe rozmiary.

### Overlap — dlaczego nakładka?

```js
const pickOverlap = (text, overlap, sep) => {
  const start = Math.max(0, text.length - overlap);
  const tail = text.slice(start);
  // Znajdź granicę słowa/linii w ogonie
  let idx = tail.search(/\n/);
  if (idx === -1) idx = tail.search(/\s/);
  // Zwróć tekst od tej granicy do końca
  return text.slice(start + idx + 1);
};
```

Nakładka (overlap) sprawia, że **koniec jednego chunka pokrywa się z początkiem następnego**. Dlaczego?

- Zdanie przecięte na granicy chunków traci kontekst
- Wyszukiwanie semantyczne może nie trafić, bo embedding "połowy zdania" jest mało sensowny
- 200 znaków nakładki to kompromis — wystarczająco dużo kontekstu, nie za dużo duplikacji

Funkcja `pickOverlap` jest sprytna: nie bierze surowych 200 znaków, lecz szuka **granicy słowa/linii**, żeby nakładka zaczynała się w sensownym miejscu.

### Indeks nagłówków i przypisywanie sekcji

Osobny mechanizm buduje **indeks nagłówków** dokumentu:

```js
export const buildHeadingIndex = (text) => {
  // Szuka nagłówków markdown: ## Tytuł, ### Podtytuł
  const mdRegex = /^(#{1,6})\s+(.+)$/gm;
  // Oraz nagłówków "plain text" (linia tekstu przed akapitem)
  const plainRegex = /(?:^|\n\n)([^\n]{1,80})\n(?=[A-Za-z"'\[(])/gm;
  // Zwraca posortowaną listę: [{ position, level, title }]
};
```

Następnie `findSection()` dla każdego chunka określa, **w jakiej sekcji dokumentu** się znajduje:

```js
export const findSection = (text, chunkContent, headings) => {
  // Bierze próbkę z 40% chunka i szuka jej pozycji w oryginalnym tekście
  const mid = Math.floor(chunkContent.length * 0.4);
  const sample = chunkContent.slice(mid, mid + 100);
  const pos = text.indexOf(sample);
  // Znajduje ostatni nagłówek przed tą pozycją
  for (const h of headings) {
    if (h.position <= pos) current = h;
    else break;
  }
  return `${"#".repeat(current.level)} ${current.title}`;
};
```

**Dlaczego to ważne?** Metadana `section` trafia do bazy i jest zwracana w wynikach wyszukiwania. Agent (i użytkownik) widzi nie tylko treść chunka, ale też **z jakiej sekcji dokumentu pochodzi**. Lekcja podkreśla, że informowanie modelu o lokalizacji fragmentu w dokumencie znacząco poprawia jakość odpowiedzi.

### Wyjściowa struktura chunka

```js
{
  content: "treść fragmentu...",
  metadata: {
    strategy: "separators",
    index: 3,                    // numer chunka w dokumencie
    chars: 847,                  // długość
    section: "## Full-Text Search",  // sekcja źródłowa
    source: "fts.md"             // plik źródłowy
  }
}
```

## Porcja 4: Wyszukiwanie hybrydowe — FTS, vector search i RRF

Plik `src/db/search.js` to serce systemu — implementuje trzy warstwy wyszukiwania i łączy je w jedno.

### Warstwa 1: Full-Text Search (FTS5 / BM25)

```js
export const searchFts = (db, query, limit = 10) => {
  const ftsQuery = toFtsQuery(query);  // sanityzacja + OR-join

  const rows = db.prepare(`
    SELECT c.id, c.content, c.section, c.chunk_index, d.source,
           rank AS fts_score,
           highlight(chunks_fts, 0, '«', '»') AS highlighted
    FROM chunks_fts
    JOIN chunks c ON c.id = chunks_fts.rowid
    JOIN documents d ON d.id = c.document_id
    WHERE chunks_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `).all(ftsQuery, limit);
};
```

**Co tu się dzieje:**

1. **Sanityzacja zapytania** (`toFtsQuery`): usuwa znaki specjalne, dzieli na termy, łączy operatorem `OR`:
   ```js
   "autoregression neural networks" → '"autoregression" OR "neural" OR "networks"'
   ```
   Każdy term jest w cudzysłowach (literal match), połączone OR-em — wystarczy, że **choć jeden** term pasuje.

2. **BM25 ranking**: `ORDER BY rank` — FTS5 automatycznie przypisuje każdemu wynikowi score BM25 (algorytm rankingowy uwzględniający częstość termów i długość dokumentu).

3. **Highlight**: `highlight(chunks_fts, 0, '«', '»')` — FTS5 otacza trafione słowa znacznikami `«»`. Funkcja `extractMatchedTerms` wyciąga z tego listę trafionych termów:
   ```js
   "The «autoregression» model uses «neural» ..." → ["autoregression", "neural"]
   ```
   Te termy trafiają do metadanych wyniku — przydatne do debugowania i logowania.

### Warstwa 2: Vector Similarity Search (sqlite-vec)

```js
export const searchVector = (db, queryEmbedding, limit = 10) => {
  const rows = db.prepare(`
    SELECT chunk_id, distance
    FROM chunks_vec
    WHERE embedding MATCH ?
    ORDER BY distance
    LIMIT ?
  `).all(toVecBuffer(queryEmbedding), limit);
};
```

**Kluczowe detale:**

- **Embedding zapytania**: przed wywołaniem, tekst zapytania jest zamieniany na wektor przez ten sam model (`text-embedding-3-small`)
- **`toVecBuffer`**: konwertuje tablicę JS na `Float32Array` → `Buffer` — sqlite-vec wymaga binarnego formatu
- **`distance`**: sqlite-vec zwraca **odległość** (mniejsza = bardziej podobne), nie similarity
- **Dwuetapowe pobieranie**: najpierw sqlite-vec zwraca `chunk_id` + `distance`, potem osobny SELECT pobiera pełne dane z `chunks` + `documents`. Dlaczego? Tabela wirtualna `vec0` nie przechowuje treści — tylko wektory i ID.

### Warstwa 3: Reciprocal Rank Fusion (RRF)

To algorytm łączenia wyników z różnych źródeł w jeden ranking. Idea jest prosta i elegancka:

```js
const RRF_K = 60;  // stała wygładzająca

// Dla każdego wyniku z FTS:
ftsResults.forEach((r, rank) => {
  entry.rrf += 1 / (RRF_K + rank + 1);
  entry.fts_rank = rank + 1;
});

// Dla każdego wyniku z vector search:
vecResults.forEach((r, rank) => {
  entry.rrf += 1 / (RRF_K + rank + 1);
  entry.vec_rank = rank + 1;
});
```

**Jak to działa:**

Każdy wynik dostaje **score RRF** = suma `1/(K + pozycja)` ze wszystkich list, na których się pojawił.

Przykład z K=60:
| Chunk | FTS rank | Vec rank | RRF score |
|-------|----------|----------|-----------|
| A | #1 | #3 | 1/61 + 1/63 = 0.0164 + 0.0159 = **0.0323** |
| B | #5 | #1 | 1/65 + 1/61 = 0.0154 + 0.0164 = **0.0318** |
| C | — | #2 | 0 + 1/62 = **0.0161** |

Chunk A wygrywa — pojawił się wysoko w **obu** listach. Chunk C, mimo drugiego miejsca w vector search, jest niżej bo nie pojawił się w FTS wcale.

**Dlaczego RRF a nie zwykłe uśrednianie?**

- Scores z FTS (BM25) i vector search (cosine distance) mają **różne skale** — nie da się ich bezpośrednio porównać
- RRF operuje na **pozycjach w rankingu**, nie na wartościach score — to czyni go agnostycznym wobec skali
- Stała K=60 zapobiega dominacji najwyższych pozycji (zmniejsza różnicę między #1 a #2)

### Graceful degradation

```js
let vecResults = [];
try {
  const [queryEmbedding] = await embed(semantic);
  vecResults = searchVector(db, queryEmbedding, ftsLimit);
} catch (err) {
  log.warn(`Semantic search unavailable: ${err.message}`);
}
```

Jeśli API embeddingów nie działa (np. brak klucza, timeout), system **nie pada** — po prostu degraduje się do samego FTS. To ważna decyzja projektowa: wyszukiwanie pełnotekstowe jest lokalne i synchroniczne, więc zawsze działa.

### Orchestracja w `hybridSearch`

```js
export const hybridSearch = async (db, { keywords, semantic }, limit = 5) => {
  const ftsLimit = limit * 3;  // ← pobierz 3x więcej z każdego źródła

  const ftsResults = searchFts(db, keywords, ftsLimit);
  const vecResults = searchVector(db, queryEmbedding, ftsLimit);

  // RRF merge...

  return merged.slice(0, limit);  // ← zwróć top N po fuzji
};
```

`ftsLimit = limit * 3` — pobiera 3x więcej wyników z każdego silnika niż chcemy zwrócić. Dlaczego? Bo po fuzji RRF kolejność się zmienia — dokument z pozycji #8 w FTS i #3 w vector search może wskoczyć na #2 w finalnym rankingu. Potrzebujemy szerszej puli kandydatów.

## Porcja 5: Agent i pętla narzędziowa

### Narzędzie `search` — interfejs agenta do bazy wiedzy (`src/agent/tools.js`)

Agent ma jedno narzędzie — `search`. Jego definicja (w formacie OpenAI function calling):

```js
const SEARCH_TOOL = {
  type: "function",
  name: "search",
  parameters: {
    type: "object",
    properties: {
      keywords: {
        type: "string",
        description: "Keywords for full-text search (BM25) — specific terms, names, phrases"
      },
      semantic: {
        type: "string",
        description: "Natural language query for semantic/vector search — a question or concept description"
      },
      limit: { type: "number", description: "Max results (default 5, max 20)" }
    },
    required: ["keywords", "semantic"],
  },
  strict: false,
};
```

**Kluczowa decyzja:** agent musi podać **dwa osobne zapytania** — `keywords` i `semantic`. Dzięki temu:

- FTS dostaje zoptymalizowane termy (nazwy, skróty, słowa kluczowe)
- Vector search dostaje pytanie w języku naturalnym (lepsze do embeddingu)
- Agent sam decyduje, jak sformułować oba zapytania — może np. przetłumaczyć pytanie po polsku na angielskie keywords

Handler narzędzia jest prosty — wywołuje `hybridSearch` i zwraca wyniki w czytelnej formie:

```js
search: async ({ keywords, semantic, limit = 5 }) => {
  const results = await hybridSearch(db, { keywords, semantic }, Math.min(limit, 20));
  return results.map((r) => ({
    source: r.source,     // plik źródłowy
    section: r.section,   // sekcja w dokumencie
    content: r.content,   // treść chunka
  }));
}
```

Zwróć uwagę: `Math.min(limit, 20)` — twardy limit 20 wyników, niezależnie od tego co agent poprosi. Zabezpieczenie przed zalewaniem kontekstu.

### Pętla agentowa (`src/agent/index.js`)

Klasyczna pętla tool-use z limitem kroków:

```js
export const run = async (query, { tools, conversationHistory = [] }) => {
  const messages = [...conversationHistory, { role: "user", content: query }];

  for (let step = 1; step <= MAX_STEPS; step++) {   // MAX_STEPS = 30
    const response = await chat({ input: messages, tools: toolDefs });

    const toolCalls = extractToolCalls(response);

    if (toolCalls.length === 0) {
      // Model nie wywołał narzędzia → odpowiedź gotowa
      const text = extractText(response);
      messages.push(...response.output);
      return { response: text, conversationHistory: messages };
    }

    // Model wywołał narzędzia → wykonaj je
    messages.push(...response.output);          // dodaj function_call do historii
    const results = await runTools(tools, toolCalls);
    messages.push(...results);                  // dodaj function_call_output do historii
    // → następna iteracja pętli
  }

  throw new Error(`Max steps (${MAX_STEPS}) reached`);
};
```

**Przepływ jednej iteracji:**

```
User: "Czym jest autoregresja?"
  │
  ▼
chat() → model odpowiada z function_call:
  search({ keywords: "autoregression", semantic: "What is autoregression in LLMs?" })
  │
  ▼
runTools() → hybridSearch → wyniki
  │
  ▼
function_call_output dodany do messages
  │
  ▼
chat() → model widzi wyniki i generuje odpowiedź tekstową (bez tool call)
  │
  ▼
return { response, conversationHistory }
```

Model może wywołać `search` **wielokrotnie** w jednej konwersacji — jeśli pierwszy zestaw wyników nie wystarczy, odpala kolejne wyszukiwanie z innymi termami. System prompt to zachęca:

> *"Start with a broad query, then refine with more specific terms based on what you find."*

### Wykonywanie narzędzi

```js
const runTool = async (tools, toolCall) => {
  const args = JSON.parse(toolCall.arguments);
  const output = await tools.handle(toolCall.name, args);
  return { type: "function_call_output", call_id: toolCall.call_id, output };
};

const runTools = (tools, toolCalls) =>
  Promise.all(toolCalls.map((tc) => runTool(tools, tc)));
```

`Promise.all` — jeśli model wywoła kilka narzędzi naraz, wykonują się **równolegle**. W tym przykładzie jest tylko jedno narzędzie, ale architektura jest gotowa na więcej.

### System prompt (`src/config.js`)

```js
export const api = {
  model: resolveModelForProvider("gpt-5.2"),
  maxOutputTokens: 16384,
  reasoning: { effort: "medium", summary: "auto" },
  instructions: `You are a knowledge assistant...`
};
```

Kilka interesujących decyzji:

- **`reasoning: { effort: "medium" }`** — model używa chain-of-thought, ale z umiarkowanym wysiłkiem (oszczędność tokenów)
- **`summary: "auto"`** — reasoning jest automatycznie streszczany w logach
- Prompt mówi agentowi **kiedy NIE szukać** ("Do NOT search for greetings, small talk") — ważne, bo bez tego agent szukałby przy każdym "cześć"
- Wymusza cytowanie źródeł: "cite the source file and section"

## Porcja 6: REPL, helpery, MCP i podsumowanie wzorców

### REPL — interaktywna pętla (`src/repl.js`)

Prosty interfejs konwersacyjny z trzema komendami specjalnymi:

```js
export const runRepl = async ({ tools, rl, db }) => {
  let conversation = createConversation();

  while (true) {
    const input = await rl.question("You: ");

    if (input === "exit")    break;
    if (input === "clear")   { conversation = createConversation(); resetStats(); continue; }
    if (input === "reindex") { await indexWorkspace(db, "workspace"); continue; }

    const result = await run(input, {
      tools,
      conversationHistory: conversation.history,
    });
    conversation.history = result.conversationHistory;
    console.log(`\nAssistant: ${result.response}\n`);
  }
};
```

- **`clear`** — resetuje historię konwersacji i statystyki tokenów. Agent "zapomina" wszystko.
- **`reindex`** — ponownie skanuje `workspace/`, przydatne po dodaniu/edycji plików bez restartu.
- **Konwersacja jest stanowa** — `conversation.history` rośnie z każdym pytaniem i odpowiedzią. Agent ma kontekst poprzednich wymian.

### API wrapper (`src/helpers/api.js`)

Cienka warstwa nad Responses API (nie Chat Completions!):

```js
export const chat = async ({
  model = api.model,
  input,           // ← "input", nie "messages" — Responses API
  tools,
  toolChoice = "auto",
  instructions,    // ← system prompt idzie tu, nie w messages
  maxOutputTokens,
  reasoning         // ← chain-of-thought config
}) => {
  const body = { model, input };
  if (tools?.length) body.tools = tools;
  if (instructions)  body.instructions = instructions;
  if (reasoning)     body.reasoning = reasoning;

  const response = await fetch(RESPONSES_API_ENDPOINT, { ... });
  recordUsage(data.usage);
  return data;
};
```

**Ważna obserwacja:** to jest **Responses API** (`/v1/responses`), nie Chat Completions (`/v1/chat/completions`). Różnice:
- Pole `input` zamiast `messages`
- `instructions` zamiast `system` message
- Wbudowane wsparcie dla `reasoning` (chain-of-thought)
- `response.output` zawiera obiekty z `type`: `"message"`, `"function_call"`, `"reasoning"`

Helpery `extractToolCalls`, `extractText`, `extractReasoning` parsują tę strukturę:

```js
export const extractToolCalls = (response) =>
  response.output.filter((item) => item.type === "function_call");

export const extractReasoning = (response) =>
  response.output
    .filter((item) => item.type === "reasoning")
    .flatMap((item) => item.summary ?? [])
    .map((s) => s.text);
```

### Stats tracker (`src/helpers/stats.js`)

Prosty akumulator tokenów:

```js
let totalTokens = { input: 0, output: 0, reasoning: 0, cached: 0, requests: 0 };

export const recordUsage = (usage) => {
  totalTokens.input += usage.input_tokens || 0;
  totalTokens.output += usage.output_tokens || 0;
  totalTokens.reasoning += usage.output_tokens_details?.reasoning_tokens || 0;
  totalTokens.cached += usage.input_tokens_details?.cached_tokens || 0;
  totalTokens.requests += 1;
};
```

Wypisuje podsumowanie przy zamknięciu programu (przez `onShutdown`). Śledzi też **cached tokens** — przy wielokrotnych wywołaniach w jednej konwersacji, prefix cache znacząco obniża koszty.

### MCP client (`src/mcp/client.js`) — przygotowany, ale nieużywany

Pełna implementacja klienta MCP (Model Context Protocol) przez stdio:

```js
export const createMcpClient = async (serverName = "files") => {
  const config = await loadMcpConfig();   // czyta mcp.json
  const client = new Client({ name: "video-generation-client", version: "1.0.0" });
  const transport = new StdioClientTransport({ command, args, env });
  await client.connect(transport);
  return client;
};
```

Plus konwerter `mcpToolsToOpenAI` — zamienia definicje narzędzi MCP na format OpenAI function calling. Cały moduł jest **gotowy do podłączenia**, ale w tym przykładzie agent korzysta wyłącznie z natywnego narzędzia `search`.

### Shared config (`config.js` — root repo)

Wspólna konfiguracja dla wszystkich przykładów z kursu. Kluczowe elementy:

- **Auto-detection providera**: `OPENAI_API_KEY` → OpenAI, `OPENROUTER_API_KEY` → OpenRouter
- **`resolveModelForProvider`**: automatycznie dodaje prefix `openai/` dla OpenRoutera (np. `"gpt-5.2"` → `"openai/gpt-5.2"`)
- **Web search**: `buildResponsesRequest` obsługuje zarówno OpenAI web search (tool) jak i OpenRouter online models / plugins

---

### Podsumowanie wzorców i lekcji

Cały przykład demonstruje kilka kluczowych wzorców z lekcji:

1. **Hybrydowe wyszukiwanie > pojedyncza metoda** — FTS łapie dokładne termy, vector search łapie znaczenie. RRF łączy oba bez problemu skali scorów.

2. **SQLite wystarczy** — nie potrzebujesz Elasticsearch + Qdrant + Redis. Dla umiarkowanej skali FTS5 + sqlite-vec w jednej bazie to sprawdzone rozwiązanie.

3. **Agent decyduje jak szukać** — zamiast sztywno przekazywać zapytanie użytkownika do wyszukiwarki, agent generuje zoptymalizowane zapytania (keywords + semantic). Może też szukać wielokrotnie, iteracyjnie zawężając wyniki.

4. **Metadane chunków są kluczowe** — `source` i `section` pomagają zarówno modelowi (cytowanie), jak i użytkownikowi (nawigacja do źródła).

5. **Graceful degradation** — jeśli vector search padnie, system degraduje się do FTS zamiast crashować.

6. **Indeksowanie z change detection** — hash SHA-256 pozwala pomijać niezmienione pliki. Pełna reindeksacja przy zmianie jest prostsza niż diff chunków.

7. **Separation of concerns** — każdy moduł robi jedną rzecz: chunking, embedding, FTS, vector search, RRF, agent loop, tools. Łatwo wymienić dowolny element.
