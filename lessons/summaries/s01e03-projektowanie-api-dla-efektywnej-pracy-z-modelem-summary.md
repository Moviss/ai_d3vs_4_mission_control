# Projektowanie API dla efektywnej pracy z modelem — Podsumowanie

## O czym jest ta lekcja? (TL;DR)

Lekcja S01E02 pokazała zasady łączenia LLM z narzędziami z lotu ptaka. Ta lekcja schodzi na ziemię — uczy, jak **produkcyjnie** projektować interfejsy narzędzi (na przykładzie systemu plików), jak budować **serwery MCP** i łączyć je z natywnymi narzędziami, oraz jak podejmować decyzje architektoniczne: ile narzędzi, jakie schematy, co w odpowiedziach zwracać, a czego nie. Kluczowy wniosek: dobry interfejs narzędzia to nie kopia API, lecz przemyślany produkt z dynamicznymi wskazówkami, checksum'ami i dry-run'em.

## Mapa koncepcji

- **Audyt API przed budowaniem narzędzi** — co sprawdzić zanim zaczniesz projektować
  - **Konsolidacja narzędzi** — 13 akcji → 4 narzędzia (Search, Read, Write, Manage)
  - **Produkcyjne schematy** — tryby, defaults, ograniczenia kontekstu, walidacja ścieżek
    - **Dynamiczne hints** — wskazówki zarówno przy błędach, jak i sukcesach
    - **Checksum + dry-run** — ochrona przed nadpisaniem i podgląd zmian
- **Model Context Protocol (MCP)** — standard łączenia LLM z narzędziami
  - **Host / Client / Server** — trzy role w architekturze MCP
  - **Komponenty MCP** — Tools, Resources, Prompts, Sampling, Elicitation, Apps
  - **STDIO vs Streamable HTTP** — transport lokalny vs zdalny
- **Łączenie natywnych + MCP narzędzi** — model nie rozróżnia źródła narzędzia
- **Workflow vs Agent (tłumacz)** — stała sekwencja vs samokorygujaąca się pętla
- **Bezpieczeństwo i autoryzacja** — programistyczne ograniczenia, OAuth, zarządzanie konfliktami nazw

## Kluczowe koncepcje

### Audyt API i konsolidacja narzędzi

**W jednym zdaniu:** Zanim zaczniesz budować narzędzia, przeskanuj API pod kątem problemów — brakujących akcji, niejasnych referencji, pollingu, rate limitów — bo nie wszystko da się naprawić na warstwie narzędzi.

**Rozwinięcie:** Pomyśl o tym jak o inspekcji budynku przed remontem. Jeśli fundamenty (API) mają problemy, najlepszy architekt wnętrz (warstwa narzędzi) ich nie naprawi. Sprawdź: czy API wymaga identyfikatorów, których model nie zna? Czy odpowiedzi zawierają wystarczające informacje, czy tylko status 201? Czy istnieją mechanizmy pollingu lub rate limity, które trzeba obsłużyć programistycznie? Najlepsze podejście: wgraj SDK lub docs do kontekstu agenta kodującego i przeprowadź z nim rozmowę, generując notatki.

**Przykład z lekcji:** Oficjalny Filesystem MCP udostępnia **13 narzędzi** (read_text_file, read_media_file, read_multiple_files, write_file, edit_file, create_directory, list_directory, list_directory_with_sizes, move_file, search_files, directory_tree, get_file_info, list_allowed_directories). Diagram konsolidacji pokazuje, jak te 13 narzędzi redukuje się do **4**: Search (wyszukiwanie plików + drzewo + info + lista katalogów), Read (pliki tekstowe + binarne + wiele naraz), Write (zapis + edycja), Manage (tworzenie katalogów + przenoszenie + listowanie).

### Produkcyjne schematy narzędzi (fs_read, fs_write, fs_search, fs_manage)

