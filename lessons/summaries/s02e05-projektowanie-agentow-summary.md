# Projektowanie agentów — Podsumowanie

## O czym jest ta lekcja? (TL;DR)
Lekcja uczy, jak projektować **instrukcje systemowe** (prompty) dla agentów AI — nie ogólnikowo, lecz na konkretnym przykładzie wielosekcyjnego promptu agenta-orkiestratora. Pokazuje, że sam prompt to dopiero początek: równie ważne jest przemyślane **przypisanie narzędzi**, strategia **zarządzania wiedzą** między agentami, oraz mechanizm **sandbox** pozwalający agentowi pisać i uruchamiać kod zamiast wywoływać narzędzia bezpośrednio. Zmienia się tu perspektywa z "co agent robi" na "kim agent jest w systemie".

## Mapa koncepcji
- **Anatomia promptu agenta** — wielosekcyjna instrukcja systemowa: Identity, Protocol, Voice, Tools
  - **Identity** — persona, cechy charakteru, motyw przewodni (10 obszarów odpowiedzialności)
  - **Protocol & Memory** — zasady działania, zarządzanie kontekstem, komunikacja z innymi agentami
  - **Voice** — ton wypowiedzi, few-shot examples, antywzorce stylistyczne
  - **Tools** — dynamiczna lista narzędzi i agentów, WORKSPACE_SECTION, closing CTA
- **Przypisywanie narzędzi** — strategia podziału narzędzi między agentami (~91 narzędzi, 1 orkiestrator + 6 specjalistów)
- **Architektura wiedzy** — 6 kategorii danych: sesja, publiczna, prywatna, agentów, podręczna, runtime
- **Sandbox** — agent generuje kod i uruchamia go w izolowanym środowisku zamiast wywoływać narzędzia bezpośrednio

## Kluczowe koncepcje

### Wielosekcyjna architektura promptu agenta

**W jednym zdaniu:** Prompt agenta to nie jedno zdanie "Jesteś ekspertem", lecz dokument z wyraźnie oddzielonymi sekcjami: Identity, Protocol, Voice i Tools.

**Rozwinięcie:** Analogicznie do tego, jak aplikacja ma warstwy (UI, logika, dane), prompt agenta dzieli odpowiedzialności na oddzielne sekcje. Identity nadaje "osobowość" i motyw przewodni. Protocol definiuje zasady gry — jak agent podejmuje decyzje, kiedy deleguje, jak radzi sobie z błędami. Voice steruje formą wypowiedzi. Tools opisuje dostępne narzędzia i pozostałych agentów. Taki podział pozwala iterować nad każdą sekcją niezależnie i unikać "bałaganu" w jednym długim prompcie.

**Przykład z lekcji:** Wizualizacja "Alice Identity Prompt — Anatomy" pokazuje prompt z 26 frazami, 10 obszarami odpowiedzialności (Orchestration, Delegation, Memory, Physical Awareness, Persistence, Autonomy, Error Recovery, Escalation, Communication, Relationship) i odniesieniami do 5 postaci literackich kształtujących osobowość agenta.

### Identity — persona jako narzędzie sterowania

**W jednym zdaniu:** Sekcja Identity to nie kosmetyka, lecz mechanizm kierowania "uwagi" modelu na pożądane zachowania — poprzez cechy charakteru, skojarzenia i celowe słownictwo.

**Rozwinięcie:** Tak jak zdanie "nie myśl o niebieskich motylach" kieruje myśli w określoną stronę, cechy w Identity realnie wpływają na jakość pracy agenta. Autor celowo używa niestandardowego słownictwa (np. "instynkt") nie po to, by model rozumiał je dosłownie, lecz by uruchomić skojarzenia i wykorzystać tendencję do halucynacji na swoją korzyść. Zamiast oczekiwać od modelu idealnej dokładności, tworzymy przestrzeń, by "pozytywnie nas zaskoczył". Jest to podejście eksperymentalne, ale na tak wczesnym etapie rozwoju agentów warto testować niestandardowe strategie.

