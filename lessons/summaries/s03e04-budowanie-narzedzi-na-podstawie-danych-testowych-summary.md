# Budowanie narzędzi na podstawie danych testowych — Podsumowanie

## O czym jest ta lekcja? (TL;DR)

Gotowe integracje (MCP servery, SDK) rzadko pasują do Twoich potrzeb — podłączenie agenta do pełnego Gmail API to proszenie się o kłopoty, jeśli potrzebuje on tylko obsługi supportu. Ta lekcja pokazuje proces **iteracyjnego projektowania narzędzi wspólnie z LLM**: od skanowania API, przez wielokrotne poprawianie schematów input/output, generowanie syntetycznych danych testowych, po ewaluację z Promptfoo na wielu modelach — aż do narzędzi, które agent naprawdę potrafi skutecznie obsłużyć.

## Mapa koncepcji

- **Projektowanie narzędzi z LLM** — iteracyjna dyskusja o schematach, nie jednorazowa generacja
  - **Skanowanie API** — zrozumienie dostępnych akcji i wybranie tych potrzebnych
  - **Iteracja schematów** — od kiepskiego pierwszego draftu do dopracowanej struktury
  - **Wspólna struktura odpowiedzi** — next_action, recovery, diagnostics we wszystkich narzędziach
- **Syntetyczne dane testowe** — generowane przez LLM, weryfikowane przez człowieka
  - **Kategorie testów** — indywidualne narzędzia + wieloetapowe scenariusze + obsługa błędów
- **Ewaluacja z Promptfoo** — offline testy na etapie developmentu
  - **Porównywanie modeli** — GPT-5.2 vs GPT-5-mini vs GPT-4.1 na tych samych testach
- **Automatyczna optymalizacja** — checklisty, dobre praktyki, agent weryfikujący najnowsze modele

## Kluczowe koncepcje

### Narzędzia dopasowane, nie gotowe

**W jednym zdaniu:** Zamiast podłączać gotowy serwer MCP z pełnym dostępem do API, buduj wyspecjalizowane narzędzia zawężone do tego, czego agent faktycznie potrzebuje.

**Rozwinięcie:** Pomyśl o tym jak o zasadzie least privilege w systemach uprawnień. Agent obsługujący support nie potrzebuje `gmail__search` (przeszuka całą skrzynkę), lecz `gmail__search_support` (domyślnie zawężone do kategorii wsparcia). Agent generujący grafiki nie potrzebuje pełnego API Replicate, lecz narzędzie z predefiniowanymi ustawieniami stylu. Gotowe integracje są jak klucz uniwersalny — dają za dużo możliwości i za mało kontroli.

**Przykład z lekcji:** Lekcja zaczyna od przeskanowania Gmail API i otrzymania listy ~15 akcji. Z nich wybieranych jest 5 (search, read, send, modify, attachment), a następnie kształtowane są ich schematy — nie 1:1 z API, ale dopasowane do potrzeb agenta.

### Iteracyjne projektowanie schematów z LLM

**W jednym zdaniu:** Pierwszy draft schematu narzędzia wygenerowany przez AI jest zawsze kiepski — prawdziwa wartość leży w wielokrotnym iterowaniu z konkretnymi wskazówkami.

**Rozwinięcie:** AI generuje "iluzję poprawności" — schemat wygląda ok na pierwszy rzut oka, ale brak stronicowania w search, brak informacji o załącznikach, pole "date" bez jasnego znaczenia, "snippet" za krótki do podjęcia decyzji. Kluczowe jest przesłanie **listy wskazówek**, które model rozszerza i przenosi na kontekst całej integracji. Na przykład: "przy braku wyników zwracaj sugestię zmiany filtrów", "modify powinno zwracać zmienione pola", "załącznik jako link, nigdy base64". Po 3-4 iteracjach uzyskujemy schemat, którego agent faktycznie może się nauczyć.

**Przykład z lekcji:** Pierwszy draft `search_messages` nie miał stronicowania, pole `to` nie obsługiwało wielu odbiorców, `snippet` był szumem. Po przesłaniu 7 wskazówek model wygenerował schemat z etykietami, statusami (read/unread), załącznikami, paginacją i kontrolą szczegółowości wyników.

### Wspólna struktura odpowiedzi narzędzi

**W jednym zdaniu:** Wszystkie narzędzia powinny zwracać odpowiedzi w jednolitym formacie zawierającym `next_action` (co agent może zrobić dalej), `recovery` (co zrobić gdy coś poszło nie tak) i `diagnostics` (szczegóły techniczne).

