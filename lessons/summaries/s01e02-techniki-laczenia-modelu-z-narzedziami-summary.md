# Techniki łączenia modelu z narzędziami — Podsumowanie

## O czym jest ta lekcja? (TL;DR)

Model językowy sam z siebie nie potrafi zrobić niczego poza generowaniem tekstu — ale dzięki Function Calling możemy dać mu "ręce", czyli narzędzia, którymi steruje przez JSON. Ta lekcja uczy, jak projektować te narzędzia mądrze: nie jako kopię 1:1 istniejącego API, ale jako przemyślany interfejs dopasowany do sposobu "myślenia" modelu. Oprócz tego poznajemy architekturę agenta AI, techniki optymalizacji i realne zagrożenia jak prompt injection.

## Model mentalny

**Zdanie-klucz:** Model nie **wykonuje** akcji — generuje JSON z **intencją**, a kod decyduje czy i jak ją zrealizować; agent to **pętla decyzyjna**, nie mózg z narzędziami.

```mermaid
flowchart TD
    U["Użytkownik<br/>zapytanie"] --> L
    T["Narzędzia<br/>definicje + opisy"] --> L
    L["LLM<br/>wybiera tool + argumenty"]
    L -->|JSON tool_call| H["Harness<br/>walidacja • whitelist • sandbox"]
    H -->|wywołanie| E["Kod wykonuje<br/>API / CLI / MCP"]
    E -->|wynik| L
    L -->|brak tool_call| A["Odpowiedź<br/>dla użytkownika"]

    classDef human fill:#1e3a5f,stroke:#60a5fa,color:#ececdf
    classDef llm fill:#3b2817,stroke:#fbbf24,color:#ececdf
    classDef warning fill:#3f1a1a,stroke:#f87171,color:#ececdf
    classDef action fill:#2a1a3a,stroke:#a78bfa,color:#ececdf
    classDef output fill:#1a2e26,stroke:#34d399,color:#ececdf
    class U,T human
    class L llm
    class H warning
    class E action
    class A output
```

**Trzy przemiany myślenia, które ten diagram wymusza:**
1. *Nie model wykonuje akcje, lecz kod na jego rozkaz* — LLM generuje JSON z intencją, harness decyduje co wykonać. Model staje się planistą, nie wykonawcą.
2. *Nie kopiuj API 1:1, projektuj interfejs dla "kolegi bez docs"* — dobre narzędzie ma samoopisujące nazwy, jasne komunikaty błędów i łączy kilka endpointów w jedno (np. `workspace_metadata` zamiast 4 osobnych).
3. *Bezpieczeństwo to kod, nie instrukcja w prompcie* — whitelist, izolacja kontekstu i dry-run trzymasz w harness. Model halucynuje adresy i ścieżki; kod nie.

## Mapa koncepcji

- **Function Calling** — fundament łączenia LLM z zewnętrznym światem
  - **Projektowanie narzędzi** — klucz do skuteczności (nazwy, opisy, schematy)
    - **Domyślne wartości i walidacja** — ułatwianie pracy modelowi
    - **Zabezpieczenia** — whitelisting, izolacja kontekstu, dry-run
  - **Sposoby integracji** — API vs CLI vs MCP/Function Calling
- **Augmented Function Calling** — wzbogacanie wywołań narzędzi o dodatkowy kontekst
- **Workflow vs Agent** — dwa modele organizacji logiki z LLM
  - **Agent Harness** — kompletna architektura systemu agentowego
- **Context Engineering** — zarządzanie kontekstem w interakcji z agentem
  - **Prompt Cache** — priorytet optymalizacji
  - **Transformacja zapytań** — tłumaczenie intencji użytkownika na skuteczne wyszukiwanie
- **Prompt Injection** — otwarty problem bezpieczeństwa, którego nie da się "naprawić"

## Kluczowe koncepcje

### Function Calling / Tool Use

**W jednym zdaniu:** Mechanizm, w którym model nie wykonuje akcji sam, lecz generuje JSON opisujący *którą* funkcję wywołać i z *jakimi* argumentami — a kod aplikacji robi resztę.

**Rozwinięcie:** Pomyśl o tym jak o kelnerze w restauracji: nie gotuje sam, ale precyzyjnie zapisuje zamówienie i przekazuje je kucharzowi. Model "widzi" definicje narzędzi (nazwy, opisy, schematy) jako część kontekstu — tokeny, za które płacisz nawet gdy narzędzie nie zostanie użyte. Cała interakcja to pętla: model albo odpowiada użytkownikowi, albo zwraca żądanie wywołania narzędzia. Kod uruchamia funkcję, przekazuje wynik z powrotem, i model decyduje co dalej.

