# Dokumenty oraz pamięć długoterminowa jako narzędzia — Podsumowanie

## O czym jest ta lekcja? (TL;DR)

Zamiast podłączać agentów do istniejących baz wiedzy i mieć nadzieję, że trafią na właściwe dokumenty, lekcja proponuje odwrócenie problemu: **budowanie bazy wiedzy z myślą o agentach**. Dzięki temu agent nie szuka — wie, gdzie patrzeć. Lekcja pokazuje też, jak implementować pamięć długoterminową (Observational Memory), jak wykorzystać grafy do nawigowania po powiązaniach między dokumentami oraz jak projektować agentów zdolnych do generowania rozbudowanych treści (Deep Research). Kluczowy wniosek: kontrola nad strukturą wiedzy jest ważniejsza niż zaawansowane algorytmy wyszukiwania.

## Mapa koncepcji

- **Problem rozumienia kontekstu** — agent trafia na pojedynczy dokument, ale nie widzi powiązań z innymi
  - **Observational Memory** — kompresja konwersacji do dziennika logów zamiast wyszukiwania semantycznego
- **Baza wiedzy budowana dla agenta** — odwrócenie podejścia: zamiast szukać, nawiguj po strukturze
  - **Nawigacja po dokumentach** — perspektywa, przeszukiwanie, powiązania, szczegóły
  - **Dekompozycja na sesje** — jeden agent, jedno zadanie, wspólna baza wynikowa
- **Grafy (Neo4j)** — wielopoziomowe powiązania z hybrydowym wyszukiwaniem
  - **Agentic Graph RAG** — narzędzia do przeszukiwania, eksplorowania i zarządzania grafem
- **Deep Research** — dekompozycja zapytania, iteracyjne pogłębianie, generowanie rozbudowanych raportów

## Kluczowe koncepcje

### Observational Memory — pamięć przez kompresję, nie wyszukiwanie

**W jednym zdaniu:** Zamiast szukać wspomnień w bazie wektorowej, Observational Memory kompresuje bieżącą konwersację do zwięzłego dziennika logów, który towarzyszy agentowi między sesjami.

**Rozwinięcie:** Wyobraź sobie, że zamiast przeszukiwać notatki z ostatnich 50 spotkań, masz jedną stronę z esencją najważniejszych ustaleń — to właśnie robi Observational Memory. Mechanizm opiera się na dwóch procesach: **Observer** uruchamia się po przekroczeniu 30 000 tokenów w rozmowie i tworzy skompresowany dziennik z bieżącej interakcji, a następnie "zapieczętowuje" przetworzone wiadomości. **Reflector** aktywuje się, gdy sam dziennik przekroczy 60 000 tokenów, kompresując go dalej. Cykl powtarza się w nieskończoność i wykracza poza pojedynczą sesję. Efekt? 94.87% na benchmarku LongMemEval z gpt-5-mini — bez wyszukiwania semantycznego, bez grafów.

**Przykład z lekcji:** Diagram "Observational Memory Log" pokazuje strukturę dziennika: sekcja `<observations>` zawiera chronologiczne wpisy (np. "09:15 User stated they live in Krakow", "09:30 Agent created 4 tables..."), sekcja `<current-task>` opisuje bieżące zadanie ("Implementing database schema for PulseBoard"), a `<suggested-response>` podpowiada kolejny krok. Każdy wpis to esencja — nie pełna rozmowa, a jedynie to, co ma znaczenie dla dalszej pracy.

### Baza wiedzy budowana dla agenta, nie podłączana do niego

**W jednym zdaniu:** Zamiast podłączać agenta do istniejącej bazy i liczyć na trafne wyniki wyszukiwania, projektujemy strukturę dokumentów tak, aby agent wiedział, gdzie szukać — podążając za wskazówkami zawartymi w samych dokumentach.

**Rozwinięcie:** To jak różnica między szukaniem książki w antykwariacie bez katalogu a poruszaniem się po dobrze zorganizowanej bibliotece z drogowskazami. W podejściu "szukaj" (Agent + Search) agent wysyła zapytanie do bazy, dostaje 2 z 8 trafień, reszta jest niewidoczna — klasyczny problem "unknown unknowns". W podejściu "nawiguj" (Knowledge -> Agent) agent dostaje jedną generyczną instrukcję: "Twoje instrukcje narzędzi znajdziesz w ./workflows". Od tego momentu podąża za referencjami w dokumentach: workflows -> linear/assign-issue.md -> projects/overview.md -> konkretne zadanie. Kluczowa zaleta: gdy zmieni się jeden dokument (np. nowa kategoria zadań), cała reszta procesu dopasowuje się automatycznie.

