# Niedeterministyczna natura modeli jako przewaga — Podsumowanie

## O czym jest ta lekcja? (TL;DR)

Programowanie nauczyło nas, że niedeterminizm to błąd. LLM-y to odwracają — ich "halucynacja" to po prostu sen, który czasem nam sprzyja, a czasem nie. Ta lekcja pokazuje, jak **przestać walczyć z niedeterminizmem** i zacząć go wykorzystywać: od agenta, który sam decyduje kiedy sięgnąć po pamięć i jak interpretować rozmowę (bez sztywnych instrukcji), przez generatywne interfejsy (HTML artifacts, JSON Render, MCP Apps), po świadome **balansowanie** między kontrolą a twórczą swobodą modelu.

## Mapa koncepcji

- **Niedeterminizm jako cecha, nie błąd** — modele to "śniące maszyny" (Karpathy), których zachowanie zależy od poprzedzającej treści
- **Przestrzeń otwartej interpretacji** — zamiast instrukcji "jeśli X to Y", tworzenie warunków do samodzielnego wnioskowania
  - **Think/Recall tools** — narzędzia tworzące przestrzeń na refleksję i odkrywanie kontekstu
  - **Behavior shaping** — 5 warstw kształtowania zachowań (tożsamość → poznanie → emocje → ekspresja → wzmocnienie)
  - **Architektura kognitywna** — odejście od "spełnienia założeń" ku "stwarzaniu warunków"
- **Generatywne interfejsy** — spektrum od pełnej swobody do pełnej kontroli
  - **Artifacts** — model pisze pełny HTML/CSS/JS, sandbox zapewnia bezpieczeństwo
  - **JSON Render** — model wybiera z katalogu komponentów, renderer jest deterministyczny
  - **MCP Apps** — model w ogóle nie generuje UI, tylko decyduje kiedy wywołać narzędzie

## Kluczowe koncepcje

### Niedeterminizm — problem powtarzalności i jednorodności

**W jednym zdaniu:** LLM-y mają problem zarówno z precyzyjnym podążaniem za instrukcjami, jak i z generowaniem zróżnicowanych odpowiedzi — zachowanie jest silnie uzależnione od poprzedzającej treści.

**Rozwinięcie:** Poproś model o żart 10 razy — dostaniesz 2-3 unikalne odpowiedzi. To nie jest "losowość", to sampling z rozkładu prawdopodobieństwa. Zmiana `temperature` czy `top_p` niewiele pomaga. Prawdziwa różnorodność pojawia się, gdy **kontekst się zmienia** — informacje o otoczeniu, pamięć długoterminowa, historia konwersacji. Agent z dostępem do dynamicznych metadanych (czas, lokalizacja, pogoda) naturalnie generuje bardziej zróżnicowane odpowiedzi, bo każda sesja ma inny "punkt startowy".

**Przykład z lekcji:** Diagram "Same Prompt, Different Sessions" pokazuje trzy sesje z tym samym promptem "Tell me a joke." — sesje 1 i 2 generują identyczny żart (most probable output), sesja 3 daje inny (sampling noise). Zachowanie jest stateless — model nie pamięta poprzednich sesji.

### Przestrzeń otwartej interpretacji — "świadomy" agent

**W jednym zdaniu:** Zamiast definiować agentowi "jeśli użytkownik powie X, zrób Y", tworzymy przestrzeń, w której model sam decyduje kiedy sięgnąć po wiedzę, jak ją połączyć i jak dopasować odpowiedź — na podstawie "podejrzeń", a nie poleceń.

**Rozwinięcie:** Agent `03_05_awareness` na proste "cześć" sam zastanawia się: "Czego nie wiem? Kim jest ta osoba? Jaki mam nastrój?". Następnie narzędziem `recall` wczytuje osobowość, tożsamość rozmówcy i kontekst otoczenia. Gdy użytkownik wspomina o wieczorze — agent zauważa lukę w wiedzy o preferencjach i lokalizacji, sięga po nie, i odpowiada **konkretnymi** sugestiami. Żadne z tych zachowań nie jest zaprogramowane. Szansa na identyczny przebieg dwóch sesji jest **bardzo niska**. Kontrola polega nie na sterowaniu decyzjami, lecz na definiowaniu **przestrzeni**, po której agent się porusza.