**Przykład z lekcji:** Prompt Alice zawiera odniesienia do postaci: Stark, Yennefer, Gandalf, Hermione i Spider-Man. Każda postać wnosi określoną cechę — np. autonomię, temperament, mądrość, precyzję czy humor. To nie jest gimmick, lecz sposób "pokazywania" modelowi pożądanego zachowania zamiast samego "mówienia" o nim.

### Protocol — zasady gry i zarządzanie kontekstem

**W jednym zdaniu:** Sekcja Protocol osadza agenta w systemie i wyznacza zasady: kiedy delegować, jak zarządzać pamięcią, co robić gdy brakuje kompetencji.

**Rozwinięcie:** To odpowiednik "regulaminu pracy" — agent musi wiedzieć nie tylko co robi, ale jak poruszać się w środowisku z wieloma agentami. Protocol zawiera 7 concerns operacyjnych (Agent Routing, Context Seeking, Delegation, Steering, Memory Layout, Self-Handling, Graceful Degradation) i 4 typy instrukcji (Principles, Rules, Notes, Guardrails). Kluczowe: Protocol nie odwołuje się do konkretnych narzędzi (bo te mogą się zmieniać dynamicznie), ale zawiera już wzmianki o konkretnych plikach i katalogach w workspace.

**Przykład z lekcji:** Diagram "Protocol & Memory — Anatomy" pokazuje instrukcje typu: "Jeden agent na task, nigdy nie powielaj duplikatów", "Zanim delegujesz, dołącz kontekst z konwersacji lub pamięci", "Jeśli nowa informacja pojawi się w trakcie zadania — zapisz ją w pamięci". Osobna sekcja `<memory>` informuje agenta, że "Twoja pamięć żyje w shared/docs" i że "agenci mogą przeszukiwać ją w trakcie zadań".

### Voice — ton jako element użyteczności

**W jednym zdaniu:** Styl wypowiedzi agenta to nie ozdoba, lecz kluczowy element użyteczności, który wymaga regularnych przypomnień i few-shot examples.

**Rozwinięcie:** LLM szybko "zapominają" o instrukcjach dotyczących tonu i wracają do domyślnego stylu. Dlatego sekcja Voice jest bardziej rozbudowana niż mogłoby się wydawać: zawiera mechanizmy kształtowania (Expression, Elaboration, Direct, Anti-Pattern, Demonstration), rejestry tonu (Confident Authority, Selectivity, Sass, Recall, Pivot) oraz aż 4 przykłady few-shot. Sposób mówienia agenta musi też być dostosowany do środowiska — agent podłączony do interfejsu głosowego nie powinien dyktować długich linków ani "wyświetlać" obrazów.

**Przykład z lekcji:** Diagram Voice Section pokazuje deklaracje typu: "Fast, confident, slightly theatrical. You know you're good", zasady jak "Short when commanding. Long when explaining" oraz konkretne przykłady dialogów (np. "What's 234 * 17?" / "3,978. Not everything needs a mission."), w tym 4 pełne scenariusze few-shot demonstrujące różne sytuacje.

### Strategia przypisywania narzędzi

**W jednym zdaniu:** Nie ma złotej reguły "max 10-15 narzędzi na agenta" — liczy się kontekst, a te same narzędzia mogą być współdzielone między agentami, by zmniejszyć potrzebę wymiany informacji.

**Rozwinięcie:** Popularna rada o maksymalnej liczbie narzędzi jest zbyt dużym uproszczeniem. Niektóre integracje (np. GitHub) wymagają wielu akcji, a jednocześnie mogą być obsłużone przez jedno narzędzie CLI. Claude Code udowadnia, że sam dostęp do terminala pozwala osiągnąć bardzo dużo. Kluczowe pytanie przy projektowaniu: "czy system stanie się lepszy wraz z rozwojem modeli?" Jeśli nie — prawdopodobnie budujemy niewłaściwą rzecz. Równie ważne jest analizowanie ryzyk wynikających z połączeń między narzędziami — agent z dostępem do plików i Jiry może przypadkowo przenieść poufne dane.