**Przykład z lekcji:** Diagram "Agent Knowledge — Search vs Structure" pokazuje dwa przepływy. Po lewej: Agent szuka "how to assign Linear issue" -> wyszukiwanie -> 2/8 trafień -> "Agent doesn't know what it didn't find. Unknown unknowns — no signal about gaps". Po prawej: Agent czyta system prompt ("Your tool docs are in ./workflows") -> przegląda katalog workflows/ -> linear/assign-issue.md -> projects/definitions -> spaces/current-tasks -> wykonuje akcję. Jedna generyczna reguła zastępuje wyszukiwanie semantyczne.

### Cztery wymiary nawigacji po bazie wiedzy

**W jednym zdaniu:** Agent poruszający się po dokumentach potrzebuje nie jednego, a czterech sposobów docierania do informacji: perspektywy, nawigacji, powiązań i szczegółów.

**Rozwinięcie:** Lekcja pokazuje, że agenci do kodowania (Cursor, Claude Code) naturalnie stosują te cztery wymiary — i dlatego tak dobrze radzą sobie z kodem. (1) **Perspektywa** — spojrzenie z lotu ptaka, np. `ls` na katalogu. (2) **Nawigacja** — przeszukiwanie nazw plików i treści, np. grep/ripgrep. (3) **Powiązania** — referencje między plikami (importy, linki wewnętrzne). (4) **Szczegóły** — czytanie pełnej treści konkretnego pliku. Kod źródłowy naturalnie zawiera te cztery wymiary (importy, nazwy plików, struktura katalogów). Dokumenty biznesowe zazwyczaj nie — stąd potrzeba świadomego ich projektowania, wzorując się np. na Wikipedii z jej bogatym linkowaniem wewnętrznym.

**Przykład z lekcji:** Diagram "Coding Agent — Codebase Navigation" prezentuje agenta, który po otrzymaniu zadania "Add a bio field to the user profile settings" wykonuje grep -> trafia na `ProfileSettings.tsx` -> podąża za importami (`UserProfileContext`, `useProfileStore`) -> analizuje typy i schematy walidacji -> dociera do API endpoint. Agent nie widział całej struktury projektu — nawigował po powiązaniach zawartych w plikach.

### Connect vs Learn — dwa modele relacji agenta z wiedzą

**W jednym zdaniu:** "Podłączenie" agenta do źródła (chunk + embed + search) daje fragmentaryczny obraz z nieznanymi lukami, natomiast "uczenie się" ze źródła (read + organize + structure) daje pełny obraz z widocznymi brakami.

**Rozwinięcie:** To analogia do różnicy między czytaniem losowych stron z podręcznika a przeczytaniem go w całości i zrobieniem notatek. W modelu Connect: dokument -> chunki -> embedding -> wyszukiwanie -> agent dostaje fragmenty bez kontekstu, nie wie czego nie wie. W modelu Learn: agent czyta pełny dokument, organizuje wiedzę w strukturę (projekt-x -> [[deployment]] -> [[env/prod]]), wie co ma i czego brakuje. Dynamiczne budowanie pamięci w ten sposób pozostaje problemem otwartym, ale tworzenie agentów wyspecjalizowanych w organizacji konkretnych typów dokumentów (np. transkrypcji spotkań) jest już realne.

**Przykład z lekcji:** Diagram "Agent Knowledge — Connect vs Learn" zestawia oba podejścia. Lewa strona (Connect): Source Document -> Chunk + Embed (Pipeline) -> Query (Search) -> Agent Receives (Fragments) -> "Unknown unknowns — no signal about gaps". Prawa strona (Learn): Source Document -> Agent Reads (Learns) -> Organizes (Structures) -> Agent Knows (Complete) -> "Gaps are visible in structure — agent knows what's missing".

### Dekompozycja na sesje — jeden agent, jedno zadanie