**W jednym zdaniu:** Narzędzie produkcyjne to nie prosty wrapper na API — to interfejs z trybami pracy, dynamicznymi wskazówkami, walidacją ścieżek i ochroną przed pomyłkami modelu.

**Rozwinięcie:** Weźmy `fs_read` — jedno narzędzie obsługuje dwa tryby (plik i katalog), współdzieli strukturę parametrów, ale zwraca różne odpowiedzi. Kluczowe cechy produkcyjnego narzędzia: (1) **proste nazwy** właściwości, (2) **minimalna ilość danych** z opcją detali, (3) **rozwiązywanie ścieżek** — gdy model poda samą nazwę pliku zamiast pełnej ścieżki, (4) **ograniczenia kontekstu** — gdy katalog zawiera zbyt dużo plików, zwracamy paginowane wyniki z hintem. Dla `fs_write` dodajemy **checksum** (agent nie może nadpisać pliku zmienionego w międzyczasie) i **dryRun** (podgląd zmian przed ich wykonaniem). Dla `fs_manage` — usuwanie ograniczone do pojedynczych plików i pustych katalogów.

**Przykład z lekcji:** Schemat `fs_write` wymaga checksum'u przy edycji, a bez niego zwraca błąd z hintem "Read the file first to get the current checksum." Tryb dryRun pozwala agentowi zobaczyć, jak będzie wyglądał dokument po zmianach, bez ich faktycznego zapisania.

### Dynamiczne wskazówki (hints) w odpowiedziach

**W jednym zdaniu:** Odpowiedzi narzędzi powinny "prowadzić" model za rękę — nie tylko przy błędach, ale też po sukcesie, informując co robić dalej.

**Rozwinięcie:** W zwykłym API komunikat "201 Created" wystarczy programiście. Agent AI potrzebuje więcej: "Plik utworzony pod ścieżką /docs/report.md. Przeczytaj go ponownie przed edycją." Pięć kategorii dynamicznych wskazówek: (1) **błąd operacji** — co poszło nie tak + co można zrobić, (2) **status zasobu** — "dokument jest chroniony przed zapisem", (3) **sugestie dalszych kroków** — "Znaleziono 3 dokumenty. Wczytaj ich treść przed edycją", (4) **korekta wartości** — "Żądano linii 48-70, plik ma 59 linii. Wczytano 48-59", (5) **dostępne opcje** — "Błędna etykieta. Dostępne: X, Y, Z". Te wskazówki generowane są dynamicznie przez kod, co zwiększa jego złożoność — ale dziś AI pomaga zarówno w planowaniu, jak i w implementacji.

**Przykład z lekcji:** Nawet przy sukcesie — narzędzie `fs_write` zwraca ścieżkę do zmodyfikowanego pliku, co "wzmacnia" zachowanie modelu i pozwala mu wykorzystać ten plik w kolejnych akcjach. Bez tego model musi "zapamiętać" ścieżkę z wcześniejszych kroków.

### Model Context Protocol (MCP) — architektura

**W jednym zdaniu:** MCP to standard, dzięki któremu raz stworzoną paczkę narzędzi podłączysz do Claude, Cursor, ChatGPT i dowolnego innego hosta — bez przepisywania integracji.

**Rozwinięcie:** MCP rozwiązuje problem N×M: bez standardu każdy host (Claude, Cursor, ChatGPT) musi mieć dedykowaną integrację z każdym serwisem. Z MCP wystarczy jeden serwer, wiele hostów. Architektura: **Host** (aplikacja, np. Claude) tworzy **Client** (połączenie), który łączy się z **Server** (paczka narzędzi). Ale MCP to nie tylko narzędzia — protokół definiuje też: **Resources** (statyczne/dynamiczne dane do odczytu), **Prompts** (predefiniowane instrukcje z dynamicznymi parametrami), **Sampling** (serwer prosi hosta o zapytanie do modelu), **Elicitation** (serwer prosi użytkownika o dane), **Apps** (interaktywne interfejsy w odpowiedzi agenta). Większość obecnych serwerów MCP wykorzystuje tylko narzędzia — reszta dopiero się kształtuje.