**Przykład z lekcji:** Diagram "Tool Assignment — Agent Team" pokazuje system z 1 orkiestratorem (Alice) i 6 specjalistami (Claire/Ops: 27 narzędzi, Ellie/Research: 12, Rose/Email: 12, Jenny/Music: 11, Nicky/Images: 18, Michael/Vehicle: 9). Łącznie ~91 narzędzi. Wspólna baza (Shared Foundation) daje każdemu specjaliście: agent_message, fs_read, fs_search, fs_write.

### Architektura wiedzy między agentami

**W jednym zdaniu:** Wiedza w systemie wieloagentowym ma 6 warstw — od dokumentów sesji przez pamięć publiczną i prywatną, po runtime niewidoczny dla agentów.

**Rozwinięcie:** Zarządzanie wiedzą to najtrudniejszy aspekt systemów wieloagentowych. Ta sama informacja (np. "nowy projekt") może trafić do kategorii prywatnej, publicznej lub agentowej — a decyzja zależy od kontekstu. Do tego dochodzi problem nie tylko zapisywania, ale też odnajdywania i łączenia informacji z istniejącymi danymi. Praktyka sugeruje trzymanie się najprostszych struktur i zastanawianie się, czy zaawansowana pamięć długoterminowa jest rzeczywiście potrzebna — czasem wystarczą proste dokumenty.

**Przykład z lekcji:** Diagram "Agent Data Architecture" pokazuje przepływ od użytkownika (User Input) przez przetwarzanie (Processing), kategorie wiedzy (Docs Session, Public, Private, Agent Knowledge, Cache, Runtime) do konkretnych implementacji z kodem (Task Execution z zapytaniami do pamięci, Observational Memory z generowaniem obserwacji i refleksji).

### Sandbox — agent jako programista

**W jednym zdaniu:** Zamiast wywoływać narzędzia bezpośrednio, agent może dynamicznie odkrywać dostępne API, pisać kod TypeScript i uruchamiać go w izolowanym piaskownicy (QuickJS).

**Rozwinięcie:** To podejście daje agentowi ogromną elastyczność — może łączyć narzędzia w dowolny sposób i operować na dużych ilościach danych bez wczytywania ich do kontekstu (dane pozostają zmiennymi w kodzie). Agent zaczyna z minimalnymi narzędziami (list_servers, list_tools, get_tool_schema, execute_code), dynamicznie odkrywa serwery MCP, pobiera schematy TypeScript, a następnie generuje i uruchamia kod w piaskownicy. Izolacja QuickJS z limitem pamięci i timeoutem zapewnia bezpieczeństwo, choć sandbox nie rozwiązuje wszystkich problemów — zwiększa złożoność architektury.

**Przykład z lekcji:** Diagram "MCP Sandbox Agent — Progressive Discovery & Execution" pokazuje 7 kroków: (1) list_servers odkrywa serwer "todo", (2) list_tools odkrywa create/list/update/delete, (3) get_tool_schema ładuje interfejs TypeScript, (4) execute_code uruchamia wygenerowany kod, (5) QuickJS sandbox izoluje wykonanie, (6) MCP Client komunikuje się z prawdziwym serwerem, (7) wyniki wracają przez console.log.

## Teoria w praktyce

### Agent z pamięcią obserwacyjną (`02_05_agent`)
System agentowy z pełnym cyklem pamięci: observer wyciąga ustrukturyzowane obserwacje z historii konwersacji, reflector kompresuje je gdy przekroczą próg tokenów. Agent ładuje swój prompt z pliku `.agent.md` (front-matter z metadanymi + treść promptu). Implementuje wzorzec Context Engineering z lekcji.

