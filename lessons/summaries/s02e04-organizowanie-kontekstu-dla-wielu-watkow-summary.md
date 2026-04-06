# S02E04 — Organizowanie kontekstu dla wielu wątków — Podsumowanie

## O czym jest ta lekcja? (TL;DR)

Lekcja przenosi nas z budowania pojedynczego agenta na projektowanie **systemów wieloagentowych** — wielu agentów współpracujących nad jednym zadaniem. Kluczowym wyzwaniem nie jest samo uruchomienie wielu agentów, lecz zarządzanie kontekstem, który między nimi przepływa: jak go współdzielić, jak unikać konfliktów przy równoczesnym zapisie i jak zaprojektować komunikację, żeby informacje się nie gubiły. To lekcja o architekturze — kiedy warto sięgać po agentów, a kiedy lepszy jest prosty kod.

## Mapa koncepcji

- **Architektury wieloagentowe** — wzorce organizacji komunikacji między agentami (Pipeline, Blackboard, Orchestrator, Tree, Mesh, Swarm)
  - **Narzędzia komunikacji** — `delegate` i `message` jako mechanizmy przekazywania zadań i dwukierunkowej wymiany danych
  - **Agent koordynujący (Manager)** — centralny agent zarządzający pracą pozostałych, z wiedzą o systemie i uprawnieniami decyzyjnymi
- **Globalny kontekst** — pamięć, baza wiedzy i dane współdzielone między sesjami i agentami
  - **Konflikty zapisu** — problem "last write wins" gdy wielu agentów modyfikuje ten sam zasób
  - **Strategie zarządzania konfliktem** — wykrywanie, unikanie, historia zmian, agent zarządzający, rozwiązywanie manualne
- **Wyzwania współdzielenia kontekstu** — degradacja komunikacji, własna interpretacja, duplikaty, metadane, granica sesja vs. pamięć
- **Kiedy agenci, a kiedy kod** — kryteria decyzji o zastosowaniu systemu wieloagentowego

## Kluczowe koncepcje

### Architektury systemów wieloagentowych

**W jednym zdaniu:** Istnieje kilka sprawdzonych wzorców organizacji komunikacji między agentami — od liniowego Pipeline po rozproszone Swarm — i w praktyce najczęściej łączymy kilka z nich jednocześnie.

**Rozwinięcie:** Wzorce te nie są nowe — znamy je z systemów rozproszonych i mikroserwisów. Nowością jest połączenie ich z modelami językowymi, co zwiększa elastyczność, ale jednocześnie utrudnia debugowanie. **Pipeline** to prosta sekwencja bez cofania (jak taśma produkcyjna). **Blackboard** to wspólna pamięć, z której niezależni agenci czytają i do której piszą (jak tablica w kuchni). **Orchestrator** to koordynator zlecający zadania (jak kierownik projektu). **Tree** dodaje warstwy managerów. **Mesh** to adresowana komunikacja "agent do agenta", a **Swarm** to rozproszone działanie z selekcją wyników.

**Przykład z lekcji:** Diagram architektur pokazuje sześć wzorców wizualnie — od liniowego łańcucha agentów A→B→C→D (Pipeline) przez Blackboard ze wspólnym stanem, Hub-and-Spoke z centralnym Orchestratorem, Peer-to-Peer (Mesh), hierarchiczne drzewo z Managerem i Leadami, aż po Swarm z rozproszoną komunikacją.

### Delegowanie i dwukierunkowa komunikacja

**W jednym zdaniu:** Agenci komunikują się przez dwa kluczowe narzędzia: `delegate` (zlecanie zadania) i `message` (wymiana informacji w trakcie realizacji), co pozwala na pauzowanie pętli agenta w oczekiwaniu na brakujące dane.

**Rozwinięcie:** `delegate` otwiera nowy wątek z własną instrukcją systemową i zestawem narzędzi — to jak wywołanie funkcji, gdzie wynik staje się odpowiedzią tool calla. Narzędzie `message` jest bardziej subtelne: gdy agent w trakcie pracy potrzebuje informacji, których nie ma, jego pętla się wstrzymuje (analogia do generatorów w JavaScript), a pytanie trafia w górę — do agenta nadrzędnego lub do człowieka. To tworzy łańcuch eskalacji, znany z klasycznych helpdesków.