**Rozwinięcie:** To jak RESTful API z konsekwentnym formatem odpowiedzi — agent uczy się schematu raz i wie, czego oczekiwać od każdego narzędzia. `next_action` sugeruje łączenie akcji (np. "pobierz szczegóły wątku" po search). `recovery` mówi, co zrobić przy braku wyników ("spróbuj szerszego zapytania") lub błędach API. `diagnostics` daje kontekst techniczny bez zanieczyszczania głównej odpowiedzi. Efekt: agent nie "gubi się" po otrzymaniu wyniku — wie, jaki jest następny krok.

**Przykład z lekcji:** Finalna struktura narzędzi Gmail zawiera we wszystkich odpowiedziach: `next_action` (sugestie dalszych kroków), `recovery` (jak naprawić problem), `diagnostics` (tokeny, czas, identyfikatory) — niezależnie od tego, czy to search, read czy modify.

### Generowanie i kategoryzowanie danych testowych

**W jednym zdaniu:** LLM świetnie generuje syntetyczne scenariusze testowe, ale potrzebuje od Ciebie kategorii, różnorodności i sensu — bez tego wyprodukuje płytkie, powtarzalne testy.

**Rozwinięcie:** Proces wygląda tak: (1) poproś LLM o wygenerowanie 10-15 przykładowych interakcji z agentem Gmail, (2) wybierz najciekawsze, (3) poproś o więcej na ich podstawie, (4) podziel na kategorie. Kluczowe kategorie: **testy poszczególnych narzędzi** (czy agent poprawnie obsługuje search/read/modify indywidualnie), **scenariusze wieloetapowe** (czy agent łączy narzędzia — np. "znajdź mail od Jana i dodaj etykietę"), **obsługa błędów** (co gdy API zwraca 403, gdy nie ma wyników, gdy akcja się nie powiedzie). Na tym etapie nie dopracowuj każdego wpisu — użyteczność ujawni się dopiero przy testowaniu.

**Przykład z lekcji:** Wygenerowane scenariusze obejmują: wyszukiwanie maili od konkretnej osoby, czytanie wątku, wysyłanie odpowiedzi, modyfikowanie etykiet, pobieranie załączników — oraz kombinacje tych akcji z obsługą edge case'ów.

### Ewaluacja z Promptfoo na wielu modelach

**W jednym zdaniu:** Promptfoo pozwala uruchomić te same testy na wielu modelach jednocześnie, porównać ich skuteczność, koszty i styl — i podjąć świadomą decyzję o wyborze modelu.

**Rozwinięcie:** Ewaluacje uruchamiane są **prawie bez wiadomości systemowej** — celowo, aby sprawdzić jak model radzi sobie bazując wyłącznie na opisach narzędzi i schematach. Logika: jeśli agent bez dodatkowych instrukcji poradzi sobie z obsługą narzędzi, to po wyspecjalizowaniu będzie jeszcze lepszy. Porównanie trzech modeli ujawniło: GPT-4.1 (najtańszy, najszybszy, ale niestabilny — niepełne odpowiedzi), GPT-5.2 (najskuteczniejszy, ale najwolniejszy i zbyt techniczny), GPT-5-mini (złoty środek). Takie porównanie pozwala też odpowiedzieć: czy mniejszy model da radę? Czy optymalizacja w ogóle ma sens?

**Przykład z lekcji:** Wszystkie trzy modele zaliczyły testy, ale w różny sposób. GPT-4.1 potrzebował najmniej kroków ale miał luki. GPT-5.2 używał identyfikatorów w odpowiedziach (mało user-friendly). Wniosek: na produkcji GPT-5.2 lub GPT-5-mini, ale warto optymalizować schematy pod mniejsze modele — to forma "narzucania ograniczeń", które podnoszą jakość również z lepszymi modelami.

### Automatyczna optymalizacja i weryfikacja nowych modeli

**W jednym zdaniu:** Po ustabilizowaniu procesu, agent kodujący może samodzielnie czytać schematy narzędzi, uruchamiać ewaluacje i sugerować usprawnienia — a nawet testować najnowsze modele Open Source.

**Rozwinięcie:** Checklista dobrych praktyk + Promptfoo config + agent kodujący = semi-automatyczny pipeline optymalizacji. Agent czyta pliki narzędzi, uruchamia testy w terminalu, interpretuje wyniki. Na rynku regularnie pojawiają się nowe modele (Minimax, GLM, Qwen), których skuteczność stopniowo rośnie. Posiadanie ewaluacji oznacza, że weryfikacja nowego modelu to kwestia jednego polecenia, a nie tygodnia ręcznych testów. Czasem mniejszy model nie tylko jest tańszy, ale ma lepszy styl wypowiedzi.