**Przykład z lekcji:** Diagram przepływu Function Calling pokazuje pełny cykl: użytkownik pyta "What's the weather in Kraków?", model otrzymuje definicje trzech narzędzi (`get_weather`, `search_web`, `send_email`), generuje JSON `{"tool": "get_weather", "arguments": {"location": "Kraków"}}`, kod wywołuje API pogodowe, wynik `{"temp": -2, "conditions": "snow"}` wraca do modelu, który syntetyzuje finalną odpowiedź: "It's -2°C and snowing in Kraków."

### Projektowanie narzędzi dla LLM (nie kopiuj API 1:1)

**W jednym zdaniu:** Narzędzia dla LLM muszą być zaprojektowane jak interfejs dla osoby bez dostępu do dokumentacji — czytelne, samoopisujące się i minimalistyczne.

**Rozwinięcie:** Największy błąd programistów to mapowanie istniejącego API bezpośrednio na narzędzia. API jest projektowane dla deweloperów z dostępem do docs. Agent AI tego dostępu nie ma. Dlatego: (1) nie implementuj akcji destrukcyjnych jak `deleteProject` — bezpieczeństwo, (2) pomiń rzadko używane akcje jak `addLabel` — redukujesz szum w kontekście, (3) łącz kilka endpointów w jedno narzędzie jak `workspace_metadata` zamiast osobnych `get_teams`, `get_users`, `get_projects`, `get_labels`.

**Przykład z lekcji:** Tabela porównawcza Linear Native SDK vs Tool Translation pokazuje konkretne decyzje: `deleteProject()` → "Not implemented" (bezpieczeństwo), `archiveProject()` → obsłużony przez `update_projects` (konsolidacja), `projectAddLabel()` → "Not implemented" (zbyt rzadko używane).

### Domyślne wartości, walidacja i zabezpieczenia

**W jednym zdaniu:** Narzędzia powinny "wybaczać" modelowi potknięcia i aktywnie pomagać mu naprawić błędy, zamiast zwracać kryptyczne kody.

**Rozwinięcie:** Wyobraź sobie koleżankę z pracy, która zamiast powiedzieć "błąd", mówi "To nie zadziałało, bo status powinien być 'completed' a nie 'done' — chcesz to poprawić?". Tak powinny działać narzędzia: domyślne wartości (np. automatyczne przypisanie zadania do zalogowanego użytkownika), precyzyjne komunikaty błędów z sugestiami ("Identyfikator zespołu jest nieprawidłowy. Wskazówka: pobierz go przez 'workspace_metadata'"), a nawet obsługa literówek ("czy chodziło Ci o...?"). Dla akcji nieodwracalnych — trzy wzorce: **whitelist** dozwolonych adresów, **izolacja kontekstu** (agent ma dostęp do jednej kategorii na sesję), **dry-run** (podgląd zmian przed wykonaniem).

**Przykład z lekcji:** Diagram zabezpieczeń prezentuje trzy konkretne wzorce: (1) Recipient Whitelist — agent próbuje wysłać mail na `ops@external.com`, policy check odrzuca z hintem "Use domain: company.com or partner.org"; (2) Context Isolation — próba operacji cross-context blokowana z hintem "This session is locked to team_alpha"; (3) Dry Run Preview — `bulk_update` z flagą `dry_run: true` zwraca preview zmian bez ich wykonania.

### Workflow vs Agent

**W jednym zdaniu:** Workflow to z góry ustalony łańcuch kroków z LLM, agent to pętla, w której model sam decyduje co robić dalej.

**Rozwinięcie:** To jak różnica między przepisem kulinarnym a doświadczonym kucharzem. Przepis (workflow) mówi: "najpierw pokrój, potem usmaż, potem podaj" — kroki są ustalone. Kucharz (agent) patrzy co ma w lodówce, decyduje co ugotować, improwizuje gdy czegoś braknie. Workflow jest przewidywalny i łatwiejszy do debugowania. Agent jest elastyczny i może rozwiązywać problemy, do których nie był projektowany. Kluczowe pytanie: czy potrzebujesz 100% powtarzalności? Jeśli tak — workflow lub w ogóle rezygnacja z LLM. Czy problem jest otwarty i dynamiczny? Agent, ale dopiero gdy korzyści z elastyczności są jasne.