**Przykład z lekcji:** Diagram "Delegate with Message" pokazuje scenariusz: użytkownik prosi o dodanie kuponu 20% do kurtek zimowych, agent e-commerce zostaje delegowany, ale potrzebuje wiedzieć, jak długo kupon ma być aktywny. Wysyła `message` → orchestrator nie zna odpowiedzi → pyta użytkownika → "14 days" → agent wznawia pracę i aplikuje kupon.

### Konflikty w globalnym kontekście

**W jednym zdaniu:** Gdy dwie instancje tego samego agenta jednocześnie modyfikują tę samą pamięć, wygrywają dane zapisane później — a wcześniejsze zmiany giną (problem "last write wins").

**Rozwinięcie:** Konflikt jest nam dobrze znany z Gita — ale tam osoba rozwiązująca merge conflict **rozumie** obie wersje. Agent często nie ma tego kontekstu. Dlatego proste przeniesienie wzorca "resolve conflicts" nie wystarczy. Lekcja proponuje pięć strategii: (1) **wykrywanie** przez checksums — porównanie hash'a między odczytem a zapisem, (2) **unikanie** przez ownership/uprawnienia/izolację sesji, (3) **agent zarządzający** ze wglądem w historię, (4) **historia zmian** w stylu append-only (jak Observational Memory), (5) **rozwiązywanie manualne** przez człowieka.

**Przykład z lekcji:** Diagram "Lost Update" pokazuje konkretny scenariusz: profil pamięci użytkownika Adama. Sesja A dodaje "Rust" do stacka (zapis w T=120ms), Sesja B dodaje email (zapis w T=340ms ze starego snapshotu). Wynik: email jest, ale Rust zniknął — "with free-text memory there is no field-level merge".

### Zewnętrzny kontekst odseparowany od logiki agentów

**W jednym zdaniu:** Współdzielona wiedza (workflows, projekty, pamięć, dane firmowe) powinna istnieć niezależnie od agentów — agenci nawigują po niej przez znane ścieżki, a nie przeszukują chaotycznie.

**Rozwinięcie:** To jak różnica między biblioteką z katalogiem a stertą papierów na biurku. Agenci wchodzą przez znany root (np. `./workflows`, `./memory`) i podążają za referencjami w dokumentach — zamiast uruchamiać wyszukiwanie full-text. Każdy agent ma ściśle określone uprawnienia (R/W lub R/O) do konkretnych katalogów. Co istotne, te same dokumenty powinny być dostępne dla ludzi — to otwiera drogę do realnej kolaboracji człowiek-agent na wspólnej bazie wiedzy.

**Przykład z lekcji:** Diagram "External Context — Multi-Agent Knowledge Map" pokazuje cztery katalogi (`/workflows`, `/projects`, `/memory`, `/company`) z konkretnymi dokumentami. Trzy agentów (Task Manager, Pre-Sales Assistant, Memory Manager) mają różne poziomy dostępu — np. Task Manager ma R/W do `/workflows` i R/O do `/projects` i `/memory`, a tylko Memory Manager ma R/W do `/memory`.

### Rola agenta koordynującego (Manager)

**W jednym zdaniu:** Agent zarządzający jest centralnym punktem systemu — posiada minimalną liczbę narzędzi, ale najszersze uprawnienia dostępu do informacji, kontekstu sesji i kontaktu z człowiekiem.

**Rozwinięcie:** Manager to nie "super-agent" z wszystkimi narzędziami. Jego siła polega na **wiedzy o systemie**: zna role dostępnych agentów, ma wgląd w ich workspace, czyta pamięć długoterminową i widzi postępy realizacji. Dysponuje głównie narzędziami `delegate` i `message` plus wyszukiwanie w pamięci. Kluczowe jest, że to on decyduje, kiedy zaangażować człowieka. Przy obecnym poziomie modeli pełna autonomia jest ryzykowna — dlatego manager pełni rolę bufora między automatyką a ludzką kontrolą.

**Przykład z lekcji:** W przykładzie `02_04_ops` orchestrator czyta workflow (`daily-ops.md`), deleguje zbieranie danych do czterech specjalistycznych agentów (mail, calendar, tasks, notes), potem sam czyta cele, historię i preferencje, a na końcu syntetyzuje Daily Ops.

### Kiedy agenci, a kiedy prosty kod

**W jednym zdaniu:** Agenci mają sens gdy zadania są otwarte, dane dynamiczne, zależności nieoczywiste lub wymagana jest elastyczność — ale wszędzie, gdzie liczy się koszt, szybkość i pełna przewidywalność, lepszy jest klasyczny kod.

