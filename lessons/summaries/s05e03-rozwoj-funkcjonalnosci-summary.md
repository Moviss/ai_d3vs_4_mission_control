# S05E03 — Rozwój funkcjonalności — Podsumowanie

## O czym jest ta lekcja? (TL;DR)

Lekcja odpowiada na pytanie: jak rozwijać generatywne aplikacje w świecie, gdzie fundamenty są stabilne, ale ekosystem zmienia się co kwartał? Kluczowy insight: nie budujesz linii produkcyjnej (jak w klasycznych appkach), a **fabrykę**, która sama kształtuje procesy. To zmienia podejście do migracji modeli, architektury, zarządzania długiem technicznym, a nawet do samego pisania promptów — bo agenci mogą zacząć optymalizować je sami.

## Mapa koncepcji

- **Dwuznaczność generatywnego AI** — stabilne fundamenty (autoregresja, halucynacje) vs dynamiczna warstwa wyższa (multimodalność, agenci, narzędzia)
  - **Dwuznaczność architektury** — prostsza logika agenta vs bardziej złożone środowisko, w którym agent działa
- **Linia produkcyjna vs fabryka** — klasyczne aplikacje to deterministyczny pipeline, generatywne to środowisko, w którym agent dynamicznie kształtuje procesy
- **Sygnał vs szum** — framework do oceny, czy nowa funkcjonalność AI to inwestycja, czy hype
- **Migracja modeli** — przełączenie modelu to nie tylko zmiana ID, ale potencjalnie gruntowna rewizja systemu
- **Samorozwój agentów** — agenci mogą rozszerzać swoje możliwości przez nowe narzędzia i autonomicznie optymalizować prompty
  - **Automatyczna optymalizacja promptów** — DSPy/AX: sygnatury zamiast ręcznych instrukcji, zamknięta pętla optymalizacji

## Kluczowe koncepcje

### Dwuznaczność generatywnego AI: stabilne fundamenty vs dynamiczna warstwa wyższa

**W jednym zdaniu:** Fundamenty modeli (autoregresja, tokenizacja, halucynacje, prompt injection) są stabilne od 3 lat, ale wszystko co nad nimi — możliwości, techniki pracy, narzędzia — zmienia się co kwartał.

**Rozwinięcie:** To jak z fizyką: prawa grawitacji się nie zmieniają, ale technologie lotnicze rozwijają się cały czas. Na stabilnych fundamentach warto budować trwałą logikę (obsługa tokenów, limitów kontekstu, halucynacji), bo tu nie grozi nam nagła rewolucja. Natomiast na poziomie narzędzi, technik agentowych i multimodalności trzeba być gotowym na szybkie zmiany i projektować z myślą o wymienialności.

**Przykład z lekcji:** Diagram "Gen AI Duality" dzieli świat na dwie warstwy: Layer I (Stable Fundamentals) — autoregresja, tokenizacja, context window, halucynacje, prompt injection — "slow change, principles unchanged". Layer II (Dynamic Higher Layer) — multimodalność, rosnące okno kontekstu (4k→128k→1M+ tok), agentic workflows, techniki pracy, ekosystem narzędzi — "fast change, quarterly shifts".

### Dwuznaczność architektury: prostsza logika, ale złożone środowisko

