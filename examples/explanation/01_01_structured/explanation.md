# Wyjaśnienie przykładu `01_01_structured`

## Porcja 1: Ogólna architektura i cel przykładu

### Kontekst z lekcji

Lekcja S01E01 wprowadza fundamenty pracy z modelami językowymi przez API. Jednym z kluczowych tematów jest **Structured Outputs** — mechanizm wymuszania na modelu odpowiedzi w ściśle określonym formacie JSON. Lekcja podkreśla, że:

- Modele generują tekst, ale w aplikacjach potrzebujemy **ustrukturyzowanych danych** do dalszego przetwarzania
- JSON Schema dołączony do zapytania gwarantuje **strukturę** (kształt odpowiedzi), ale **wartości** zależą od treści wejściowej oraz nazw i opisów w schemacie
- Kolejność właściwości w schemacie ma znaczenie — wcześniej wygenerowane tokeny wpływają na kolejne (autoregresja)

### Co robi ten przykład

`01_01_structured` to minimalny, samodzielny skrypt demonstrujący **ekstrakcję ustrukturyzowanych danych z tekstu naturalnego**. Scenariusz: mamy zdanie opisujące osobę i chcemy wyciągnąć z niego konkretne pola (imię, wiek, zawód, umiejętności) w formacie JSON.

### Struktura plików

```
01_01_structured/
├── app.js          # Główna logika — schemat, wywołanie API, wyświetlenie wyników
├── helpers.js      # Funkcja pomocnicza do parsowania odpowiedzi Responses API
├── package.json    # Metadata pakietu (ESM, brak zależności)
└── README.md       # Krótki opis
```

Plus współdzielony plik na poziomie repozytorium:

```
../config.js        # Konfiguracja providera (OpenAI / OpenRouter), klucze API, endpointy
```

### Przepływ danych

```
Tekst wejściowy (string)
    ↓
extractPerson() — buduje request z JSON Schema
    ↓
POST → Responses API (OpenAI lub OpenRouter)
    ↓
Odpowiedź z gwarantowaną strukturą JSON
    ↓
JSON.parse() → obiekt { name, age, occupation, skills }
    ↓
console.log() — wyświetlenie wyników
```

Kluczowa obserwacja: **cały "mózg" ekstrakcji to schemat JSON + model**. Nie ma tu żadnej logiki parsowania tekstu, regexów ani reguł — model sam rozumie tekst i wypełnia pola schematu.

## Porcja 2: JSON Schema — serce Structured Outputs

### Schemat `personSchema`

To najważniejszy fragment całego przykładu (`app.js:42-70`):

```javascript
const personSchema = {
  type: "json_schema",
  name: "person",
  strict: true,
  schema: {
    type: "object",
    properties: {
      name: {
        type: ["string", "null"],
        description: "Full name of the person. Use null if not mentioned."
      },
      age: {
        type: ["number", "null"],
        description: "Age in years. Use null if not mentioned or unclear."
      },
      occupation: {
        type: ["string", "null"],
        description: "Job title or profession. Use null if not mentioned."
      },
      skills: {
        type: "array",
        items: { type: "string" },
        description: "List of skills, technologies, or competencies. Empty array if none mentioned."
      }
    },
    required: ["name", "age", "occupation", "skills"],
    additionalProperties: false
  }
};
```

### Anatomia schematu — warstwa po warstwie

**Poziom zewnętrzny** (konfiguracja dla API):

| Pole | Wartość | Znaczenie |
|------|---------|-----------|
| `type` | `"json_schema"` | Mówi API: "chcę odpowiedź w formacie JSON Schema" |
| `name` | `"person"` | Identyfikator schematu — model "widzi" tę nazwę i traktuje ją jako wskazówkę kontekstową |
| `strict` | `true` | **Gwarancja struktury** — API wymusi, że odpowiedź będzie dokładnie zgodna ze schematem |

**Poziom wewnętrzny** (`schema`) — to jest faktyczny JSON Schema:

- `type: "object"` — odpowiedź to obiekt JSON
- `required: [...]` — wszystkie 4 pola muszą być obecne
- `additionalProperties: false` — model **nie może** dodać żadnych dodatkowych pól

### Trzy kluczowe decyzje projektowe

**1. Nullable types zamiast optional fields**

```javascript
type: ["string", "null"]  // ← unia typów
```

Zamiast robić pole opcjonalnym (co w `strict` mode nie jest dozwolone), autorzy używają unii `string | null`. To daje modelowi "wyjście awaryjne" — jeśli tekst nie zawiera informacji o imieniu, model zwróci `null` zamiast wymyślać dane. Lekcja wprost o tym mówi:

> *Warto uwzględnić wartości nieznane bądź neutralne. Takie podejście zwykle zwiększa skuteczność i obniża ryzyko halucynacji.*

**2. Descriptions jako instrukcje dla modelu**