**W jednym zdaniu:** Zamiast jednego agenta robiącego wszystko w jednej sesji, rozbijamy proces na osobne sesje z osobnymi agentami, które komunikują się przez wspólną bazę wiedzy (pliki na dysku).

**Rozwinięcie:** To jak linia montażowa w fabryce — każdy pracownik robi swoją część, a efekt przechodzi do następnego. Lekcja ilustruje to na przykładzie generowania newslettera: (1) Agent "Researcher" w trzech osobnych sesjach zbiera materiały z blogów, YouTube i newsletterów — wszystkie sesje czytają tę samą instrukcję `news.md`, więc wyniki lądują w `newsletter/edition-26/`. (2) Agent "Writer" czyta zebrane materiały i `daily-newsletter.md` z zasadami, generuje `content.md`. (3) Agent "Sender" wysyła newsletter. Każdy agent jest skupiony na jednym zadaniu, co utrzymuje wysoką jakość i optymalizuje koszty (płacimy tylko za wielokrotne wczytanie instrukcji).

**Przykład z lekcji:** Diagram "Knowledge Base — Multi-Agent Newsletter Pipeline" pokazuje trzy fazy: Phase 1 (Gathering) — trzy sesje Researchera, każda z innym źródłem (Blogs, YouTube, Newsletters), ale tą samą instrukcją `news.md`, wyniki w shared `newsletter/edition-26/`. Phase 2 (Writing) — Writer Agent czyta folder + reguły -> generuje `content.md`. Phase 3 (Delivery) — Sender Agent czyta `content.md` -> wysyła do team inbox.

### Grafy jako pamięć agenta — Agentic Graph RAG

**W jednym zdaniu:** Bazy grafowe (Neo4j) łączą indeksowanie treści, wyszukiwanie pełnotekstowe i semantyczne z wielopoziomowymi powiązaniami między encjami — to najbardziej kompletne, ale i najkosztowniejsze podejście do bazy wiedzy.

**Rozwinięcie:** Graf właściwości to wierzchołki (obiekty z właściwościami i etykietami) oraz krawędzie (skierowane połączenia z typem i właściwościami). W kontekście RAG oznacza to: Document -[HAS_CHUNK]-> Chunk -[MENTIONS]-> Entity -[RELATED_TO]-> Entity. Agent dysponuje narzędziami w trzech kategoriach: **przeszukiwanie** (search z hybrydowym BM25 + vector, explore do sąsiadów, connect do najkrótszych ścieżek, cypher do zapytań strukturalnych), **indeksowanie** (learn do dodawania, forget do usuwania) oraz **zarządzanie** (audit do diagnostyki, merge_entities do deduplikacji). Złożoność i koszt utrzymania są jednak na tyle duże, że grafy uzasadniają się głównie przy priorytetowych wielopoziomowych powiązaniach.

**Przykład z lekcji:** Diagram "Neo4j — Property Graph" pokazuje trzy wierzchołki: :PERSON/:DEVELOPER (name: "Adam", age: 35) -[OWNS]-> :COMPANY (name: "eduweb", brand: "EasyTools"), Adam -[CREATED]-> :PROJECT (name: "Alice", status: "active"), :COMPANY -[OWNS]-> :PROJECT. Krawędzie mają kierunek i typ — analogicznie do relacji w grafie wiedzy agenta.

### Deep Research — generowanie długich form przez iteracyjne pogłębianie

**W jednym zdaniu:** Deep Research to agentowy wzorzec, w którym zapytanie jest rozkładane na podzapytania, iteracyjnie pogłębiane i syntetyzowane w rozbudowany raport — proces trwający minuty, nie sekundy.

**Rozwinięcie:** To jak pisanie pracy dyplomowej: najpierw dekomponujesz temat na rozdziały, potem szukasz źródeł do każdego, czytasz, identyfikujesz braki, szukasz głębiej, aż masz pełny obraz, z którego piszesz raport. Mechanika: Question -> Break Apart -> pętla (Search -> Read -> Find Gaps -> Enough? -> jeśli nie: Refine -> ponowne szukanie) -> gdy wystarczająco: Report. Przed rozpoczęciem warto doprecyzować zapytanie pytaniami pogłębiającymi i sparafrazować je — wstępne przeszukiwanie zawęża kontekst i wzbogaca model. Lekcja sugeruje też zmianę nazwy na "deep action", bo ten sam wzorzec działa dla generowania kodu, audytów czy dowolnych zadań wymagających eksploracji.