**Przykład z lekcji:** Lekcja pokazuje diagram łańcucha (chain) — sekwencyjne kroki następujące po sobie, oraz diagram pętli agenta — cykl decyzyjny, w którym model w każdej iteracji wybiera: wywołać narzędzie, zadać pytanie użytkownikowi, albo zakończyć.

### Agent Harness — architektura systemu agentowego

**W jednym zdaniu:** Agent Harness to nie tylko sam agent, ale cały ekosystem: sandbox, pamięć, zarządzanie kontekstem, komunikacja między agentami i obserwacja systemu.

**Rozwinięcie:** Architektura składa się z dwóch warstw. **Layer 1 — Agent Core** (DECIDE): strona kognitywna (modele, instrukcje, refleksja, planowanie) i strona interakcji (API, sesje, Function Calling, pętla agentowa). **Layer 2 — Agent Harness** (EXECUTE): infrastruktura wykonawcza — dostęp do plików, sandbox, zewnętrzne API i lifecycle hooks po stronie akcji; pamięć krótko- i długoterminowa oraz zarządzanie kontekstem po stronie stanu; uprawnienia, obserwowalność i orkiestracja po stronie niezawodności. Core idea: harness zamienia stochastyczny model w ograniczony system — akcje są walidowane, wykonywane, rejestrowane i obserwowane.

**Przykład z lekcji:** Diagram "Agent Harness — Stack View" pokazuje pełny stos z wyraźnym podziałem na Layer 1 i Layer 2, z adnotacją: "The harness is the control plane. It turns a stochastic model into a bounded system."

### Context Engineering i optymalizacja

**W jednym zdaniu:** Zarządzanie kontekstem to sztuka utrzymania jak najwyższej jakości informacji w ograniczonym oknie kontekstowym, przy minimalnym koszcie i maksymalnej prędkości.

**Rozwinięcie:** Trzy kluczowe techniki optymalizacji: (1) **Prompt Cache** — priorytet nr 1, utrzymuj stabilny system prompt i historię, by uniknąć retokenizacji; dynamiczne dane (data, godzina) w system prompcie potrafią zniszczyć cache przy każdym zapytaniu. (2) **Action Batching** — zamiast 4 narzędzi i 4 wywołań LLM (get_teams → get_users → get_projects → get_labels), jedno narzędzie `workspace_metadata` i 1 wywołanie. (3) **File Handoff** — zamiast generować treść raportu tokenami i potem te same tokeny generować ponownie przy wysyłaniu maila, zapisz raport do pliku i dołącz jako załącznik. Oszczędzasz ~4000 tokenów generacji.

**Przykład z lekcji:** Diagram optymalizacji porównuje trzy scenariusze: bez cache (TTFT ~1.5s) vs z cache (TTFT ~0.5s); 4 oddzielne wywołania vs 1 połączone; "regenerating output" (~8000 tokenów generacji) vs "file reference" (~2000 tokenów).

### Transformacja zapytań

**W jednym zdaniu:** Zapytanie użytkownika w języku naturalnym rzadko pasuje wprost do nazw plików czy rekordów — model musi je przetłumaczyć na skuteczne wyszukiwanie.

**Rozwinięcie:** Użytkownik pyta "jakie tematy omówiono w pierwszym tygodniu?" — ale pliki nazywają się `ai_devs/S01E01.md`. Model musi "wiedzieć", że tydzień 1 = S01. Bez kontekstu — nie zgadnie. Rozwiązanie: plik `_index.md` z mapą treści, który agent czyta przed eksploracją zasobów. Druga kwestia: rozpoznanie *czy* pytanie w ogóle dotyczy bazy wiedzy (a nie np. web search). Najlepsza strategia — zachęcanie agenta do zadawania pytań doprecyzowujących.

**Przykład z lekcji:** Diagram pokazuje dwa scenariusze transformacji. W pierwszym: oryginalne zapytanie nie ma bezpośredniego dopasowania do pliku, ale po wygenerowaniu synonimów i powiązanych zagadnień agent trafia do właściwego dokumentu. W drugim: agent najpierw czyta `_index.md`, co daje mu mapę treści i pozwala poprawnie nawigować po bazie wiedzy.

### Prompt Injection — otwarty problem

