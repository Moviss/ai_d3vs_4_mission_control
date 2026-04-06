# Obserwowanie i ewaluacja — Podsumowanie

## O czym jest ta lekcja? (TL;DR)

Gdy budujesz system agentowy, nawet drobna zmiana w prompcie może nieoczekiwanie zepsuć coś zupełnie innego. Ta lekcja pokazuje dwa filary kontroli jakości aplikacji LLM: **observability** (śledzenie tego, co agent robi i dlaczego) oraz **evals** (sprawdzanie, czy robi to dobrze). To nie są testy jednostkowe — to raczej system wczesnego ostrzegania, który pomaga zrozumieć niedeterministyczne zachowania modeli zanim trafią one do użytkowników.

## Mapa koncepcji

- **LLM Application Quality Assurance** — trzy filary: Evals, Guardrails, Observation
  - **Observation (Observability)** — śledzenie zachowań agenta w runtime
    - **Hierarchia obserwacji** — Session → Trace → Span → Generation / Agent / Tool / Event
    - **Scentralizowana bramka** — jeden punkt logowania wszystkich interakcji z LLM i narzędziami
  - **Evals (Ewaluacja)** — weryfikacja jakości przed i po wdrożeniu
    - **Offline evals** — testy przed publikacją (CI/CD, development)
    - **Online evals** — ocena w trakcie działania aplikacji na produkcji
    - **Datasety testowe** — pokrycie, różnorodność, balans
  - **Prompt Versioning** — wersjonowanie instrukcji powiązane ze statystykami
  - **Guardrails** — walidacja wejść/wyjść, moderacja treści

## Kluczowe koncepcje

### Trzy filary jakości aplikacji LLM

**W jednym zdaniu:** Evals weryfikują jakość, Guardrails wymuszają granice, Observation pozwala zrozumieć zachowanie — razem tworzą kompletny system kontroli jakości.

**Rozwinięcie:** Pomyśl o tym jak o trzech warstwach ochrony budynku: Observation to monitoring kamer (wiesz co się dzieje), Guardrails to zamki i alarmy (blokują niepożądane działania w czasie rzeczywistym), a Evals to audyt bezpieczeństwa (sprawdzasz offline, czy wszystko działa jak powinno). Żaden z tych elementów nie zastępuje klasycznych testów jednostkowych czy E2E — skupiają się wyłącznie na niedeterministycznym zachowaniu modeli.

**Przykład z lekcji:** Diagram "LLM Application Quality Assurance" pokazuje, że Evals dzielą się na offline (prompt regression, dataset benchmarks, pre-deploy checks) i online (live interaction scoring, violation detection, user satisfaction), a ocena może być **programistyczna**, przez **LLM-as-Judge** lub przez **człowieka**.

### Observability — śledzenie zachowań agenta

**W jednym zdaniu:** Monitorowanie aplikacji agentowej wymaga logowania nie tylko pojedynczych zdarzeń, ale całego kontekstu sesji z hierarchicznym grupowaniem i zagnieżdżaniem.

**Rozwinięcie:** W klasycznym logowaniu zapisujesz pojedyncze linie tekstu. W observability agentów musisz zrozumieć **sekwencję decyzji**: agent wybrał narzędzie X, dostał wynik Y, na tej podstawie wywołał narzędzie Z. Platformy jak Langfuse organizują to w hierarchię: **Session** (wątek czatu) → **Trace** (pojedyncza interakcja użytkownika) → **Generation** (wywołanie LLM) / **Tool** (wywołanie narzędzia) / **Span** (pomiar czasu operacji). Kluczowe jest przekazywanie kontekstu: identyfikator użytkownika, sesji, agenta, wersja promptu.

**Przykład z lekcji:** Diagram architektury pokazuje Agent Loop (Generation → Tool → Generation → Spawn Agent → ...) przepływający przez Centralized Gateway do platformy obserwacji, gdzie każde zdarzenie jest wzbogacone o Session Context (userId, sessionId, agentId, promptVersion, tags).

### Debugowanie przez obserwację, nie przez kod

**W jednym zdaniu:** Problemy agentów AI często są niewidoczne w kodzie — dopiero śledzenie kroków agenta ujawnia, dlaczego podjął złą decyzję.

**Rozwinięcie:** Wyobraź sobie agenta, który twierdzi, że nie znalazł danych użytkownika — kod wygląda poprawnie, narzędzia nie rzucają błędów. Dopiero observability pokazuje, że agent przeszukiwał **niewłaściwy obszar**, bo opisy dwóch narzędzi były zbyt podobne. To jak różnica między czytaniem kodu źródłowego a oglądaniem nagrania z debuggera — czasem musisz zobaczyć, co agent *faktycznie zrobił*, a nie co *powinien był zrobić*.