**Przykład z lekcji:** Diagram "Deep Research" przedstawia przepływ: QUESTION -> BREAK APART -> pętla SEARCH -> READ -> FIND GAPS (powtarza się) -> ENOUGH? -> jeśli No: REFINE (powrót do search) -> jeśli Yes: REPORT. Prosta, ale skuteczna mechanika iteracyjnego pogłębiania.

## Teoria w praktyce

### Agent z grafową bazą wiedzy (`02_03_graph_agents`)

Agent RAG oparty na Neo4j — indeksuje pliki markdown/txt z katalogu workspace, buduje graf z encjami i relacjami, a następnie odpowiada na pytania, nawigując po grafie. Implementuje pełny pipeline: chunk -> embed -> extract entities -> write to Neo4j.

```javascript
// Narzędzie search — hybrydowe wyszukiwanie z wzbogaceniem o encje grafu
search: async ({ keywords, semantic, limit = 5 }) => {
  // 1. Hybrid search: FTS (BM25) + vector (cosine) z fuzją RRF
  const chunks = await hybridSearch(driver, { keywords, semantic }, Math.min(limit, 20));
  // 2. Wzbogacenie: dla znalezionych chunków pobierz powiązane encje
  const { chunkEntities, allEntities } = await getEntitiesForChunks(driver, chunks);
  return { chunks: /* z encjami */, entities: allEntities };
}
```

Search zwraca nie tylko fragmenty tekstu, ale też encje z grafu — agent może od razu użyć `explore` lub `connect`, żeby podążyć za powiązaniami. To kluczowa różnica vs prosty RAG: wyniki wyszukiwania stają się punktami startowymi do nawigacji po grafie.

```javascript
// Narzędzia nawigacyjne — explore i connect
explore: async ({ entity }) => {
  // Pobierz sąsiadów encji: inne encje + typy relacji + dowody
  return await getNeighbors(driver, entity, Math.min(limit, 50));
},
connect: async ({ from, to, maxDepth = 4 }) => {
  // Znajdź najkrótszą ścieżkę między dwoma encjami
  return { paths: await findPaths(driver, from, to, Math.min(maxDepth, 6)) };
}
```

Agent działa w pętli (max 30 kroków): chat -> tool calls -> results -> chat. Dzięki temu może iteracyjnie pogłębiać wyszukiwanie: search -> explore wybranych encji -> connect między nimi -> dopiero wtedy odpowiedzieć.

```javascript
// Pipeline indeksowania: chunk -> embed -> extract -> write
const indexContent = async (driver, content, source) => {
  const chunks = chunkBySeparators(content, { source });     // 1. Chunking separatorowy
  const chunkEmbeddings = await batchEmbed(chunkTexts);       // 2. Embeddingi chunków
  const { entities, relationships } = await extractFromChunks(chunks); // 3. Ekstrakcja encji LLM-em
  const entityEmbeddings = await batchEmbed(entityTexts);     // 4. Embeddingi encji
  // 5. Zapis do Neo4j: Document -> Chunk -> Entity + relacje RELATED_TO
};
```

Ekstrakcja encji to osobny prompt do LLM (gpt-5-mini), który zwraca JSON z encjami (name, type, description) i relacjami (source, target, type). Normalizacja obejmuje Title Case, singularyzację (deduplikacja "LLMs" -> "LLM") i ograniczenie do dozwolonych typów relacji.

## Najważniejsze zasady (cheat sheet)