**Przykład z lekcji:** Diagram "MCP + Native Tools + Unified Toolset" pokazuje, jak w jednej aplikacji łączy się narzędzia natywne (np. `calculate`) z narzędziami MCP (np. `get_weather`). Oba źródła sprowadzane są do jednego unified handler map — model nie wie i nie musi wiedzieć, skąd pochodzi narzędzie.

### STDIO vs Streamable HTTP

**W jednym zdaniu:** STDIO to transport dla procesów lokalnych (desktop, CLI), Streamable HTTP to domyślny wybór dla serwerów zdalnych z obsługą wielu użytkowników i OAuth.

**Rozwinięcie:** To jak różnica między USB a WiFi. **STDIO** uruchamia serwer MCP jako lokalny proces — świetne dla narzędzi jak ffmpeg, system plików, CLI. Każde połączenie = nowy proces, więc sprawdza się tylko dla jednego użytkownika (aplikacje desktopowe). **Streamable HTTP** to serwer na VPS lub Cloudflare Workers, obsługujący sesje wielu użytkowników, z OAuth 2.1. Powinien być domyślnym wyborem przy budowie nowych serwerów MCP.

**Przykład z lekcji:** Przykład `01_03_mcp_translator` używa STDIO do połączenia z lokalnym serwerem Files MCP — agent tłumaczący dokumenty działa na tej samej maszynie co system plików. Natomiast serwer uploadthing jest deployowany przez Cloudflare Workers jako Streamable HTTP.

### Workflow vs Agent — przykład tłumacza

**W jednym zdaniu:** Workflow to stała sekwencja kroków (Split → Translate → Merge), agent to samokorygująca się pętla, która czyta, tłumaczy, weryfikuje i poprawia w dowolnej kolejności.

**Rozwinięcie:** Diagram porównawczy z lekcji klarownie to ilustruje. **Workflow**: Step 1 Split → Step 2 Translate → Step 3 Merge, adnotacja: "Fixed sequence. No recovery." Jeśli tłumaczenie fragmentu jest błędne, nie ma mechanizmu korekty. **Agent**: centralny loop "Decide → Act" połączony dwukierunkowo z Read, Write, Translate, Review. Adnotacja: "Any order. Self-correcting. 0 repeats until done." Agent może wrócić do pliku, przeczytać go ponownie, poprawić tłumaczenie i zweryfikować wynik. Kluczowa decyzja architektoniczna: jeśli chcesz aby agent **zawsze** realizował zadanie według ustalonej sekwencji — zbuduj workflow. Agent daje elastyczność, ale wymaga lepszych narzędzi i instrukcji.

**Przykład z lekcji:** Agent tłumaczący (`01_03_mcp_translator`) używa pętli z limitem 80 kroków i narzędzi MCP do interakcji z systemem plików. Pętla obserwuje katalog `translate/`, wykrywa nowe pliki, uruchamia agenta z prostym promptem `Translate "${sourcePath}" to English and save to "${targetPath}"`, a agent sam decyduje o kolejności kroków (czytanie, tłumaczenie, weryfikacja, zapis).

### Spec-driven budowanie serwerów MCP

**W jednym zdaniu:** Serwery MCP buduje się z AI — wgraj docs API i szablon, poproś o listę narzędzi, zoptymalizuj ją zasadami z lekcji, zaimplementuj.

**Rozwinięcie:** Proces jest powtarzalny: (1) pobierz szablon serwera MCP, (2) utwórz API.md z dokumentacją integrowanego serwisu, (3) wgraj README.md i manual.md szablonu do kontekstu agenta, (4) poproś o sugerowaną listę narzędzi, (5) zastosuj zasady: ogranicz liczbę, połącz pokrewne, odrzuć rzadko używane, (6) zaprojektuj schematy input/output z hintsami, (7) zaimplementuj z agentem, (8) weryfikuj i iteruj. Kluczowe: wiedza o MCP w modelach może być nieaktualna — trzeba "przypominać" modelowi o dokumentacji.