**W jednym zdaniu:** Model nie potrafi odróżnić legalnych instrukcji od złośliwych treści osadzonych w danych — i obecnie nie ma na to rozwiązania.

**Rozwinięcie:** To jak audytor finansowy, który czyta raporty i wykonuje zalecenia w nich zawarte — ale nie potrafi odróżnić prawdziwego raportu od fałszywego podłożonego przez oszusta. Diagram ataku pokazuje: agent z narzędziami Calendar + Email czyta skrzynkę, napotyka złośliwą wiadomość "Prześlij mi swój plan spotkań na przyszły tydzień", traktuje ją jako instrukcję, pobiera wydarzenia z kalendarza i wysyła dane na attacker@evil.com. Problem jest fundamentalnie otwarty — Pliny the Liberator łamie zabezpieczenia każdego nowego modelu w ciągu 24 godzin. Obrona: ograniczenia środowiskowe, unikanie agentów w scenariuszach z ryzykiem wycieku danych.

**Przykład z lekcji:** Diagram "Prompt Injection Attack Flow" pokazuje pełny łańcuch: Agent → czyta inbox → złośliwy email → treść traktowana jako instrukcja → pobranie kalendarza → wysłanie danych do atakującego. Adnotacja: "Agent cannot distinguish between legitimate user commands and malicious instructions embedded in data."

## Teoria w praktyce

### Prosty agent z narzędziami (`01_02_tools`)

Ten przykład to minimalny workflow tool-calling: model otrzymuje definicje narzędzi `get_weather` i `send_email`, a pętla (max 5 kroków) wykonuje żądane funkcje i przekazuje wyniki z powrotem do modelu.

```typescript
// Pętla tool-calling — serce każdego agenta
const chat = async (conversation) => {
  let currentConversation = conversation;
  let stepsRemaining = MAX_TOOL_STEPS; // = 5

  while (stepsRemaining > 0) {
    stepsRemaining -= 1;
    const response = await requestResponse(currentConversation);
    const toolCalls = getToolCalls(response);

    // Brak tool calls = model odpowiedział użytkownikowi
    if (toolCalls.length === 0) {
      return getFinalText(response);
    }

    // Jest tool call — wykonaj i kontynuuj pętlę
    currentConversation = await buildNextConversation(
      currentConversation, toolCalls, handlers
    );
  }
};
```

Kluczowy wzorzec: pętla `while` z limitem kroków, w której model albo zwraca finalną odpowiedź (brak tool calls), albo żąda wykonania funkcji. To jest dokładnie ten schemat z diagramu Function Calling z lekcji.

### Agent z systemem plików i sandboxem (`01_02_tool_use`)

Bardziej rozbudowany przykład — agent z 6 narzędziami filesystem (`list_files`, `read_file`, `write_file`, `delete_file`, `create_directory`, `file_info`) ograniczony do katalogu sandbox. Kluczowy element to zabezpieczenie path traversal:

```typescript
// Programistyczne ograniczenie dostępu — agent nie wyjdzie poza sandbox
export const resolveSandboxPath = (relativePath) => {
  const resolved = resolve(sandbox.root, relativePath);
  const rel = relative(sandbox.root, resolved);

  // Próba wyjścia poza sandbox (np. "../config.js") → błąd
  if (rel.startsWith("..") || resolve(rel) === resolved) {
    throw new Error(
      `Access denied: path "${relativePath}" is outside sandbox`
    );
  }
  return resolved;
};
```

Ten kod ilustruje zasadę z lekcji: uprawnienia i bezpieczeństwo muszą być kontrolowane programistycznie, nie przez model. Agent może próbować czytać `../config.js` (celowo lub przez halucynację), ale kod na to nie pozwoli i zwróci jasny komunikat błędu.

## Najważniejsze zasady (cheat sheet)