```javascript
description: "Age in years. Use null if not mentioned or unclear."
```

Te opisy to nie komentarze dla programisty — to **instrukcje, które model czyta i wykonuje**. Lekcja podkreśla, że wartości w schemacie generowane są na podstawie `treści wejściowej` + `nazw` + `opisów`. Dlatego opisy muszą być:
- **zrozumiałe** — jasno mówić, czego oczekujemy
- **zwięzłe** — nie zaśmiecać kontekstu
- **instrukcyjne** — mówić co robić w edge case'ach ("Use null if not mentioned")

**3. Kolejność pól ma znaczenie**

Model generuje tokeny sekwencyjnie. W tym schemacie:
1. Najpierw `name` — zakotwicza kontekst ("o kim mówimy")
2. Potem `age` — prosty fakt
3. Potem `occupation` — wymaga interpretacji
4. Na końcu `skills` — tablica, która może wymagać ekstrakcji wielu elementów

To nie przypadek. Lekcja wyjaśnia zasadę: *"reasoning" generowany jako pierwszy wpłynie na kolejne pola*. Prostsze pola generowane wcześniej dostarczają kontekst dla trudniejszych pól generowanych później.

### `skills` — jedyne pole bez `null`

```javascript
skills: {
  type: "array",
  items: { type: "string" },
  description: "List of skills, technologies, or competencies. Empty array if none mentioned."
}
```

Tablice mają naturalny odpowiednik "brak danych" — pustą tablicę `[]`. Nie trzeba tu `null`, bo `[]` pełni tę samą rolę semantyczną i jest łatwiejszy w obsłudze po stronie kodu (nie trzeba sprawdzać `if (skills !== null)`).

## Porcja 3: Wywołanie API — `extractPerson` i rola `config.js`

### Funkcja `extractPerson` (`app.js:11-40`)

```javascript
async function extractPerson(text) {
  const response = await fetch(RESPONSES_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS
    },
    body: JSON.stringify({
      model: MODEL,
      input: `Extract person information from: "${text}"`,
      text: { format: personSchema }
    })
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    const message = data?.error?.message ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  const outputText = extractResponseText(data);

  if (!outputText) {
    throw new Error("Missing text output in API response");
  }

  return JSON.parse(outputText);
}
```

### Kluczowe elementy requestu

**1. Responses API, nie Chat Completions**

Przykład używa **Responses API** (`/v1/responses`), nie starszego Chat Completions API (`/v1/chat/completions`). Różnica:

| Aspekt | Chat Completions | Responses API |
|--------|-----------------|---------------|
| Pole wejścia | `messages: [...]` (tablica ról) | `input: "..."` (prosty string lub tablica) |
| Structured Output | `response_format: { type: "json_schema", ... }` | `text: { format: { type: "json_schema", ... } }` |
| Kontekst | Bezstanowe — za każdym razem wysyłamy pełną historię | Może przechowywać stan (ale tu nie jest to wykorzystane) |

**2. Pole `input` — prosty prompt**

```javascript
input: `Extract person information from: "${text}"`
```

Zauważ, że nie ma tu promptu systemowego ani złożonej konwersacji. Jedno zdanie wystarczy, bo **schemat JSON pełni rolę szczegółowej instrukcji**. Nazwy pól (`name`, `age`, `occupation`, `skills`) i ich opisy mówią modelowi dokładnie, czego szukać. Prompt jedynie informuje o zadaniu ("wyekstrahuj").

**3. Pole `text.format` — podpięcie schematu**

```javascript
text: { format: personSchema }
```

To właśnie tu podpinamy `personSchema` z Porcji 2. API widzi `strict: true` i gwarantuje, że odpowiedź będzie walidnym JSON-em zgodnym ze schematem. Bez tego pola model mógłby odpowiedzieć dowolnym tekstem.

### Rola `config.js` — abstrakcja providera

Na górze `app.js`:

```javascript
import {
  AI_API_KEY,
  EXTRA_API_HEADERS,
  RESPONSES_API_ENDPOINT,
  resolveModelForProvider
} from "../config.js";

const MODEL = resolveModelForProvider("gpt-5.4");
```

`config.js` rozwiązuje problem **multi-provider setup**:

- Czyta `.env` i ustala, czy używamy OpenAI czy OpenRouter
- Eksportuje odpowiedni endpoint (`https://api.openai.com/v1/responses` lub `https://openrouter.ai/api/v1/responses`)
- `resolveModelForProvider("gpt-5.4")` — jeśli provider to OpenRouter, automatycznie dodaje prefix `openai/` → `openai/gpt-5.4`, bo OpenRouter wymaga pełnej nazwy modelu z prefixem firmy
- `EXTRA_API_HEADERS` — dla OpenRouter dodaje opcjonalne nagłówki (`HTTP-Referer`, `X-Title`), dla OpenAI jest pusty