**Przykład z lekcji:** Przykład `01_03_upload_mcp` — serwer MCP dla uploadthing.com, stworzony na podstawie szablonu. Agent z tym serwerem wgrywa pliki z katalogu `workspace/` do chmury i zapisuje linki w pliku `uploaded.md`.

### Bezpieczeństwo, prywatność i zarządzanie wieloma serwerami

**W jednym zdaniu:** Wewnętrzny serwer MCP to kontrolowane środowisko; publiczny serwer to otwarte pole minowe — musisz stosować programistyczne ograniczenia, bo nie wiesz kto i jak go użyje.

**Rozwinięcie:** Wewnętrznie kontrolujesz zasoby, znasz listę narzędzi, rozumiesz procesy, możesz edukować użytkowników. Przy publikacji tracisz tę wiedzę: nie wiesz jakie inne serwery podłączył użytkownik, jakie dane przetwarza agent, czy ktoś nie próbuje ataku. Podstawy: blokady dostępu, limity zapytań, walidacja, anonimizacja. Ale też: niektóre akcje **nie powinny** być dostępne dla agentów. Przy wielu serwerach — prefixowanie nazw (`gmail__search`, `resend__send`), zarządzanie profilami aktywnych narzędzi, twardy limit na liczbę jednocześnie aktywnych narzędzi.

**Przykład z lekcji:** Host powinien prezentować narzędzia w formie `resend__send` i `gmail__search` — użytkownik nie może dodać dwóch serwerów o tej samej nazwie, co eliminuje kolizje.

## Teoria w praktyce

### Łączenie natywnych i MCP narzędzi (`01_03_mcp_native`)

Przykład pokazuje, jak w jednej aplikacji agent korzysta zarówno z narzędzi MCP (get_weather, get_time), jak i natywnych JS (calculate, uppercase). Model nie widzi różnicy — oba źródła są zunifikowane w jeden handler map.

```javascript
// Unified handler map — MCP i natywne narzędzia za tym samym interfejsem
const handlers = Object.fromEntries([
  // Narzędzia MCP — wywołanie przez klienta MCP
  ...mcpTools.map((t) => [t.name, {
    execute: (args) => callMcpTool(mcpClient, t.name, args),
    label: MCP_LABEL
  }]),
  // Narzędzia natywne — zwykłe funkcje JS
  ...Object.entries(nativeHandlers).map(([name, fn]) => [name, {
    execute: fn,
    label: NATIVE_LABEL
  }])
]);

// Schematy z obu źródeł trafiają na jedną listę
const tools = [...mcpToolsToOpenAI(mcpTools), ...nativeTools];
```

Kluczowe: schematy MCP konwertowane są do formatu OpenAI Function Calling (`mcpToolsToOpenAI`), a handlersy unifikowane pod wspólnym interfejsem `{ execute, label }`. Dla modelu nie ma różnicy między "get_weather" (MCP) a "calculate" (natywne).

### Agent tłumaczący z pętlą obserwacji (`01_03_mcp_translator`)

Agent łączy się z serwerem Files MCP, obserwuje katalog `translate/` i automatycznie tłumaczy nowe pliki. Architektura: file watcher → agent loop (max 80 kroków) → narzędzia MCP filesystem.

```javascript
// Pętla agenta — czat → narzędzia → wyniki → powtórz aż skończone
export const run = async (query, { mcpClient, mcpTools }) => {
  const tools = mcpToolsToOpenAI(mcpTools);
  const messages = [{ role: "user", content: query }];

  for (let step = 1; step <= MAX_STEPS; step++) {
    const response = await chat({ input: messages, tools });
    const toolCalls = extractToolCalls(response);

    if (toolCalls.length === 0) {
      // Model odpowiedział — koniec pętli
      return { response: extractText(response), toolCalls: history };
    }

    // Wykonaj narzędzia i dodaj wyniki do kontekstu
    messages.push(...response.output);
    const results = await runTools(mcpClient, toolCalls);
    messages.push(...results);
  }
};
```

