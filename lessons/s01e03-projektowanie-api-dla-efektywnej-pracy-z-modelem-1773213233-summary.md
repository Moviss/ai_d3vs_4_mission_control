# Projektowanie API dla efektywnej pracy z modelem — Podsumowanie

## TL;DR
Lekcja pokazuje, jak projektować narzędzia (Function Calling / MCP) tak, aby modele językowe mogły z nich efektywnie korzystać. Kluczowe jest grupowanie akcji API w mniejszą liczbę przemyślanych narzędzi, projektowanie dynamicznych odpowiedzi z podpowiedziami dla modelu oraz świadome podejście do bezpieczeństwa. Omawia też Model Context Protocol — jego architekturę, komponenty, autoryzację i praktyczne wdrożenie.

## Kluczowe koncepcje

### Audyt API przed budową narzędzi
Zanim zaczniemy projektować narzędzia, trzeba przeanalizować API pod kątem: brakujących akcji, sposobu identyfikacji zasobów (ID vs nazwa), niespójności w strukturach zapytań/odpowiedzi, skomplikowanych relacji wymagających wielu kroków, mechanizmów pollingu i rate limitu (które powinny być obsłużone w kodzie, nie przez agenta), oraz ustawień paginacji i wyszukiwania.

### Grupowanie narzędzi — mniej znaczy lepiej
Oficjalny Filesystem MCP oferuje 13 narzędzi do operacji na plikach. W praktyce można je zredukować do 4 (fs_search, fs_read, fs_write, fs_manage), grupując powiązane akcje. Celem nie jest minimalizacja liczby schematów za wszelką cenę, lecz znalezienie balansu między liczbą narzędzi a skutecznością ich obsługi przez model.

### Dynamiczne odpowiedzi z podpowiedziami (hints)
Narzędzia powinny zwracać nie tylko wynik operacji, ale też dynamicznie generowane wskazówki dla modelu — co zrobić dalej, jakie opcje są dostępne, jakie korekty zostały wprowadzone. Dotyczy to zarówno błędów, jak i sukcesów. Np. po wyszukaniu plików: „Znaleziono 3 dokumenty. Przed ich edycją wczytaj wcześniej ich treść."

### Zabezpieczenia narzędzi zapisujących dane
Dla akcji modyfikujących (zapis, edycja, usuwanie) warto stosować mechanizmy takie jak weryfikacja checksum (zapobiega nadpisaniu pliku zmienionego w międzyczasie), tryb dryRun (podgląd wyniku przed faktyczną zmianą) oraz historia zmian umożliwiająca cofnięcie bez angażowania modelu.

### MCP — architektura Host / Client / Server
Model Context Protocol opiera się na trzech rolach: **Host** (aplikacja, np. Claude, Cursor, lub backend), **Client** (zarządza połączeniami) i **Server** (dostarcza narzędzia). Z perspektywy agenta źródło narzędzi nie ma znaczenia — natywne i MCP-owe trafiają na jedną listę schematów Function Calling.

### Komponenty MCP poza narzędziami
Protokół oferuje nie tylko Tools, ale też: **Apps** (interaktywne interfejsy w odpowiedzi agenta), **Resources** (statyczne/dynamiczne dane do odczytu), **Prompts** (predefiniowane instrukcje z dynamicznymi elementami), **Sampling** (odwrócona komunikacja — serwer prosi o wywołanie modelu) i **Elicitation** (prośba do użytkownika o dane lub akcję).

### STDIO vs Streamable HTTP
STDIO sprawdza się do procesów lokalnych (desktopowe aplikacje, CLI) — każde połączenie to nowy proces. Streamable HTTP powinien być domyślnym wyborem przy budowie serwerów MCP — działa na VPS lub Cloudflare Workers, obsługuje sesje użytkowników i OAuth 2.1.

### Generowanie serwerów MCP z pomocą AI
Proces tworzenia serwera MCP na bazie szablonu: pobranie szablonu, przygotowanie dokumentacji API (API.md), wczytanie README.md i manual.md do kontekstu agenta, wspólne zaprojektowanie listy narzędzi, struktury input/output, implementacja, weryfikacja i iteracja. Kluczowe: dostarczyć agentowi aktualną dokumentację protokołu, bo jego wiedza może być nieaktualna.

### Bezpieczeństwo i prywatność
W systemach wewnętrznych mamy kontrolę nad zasobami, narzędziami i procesami. Przy udostępnianiu serwerów MCP użytkownikom zewnętrznym tracimy tę kontrolę — nie wiemy nic o hoście, innych narzędziach ani intencjach użytkownika. Konieczne są programistyczne ograniczenia: blokady dostępu, limity zapytań, walidacje, anonimizacja. Niektóre zasoby po prostu nie powinny być udostępniane agentom.