**Przykład z lekcji:** Diagram "Debugging Agent: Overlapping Tool Descriptions" pokazuje konkretny scenariusz: agent ma narzędzia `search_contacts` ("Search user data and interactions") oraz `search_notes` ("Search user data and documents"). Opisy się pokrywają — oba mówią "Search user data" — więc agent wybrał `search_notes` zamiast `search_contacts`, szukając w `notes/` zamiast w `contacts/`, gdzie leżał plik `anna-history.json`.

### Playground — interaktywne debugowanie zachowań

**W jednym zdaniu:** Playground pozwala odtworzyć zapisaną interakcję z LLM, zmienić parametry i sprawdzić, jak wpływa to na zachowanie modelu.

**Rozwinięcie:** To jak "replay" w grze — bierzesz konkretne zapytanie z produkcji, widzisz pełny kontekst (system prompt, historię, narzędzia), a potem możesz edytować dowolny element i uruchomić ponownie. Możesz nawet porównać odpowiedzi różnych modeli. Ważne zastrzeżenie: nawet jeśli zmiana promptu rozwiąże problem w jednym przypadku, może zepsuć coś innego — dlatego evals są tak istotne.

**Przykład z lekcji:** Diagram "LLM Debug Playground" pokazuje interfejs z wyborem modelu (gpt-5-nano), 12 narzędziami, sekcją Messages (SYSTEM + USER) i Output z tool callem `video__understand`. Można dodać wynik narzędzia do wiadomości i ponownie uruchomić agenta.

### Wersjonowanie promptów ze statystykami

**W jednym zdaniu:** Każda wersja promptu powinna mieć własny "fingerprint wydajnościowy" — latency, koszt, zużycie tokenów, wynik ewaluacji — aby świadomie decydować o zmianach.

**Rozwinięcie:** Git śledzi historię zmian w kodzie, ale nie mówi Ci, że wersja #1 promptu generowała 4 interakcje z latency 2.76s i kosztem $0.015, a wersja #2 już 183 interakcji z latency 2.41s i kosztem $0.0011. Platformy jak Langfuse łączą wersje promptów z ich statystykami produkcyjnymi, co umożliwia data-driven iterację. Jeśli nie możesz trzymać promptów w platformie, wystarczy **jednostronna synchronizacja** — zmiany w kodzie odzwierciedlane w Langfuse.

**Przykład z lekcji:** Diagram "System Prompt Versioning" pokazuje prompt `agents/alice` z dwoma wersjami: #1 (4 generacje, $0.0150) vs #2 PRODUCTION (183 generacje, avg score 0.65, $0.0011), z powiązanymi generacjami i ich kosztami.

### Anatomia promptu i projektowanie datasetów

**W jednym zdaniu:** W typowym wywołaniu agentowym odpowiedzi narzędzi stanowią ~68% promptu — ewaluacje muszą to uwzględniać, a datasety testowe wymagają pokrycia, różnorodności i balansu.

**Rozwinięcie:** Łatwo zapomnieć, że system prompt to zaledwie ~3.4% tokenów w typowym agentowym zapytaniu. Definicje narzędzi zajmują ~10.7%, konwersacja ~18.3%, ale to **odpowiedzi narzędzi** (~67.6%) dominują kontekst. Jeśli testujesz tylko prompt systemowy, pomijasz większość tego, co model widzi. Projektując datasety testowe, pamiętaj o trzech zasadach: **Coverage** (pokryj wszystkie kategorie zachowań, łącznie z negatywnymi), **Diversity** (różnorodne scenariusze w każdej kategorii), **Balance** (nie skrzywiaj uwagi w jednym kierunku).

**Przykład z lekcji:** Diagram "Prompt Anatomy" rozbija skład typowego agentowego promptu: System Prompt 3.4% (465 tokenów), Tool Definitions 10.7% (1,466 tokenów), Conversation 18.3% (~2,500 tokenów), Tool Responses 67.6% (9,294 tokenów).

### Eval Alignment Matrix — kiedy test kłamie

**W jednym zdaniu:** Wysoki wynik ewaluacji nie gwarantuje dobrego outputu — musisz rozróżniać cztery scenariusze: aligned, false positive, true negative i false negative.

**Rozwinięcie:** To jak w medycynie — test może dać wynik pozytywny, ale pacjent jest zdrowy (false positive). W kontekście evals: **Aligned** (wysoki wynik + dobry output → monitoruj), **False Positive** (wysoki wynik + słaby output → napraw evals), **True Negative** (niski wynik + słaby output → napraw aplikację), **False Negative** (niski wynik + dobry output → napraw evals). Iteracja datasetów i kryteriów oceny jest nieunikniona.