Prompt jest minimalny: `Translate "${sourcePath}" to English and save to "${targetPath}"`. Agent sam decyduje: czytać plik, tłumaczyć fragmenty, zapisywać wynik, weryfikować. To właśnie różnica między workflow (ustalona sekwencja) a agentem (dynamiczne decyzje).

### Narzędzia MCP filesystem produkcyjnie (`files-stdio-mcp-server`)

Kod z repozytorium files-stdio-mcp-server pokazuje, jak translator korzysta z narzędzi: `fs_read` z trybem "list" do skanowania katalogu, `fs_manage` z operacją "mkdir" do tworzenia katalogów.

```javascript
// Skanowanie katalogu — fs_read z mode: "list"
const listFiles = async (mcpClient, dir) => {
  const result = await callMcpTool(mcpClient, "fs_read", {
    path: dir,
    mode: "list"   // Tryb listowania — zwraca entries z name i kind
  });
  return result.entries
    .filter(e => e.kind === "file")
    .map(e => e.name);
};

// Tworzenie katalogów — fs_manage z operation: "mkdir"
await callMcpTool(mcpClient, "fs_manage", {
  operation: "mkdir",
  path: config.sourceDir,
  recursive: true
});
```

Jedno narzędzie `fs_read` obsługuje zarówno czytanie plików, jak i listowanie katalogów — wystarczy zmienić `mode`. To właśnie konsolidacja 13 narzędzi do 4 w akcji.

## Najważniejsze zasady (cheat sheet)

1. **Przed budowaniem narzędzi przeskanuj API** — brakujące akcje, niejasne referencje, polling, rate limity to problemy, których nie naprawisz na warstwie schematów.
2. **Konsoliduj narzędzia, ale zachowaj przejrzystość** — 13 akcji filesystem → 4 narzędzia z trybami. Cel: balans między liczbą schematów a skutecznością modelu.
3. **Każde narzędzie powinno mieć tryby i opcje szczegółowości** — `fs_read` z `mode: "list"` vs `mode: "content"`, z opcją `details: true`. Jeden schemat, wiele zachowań.
4. **Dynamiczne hints to standard, nie luksus** — wskazówki przy sukcesach i błędach, korekty automatyczne, sugestie dalszych kroków. Zwiększa złożoność kodu, ale AI pomaga go pisać.
5. **Checksum + dryRun dla akcji modyfikujących** — checksum chroni przed nadpisaniem zmienionego pliku, dryRun pozwala na podgląd zmian. Razem eliminują dużą klasę błędów.
6. **MCP to sposób dystrybucji narzędzi, nie alternatywa** — natywne i MCP narzędzia łączy się w jedną listę. Model nie wie i nie musi wiedzieć, skąd pochodzi narzędzie.
7. **STDIO dla procesów lokalnych, Streamable HTTP domyślnie** — STDIO = jeden użytkownik, desktop/CLI. Streamable HTTP = wielu użytkowników, VPS/Cloudflare, OAuth.
8. **Serwery MCP buduj z AI na szablonie** — wgraj API docs + szablon do kontekstu, iteruj. "Przypominaj" modelowi o dokumentacji MCP, bo jego wiedza może być nieaktualna.
9. **Prefixuj nazwy narzędzi w hoście** — `gmail__search` zamiast `search`. Eliminuje kolizje między serwerami i zwiększa czytelność dla modelu.
10. **Wewnętrzny MCP ≠ publiczny MCP** — publikując serwer, tracisz wiedzę o hoście i procesach. Stosuj programistyczne blokady, limity, walidację. Niektóre akcje po prostu nie mogą być dostępne dla agentów.
11. **Odpowiedzi przy sukcesie powinny "wzmacniać" model** — zwracaj ścieżkę do pliku, status zasobu, sugestie dalszych kroków. Model nie musi "pamiętać" — wystarczy, że przeczyta odpowiedź narzędzia.