### Zarządzanie wieloma serwerami MCP
Przy wielu podłączonych serwerach pojawiają się konflikty nazw narzędzi. Host powinien prezentować narzędzia w formie z prefiksem (np. `resend__send`, `gmail__search`). Przydatne są też: przypisywanie narzędzi do profili asystentów, twarde limity liczby aktywnych narzędzi oraz dynamiczne odkrywanie narzędzi.

## Najważniejsze do zapamiętania

1. **Zanim zbudujesz narzędzie, przeanalizuj API** — brakujące akcje, rate limit, paginacja i asynchroniczność muszą być zaadresowane w kodzie, nie przez agenta.
2. **Grupuj powiązane akcje w jedno narzędzie** — 4 dobrze zaprojektowane narzędzia do systemu plików zastępują 13 z oficjalnego Filesystem MCP, bo model łatwiej obsługuje mniej schematów z jasnym podziałem odpowiedzialności.
3. **Zwracaj dynamiczne podpowiedzi (hints) w odpowiedziach** — zarówno przy błędach, jak i sukcesach. Model potrzebuje kontekstu o ograniczeniach, dostępnych opcjach i sugerowanych kolejnych krokach.
4. **Wzmacniaj zachowanie modelu informacjami zwrotnymi** — np. po zapisaniu pliku zwróć jego ścieżkę, nawet jeśli wydaje się to zbędne. Model wykorzysta tę informację w dalszych akcjach.
5. **Stosuj checksum i dryRun dla operacji zapisu** — checksum chroni przed nadpisaniem zmienionego pliku, dryRun pozwala modelowi zobaczyć efekt przed faktyczną zmianą.
6. **Prowadź historię zmian narzędzi „stratnych"** — przywracanie błędnych modyfikacji powinno działać bez angażowania modelu.
7. **MCP to nie alternatywa dla natywnych narzędzi — to uzupełnienie** — łącz narzędzia natywne z MCP-owymi na jednej liście schematów Function Calling.
8. **Testuj narzędzia MCP na małych modelach lokalnych** — jeśli Qwen 3 Coder 30B radzi sobie z Twoimi narzędziami, to znak, że są dobrze zaprojektowane.
9. **Generuj serwery MCP z agentem AI, ale dostarczaj mu aktualną dokumentację** — wiedza modeli o kształtującym się protokole bywa nieaktualna, więc wczytuj README.md i manual.md do kontekstu.
10. **Nie ufaj nazwie narzędzia — dodawaj prefiksy w hoście** — `send` jest zbyt generyczne; `resend__send` eliminuje konflikty między serwerami.
11. **Streamable HTTP powinien być domyślnym transportem MCP** — STDIO rezerwuj wyłącznie dla procesów lokalnych (desktopowe aplikacje, CLI).
12. **Programistyczne ograniczenia to podstawa bezpieczeństwa** — blokady dostępu, limity, walidacje i anonimizacja. Prompt injection nie ma uniwersalnego rozwiązania, więc ogranicz fizycznie to, co agent może zrobić.
13. **Agent > workflow, gdy potrzebujesz elastyczności** — agent do tłumaczeń może weryfikować i poprawiać swoją pracę, workflow nie. Ale jeśli wymagasz ścisłej kolejności kroków, workflow jest lepszym wyborem.

## Anty-wzorce

- **Zbyt wiele granularnych narzędzi** — 13 osobnych akcji do systemu plików zamiast 4 logicznie pogrupowanych. Model gubi się w zbędnej liczbie schematów.
- **Generyczne komunikaty błędów** — samo „404 Not Found" nie pomoże agentowi. Brakuje wskazówki, co zrobić dalej lub jakie wartości są dostępne.
- **Brak informacji zwrotnej po sukcesie** — potwierdzanie akcji samym statusem 201 bez zwrócenia danych zasobu. Model traci kontekst potrzebny do dalszych kroków.
- **Obsługa rate limitu i pollingu przez agenta** — agent nie powinien wielokrotnie uruchamiać akcji ani czekać na wynik. Te mechaniki należy zaadresować w kodzie narzędzia.
- **Generyczne nazwy narzędzi** — `get`, `send`, `search` bez kontekstu powodują konflikty między serwerami i są niezrozumiałe dla modelu.
- **Udostępnianie narzędzi bez programistycznych zabezpieczeń** — liczenie na to, że model „sam nie zrobi nic złego" zamiast narzucenia blokad dostępu, limitów i walidacji.
- **Budowanie workflow tam, gdzie potrzebna jest elastyczność** — sztywny pipeline tłumaczenia nie poradzi sobie z błędem w jednym fragmencie, agent tak.
- **Ignorowanie OAuth przy serwerach MCP na produkcji** — klucze API wystarczą do prototypowania, ale produkcyjne serwery potrzebują pełnego procesu autoryzacji z PKCE i zarządzaniem tokenami.