**Przykład z lekcji:** Lekcja sugeruje, że po ustabilizowaniu schematów i ewaluacji, cały proces weryfikacji nowych modeli (w tym Open Source jak Qwen 3.5) może być w dużym stopniu zautomatyzowany.

## Teoria w praktyce

### Iteracja schematu narzędzia Gmail
Lekcja nie zawiera tradycyjnego kodu do pokazania, lecz **proces projektowania** wspólnie z LLM. Najważniejszy wzorzec to lista wskazówek przekazywanych modelowi:

```
Wskazówki do poprawy schematów narzędzi Gmail:

1. Przy braku wyników: zwracaj sugestię zmiany zapytania lub filtrów
2. Przy błędach API: jasno wyjaśnij co się stało i co można zrobić
3. Przy problemach globalnych (np. autoryzacja): osobna diagnostyka
4. Dołączaj wskazówki łączenia akcji (np. "pobierz szczegóły wątku")
5. Akcja "read": nie wymagaj od agenta decyzji o typie zasobu
   (wiadomość/wątek) — rozwiąż programistycznie po identyfikatorze
6. Akcja "modify": zwracaj wprost zmienione pola w odpowiedzi
7. Załączniki: NIGDY base64 — zawsze link do zasobu
```

Model rozszerza te wskazówki i przenosi na kontekst całej integracji — efekt jest znacznie lepszy niż jednorazowa generacja.

### Struktura ewaluacji w Promptfoo (`03_04_gmail`)
Ewaluacje dzielą się na testy indywidualnych narzędzi i scenariusze wieloetapowe, uruchamiane na wielu modelach jednocześnie.

```yaml
# Przykładowa struktura ewaluacji Promptfoo (koncepcyjna)
providers:
  - openai:gpt-5.2
  - openai:gpt-5-mini
  - openai:gpt-4.1

tests:
  # Testy indywidualnych narzędzi
  - description: "Search: find emails from specific sender"
    vars:
      message: "Find all emails from jan@example.com from last week"
    assert:
      - type: is-json           # odpowiedź jest poprawnym JSON
      - type: contains          # zawiera oczekiwane pole
        value: "next_action"
      - type: javascript        # programistyczna weryfikacja
        value: "output.results.length > 0"

  # Scenariusze wieloetapowe
  - description: "Scenario: find, read and label"
    vars:
      message: "Find the latest email from support, read it, and add label 'urgent'"
    assert:
      - type: llm-rubric        # ocena przez LLM
        value: "Agent should use search, then read, then modify tools in sequence"
```

Kluczowe: testy uruchamiane **bez wiadomości systemowej** — sprawdzamy skuteczność samych opisów narzędzi.

### Wspólna struktura odpowiedzi narzędzi
Każde narzędzie zwraca odpowiedź w jednolitym formacie, który prowadzi agenta dalej.

```typescript
// Koncepcyjna struktura odpowiedzi narzędzia Gmail
interface ToolResponse<T> {
  success: boolean;
  data: T;

  // Co agent może zrobić dalej
  next_action?: {
    suggestion: string;      // "Use read_message to see full thread"
    tool: string;            // "gmail__read"
    params_hint?: object;    // { id: "thread_abc123" }
  };

  // Jak naprawić problem
  recovery?: {
    reason: string;          // "No results for query"
    suggestion: string;      // "Try broader date range or remove label filter"
  };

  // Kontekst techniczny
  diagnostics?: {
    request_id: string;
    tokens_used: number;
    page_info?: { has_next: boolean; cursor: string };
  };
}
```

Agent nie musi "zgadywać" co zrobić po otrzymaniu wyniku — narzędzie mu to mówi.

## Najważniejsze zasady (cheat sheet)