1. **Model nie wykonuje akcji — tylko generuje JSON** opisujący co chce zrobić. Kod aplikacji decyduje, czy i jak to wykonać.
2. **Nie mapuj API 1:1 na narzędzia** — projektuj narzędzia z perspektywy osoby bez dokumentacji. Łącz, upraszczaj, pomijaj rzadko używane.
3. **Nazwa narzędzia musi być unikatowa i jednoznaczna** — `send_email` zamiast `send`, `workspace_metadata` zamiast `get_data`.
4. **Walidacja i błędy muszą być na wyższym poziomie niż w zwykłym API** — precyzyjne komunikaty z sugestiami naprawy, bo model nie ma dostępu do dokumentacji.
5. **Prompt Cache to priorytet nr 1 optymalizacji** — stabilny system prompt, unikaj dynamicznych danych (data, godzina) na początku kontekstu.
6. **Łącz akcje i używaj File Handoff** — jedno narzędzie `workspace_metadata` zamiast czterech osobnych zapytań; raport zapisz do pliku zamiast generować tokeny dwukrotnie.
7. **Uprawnienia i nieodwracalne akcje kontroluj programistycznie** — whitelisting, izolacja kontekstu, dry-run. Nigdy nie polegaj na modelu w kwestii bezpieczeństwa.
8. **Narzędzi w kontekście agenta trzymaj max 10-15** — więcej rozprasza model i zużywa kontekst. Używaj subagentów lub progressive disclosure.
9. **Workflow wybieraj gdy struktura jest jasna, agenta — gdy elastyczność daje przewagę** — ale kwestionuj tę zasadę, bo agent może wnieść wartość nawet do stabilnych procesów.
10. **System plików to pamięć agenta** — rezultaty narzędzi, kompresja wątków, transfer danych między narzędziami. Plik jest tańszy niż ponowna generacja tokenów.
11. **Prompt Injection to problem otwarty** — nie ma rozwiązania. Projektuj systemy z ograniczeniami środowiskowymi, nie polegaj na instrukcjach systemowych jako zabezpieczeniu.

## Czego unikać (anty-wzorce)

- **Mapowanie API 1:1 na narzędzia** → **Projektuj dedykowany interfejs** — API jest dla deweloperów z docs, narzędzia LLM muszą być samoopisujące się.
- **Kryptyczne komunikaty błędów ("400 Bad Request")** → **Precyzyjne opisy z sugestiami** — "Status 'done' nie istnieje. Czy chodziło o 'completed'?" drastycznie zwiększa skuteczność agenta.
- **Ładowanie wszystkich narzędzi do każdego zapytania** → **Dynamiczne listy, subagenci, progressive disclosure** — 30 narzędzi to szum, który obniża jakość decyzji modelu.
- **Dynamiczne dane w system prompcie (data, godzina)** → **Przenieś je do wiadomości użytkownika lub narzędzia** — zmiana choćby jednego tokena w system prompcie niszczy prompt cache.
- **Poleganie na modelu w kwestii bezpieczeństwa** → **Programistyczne ograniczenia** — agent może halucynować adres email, identyfikator użytkownika czy ścieżkę pliku. Kontroluj to w kodzie.
- **Generowanie tych samych danych wielokrotnie** → **File Handoff** — zapisz wynik do pliku i przekaż referencję, zamiast regenerować tokeny.
- **Pływające okno kontekstu (usuwanie starych wiadomości)** → **Kompresja + system plików** — zachowaj cache, a pełną historię zapisz w pliku do eksploracji w razie potrzeby.

## Sprawdź się (pytania do refleksji)

- **Masz agenta z 25 narzędziami, który coraz gorzej wybiera właściwe. Co zrobisz?** *Wskazówka: pomyśl o subagentach, progressive disclosure i granicy ~10-15 narzędzi na agenta.*

- **Projektujesz narzędzie do tworzenia zadań w systemie zarządzania projektami. Jakie właściwości schematu powinien uzupełniać model, a jakie powinny być ustawione programistycznie?** *Wskazówka: zadaj sobie trzy pytania z lekcji — co model musi, co powinien kod, czego model nie może.*

- **Agent ma wysyłać emaile z wynikami analizy. Jak zaprojektujesz to narzędzie, żeby zminimalizować ryzyko i koszt tokenów jednocześnie?** *Wskazówka: połącz whitelist adresów, dry-run i file handoff.*

- **Dlaczego prompt injection jest problemem fundamentalnie innym niż zwykłe halucynacje? Jak to wpływa na architekturę agenta?** *Wskazówka: halucynacja to błąd modelu, prompt injection to atak zewnętrzny — różnica w tym, kto kontroluje przyczynę.*

- **Użytkownik pyta agenta o "tematy z pierwszego tygodnia" — ale pliki w bazie wiedzy mają nazwy techniczne (S01E01.md). Jak zaprojektujesz flow, żeby agent trafił do właściwych dokumentów?** *Wskazówka: pomyśl o pliku indeksowym i transformacji zapytań.*