**Rozwinięcie:** To jedno z najważniejszych pytań w lekcji. Łatwo dać się ponieść wizji systemu wieloagentowego tam, gdzie wystarczy CRON + szablon. Lekcja podaje sześć kryteriów przemawiających za agentami: (1) zadania otwarte wymagające reagowania na otoczenie, (2) dynamiczna struktura danych, (3) zależności na poziomie semantyki języka, (4) iterowanie z kryteriami w języku naturalnym, (5) potrzeba elastycznej architektury, (6) personalizacja wykraczająca poza szablony. Jeśli żadne z nich nie zachodzi — agenci to overengineering.

**Przykład z lekcji:** System Daily Ops sam w sobie prowokuje pytanie "po co tu agenci?" — podobne narzędzia istniały przed LLM-ami. Różnica polega na elastyczności, personalizacji i zdolności reagowania na kontekst (np. eskalacja powtarzających się zadań).

## Teoria w praktyce

### System Daily Ops (`02_04_ops`)

Ten przykład implementuje wieloagentowy system generujący codzienny raport operacyjny. Orchestrator czyta workflow, deleguje zbieranie danych do wyspecjalizowanych agentów, a potem syntetyzuje wynik z uwzględnieniem historii, celów i preferencji użytkownika.

```typescript
// agent.ts — rekurencyjne delegowanie zadań między agentami
export async function runAgent(
  agentName: string,
  task: string,
  depth: number = 0
): Promise<string> {
  if (depth > MAX_DEPTH) {
    return 'Max agent depth exceeded' // zabezpieczenie przed nieskończoną rekurencją
  }

  const template = await loadAgent(agentName) // wczytanie szablonu z .agent.md
  // ... pętla tool-calling ...

  if (name === 'delegate') {
    // delegate = rekurencyjne wywołanie runAgent z nowym agentem i zadaniem
    result = await runAgent(agent, delegatedTask, depth + 1)
  }
}
```

Kluczowy wzorzec: każdy agent jest definiowany przez plik Markdown z frontmatterem (nazwa, model, lista narzędzi) i treścią będącą system promptem. Narzędzie `delegate` to po prostu rekurencyjne wywołanie `runAgent` — wynik pracy delegowanego agenta staje się odpowiedzią tool calla. `MAX_DEPTH = 3` chroni przed nieskończoną rekurencją.

```typescript
// tools.ts — narzędzia agentów z izolacją do workspace
function isPathSafe(path: string): boolean {
  const fullPath = resolve(join(WORKSPACE, path))
  const rel = relative(resolve(WORKSPACE), fullPath)
  return !rel.startsWith('..') // agent nie wyjdzie poza workspace
}
```

Narzędzia (`get_mail`, `get_calendar`, `get_tasks`, `get_notes`, `read_file`, `write_file`, `delegate`) są współdzielone, ale każdy agent deklaruje w swoim szablonie, do których ma dostęp. Agenci specjalistyczni (mail, calendar, tasks, notes) mają po jednym narzędziu — ich rola to wyłącznie pobranie i podsumowanie danych. Orchestrator ma `delegate`, `read_file` i `write_file` — koordynuje, czyta kontekst i zapisuje wynik.

## Najważniejsze zasady (cheat sheet)