## Czego unikać (anty-wzorce)

- **Mapowanie 1:1 akcji API na narzędzia MCP** → **Konsoliduj powiązane akcje** — 13 narzędzi filesystem to szum; 4 z trybami to klarowność. Model lepiej radzi sobie z mniejszą liczbą dobrze zaprojektowanych narzędzi.
- **Generyczne komunikaty "operacja udana"** → **Dynamiczne hints z kontekstem** — "Plik zapisany" to za mało. "Plik zapisany pod /docs/report.md. Checksum: abc123. Przeczytaj go, aby zweryfikować." daje modelowi pełen kontekst do dalszych działań.
- **Brak ochrony przed nadpisaniem** → **Checksum + dryRun** — bez checksum'u agent może nadpisać plik zmieniony w międzyczasie przez inny proces lub użytkownika. Bez dryRun nie zobaczy efektu zmian przed ich wykonaniem.
- **Bezpośrednie mapowanie wszystkich akcji API na publiczny serwer MCP** → **Selekcja i ograniczenie** — nie każda akcja API powinna być dostępna dla agenta. Usuwanie, masowe operacje, zmiana uprawnień — rozważ czy w ogóle chcesz je udostępniać.
- **Generyczne nazwy narzędzi (send, get, search)** → **Unikatowe nazwy z namespace'em** — w środowisku wielu serwerów MCP, `send` kolizjuje z wieloma innymi. `resend__send_email` jest jednoznaczne.
- **Workflow tam, gdzie potrzebna jest samokorekta** → **Agent z pętlą i limitem kroków** — tłumaczenie w stałej sekwencji (split-translate-merge) nie pozwala na weryfikację i poprawki. Agent z 80 krokami sam decyduje, kiedy wynik jest wystarczający.

## Sprawdź się (pytania do refleksji)

- **Masz API z 20 endpointami do zarządzania projektami. Jak zdecydujesz, które z nich zamienić na narzędzia MCP, a które pominąć lub połączyć?** *Wskazówka: pomyśl o częstotliwości użycia, bezpieczeństwie akcji i liczbie kroków potrzebnych modelowi do wykonania typowego zadania.*

- **Twój agent edytuje pliki, ale czasami nadpisuje zmiany wprowadzone przez użytkownika w międzyczasie. Jak zaprojektujesz narzędzie `write`, żeby temu zapobiec?** *Wskazówka: pomyśl o weryfikacji stanu pliku przed zapisem i o podglądzie zmian.*

- **Projektujesz publiczny serwer MCP integrujący się z systemem CRM. Jakie ograniczenia zastosujesz, wiedząc, że nie kontrolujesz ani hosta, ani innych podłączonych serwerów?** *Wskazówka: pomyśl o tym, czego nie wiesz — jakie inne narzędzia ma agent, jakie dane przetwarza, kto go używa.*

- **Kiedy wybrałbyś STDIO zamiast Streamable HTTP dla serwera MCP? A kiedy Streamable HTTP byłby złym wyborem?** *Wskazówka: pomyśl o tym, kto jest użytkownikiem (jedna osoba vs wielu), gdzie działa serwer i czy potrzebuje dostępu do lokalnych zasobów.*

- **Twój agent tłumaczący dokumenty działa jako workflow (split → translate → merge). Użytkownik zgłasza, że fragmenty tłumaczeń bywają niespójne stylistycznie. Jak zmieniłbyś architekturę?** *Wskazówka: pomyśl o tym, co agent mógłby zrobić po przetłumaczeniu fragmentu, gdyby miał możliwość wrócenia i porównania z innymi fragmentami.*