**Przykład z lekcji:** Diagram "Agent V — Situational Awareness" pokazuje flow: wiadomość użytkownika → autonomiczne self-questioning ("Czy wiem wystarczająco?") → decision diamond → recall (tożsamość, preferencje, persona) → synteza → spersonalizowana odpowiedź. Diagram "Scripted vs Aware Agent" zestawia: scripted (keyword triggers, scheduled memory, same input = same behavior) vs aware (recall fires on felt gaps, memory loaded only when needed, context-dependent behavior).

### Think i Recall — narzędzia tworzące przestrzeń na refleksję

**W jednym zdaniu:** `think` to narzędzie-no-op, które zachęca model do zadawania sobie pytań; `recall` przyjmuje pytanie (nie ścieżkę do pliku) i deleguje wyszukiwanie do sub-agenta "scouta".

**Rozwinięcie:** To kluczowy wzorzec: `think` nie robi nic — zwraca pytania modelu z powrotem z dodatkowym nudge'em "Now decide: which of these could recall help answer?". Sama obecność narzędzia `think` wpływa na dalsze rozumowanie modelu, tworząc przestrzeń na "zastanowienie". `recall` przyjmuje pytanie typu "Who is this person and what is my voice with them?" (nie "load persona, identity, preferences") i deleguje do sub-agenta scout, który przeszukuje workspace z plikami pamięci. Opisy narzędzi używają języka zachęcającego do ciekawości ("stay curious, not just efficient"), nie mechanicznych instrukcji.

**Przykład z lekcji:** Definicja `think` tool mówi: "Pause and ask yourself what you might be missing. Explore: what assumptions am I about to make? What would change my response if I knew it?" — to nie jest instrukcja, to zaproszenie do refleksji.

### Behavior shaping — 5 warstw kształtowania zachowań

**W jednym zdaniu:** Zamiast sztywnych reguł, agent ma 5 warstw "zachęt": tożsamość, wzorce poznawcze, inteligencja emocjonalna, styl ekspresji i mechaniki wzmacniające — które razem tworzą spójne, ale niedeterministyczne zachowanie.

**Rozwinięcie:** To architektura kognitywna, nie lista instrukcji. **Warstwa 1** (Tożsamość): agent wie, że "ma osobowość, nastrój i opinie", ale na początku są "rozmyte" — musi je odkryć. **Warstwa 2** (Poznanie): self-questioning, rozpoznawanie luk, łączenie faktów z kontekstem. **Warstwa 3** (Emocje): odczytywanie stanu emocjonalnego rozmówcy, dopasowanie odpowiedzi do intencji, nawet gdy użytkownik jeszcze nie wie czego chce. **Warstwa 4** (Ekspresja): styl i format wypowiedzi dopasowane do osoby — wzmacniane przez metadane. **Warstwa 5** (Wzmocnienie): per-turn nudges, think-to-recall bridges, mechaniki zachęcające do pożądanych postaw. Razem dają agenta, który "czyta między słowami" i "wychodzi z inicjatywą".

**Przykład z lekcji:** Persona agenta V mówi: "V's mood emerges from available context: weather, time of day, day of week... V doesn't perform a mood — V forms one from signals." To nie instrukcja "bądź wesoły gdy świeci słońce" — to przestrzeń na samodzielną interpretację.

### Artifacts — generatywne interfejsy z pełną swobodą

**W jednym zdaniu:** Agent generuje kompletny HTML/CSS/JS w jednym strzale, renderowany w sandboxowanym iframe z CSP i predefiniowanymi bibliotekami (Chart.js, D3, Preact, Tailwind).