1. **Zacznij od najprostszej architektury** — jeden agent z orchestratorem i delegowaniem wystarczy na 90% przypadków. Mesh i Swarm to jeszcze egzotyka w produkcji.
2. **`delegate` = nowy wątek z własną instrukcją i narzędziami** — delegowany agent nie dziedziczy kontekstu nadrzędnego. Musi dostać wszystkie potrzebne informacje w treści zadania.
3. **`message` pozwala na pauzowanie pętli agenta** — gdy brakuje danych, agent eskaluje w górę zamiast zgadywać. To wzorzec generatora (yield) przeniesiony na komunikację.
4. **Kontroluj konflikty zapisu przez ownership i izolację** — lepiej zapobiegać niż rozwiązywać. Przypisz zasoby do konkretnych agentów, ogranicz uprawnienia do R/O tam, gdzie to możliwe.
5. **Zewnętrzny kontekst powinien być niezależny od agentów** — agenci nawigują po znanych ścieżkach, a nie przeszukują chaotycznie. Te same dokumenty muszą być dostępne dla ludzi.
6. **Agent koordynujący ma mało narzędzi, ale dużo wiedzy** — jego rola to rozbijanie zadań, zarządzanie planem i kontakt z człowiekiem. Nie obciążaj go narzędziami specjalistycznymi.
7. **Każda warstwa komunikacji degraduje informację** — im więcej agentów w łańcuchu, tym większe ryzyko utraty lub zniekształcenia danych. Starannie projektuj instrukcje `delegate` i `message`.
8. **Zadawaj sobie pytanie "po co tu agenci?"** — jeśli struktura danych jest stała, logika deterministyczna, a personalizacja ograniczona, to klasyczny kod będzie lepszy.
9. **Metadane są paliwem dla komunikacji** — źródło, data, kontekst powstania informacji pomagają agentom i ludziom poprawnie interpretować dane.
10. **Projektuj panel zarządzania od początku** — okno czatu nie wystarczy dla systemu wieloagentowego. Dashboard z sesjami, harmonogramem i eskalacjami jest koniecznością.
11. **Utrzymuj system prostym tak długo, jak to możliwe** — system wieloagentowy nie musi od razu przejmować całej organizacji. Jeden system może obsługiwać wiele niezależnych obszarów z minimalną wymianą danych.

## Czego unikać (anty-wzorce)

- **Pełna autonomia bez nadzoru** → **Panel zarządzania + jasne reguły eskalacji do człowieka** — modele popełniają proste błędy, a w wieloagentowym systemie błąd się kaskadowo propaguje.
- **Jeden agent z dziesiątkami narzędzi** → **Wyspecjalizowani agenci z minimalnym zestawem narzędzi** — mniej narzędzi = mniej błędów w wyborze i bardziej precyzyjne działanie.
- **Kopiowanie wzorca Git do rozwiązywania konfliktów** → **Zapobieganie konfliktom przez izolację i ownership** — agent rozwiązujący merge conflict często nie ma wystarczającego kontekstu, żeby podjąć dobrą decyzję.
- **Przekazywanie informacji bez struktury** → **Precyzyjne instrukcje w `delegate` z pełnym kontekstem zadania** — degradacja komunikacji jest nieunikniona, ale można ją minimalizować.
- **Zapisywanie notatek bez kontekstu** → **Dodawanie metadanych: źródło, data, sesja, powiązane dokumenty** — notatka "Anna lubi kawę" bez kontekstu jest bezwartościowa, gdy w systemie jest pięć Ann.
- **Budowanie skomplikowanego systemu wieloagentowego "na zapas"** → **Rozpoczęcie od prostego workflow i dodawanie agentów gdy pojawiają się realne potrzeby** — Gen-AI potrafi więcej niż myślimy i mniej niż nam się wydaje.

## Sprawdź się (pytania do refleksji)

- **Masz system, w którym dwa agenty jednocześnie aktualizują profil użytkownika. Jak zaprojektujesz pamięć, żeby żadna informacja nie zginęła?** *Wskazówka: pomyśl o append-only, checksumach i podziale odpowiedzialności za konkretne pola.*

- **W systemie Daily Ops orchestrator deleguje zbieranie maili i kalendarza. Co się stanie, gdy agent mailowy zwróci informację sprzeczną z danymi z kalendarza? Kto powinien to rozwiązać?** *Wskazówka: zastanów się, który agent ma wystarczająco szeroki kontekst, żeby ocenić sprzeczność.*

- **Kiedy zastosowanie architektury event-driven (pub/sub) ma przewagę nad prostym delegowaniem? Wymień trzy scenariusze.** *Wskazówka: pomyśl o sytuacjach, gdzie jedno zdarzenie powinno wywołać reakcję wielu niezależnych agentów.*

- **Zaprojektuj uprawnienia dostępu dla trzech agentów (Task Manager, Sales Assistant, Memory Manager) do czterech katalogów wiedzy. Jakie poziomy (R/W, R/O, brak) przydzielisz i dlaczego?** *Wskazówka: zasada najmniejszych uprawnień + kto jest "właścicielem" danego zasobu.*

- **Czy system wieloagentowy do generowania Daily Ops jest overengineeringiem? Zdefiniuj trzy konkretne warunki, przy których klasyczny CRON + szablon byłby lepszym rozwiązaniem.** *Wskazówka: pomyśl o kosztach, przewidywalności danych i potrzebie personalizacji.*