**W jednym zdaniu:** Logika agentowa upraszcza kod (RAG z wieloetapowego pipeline'u staje się zestawem narzędzi), ale otoczenie agenta (sandbox, multimodalność, ewaluacja, tryby czasowe) staje się coraz bardziej złożone.

**Rozwinięcie:** Wyobraź sobie, że zatrudniasz autonomicznego pracownika zamiast budować linię montażową. Sam pracownik jest "prostszy" w obsłudze (dajesz instrukcje, nie programujesz każdy krok), ale musisz zbudować mu biuro, dać klucze, ustawić granice, założyć monitoring i zabezpieczenia. W architekturze aplikacji widzimy to samo: logika RAG sprowadza się do `search()→fetch()→answer()`, ale dookoła pojawiają się sandboxe, pipeline'y multimodalne, tryby async/real-time i warstwa ewaluacji.

**Przykład z lekcji:** Diagram "Application Architecture Duality" pokazuje: po lewej (Simpler Logic) — RAG w 2022 to 5-etapowy pipeline (query analysis→rewrite→multi-level retrieval→rerank→merge), a dziś to 3 wywołania narzędzi. Delegacja logiki do agenta: 2022=10%, 2024=45%, 2025=75%. Po prawej (Complex Environment) — sandbox z code_exec/file_system/browser, multimodalny pipeline przetwarzania (PDF→parse→chunk→embed, image→vision→OCR), tryby async/real-time, warstwa ewaluacji i guardrails.

### Linia produkcyjna vs fabryka

**W jednym zdaniu:** Klasyczna aplikacja to deterministyczna linia montażowa (każdy krok zaprojektowany ręcznie), a generatywna to fabryka — projektujesz środowisko, agent sam kształtuje procesy.

**Rozwinięcie:** W klasycznej aplikacji masz 5 kroków: validate input → query database → apply business rules → transform output → return response. Każde "if" i "else" zaprojektowałeś sam. W aplikacji generatywnej agent siedzi w centrum i **sam decyduje** co zbudować, jak i w jakiej kolejności — ty projektujesz środowisko: narzędzia (search, read, code, run), sandbox, pamięć, uprawnienia i guardrails. "Fixed path, deterministic, one pipeline per use case" vs "Dynamic paths, adaptive, pipelines emerge per situation".

**Przykład z lekcji:** Diagram "Building the Line vs Building the Factory" pokazuje to wprost: lewa strona to 5 sekwencyjnych bloków (01–05), prawa to Agent w centrum z trzema gałęziami narzędzi (search→read→answer, code→run→fix→run, plan→delegate) plus warstwa tools/sandbox/memory/permissions/guardrails.

### Sygnał vs szum: jak oceniać nowości AI

**W jednym zdaniu:** Nie wszystko co głośne jest ważne — prawdziwe sygnały to rozwiązania cross-provider, open standard, community-built, które wracają po tygodniach ciszy.

**Rozwinięcie:** Lekcja prezentuje macierz 2x2 do klasyfikacji nowości. Oś X to "Fundamentals Alignment" (czy rozwiązanie jest przezroczyste i przenośne?), oś Y to "Adoption" (czy szerokie grono faktycznie tego używa?). Kluczowa zasada: jeśli temat wraca po tygodniach ciszy, daj mu drugą szansę. Jeśli po początkowym szumie znika — to szum. Samodzielne sprawdzenie zawsze bije czytanie komentarzy w social mediach.

**Przykład z lekcji:** Macierz "Signal vs Noise": **INVEST** (cross-provider, open standard, portable, community-built, keeps returning), **WATCH** (single-vendor, no migration path, opaque internals, high exit cost), **REVISIT** (solves real pain, small but growing, reappears over time), **IGNORE** (one vendor demo, benchmark-only, spike then silence). Assistants API OpenAI to przykład szumu — temat pojawiał się, ale malał z czasem, a po 15 miesiącach został zastąpiony. Responses API to sygnał — przyjęte cross-provider w 3-4 miesiące.

### Rozwijanie agentów przez narzędzia i modele

**W jednym zdaniu:** Prosta zmiana dostępnych narzędzi lub modelu potrafi całkowicie zmienić profil aplikacji agentowej — bez modyfikacji głównej logiki.

**Rozwinięcie:** Agent z dostępem do systemu plików + pamięcią potrafi programować gry. Ten sam agent po podłączeniu Gmaila, Google Calendar i Firecrawl staje się asystentem produktywności. Po przełączeniu na mocniejszy model (np. gpt-5.4 xhigh) — rozwiązuje trudniejsze problemy. Po dodaniu terminala — staje się pełnoprawnym środowiskiem deweloperskim. To jak z człowiekiem: te same umiejętności poznawcze, ale daj mu laptop vs kartkę papieru i dostaniesz diametralnie inne wyniki.

**Przykład z lekcji:** Diagram architektury `05_03_coding` pokazuje agenta z zaledwie 4 narzędziami plikowych (fs_read, fs_write, fs_search, fs_manage). Z jednozdaniową instrukcją stworzył grę Snake z autonomicznym przeciwnikiem oraz wyścigi z "duchem". Diagram "Capability Levers" pokazuje dwa dźwignie: Lever 1 (Model) — swap na gpt-5.4 xhigh = głębsze rozumowanie; Lever 2 (Tool) — dodanie terminala = pełne środowisko deweloperskie.

### Pamięć agenta: Observer + Reflector

**W jednym zdaniu:** Agent działający przez wiele tur potrzebuje mechanizmu kompakcji pamięci — starsze wiadomości są kondensowane do podsumowania, a tylko najnowsze trafiają do kontekstu.

**Rozwinięcie:** To jak robienie notatek ze spotkania: nie przepisujesz każdego słowa, a kondensujesz kluczowe ustalenia. Agent z `05_03_coding` ma dwie role pamięciowe: Observer (kategoryzuje obserwacje wg priorytetów: high/medium/low) i Reflector (kompresuje obserwacje powyżej 4k tokenów w do 5 przebiegach — z agresywną, przez redukcyjną, do generycznej). System prompt otrzymuje skondensowane podsumowanie + najnowsze wiadomości, co pozwala na długie sesje bez przekraczania okna kontekstu.

**Przykład z lekcji:** W kodzie `05_03_coding/memory.ts` widać mechanizm: gdy wiadomości przekroczą limit (COMPACT_AFTER_MESSAGES/CHARS), starsze są serializowane, wysyłane do mniejszego modelu z instrukcją "fold into summary", a wynik trafia do `session.summary`. Nowy kontekst = `system prompt + summary + ostatnie N wiadomości`.

### Automatyczna optymalizacja promptów (DSPy/AX)

**W jednym zdaniu:** Zamiast ręcznie pisać prompty, definiujesz "sygnaturę" (wejście → wyjście) i pozwalasz frameworkowi automatycznie zoptymalizować instrukcję lub wygenerować few-shot examples.

**Rozwinięcie:** Pomyśl o tym jak o testach jednostkowych dla promptów, ale z automatyczną naprawą. Definiujesz co chcesz (np. "emailBody → labels, priority, summary"), dajesz przykłady treningowe z oczekiwanym wynikiem, a framework sam generuje kandydatów, testuje ich, porównuje z baseline'em i zachowuje tylko te zmiany, które podnoszą wynik powyżej szumu. Podejście `05_03_autoprompt` podniosło skuteczność z 60% do 94.3% w 10 rundach. AX idzie dalej: w kodzie w ogóle nie piszesz promptu — definiujesz sygnaturę i wywołujesz `classifier.forward()`.

**Przykład z lekcji:** Diagram "Optimization Progress" pokazuje: baseline 60%, po 10 iteracjach najlepszy wynik 94.3% (iter 6), holdout verification na niewidzianych danych 89.9%. Zielone paski = keep (iteracje 1-3, 6), szare = discard (4-5, 7-10). Kluczowe: z 5 strategii kandydujących (balanced, coverage, simplify, boundary, salience) wybierany jest najlepszy per iterację, a akceptacja wymaga pokonania progu szumu.

## Teoria w praktyce

### Agent z pamięcią i plikami (`05_03_coding`)
Prosty agent z dostępem do systemu plików i mechanizmem kompakcji pamięci — demonstruje, jak niewiele narzędzi wystarczy do tworzenia rozbudowanych aplikacji.

```typescript
// memory.ts — kompakcja pamięci agenta
export const maybeCompactMemory = async (openai, session, logger) => {
  const serialized = serializeMessages(session.messages)
  const needsCompaction =
    session.messages.length > COMPACT_AFTER_MESSAGES ||
    serialized.length > COMPACT_AFTER_CHARS

  if (!needsCompaction) return

  // Starsze wiadomości → mniejszy model → podsumowanie
  const splitIndex = Math.max(0, session.messages.length - KEEP_RECENT_MESSAGES)
  const olderMessages = session.messages.slice(0, splitIndex)

  const response = await openai.responses.create({
    model: MEMORY_MODEL,
    instructions: MEMORY_PROMPT,
    input: [
      `Current summary:\n${session.summary}`,
      `Conversation to fold:\n${serializeMessages(olderMessages)}`,
    ].join('\n\n'),
  })

  session.summary = response.output_text?.trim()
  session.messages = session.messages.slice(splitIndex)  // zachowaj tylko najnowsze
}
```

Wzorzec "rolling summary": zamiast trzymać pełną historię w kontekście, agent składa starsze wiadomości do podsumowania mniejszym modelem. Kluczowy detal: `buildInstructions()` wstrzykuje to podsumowanie do system prompt, a w `input` trafiają tylko najnowsze wiadomości — context window nigdy nie puchnie.

### Zamknięta pętla optymalizacji promptów (`05_03_autoprompt`)
Autonomiczny optymalizator, który generuje kandydatów z różnymi strategiami, testuje je i zachowuje tylko te, które pokonują próg szumu.

```javascript
// optimize-project.js — strategia keep/discard
const candidateResult = await runEvaluation({ prompt: suggestion.prompt, ... })
const delta = candidateResult.avg - bestScore
const noiseFloor = Math.max(candidateResult.spread, lastEval.spread) / 2
const improved = delta > noiseFloor  // akceptuj tylko powyżej progu szumu!

// 5 strategii kandydujących per iteracja:
const CANDIDATE_STRATEGIES = [
  { label: "balanced",  hint: "choose highest-impact single change" },
  { label: "coverage",  hint: "prefer ADD when concern lacks a rule" },
  { label: "simplify",  hint: "prefer REMOVE or MERGE when rules overlap" },
  { label: "boundary",  hint: "sharpen what counts as task/decision/person" },
  { label: "salience",  hint: "REORDER to make important rule easier to follow" },
]
```

Dwa kluczowe mechanizmy: (1) **noise floor** — zmiana musi pokonać połowę spreadu dotychczasowych wyników, żeby nie akceptować szumu; (2) **zróżnicowane strategie** — każdy kandydat próbuje innego podejścia (dodaj regułę, uprość, wyostrz granice), co eksploruje przestrzeń rozwiązań szerzej niż jeden prompt "improve this".

### Sygnatury zamiast promptów z AX (`05_03_ax`)
Framework AX eliminuje ręczne pisanie promptów — definiujesz sygnaturę (pola wejściowe → wyjściowe) i wywołujesz `.forward()`.

```typescript
// classify.ts — sygnatura zamiast promptu
const SIGNATURE = `emailFrom:string, emailSubject:string, emailBody:string ->
   labels:string[] "pick ALL matching labels from: ${labelsEnum}",
   priority:class "high, medium, low",
   needsReply:boolean,
   summary:string "one-sentence summary"`;

const classifier = ax(SIGNATURE, { description: DESCRIPTION });

// Użycie: zero promptów, strukturalny wynik
const result = await classifier.forward(llm, {
  emailFrom: email.from,
  emailSubject: email.subject,
  emailBody: email.body,
});
// result.labels, result.priority, result.needsReply, result.summary

// optimize.ts — automatyczne generowanie few-shot examples
const optimizer = new AxBootstrapFewShot({ studentAI: llm, targetScore: 0.85 });
const result = await optimizer.compile(classifier, trainingSet, classificationMetric);
writeFileSync('demos.json', JSON.stringify(result.demos, null, 2));
```

Dwa poziomy wartości: (1) sygnatura wymusza strukturalny output bez ręcznego JSON mode — framework buduje prompt za ciebie; (2) optymalizator `AxBootstrapFewShot` automatycznie generuje najlepsze few-shot examples i zapisuje je do `demos.json`, które przy następnym uruchomieniu podnoszą skuteczność bez zmiany kodu.

## Najważniejsze zasady (cheat sheet)

1. **Inwestuj w zrozumienie fundamentów modeli** — autoregresja, tokenizacja, halucynacje, prompt injection pozostają niezmienne od 3 lat i kształtują ograniczenia wszystkiego co budujesz.
2. **Projektuj z myślą o wymienialności na wyższych warstwach** — modele, narzędzia i techniki zmieniają się co kwartał; wspieraj więcej niż jednego providera.
3. **Budujesz fabrykę, nie linię montażową** — projektuj środowisko (narzędzia, sandbox, pamięć, guardrails), nie deterministyczny pipeline; agent sam kształtuje procesy w runtime.
4. **Logika agentowa jest domyślnym podejściem** — deterministyczną logikę wybieraj dopiero gdy masz istotny powód; RAG, klasyfikacja, ekstrakcja — agent z narzędziami coraz częściej wygrywa z hardcoded pipeline'em.
5. **Przy migracji modeli szukaj nowych możliwości, nie tylko regresji** — nowszy model może uprościć instrukcje, zmniejszyć liczbę narzędzi lub odblokować nowe scenariusze.
6. **Ostrożnie z mniejszymi wariantami modeli** — główna wersja jest zazwyczaj zauważalnie lepsza, mniejsze potrafią tylko sprawiać wrażenie; testuj ewaluacjami.
7. **Narzędzia zmieniają profil agenta bardziej niż kod** — podłączenie Gmaila, terminala czy przeglądarki daje nowe możliwości bez zmiany logiki; projektuj agentów jako platformy, nie jednorazowe skrypty.
8. **Kompaktuj pamięć agenta zamiast powiększać kontekst** — rolling summary z mniejszym modelem pozwala na sesje dowolnej długości bez przekraczania okna kontekstu.
9. **Rozważ automatyczną optymalizację promptów** — frameworki DSPy/AX potrafią podnieść skuteczność z 60% do 90%+ bez ręcznego iterowania nad instrukcjami.
10. **Używaj macierzy "Signal vs Noise"** — cross-provider, open standard, community-built = inwestuj; one vendor demo, benchmark-only, spike then silence = ignoruj.
11. **Zabezpiecz się przed 1-3% power users** — twarde limity kosztowe są konieczne; nieliczni użytkownicy potrafią wygenerować koszty większe niż reszta razem.
12. **Interfejs czatu nie zawsze jest odpowiedzią** — seria przycisków i akcje w tle mogą być skuteczniejsze niż chatbot; agenci AI są przydatni tam, gdzie trzeba podejmować wiele akcji, nie gdzie wystarczy jeden klik.

## Czego unikać (anty-wzorce)

- **Budowanie deterministycznego pipeline'u tam, gdzie agent z narzędziami wystarczy** → **Agentic RAG z prostymi narzędziami (search, fetch, answer)** — mniej kodu do utrzymania, agent sam dopasowuje strategię do kontekstu.
- **Uzależnianie się od API jednego providera (vendor lock-in)** → **Abstrakcja providera + rotacja kluczy** — Assistants API OpenAI zostało deprecated po 15 miesiącach; to może spotkać każde single-vendor rozwiązanie.
- **Reagowanie na każdy hype bez weryfikacji** → **Samodzielne sprawdzenie + macierz Signal vs Noise** — social media generują szum; dopiero osobiste testy pozwalają ocenić realną wartość.
- **Traktowanie migracji modelu jako "zmiany jednego stringa"** → **Pełna ewaluacja + rewizja instrukcji** — nowsze modele mogą wymagać kompletnie innego stylu promptowania (np. Opus 4.5 nie lubi CRITICAL/MUST napisanych capslockiem).
- **Trzymanie pełnej historii konwersacji w kontekście** → **Rolling summary + tail messages** — pełna historia puchnie i trafisz w limit; kompakcja daje sesje dowolnej długości.
- **Ręczne iterowanie nad promptami bez danych** → **Automatyczna optymalizacja z DSPy/AX** — zamknięta pętla z ewaluacją i szumem jako progiem jest skuteczniejsza niż ludzka intuicja w ulepszaniu instrukcji.

## Sprawdź się (pytania do refleksji)

- **Dlaczego autor twierdzi, że "fundamenty AI są stabilne", skoro co chwilę pojawiają się nowe modele i benchmarki?** *Wskazówka: rozdziel mechaniki działania modeli od ich parametrów (rozmiar kontekstu, poziom halucynacji) — co się zmienia, a co nie?*

- **Jak wytłumaczysz komuś różnicę między "budowaniem linii produkcyjnej" a "budowaniem fabryki" w kontekście aplikacji AI?** *Wskazówka: pomyśl o tym, kto decyduje o kolejności kroków — programista czy agent.*

- **W `05_03_autoprompt` akceptacja zmiany wymaga pokonania "noise floor". Dlaczego nie wystarczy sprawdzić, czy nowy wynik jest wyższy od poprzedniego?** *Wskazówka: pomyśl o niedeterministycznej naturze LLM i co się stanie, gdy uruchomisz ten sam prompt dwa razy.*

- **Agent z `05_03_coding` ma tylko 4 narzędzia plikowe. Co zyskasz dodając terminal (shell_exec) i co stracisz z punktu widzenia bezpieczeństwa?** *Wskazówka: diagram "Capability Levers" mówi wprost o wymaganiu sandboxa.*

- **Framework AX pozwala w ogóle nie pisać promptów — definiujesz sygnaturę i .forward(). W jakich sytuacjach to podejście zawiedzie?** *Wskazówka: pomyśl o zadaniach, gdzie kluczowy jest nie format wyjścia, ale sposób rozumowania agenta.*