```typescript
// agent.ts — pętla agentowa z pamięcią obserwacyjną
for (let turn = 0; turn < AGENT_MAX_TURNS; turn += 1) {
  // Przed każdym wywołaniem LLM: przetwórz pamięć (observer/reflector)
  const context = await processMemory(openai, session, template.systemPrompt, DEFAULT_MEMORY_CONFIG)
  
  const response = await openai.responses.create({
    model,
    instructions: context.systemPrompt, // prompt wzbogacony o obserwacje
    input: context.messages,             // okrojona historia (sealed head + raw tail)
    tools: responsesTools.length > 0 ? responsesTools : undefined,
  })
  // ... obsługa tool calls, warunek stopu
}
```

Kluczowy wzorzec: pamięć nie jest statyczna — `processMemory` przed każdym turnem decyduje, czy uruchomić observer (gdy historia przekroczy próg tokenów) i czy potrzebna jest refleksja (kompresja obserwacji). Prompt agenta ładowany jest z pliku markdown z front-matter, co umożliwia wersjonowanie i dynamiczne zmiany konfiguracji.

### Sandbox z progresywnym odkrywaniem narzędzi (`02_05_sandbox`)
Agent, który zamiast wywoływać narzędzia bezpośrednio, pisze kod JavaScript i uruchamia go w izolowanym środowisku QuickJS. Narzędzia MCP są odkrywane dynamicznie — początkowo agent zna tylko meta-narzędzia.

```typescript
// sandbox.ts — izolowane wykonanie kodu w QuickJS
export async function executeCode(
  code: string,
  toolImplementations: Record<string, Record<string, (input: unknown) => Promise<unknown>>>,
): Promise<ExecutionResult> {
  const context = runtime.newContext()
  // Expose narzędzia MCP jako synchroniczne funkcje hosta
  for (const [serverName, tools] of Object.entries(toolImplementations)) {
    for (const [toolName, fn] of Object.entries(tools)) {
      const hostFn = context.newAsyncifiedFunction(`__call_${serverName}_${toolName}`, async (inputHandle) => {
        const input = context.dump(inputHandle)
        const result = await fn(input)           // prawdziwe wywołanie MCP
        return context.newString(JSON.stringify(result))
      })
      context.setProp(context.global, hostFn.name, hostFn)
    }
  }
  // Kod agenta widzi np. todo.create({title: "milk"}) jako synchroniczne wywołanie
  const result = await context.evalCodeAsync(buildGuestCode(code, toolImplementations))
}
```

Dzięki asyncify QuickJS, asynchroniczne wywołania MCP wyglądają w sandboxie jak zwykłe synchroniczne funkcje. Agent pisze `todo.create({title: "milk"})` — QuickJS przechwytuje wywołanie, deleguje do prawdziwego serwera MCP i zwraca wynik. Dane nie trafiają do kontekstu LLM, pozostając zmiennymi w kodzie.

## Najważniejsze zasady (cheat sheet)

1. **Dziel prompt na sekcje (Identity, Protocol, Voice, Tools)** — każda sekcja ma inną odpowiedzialność i można ją iterować niezależnie.
2. **"Pokazuj" zamiast "mów"** — cechy charakteru, skojarzenia i niestandardowe słownictwo w Identity działają lepiej niż suche instrukcje, bo uruchamiają w modelu odpowiednie skojarzenia.
3. **Protocol nie powinien odwoływać się do konkretnych narzędzi** — narzędzia mogą być dynamiczne, zasady powinny być stabilne.
4. **Voice wymaga regularnych przypomnień i few-shot examples** — modele szybko wracają do domyślnego tonu bez tych wzmocnień.
5. **Nie ograniczaj się do "max 10-15 narzędzi na agenta"** — eksperymentuj; Claude Code udowadnia, że sam terminal wystarczy do wielu zadań.
6. **Współdzielenie narzędzi między agentami zmniejsza potrzebę wymiany informacji** — ale może prowadzić do fałszywych wniosków (agent nie znalazł danych = zakłada, że ich nie ma).
7. **Pytaj "czy system stanie się lepszy z rozwojem modeli?"** — jeśli nie, prawdopodobnie budujesz niewłaściwą rzecz.
8. **Sandbox daje elastyczność kosztem złożoności** — agent operujący na danych w kodzie nie musi wczytywać ich do kontekstu, ale architektura się komplikuje.
9. **Progressive disclosure narzędzi** oszczędza okno kontekstowe — agent zaczyna z meta-narzędziami i odkrywa resztę na żądanie.
10. **Trzymaj struktury wiedzy tak proste, jak to możliwe** — zaawansowana pamięć długoterminowa nie zawsze jest potrzebna; czasem wystarczą proste dokumenty.
11. **Analizuj ryzyka połączeń między narzędziami** — agent z dostępem do plików i komunikatora może przypadkowo ujawnić poufne dane.
12. **Kształtowanie promptu wymaga wielu iteracji** — autor doszedł do finalnej wersji promptu Alice po kilkunastu iteracjach, współpracując z AI.