**Rozwinięcie:** Model dostaje zestaw danych i sam decyduje: jaki typ wizualizacji pasuje? Line chart, treemap, bubble scatter, sunburst? Nie ma reguły "dla danych czasowych użyj line chart" — model sam ocenia strukturę danych i wybiera strategię. Ten sam pipeline z różnymi danymi daje różne wykresy. Bezpieczeństwo nie polega na ograniczaniu outputu, lecz na sandboxowaniu runtime'u: strict CSP (`default-src 'none'`, brak zewnętrznych skryptów, brak network calls), capability packs z pre-załadowanymi bibliotekami. Edit przez search/replace na raw HTML daje chirurgiczną kontrolę.

**Przykład z lekcji:** Diagram "Regional Margin Mix" pokazuje interaktywny dashboard Marimekko wygenerowany przez agenta — z filtrami, summary cards i tekstowym wyjaśnieniem dlaczego ten typ wykresu został wybrany. Wersja Tailwind 3 zamiast 4 — celowo, bo modele lepiej się nią posługują.

### JSON Render — kontrola przez katalog komponentów

**W jednym zdaniu:** Zamiast pisać HTML, model wybiera z katalogu 19 typowanych komponentów (Stack, Card, LineChart, Table...) i generuje JSON spec, który deterministyczny renderer zamienia w HTML.

**Rozwinięcie:** To filozoficzne przeciwieństwo artifacts. Model nie może napisać dowolnego kodu — może tylko wybrać komponenty i ułożyć je. `$state` binding separuje dane od layoutu. Zod walidacja odrzuca spec, który nie pasuje do schematu. Niedeterminizm jest kanalizowany: model sam decyduje **które** komponenty wybrać i **jak** je ułożyć, ale nie może wyjść poza katalog. Trade-off jest jawny: artifacts mogą zbudować cokolwiek ale mogą się zepsuć; render jest bezpieczny i przewidywalny ale ograniczony.

**Przykład z lekcji:** Instrukcje render mówią wprost: "do NOT output HTML, CSS, JavaScript, markdown, or code fences" — "use ONLY allowed components from the selected packs." Model przesyła JSON, renderer deterministycznie generuje HTML.

### MCP Apps — model nie generuje UI w ogóle

**W jednym zdaniu:** Model wywołuje narzędzie (`manage_lists`), MCP server zwraca pre-built UI z danymi stanu — użytkownik operuje na interfejsie, zmiany synchronizują się z plikami na dysku, model dowiaduje się o zmianach po zamknięciu.

**Rozwinięcie:** To najbardziej kontrolowane podejście. `registerAppTool` łączy narzędzie z pre-built UI przez `_meta.ui.resourceUri`. Niektóre narzędzia mają `visibility: ['app']` — dostępne tylko dla UI, nie dla LLM. Tworzy to system dwukierunkowy: człowiek operuje na UI, LLM na CLI, oba pracują na tych samych danych (markdown na dysku). Niedeterminizm modelu jest kanalizowany wyłącznie w decyzję **kiedy** i **jak** wywołać narzędzie, nie w to jak wygląda interfejs.

**Przykład z lekcji:** Diagram "MCP Apps" pokazuje sequence: User → "manage shopping list" → LLM → tool call → MCP Server → UI URI + structuredContent → Host mounts iframe → User checks box → callServerTool → save to todo.md → update iframe. Tagline: "model chooses intent, host brokers IO, server owns truth."

## Teoria w praktyce

### Think i Recall — narzędzia do refleksji (`03_05_awareness`)
Narzędzia, które nie robią nic poza tworzeniem przestrzeni na myślenie.

```typescript
// tools.ts — think to no-op zachęcający do refleksji
const thinkTool: OpenAI.Responses.FunctionTool = {
  type: 'function',
  name: 'think',
  description:
    'Pause and ask yourself what you might be missing. Explore: what assumptions '
    + 'am I about to make? What would change my response if I knew it? '
    + 'Use this to stay curious, not just efficient.',
  parameters: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Questions you\'re genuinely asking yourself — what you '
          + 'don\'t know, what you\'re assuming, what you\'re curious about.',
      },
    },
    required: ['questions'],
  },
}

// recall przyjmuje pytanie, nie ścieżkę do pliku
const recallTool: OpenAI.Responses.FunctionTool = {
  name: 'recall',
  description:
    'Recover context from memory that would change how you respond right now. '
    + 'Write goals as questions about what you need to know, not lists of file '
    + 'categories to load. The scout will find the right sources.',
  parameters: {
    properties: {
      goal: {
        type: 'string',
        description: 'A question about what you need to know and why. '
          + 'Example: "Who is this person and what is my voice with them?" '
          + 'not "load persona, identity, preferences."',
      },
    },
  },
}
```