1. **Zawężaj narzędzia do potrzeb agenta** — `gmail__search_support` zamiast `gmail__search`. Mniej możliwości = mniej błędów = mniej ryzyka.
2. **Pierwszy draft od AI jest zawsze kiepski** — traktuj go jako punkt startowy (60-70% pracy), nie jako gotowe rozwiązanie. Iteruj 3-4 razy z konkretnymi wskazówkami.
3. **Przesyłaj wskazówki, nie poprawki** — model rozszerzy 7 punktów na kontekst całej integracji lepiej, niż gdybyś poprawiał każde pole ręcznie.
4. **Wspólna struktura odpowiedzi** — next_action, recovery, diagnostics we wszystkich narzędziach. Agent uczy się formatu raz.
5. **next_action w odpowiedzi** — sugeruj agentowi kolejny krok (np. "pobierz szczegóły wątku"). Drastycznie zmniejsza liczbę błędnych decyzji.
6. **Nigdy base64 w odpowiedzi narzędzia** — załączniki, obrazy, pliki: zwracaj linki. Base64 zabija okno kontekstowe.
7. **Generuj testy z LLM, ale kategoryzuj sam** — AI wyprodukuje płytkie, powtarzalne testy bez Twojego kierunku. Podziel na: indywidualne narzędzia, scenariusze wieloetapowe, obsługa błędów.
8. **Testuj bez wiadomości systemowej** — jeśli agent poradzi sobie bazując na opisach narzędzi, to po wyspecjalizowaniu będzie jeszcze lepszy.
9. **Porównuj modele na tych samych testach** — Promptfoo pozwala uruchomić eval na wielu modelach jednocześnie. Mniejszy model nie zawsze jest gorszy.
10. **Optymalizuj schematy pod mniejsze modele** — to forma "narzucania ograniczeń", która podnosi jakość również z lepszymi modelami.
11. **Ewaluacje pozwalają testować nowe modele jednym poleceniem** — gdy pojawi się nowy Qwen czy Minimax, sprawdzisz go w minuty, nie dni.

## Czego unikać (anty-wzorce)

- **Podłączanie gotowego MCP servera z pełnym API** → **Budowanie wyspecjalizowanych narzędzi z zawężonym zakresem** — agent z dostępem do całego Gmail to ryzyko bezpieczeństwa i źródło błędów.
- **Jednorazowa generacja schematu narzędzia** → **Iteracyjna dyskusja z LLM (3-4 rundy)** — pierwszy draft ma fundamentalne błędy (brak paginacji, base64, brak opisów pól). Iteracja je eliminuje.
- **Testowanie tylko "happy path"** → **Ewaluacja błędów, brakujących wyników i łączenia narzędzi** — agent musi radzić sobie gdy API zwraca 403, gdy nie ma wyników, gdy pierwsza akcja się nie powiedzie.
- **Wybór modelu "na czucie"** → **Porównanie na syntetycznych benchmarkach** — GPT-4.1 wygląda świetnie w demo, ale na produkcji ujawnią się problemy z niepełnymi odpowiedziami. Ewaluacje to pokażą.
- **Zwracanie base64 w odpowiedziach narzędzi** → **Zawsze linki do zasobów** — 1 MB base64 w kontekście to ~1.3M tokenów. Jeden taki załącznik i okno kontekstowe jest martwe.
- **Testy bez struktury i kategorii** → **Podział na narzędzia, scenariusze i błędy** — chaotyczne testy trudno rozbudowywać i analizować.

## Sprawdź się (pytania do refleksji)

- **Dostajesz zadanie: podłącz agenta do Jira API. Jak przeprowadzisz "skanowanie" dostępnych akcji i zdecydujesz, które z nich agent powinien mieć, a które nie?** *Wskazówka: pomyśl o zasadzie least privilege i o tym, jakie akcje są odwracalne.*

- **Twój agent Gmail zwraca snippet wiadomości (20 słów), ale agent nie potrafi na tej podstawie zdecydować, czy to ważny mail. Jak zmienisz schemat narzędzia?** *Wskazówka: pomyśl o kontroli szczegółowości (detail level) i o balance między tokenami a użytecznością.*

- **Wszystkie trzy testowane modele zaliczają eval na 100%, ale użytkownicy narzekają na jakość. Co jest nie tak z Twoimi testami?** *Wskazówka: pomyśl o Eval Alignment Matrix z lekcji S03E01 — false positive oznacza, że to testy wymagają poprawy.*

- **Masz agenta, który świetnie radzi sobie z pojedynczymi narzędziami, ale "gubi się" przy scenariuszach wieloetapowych (search → read → modify). Co może pomóc?** *Wskazówka: pomyśl o polu `next_action` w odpowiedzi narzędzia i o tym, jak prowadzić agenta krok po kroku.*

- **Kiedy optymalizacja pod mniejsze modele NIE ma sensu? A kiedy jest warta zachodu nawet jeśli docelowo używasz największego modelu?** *Wskazówka: pomyśl o narzucaniu ograniczeń jako formie poprawy jakości schematów.*