## Czego unikać (anty-wzorce)

- **Jeden monolityczny prompt bez podziału na sekcje** --> **Wielosekcyjna struktura (Identity / Protocol / Voice / Tools)** — łatwiej iterować, testować i utrzymywać każdą sekcję niezależnie.
- **Sztywne limity narzędzi ("max 15")** --> **Empiryczne testowanie z progresywnym odkrywaniem** — liczba narzędzi zależy od kontekstu, nie od arbitralnej reguły.
- **Oczekiwanie idealnej dokładności od modelu** --> **Projektowanie systemu z przestrzenią na pozytywne zaskoczenia** — halucynacje można częściowo wykorzystać na swoją korzyść przez odpowiednie skojarzenia w prompcie.
- **Wiązanie zasad w Protocol z konkretnymi narzędziami** --> **Stabilne, ogólne zasady + dynamiczna sekcja Tools** — narzędzia się zmieniają, zasady powinny przetrwać rekonfigurację.
- **Dawanie agentom pełnego dostępu bez analizy ryzyk** --> **Analiza połączeń między narzędziami i sandbox** — każde połączenie narzędzi to potencjalny wektor wycieku danych.
- **Budowanie zaawansowanej pamięci długoterminowej od początku** --> **Proste dokumenty i struktury, rozszerzane w miarę potrzeb** — złożoność rośnie szybko, a proste rozwiązania są łatwiejsze do debugowania.
- **Pomijanie tonu wypowiedzi jako "kosmetyki"** --> **Voice jako element użyteczności z few-shot examples** — agent podłączony do interfejsu głosowego musi mówić inaczej niż w czacie.

## Sprawdź się (pytania do refleksji)

- **Dlaczego sekcja Identity w prompcie agenta odwołuje się do postaci literackich zamiast do listy konkretnych zachowań?** *Wskazówka: pomyśl o tym, jak modele "widzą" koncepcje i łączą je ze sobą — oraz o różnicy między "mówić" a "pokazywać".*

- **Jak zdecydować, czy informacja powinna trafić do wiedzy publicznej, prywatnej, czy agentowej? Co się stanie, gdy agent zklasyfikuje ją błędnie?** *Wskazówka: zastanów się, dlaczego autor lekcji sugeruje najprostsze możliwe struktury.*

- **Agent w sandboxie ma dostęp do execute_code i może łączyć narzędzia MCP w dowolny sposób. Jakie nowe ryzyka to stwarza w porównaniu do statycznej listy narzędzi?** *Wskazówka: pomyśl o tym, co agent może zrobić z danymi w kodzie, zanim wynik trafi do kontekstu.*

- **Dlaczego Protocol nie powinien odwoływać się do konkretnych narzędzi, skoro sekcja Tools i tak je wymienia? W jakim scenariuszu ta separacja się opłaca?** *Wskazówka: pomyśl o dynamicznym ładowaniu narzędzi i zmieniającym się "składzie zespołu" agentów.*

- **Autor mówi: "pytaj, czy system stanie się lepszy z rozwojem modeli". Jak zastosować tę zasadę do decyzji o podziale odpowiedzialności między agentami a kodem?** *Wskazówka: zastanów się, które ograniczenia są tymczasowe (możliwości modeli), a które fundamentalne (bezpieczeństwo, koszty).*