1. **Buduj bazę wiedzy dla agenta, nie podłączaj istniejącej** — agent, który wie gdzie patrzeć, jest skuteczniejszy niż ten, który ma szansę trafić na właściwy chunk.
2. **Jeden agent, jedno zadanie, osobna sesja** — dekompozycja na sesje utrzymuje jakość, zmniejsza koszty i pozwala na komunikację przez wspólne pliki.
3. **Dokumenty powinny zawierać referencje do innych dokumentów** — to naturalny mechanizm nawigacji znany z kodu źródłowego; bez niego agent nie ma sygnału o brakach.
4. **Kompresja > wyszukiwanie dla pamięci konwersacyjnej** — Observational Memory z Observer + Reflector osiąga 94.87% na LongMemEval bez grafów i bez semantic search.
5. **Cztery wymiary dostępu do wiedzy: perspektywa, nawigacja, powiązania, szczegóły** — zaprojektuj bazę wiedzy tak, aby agent mógł korzystać ze wszystkich czterech.
6. **"Unknown unknowns" to główny problem klasycznego RAG** — agent nie wie, czego nie znalazł; strukturalna baza wiedzy czyni braki widocznymi.
7. **Grafy uzasadniają się przy wielopoziomowych powiązaniach** — jeśli Twój problem nie wymaga ścieżek między encjami, prostsza architektura będzie lepsza.
8. **Deep Research = dekompozycja + iteracyjne pogłębianie** — ten sam wzorzec (search -> read -> find gaps -> refine) działa dla raportów, kodu i audytów.
9. **Doprecyzuj zapytanie przed kosztowną operacją** — wstępne przeszukiwanie i parafraza zapytania poprawiają jakość wyników Deep Research.
10. **Krytyczne akcje agentów wymagają weryfikacji człowieka** — agent powinien tworzyć szkice, nie wysyłać gotowych newsletterów na listy mailingowe.
11. **Dynamiczne budowanie pamięci to otwarty problem** — obecne rozwiązania (mem0, supermemory, Observational Memory) działają, ale żadne nie jest definitywne.

## Czego unikać (anty-wzorce)

- **Podłączanie istniejącej bazy wiedzy bez adaptacji** → **Zaprojektuj strukturę dokumentów pod agenta** — dokumenty pisane dla ludzi nie mają referencji i kontekstu potrzebnego agentowi do nawigacji.
- **Wrzucanie całej struktury katalogów do kontekstu** → **Ujawniaj informacje dynamicznie, na żądanie** — statyczna mapa bazy wiedzy zajmuje kontekst niepotrzebnie i dezaktualizuje się.
- **Jeden agent na cały złożony proces** → **Dekompozycja na sesje z osobnymi agentami** — jeden agent próbujący zbierać dane, analizować i pisać w jednej sesji traci fokus i jakość.
- **Grafy "bo brzmi zaawansowanie"** → **Dobierz złożoność do problemu** — koszt utrzymania grafu (finansowy, operacyjny, czasowy) uzasadnia się tylko przy wielopoziomowych powiązaniach.
- **Wyszukiwanie semantyczne jako jedyny mechanizm pamięci** → **Rozważ kompresję konwersacji (Observational Memory)** — prostszy mechanizm osiąga lepsze wyniki na benchmarku pamięci długoterminowej.
- **Generowanie rozbudowanych treści jednym strzałem** → **Iteracyjne pogłębianie z identyfikacją braków** — Deep Research działa, bo wielokrotnie wraca do szukania i weryfikuje kompletność.

## Sprawdź się (pytania do refleksji)

- **Masz agenta, który zarządza zadaniami w Linear i korzysta z istniejącej dokumentacji Confluence. Co zyskasz, przepisując instrukcje do dedykowanego katalogu `workflows/`?** *Wskazówka: pomyśl o tym, czego agent "nie wie, że nie wie" przy wyszukiwaniu vs nawigacji po strukturze.*

- **W jaki sposób Observational Memory radzi sobie z naturalnym "zapominaniem" i czy to jest wada, czy cecha?** *Wskazówka: porównaj z ludzką pamięcią — czy pamiętanie wszystkiego na zawsze byłoby praktyczne?*

- **Projektujesz system, w którym trzy zespoły agentów (badawczy, analityczny, raportowy) muszą współpracować nad cotygodniowym raportem. Jak zastosujesz wzorzec dekompozycji na sesje?** *Wskazówka: pomyśl o wspólnym katalogu wynikowym i instrukcjach, które czyta każdy agent.*

- **Kiedy baza grafowa jest lepsza od prostego systemu plików z grep, a kiedy gorsza?** *Wskazówka: rozważ koszt utrzymania, złożoność zapytań i rodzaj powiązań między dokumentami.*

- **Jak zastosowałbyś wzorzec Deep Research do audytu bezpieczeństwa kodu — co byłoby odpowiednikiem "search", "read", "find gaps" i "refine"?** *Wskazówka: lekcja sugeruje zmianę nazwy na "deep action" nie bez powodu.*