Dzięki temu **kod w `app.js` jest identyczny** niezależnie od providera. Zmiana z OpenAI na OpenRouter to kwestia jednej zmiennej w `.env`.

### Obsługa błędów

```javascript
if (!response.ok || data.error) {
  const message = data?.error?.message ?? `Request failed with status ${response.status}`;
  throw new Error(message);
}
```

Podwójne sprawdzenie: status HTTP (`response.ok`) **i** pole `error` w body. Dlaczego oba? Niektóre API zwracają HTTP 200, ale z obiektem `error` w JSON-ie (np. przy przekroczeniu limitu tokenów). Defensive coding.

## Porcja 4: Parsowanie odpowiedzi i kluczowe wnioski

### `helpers.js` — `extractResponseText`

```javascript
export const extractResponseText = (data) => {
  // Ścieżka 1: skrót — pole output_text na najwyższym poziomie
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  // Ścieżka 2: pełna struktura — przeszukanie tablicy output
  const messages = Array.isArray(data?.output)
    ? data.output.filter((item) => item?.type === "message")
    : [];

  const textPart = messages
    .flatMap((message) => (Array.isArray(message?.content) ? message.content : []))
    .find((part) => part?.type === "output_text" && typeof part?.text === "string");

  return textPart?.text ?? "";
};
```

### Dlaczego dwie ścieżki?

Responses API zwraca odpowiedź w zagnieżdżonej strukturze:

```json
{
  "output_text": "{ \"name\": \"John\", ... }",
  "output": [
    {
      "type": "message",
      "content": [
        { "type": "output_text", "text": "{ \"name\": \"John\", ... }" }
      ]
    }
  ]
}
```

- `output_text` — to **convenience field**, skrót dodany przez API, zawiera sklejony tekst ze wszystkich bloków
- `output[].content[]` — to **pełna struktura** ze wszystkimi blokami odpowiedzi (tekst, wywołania narzędzi, itd.)

Helper próbuje najpierw skrótu, a jeśli go nie ma (np. starsze wersje API lub niestandardowe odpowiedzi) — przeszukuje pełną strukturę. Defensive coding ponownie.

### Końcowy `JSON.parse` w `extractPerson`

```javascript
const outputText = extractResponseText(data);
return JSON.parse(outputText);
```

Mimo że API gwarantuje poprawny JSON (dzięki `strict: true`), odpowiedź przychodzi jako **string** — nie jako obiekt. `JSON.parse()` zamienia go na natywny obiekt JavaScript. To ważna obserwacja: Structured Outputs nie zmienia formatu transportu (nadal tekst), a jedynie gwarantuje, że ten tekst będzie walidnym JSON-em.

### Funkcja `main` — użycie wyników

```javascript
async function main() {
  const text = "John is 30 years old and works as a software engineer. He is skilled in JavaScript, Python, and React.";
  const person = await extractPerson(text);

  console.log("Name:", person.name ?? "unknown");
  console.log("Age:", person.age ?? "unknown");
  console.log("Occupation:", person.occupation ?? "unknown");
  console.log("Skills:", person.skills.length ? person.skills.join(", ") : "none");
}
```

Zwróć uwagę na operator `??` (nullish coalescing) — to bezpośrednia konsekwencja decyzji projektowej ze schematu (Porcja 2), gdzie pola mają typ `string | null`. Kod nie musi sprawdzać, czy pole istnieje (schemat gwarantuje obecność), ale musi obsłużyć `null` (bo model mógł nie znaleźć informacji).

### Kluczowe wnioski z całego przykładu

1. **Schemat to instrukcja.** W prostych zadaniach ekstrakcji dobrze zaprojektowany JSON Schema może zastąpić rozbudowany prompt systemowy. Nazwy pól i opisy mówią modelowi, czego szukać.

2. **`strict: true` eliminuje klasę błędów.** Bez niego model mógłby zwrócić dodatkowe pola, pominąć wymagane, albo użyć złego typu. Z nim — struktura jest gwarantowana, zostaje walidacja wartości.

3. **Nullable > optional.** Dawanie modelowi "wyjścia awaryjnego" (`null`) zamiast zmuszania do odpowiedzi zmniejsza ryzyko halucynacji.

4. **Kolejność pól to chain-of-thought.** Prostsze pola wcześniej budują kontekst dla trudniejszych później — to subtelna, ale skuteczna technika.

5. **Abstrakcja providera się opłaca.** `config.js` sprawia, że zmiana z OpenAI na OpenRouter to jedna zmienna w `.env`. Przy obecnym tempie zmian na rynku modeli — to niezbędna elastyczność.

6. **Odpowiedź to nadal string.** Structured Outputs gwarantuje poprawność JSON-a, ale nie zmienia formatu transportu — zawsze trzeba `JSON.parse()`.