`think` zwraca pytania z nudge'em "Now decide: which of these could recall help answer?". `recall` deleguje do sub-agenta scout, który przeszukuje workspace.

### Artifacts — sandbox i capability packs (`03_05_artifacts`)
Agent generuje HTML, ale CSP blokuje wszystko poza inline'em i predefiniowanymi bibliotekami.

```typescript
// artifact-generator.ts — strict CSP + capability packs
const buildCsp = (serverBaseUrl?: string): string => {
  const scriptSrc = serverBaseUrl
    ? `'unsafe-inline' ${serverBaseUrl}`
    : "'unsafe-inline'"
  return `default-src 'none'; connect-src ${connectSrc}; frame-src 'none'; `
    + `img-src data: blob:; script-src ${scriptSrc}; style-src 'unsafe-inline';`
}

const buildArtifactInstructions = (packManifest: string): string => [
  'You generate interactive browser artifacts.',
  'Return JSON only: {"title":"string","html":"string"}',
  'Rules for html:',
  '- must be self-contained, no external scripts, no network calls',
  '- prefer preloaded globals from selected packs when appropriate',
  '', packManifest,
].join('\n')
```

Pełna swoboda twórcza modelu + runtime sandbox = bezpieczna niedeterministyczność.

### JSON Render — model ograniczony do katalogu (`03_05_render`)
Model wybiera z 19 komponentów, Zod waliduje spec, renderer jest deterministyczny.

```typescript
// spec-generator.ts — model NIE pisze HTML, tylko spec komponentów
const buildRenderInstructions = (packManifest: string): string => [
  'You generate static, data-first dashboard specs constrained to allowed components.',
  'Return JSON: {"title","summary","spec":{"root","elements":{...}},"state":{}}',
  'Strict rules:',
  '- use ONLY allowed components from the selected packs',
  '- do NOT output HTML, CSS, JavaScript, markdown, or code fences',
  '- for chart/table data props, bind to state via {"$state":"/path"}',
  '', packManifest,
].join('\n')
```

Trade-off: mniejsza swoboda, ale Zod odrzuca nieprawidłowy spec, a renderer deterministycznie generuje bezpieczny HTML.

## Najważniejsze zasady (cheat sheet)

1. **Niedeterminizm to cecha, nie błąd** — modele to "śniące maszyny". Zamiast walczyć z halucynacjami, kanalizuj je w przestrzenie, gdzie przynoszą wartość.
2. **Twórz warunki, nie instrukcje** — zamiast "jeśli X to Y", opisuj przestrzeń po której agent się porusza. Generalizuj zachowania zamiast precyzować kroki.
3. **Think/Recall > bezpośrednie polecenia** — narzędzie `think` (no-op) tworzy przestrzeń na refleksję. `recall` przyjmuje pytania, nie ścieżki do plików.
4. **Behavior shaping przez 5 warstw** — tożsamość, poznanie, emocje, ekspresja, wzmocnienie. Nie programujesz zachowań — tworzysz warunki do ich emergencji.
5. **Opisy narzędzi jako kształtowanie zachowań** — "stay curious, not just efficient" zamiast "always call think before responding". Język wpływa na postawę modelu.
6. **Spektrum generatywnych interfejsów** — Artifacts (pełna swoboda) → JSON Render (katalog komponentów) → MCP Apps (zero generacji UI). Wybierz punkt na spektrum dopasowany do potrzeb.
7. **Sandbox chroni, nie ogranicza** — CSP + capability packs pozwalają modelowi na pełną swobodę twórczą przy zachowaniu bezpieczeństwa runtime'u.
8. **Kontekst z otoczenia zwiększa różnorodność** — dynamiczne metadane (czas, lokalizacja, pogoda) naturalnie dywersyfikują zachowanie agenta.
9. **"Kiedy X, kiedy Y, kiedy X+Y"** — zamiast debaty "artifacts vs render", rozważ kiedy każde podejście (lub ich kombinacja) jest odpowiednie.
10. **Celowo wybieraj starsze biblioteki** — Tailwind 3 zamiast 4, bo modele lepiej się nią posługują. Optymalizuj pod LLM, nie pod najnowsze standardy.