**Przykład z lekcji:** Diagram "Eval Alignment Matrix" to macierz 2×2: oś X to Actual Output Quality (poor → good), oś Y to Eval Score (low → high). Kluczowa lekcja: kiedy wynik eksperymentu nie pasuje do rzeczywistości, problemem mogą być testy, nie aplikacja.

## Teoria w praktyce

### Agent z observability (`03_01_observability`)
Minimalny agent HTTP (Hono) z pełną integracją Langfuse. Każde zapytanie `/api/chat` jest owijane w trace z kontekstem sesji, a wywołania narzędzi i generacje LLM automatycznie trafiają do platformy.

```typescript
// app.ts — każda interakcja jest owijana w trace z pełnym kontekstem
const result = await withTrace(
  {
    name: 'chat-request',
    sessionId,
    userId,
    input: message,
    metadata: { provider: 'openai', stream: false },
    tags: ['chat', 'openai', 'sync'],
  },
  async () => {
    const run = await runAgent({ adapter: adapter.value, logger, session, message });
    setTraceOutput(run.response);
    return run;
  },
);
```

Kluczowe: `withTrace` tworzy nadrzędny span, wewnątrz którego zagnieżdżone są `withAgent`, `startGeneration` i `withTool` — budując pełne drzewo obserwacji automatycznie.

### Tracer — hierarchiczny system obserwacji (`03_01_observability`)
System tracingu buduje hierarchię: trace → agent → generation/tool, z automatycznym formatowaniem nazw i kontekstem turów konwersacji.

```typescript
// tracer.ts — withTool opakowuje wywołanie narzędzia z pełnym kontekstem
export const withTool = async <T>(params: ToolParams, fn: () => Promise<T>): Promise<T> => {
  if (!isTracingActive()) return fn(); // graceful degradation bez Langfuse

  const name = formatToolName(params.name);
  return startActiveObservation(name, async (span: LangfuseTool) => {
    span.update({
      input: params.input,
      metadata: { callId: params.callId, turn: getCurrentTurn(), ...params.metadata },
    });
    try {
      const result = await fn();
      span.update({ output: result });
      return result;
    } catch (error) {
      span.update({ level: 'ERROR', statusMessage: error.message });
      throw error;
    }
  }, { asType: 'tool' });
};
```

Wzorzec `if (!isTracingActive()) return fn()` zapewnia, że aplikacja działa poprawnie nawet bez skonfigurowanego Langfuse.

### Ewaluacja skuteczności narzędzi (`03_01_evals`)
Eksperyment `tool-use.ts` weryfikuje, czy agent poprawnie wybiera narzędzia. Evaluator sprawdza cztery metryki deterministycznie, bez użycia LLM.

```typescript
// tool-use.ts — deterministyczna ocena wyboru narzędzi
const toolUseEvaluator: Evaluator = async ({ input, output, expectedOutput }) => {
  const expected = toExpected(expectedOutput);
  const toolNames = asArray(outputObj.toolNames).filter((v): v is string => typeof v === 'string');
  const unique = new Set(toolNames);

  const decision = expected.shouldUseTools ? (count > 0 ? 1 : 0) : (count === 0 ? 1 : 0);
  const required = expected.requiredTools.every((n) => unique.has(n)) ? 1 : 0;
  const forbidden = (expected.forbiddenTools ?? []).every((n) => !unique.has(n)) ? 1 : 0;
  const callCount = (count >= (expected.minToolCalls ?? 0) && count <= (expected.maxToolCalls ?? Infinity)) ? 1 : 0;
  const overall = (decision + required + forbidden + callCount) / 4;

  return [
    { name: 'tool_use_overall', value: overall },
    { name: 'tool_use_decision_accuracy', value: decision },
    // ... kolejne metryki
  ];
};
```

Cztery metryki: czy agent w ogóle użył narzędzi (decision), czy użył wymaganych (required), czy unikał zabronionych (forbidden), czy liczba wywołań mieści się w zakresie (call count). Wynik to średnia — prosta, ale skuteczna heurystyka.

## Najważniejsze zasady (cheat sheet)

