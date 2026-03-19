# Wyjaśnienie przykładu: 02_02_embedding

## Porcja 1: Ogólna architektura i cel przykładu

### Co robi ten przykład?

To interaktywne demo embeddingów z macierzą podobieństwa (similarity matrix). Użytkownik wpisuje kolejne teksty w REPL-u, a program:

1. Zamienia każdy tekst na **embedding** (wektor liczb) za pomocą API
2. Po dwóch lub więcej wpisach wyświetla **kolorową macierz** pokazującą, jak bardzo teksty są do siebie semantycznie podobne

### Struktura pliku

Cały przykład to jeden plik `app.js` (~153 linie), podzielony na logiczne sekcje:

```
app.js
├── Konfiguracja modelu (linia 10)
├── Colors — kody ANSI do kolorowania terminala (linie 14-27)
├── Embedding API — funkcja wywołująca API (linie 30-45)
├── Math — cosine similarity (linie 49-61)
├── Display — formatowanie i drukowanie macierzy (linie 65-111)
└── REPL — pętla główna (linie 115-153)
```

### Zależności zewnętrzne

Przykład importuje konfigurację ze wspólnego pliku `config.js` w katalogu nadrzędnym:

```javascript
import { AI_API_KEY, EMBEDDINGS_API_ENDPOINT, EXTRA_API_HEADERS, resolveModelForProvider } from "../config.js";
```

`config.js` to sprytny moduł konfiguracyjny, który:
- Automatycznie wykrywa providera (OpenAI vs OpenRouter) na podstawie dostępnych kluczy API
- Ustawia odpowiednie endpointy (np. `https://openrouter.ai/api/v1/embeddings`)
- Dodaje nagłówki specyficzne dla OpenRoutera

Dzięki temu sam `app.js` nie musi się martwić, z którego providera korzysta — `config.js` abstrakcje to za niego.

### Model embeddingu

```javascript
const MODEL = resolveModelForProvider("text-embedding-3-small");
```

Funkcja `resolveModelForProvider` dodaje prefix `openai/` jeśli korzystamy z OpenRoutera (który wymaga pełnej nazwy modelu w formacie `provider/model`). Dla OpenAI zwraca model bez zmian.

**text-embedding-3-small** to model OpenAI generujący wektory o **1536 wymiarach** — dokładnie to, o czym mówi lekcja S02E02. Jest mały, tani i wystarczająco dobry do demonstracji podobieństwa semantycznego.

### Kontekst z lekcji

Lekcja podkreśla, że embedding to sposób **opisywania znaczenia** tekstu za pomocą tablicy liczb. Dzięki temu możemy porównywać teksty nie po zapisie (słowa kluczowe), ale po **znaczeniu**. Ten przykład to najprostsza możliwa demonstracja tej koncepcji — bez bazy danych, bez indeksowania, bez wyszukiwania. Czysta zamiana tekstu na wektor i porównanie.

## Porcja 2: Embedding API i Cosine Similarity

### Funkcja `embed` — zamiana tekstu na wektor

```javascript
const embed = async (text) => {
  const response = await fetch(EMBEDDINGS_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS
    },
    body: JSON.stringify({ model: MODEL, input: text }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message ?? JSON.stringify(data.error));

  return data.data[0].embedding;
};
```

To serce przykładu — wywołanie OpenAI-compatible Embeddings API. Kilka rzeczy wartych uwagi:

- **Brak zewnętrznych bibliotek** — używa natywnego `fetch` (dostępnego w Node 24+). Żadnego SDK, żadnego axios. To świadoma decyzja kursu — pokazuje, że API embeddingów to zwykły endpoint REST.
- **Spread `...EXTRA_API_HEADERS`** — dla OpenRoutera dodaje nagłówki `HTTP-Referer` i `X-Title` (jeśli skonfigurowane). Dla OpenAI spread pustego obiektu nie zmienia nic.
- **Request body** jest minimalny: `model` + `input`. API obsługuje też batch (tablica tekstów w `input`), ale tu wysyłamy po jednym.
- **Odpowiedź** ma strukturę `{ data: [{ embedding: [...] }] }`. Bierzemy `data[0].embedding` — tablicę 1536 liczb zmiennoprzecinkowych.

### Cosine Similarity — porównywanie wektorów

```javascript
const cosineSimilarity = (a, b) => {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};
```

To klasyczna implementacja **podobieństwa kosinusowego** — najczęściej stosowanej metryki do porównywania embeddingów. Algorytm w jednej pętli oblicza trzy rzeczy:

| Zmienna | Co liczy | Wzór |
|---------|----------|------|
| `dot` | iloczyn skalarny | Σ aᵢ·bᵢ |
| `normA` | kwadrat normy wektora A | Σ aᵢ² |
| `normB` | kwadrat normy wektora B | Σ bᵢ² |

Wynik to: `dot / (√normA · √normB)`, czyli cosinus kąta między dwoma wektorami w przestrzeni 1536-wymiarowej.

### Intuicja stojąca za tą metryką

- **Wynik = 1.0** — wektory wskazują dokładnie ten sam kierunek (identyczne znaczenie)
- **Wynik ≈ 0.6+** — silne podobieństwo semantyczne (np. "kobieta" i "królowa")
- **Wynik ≈ 0.35-0.6** — powiązane tematycznie (np. "samochód" i "autostrada")
- **Wynik < 0.35** — odległe znaczeniowo (np. "kot" i "matematyka")

Cosine similarity ignoruje **długość** wektorów, patrzy tylko na **kierunek**. Dlatego działa dobrze niezależnie od długości tekstu — krótkie i długie teksty mogą mieć podobne znaczenie.

### Dlaczego ręczna implementacja?

W produkcji tę matematykę robi baza wektorowa (Qdrant, sqlite-vec itp.). Ale w tym demo chodzi o **zrozumienie mechanizmu** — widzisz dokładnie, co się dzieje między dwoma embeddingami. Żadnej magii, tylko iloczyn skalarny i normalizacja.

## Porcja 3: Wizualizacja macierzy i pętla REPL

### Preview embeddingu

```javascript
const preview = (embedding) => {
  const head = embedding.slice(0, 4).map((v) => v.toFixed(4)).join(", ");
  const tail = embedding.slice(-2).map((v) => v.toFixed(4)).join(", ");
  return `[${head}, …, ${tail}] (${embedding.length}d)`;
};
```

Prosty helper — pokazuje 4 pierwsze i 2 ostatnie wartości z 1536-elementowej tablicy. Pozwala "zobaczyć" embedding bez zalewania terminala. To czysto edukacyjne — w produkcji nikt nie wyświetla surowych wartości. Ale tutaj pomaga zbudować intuicję: **każdy tekst to tablica liczb o stałej długości**.

### Kolorowanie wyników

```javascript
const colorFor = (score) =>
  score >= 0.6 ? c.green : score >= 0.35 ? c.yellow : c.red;
```

Trzy progi:
- **Zielony (≥ 0.60)** — semantycznie podobne
- **Żółty (≥ 0.35)** — powiązane tematycznie
- **Czerwony (< 0.35)** — odległe

Dla modelu `text-embedding-3-small` te progi dobrze oddają praktyczne granice podobieństwa.

### Macierz podobieństwa — `printMatrix`

Kluczowe decyzje projektowe:

1. **Pełna macierz parami (pairwise)** — każdy tekst porównywany z każdym. Złożoność O(n²), ale przy kilku tekstach w REPL-u to nie problem.
2. **Przekątna (`i === j`) wyświetla "——"** — porównanie tekstu z samym sobą dałoby zawsze 1.0, więc nie ma sensu go pokazywać.
3. **Wizualny pasek `█`** — `Math.round(score * 8)` daje 0-8 bloków. Szybka wizualna ocena bez czytania liczb.
4. **Legenda na końcu** — kolorowy przewodnik po progach.

### Pętla REPL — `main`

```javascript
const entries = [];

while (true) {
  const input = await rl.question("Text: ").catch(() => "exit");
  if (input.toLowerCase() === "exit" || !input.trim()) break;

  const embedding = await embed(input);
  entries.push({ text: input, embedding });

  if (entries.length === 1) {
    console.log("Add more to see similarities.");
    continue;
  }
  printMatrix(entries);
}
```

- **`entries`** — tablica `{ text, embedding }`, rośnie z każdym wpisem.
- **Pierwsza wiadomość** — brak z czym porównać, wyświetla podpowiedź.
- **Od drugiej** — przelicza i wyświetla **całą macierz od nowa** (cosine similarity na żywo, bez cache'a).

### Wzorzec architektoniczny

Przepływ to klasyczny **embed → store → compare**:

```
Input → API (embed) → Wektor → Pamięć (entries[]) → Porównanie (cosine) → Wizualizacja
```

W produkcyjnym RAG ten sam schemat wygląda tak:

```
Dokument → API (embed) → Wektor → Baza wektorowa → Wyszukiwanie (cosine/ANN) → Wyniki
```

Różnica? W demo porównujemy **wszystko ze wszystkim** (brute force). W produkcji baza wektorowa używa **approximate nearest neighbors** (ANN) do szybkiego znajdowania najbliższych wektorów bez porównywania z każdym.