## Czego unikać (anty-wzorce)

- **Traktowanie niedeterminizmu jako błędu do wyeliminowania** → **Kanalizowanie go w przestrzenie, gdzie przynosi wartość** — agent, który za każdym razem odpowiada identycznie, jest nudny i mniej użyteczny niż ten, który dynamicznie dopasowuje się do kontekstu.
- **Sztywne "jeśli X to Y" w promptach agenta** → **Zgeneralizowane instrukcje tworzące przestrzeń interpretacji** — model powinien sam decydować kiedy sięgnąć po pamięć i jak połączyć fakty. Twoja rola: zdefiniować przestrzeń, nie trasę.
- **Ładowanie całej wiedzy na start** → **Recall on demand, wyzwalany przez "felt incompleteness"** — agent nie potrzebuje 10 plików pamięci na starcie. Niech sam odkryje, czego mu brakuje.
- **Artifacts na produkcji bez sandboxa** → **CSP + capability packs + iframe isolation** — model generujący dowolny HTML bez sandbox to zaproszenie do XSS.
- **JSON Render z nieograniczonym zbiorem komponentów** → **Ścisły katalog z Zod walidacją** — im mniej komponentów, tym pewniej model je dobierze. 19 typów wystarczy na większość dashboardów.
- **Debata "artifacts vs render"** → **Świadomy wybór punktu na spektrum** — artifacts dla prototypów i eksploracji, render dla produkcyjnych dashboardów, MCP Apps gdy potrzebujesz dwukierunkowej komunikacji.

## Sprawdź się (pytania do refleksji)

- **Projektujesz asystenta osobistego, który ma być "świadomy" kontekstu użytkownika (kalendarz, lokalizacja, nastrój). Jak zaprojektowałbyś warstwy behavior shaping, żeby agent był pomocny bez bycia inwazyjnym?** *Wskazówka: pomyśl o granicy między proaktywnym dopasowaniem a naruszeniem prywatności — i o tym, jak "felt incompleteness" może tu pomóc.*

- **Masz agenta generującego raporty finansowe. Kiedy wybrałbyś artifacts (pełny HTML), kiedy JSON Render (komponenty), a kiedy MCP Apps?** *Wskazówka: rozważ kto jest odbiorcą (developer vs CFO), jak krytyczna jest poprawność danych i czy potrzebna jest dwukierunkowa interakcja.*

- **Narzędzie `think` to no-op — zwraca pytania modelu z powrotem. Dlaczego mimo to wpływa na jakość odpowiedzi? Jak byś to przetestował?** *Wskazówka: pomyśl o Chain of Thought i o tym, jak "przestrzeń na refleksję" zmienia kolejne decyzje modelu.*

- **Agent `03_05_awareness` generuje różne odpowiedzi na to samo "cześć" w zależności od pory dnia, pogody i kontekstu. Jak zaprojektowałbyś ewaluację takiego agenta, skoro nie ma "jednej poprawnej odpowiedzi"?** *Wskazówka: pomyśl o llm-rubric z S03E01 i o tym, co oceniasz — nie treść, lecz spójność i trafność kontekstową.*

- **Kiedy "stracenie kontroli" nad zachowaniem agenta jest akceptowalne, a kiedy nie? Jak wyznaczyłbyś granicę?** *Wskazówka: rozważ konsekwencje błędu — agent do small-talk vs agent wykonujący przelewy.*