1. **Observability to fundament, evals to nadbudowa** — zacznij od monitorowania aktywności agentów, potem stopniowo dodawaj ewaluacje tam, gdzie system najbardziej tego wymaga.
2. **Evals ≠ testy deterministyczne** — nie szukasz 100% dopasowania, lecz wystarczającego poziomu dla ustalonych wskaźników. Ocena może być programistyczna, przez LLM lub przez człowieka.
3. **Loguj kontekst, nie tylko zdarzenia** — samo „agent wywołał narzędzie X" jest bezwartościowe bez informacji o sesji, użytkowniku, wersji promptu i historii konwersacji.
4. **Grupuj i zagnieżdżaj obserwacje** — Session → Trace → Agent → Generation / Tool. Hierarchia pozwala zrozumieć sekwencję decyzji agenta.
5. **Odpowiedzi narzędzi dominują prompt** — stanowią ~68% tokenów w typowym wywołaniu agentowym. Uwzględniaj je w ewaluacjach.
6. **Wersjonuj prompty ze statystykami** — sam Git nie wystarczy. Łącz wersje promptów z ich metrykami produkcyjnymi (latency, koszt, skuteczność).
7. **Datasety testowe wymagają pokrycia, różnorodności i balansu** — skrzywiony dataset da fałszywy obraz skuteczności. Testuj szczęśliwe i nieszczęśliwe ścieżki.
8. **Weryfikuj alignment evals** — wysoki wynik nie gwarantuje dobrego outputu. Sprawdzaj false positives i false negatives w swoich testach.
9. **Estymacja kosztów wymaga danych produkcyjnych** — token composition jest zmienna (dynamiczny kontekst, nieprzewidywalne odpowiedzi narzędzi, różni użytkownicy). Twarde limity są krytyczne.
10. **Ewaluacje mogą być tymczasowe** — nie musisz utrzymywać ich w systemie na zawsze. Stwórz je np. żeby sprawdzić, czy mniejszy model poradzi sobie z zadaniem.
11. **Guardrails łapią to, czego evals nie wychwycą** — walidacja wejść, filtrowanie wyjść i blokowanie niepożądanych zapytań działają inline z każdym requestem.

## Czego unikać (anty-wzorce)

- **Debugowanie agenta przez czytanie kodu** → **Debugowanie przez śledzenie kroków agenta** — problemy często wynikają z nakładających się opisów narzędzi lub dynamicznego kontekstu, co jest niewidoczne w statycznym kodzie.
- **Logowanie bez kontekstu sesji** → **Przekazywanie pełnego kontekstu do platformy observability** — log "wywołano narzędzie search_notes" jest bezużyteczny bez informacji, w jakiej sesji, dla jakiego zapytania i po jakiej sekwencji kroków.
- **Testowanie tylko system promptu** → **Ewaluacja pełnego kontekstu, w tym odpowiedzi narzędzi** — system prompt to ~3.4% tokenów; ignorowanie reszty daje fałszywy obraz.
- **Skrzywiony dataset (tylko happy path)** → **Balansowanie scenariuszy pozytywnych, negatywnych i edge case'ów** — jeśli testujesz agenta z 5 narzędziami, ale 80% testów dotyczy jednego narzędzia, wynik będzie mylący.
- **Traktowanie wysokiego eval score jako gwarancji jakości** → **Weryfikacja alignment matrix** — false positive (dobry wynik + słaby output) to sygnał, że evals wymagają poprawy.
- **Wrzucanie observability dopiero przy problemach** → **Planowanie observability od etapu architektury** — scentralizowana bramka do logowania LLM i narzędzi jest znacznie łatwiejsza do wdrożenia, gdy projektujesz ją od początku.

## Sprawdź się (pytania do refleksji)

- **Masz agenta, który w 90% przypadków poprawnie wybiera narzędzia, ale w 10% myli dwa o podobnych opisach. Jak zaprojektowałbyś ewaluację, która wykryje ten problem, zanim trafi on na produkcję?** *Wskazówka: pomyśl o pokryciu scenariuszy, w których opisy narzędzi się nakładają, i o metryce `tool_use_decision_accuracy`.*

- **Twój system agentowy korzysta z trzech modeli o różnych cenach. Jak observability pomaga Ci estymować koszty i reagować na anomalie?** *Wskazówka: pomyśl o tym, co wpływa na zmienność kosztu — dynamiczny kontekst, długość sesji, engagement użytkowników.*

- **Zmieniasz opis jednego narzędzia w systemie z 10 narzędziami. Jak sprawdzisz, że zmiana nie pogorszyła zachowania agenta w innych scenariuszach?** *Wskazówka: pomyśl o wersjonowaniu promptów powiązanym z eksperymentami na syntetycznych datasetach.*

- **Kiedy warto zrezygnować z ewaluacji i polegać wyłącznie na observability + manualnym review?** *Wskazówka: rozważ trade-off między szybkością iteracji a stabilnością systemu — twórca Claude Code mówi "no evals".*

- **Jak zaprojektowałbyś system monitorowania, który automatycznie wykrywa naruszenia w odpowiedziach modelu na produkcji (online eval)?** *Wskazówka: pomyśl o połączeniu Guardrails (inline) z online evals (asynchroniczna ocena zapisanych interakcji).*
