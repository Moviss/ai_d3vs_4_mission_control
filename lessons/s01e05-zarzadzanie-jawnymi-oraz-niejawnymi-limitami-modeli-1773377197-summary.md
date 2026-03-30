# Zarządzanie jawnymi oraz niejawnymi limitami modeli — Podsumowanie

## TL;DR
Lekcja omawia pełne spektrum ograniczeń, z jakimi mierzymy się przy wdrażaniu generatywnych aplikacji na produkcję — od limitów okna kontekstowego i tokenów wyjściowych, przez koszty, wydajność i bezpieczeństwo, po niejawne problemy jak halucynacje wartości przy poprawnej strukturze. Główny przekaz: produkcyjne aplikacje AI wymagają adresowania tych limitów na poziomie architektury, UX-u i procesów biznesowych, a nie tylko promptów.

## Kluczowe koncepcje

### Produkcyjne wyzwania generatywnych aplikacji
Aplikacje z LLM to w ~80% klasyczne oprogramowanie, ale wpływ modeli ujawnia się natychmiast przy przejściu z prototypu na produkcję. Dziesięć kluczowych obszarów problemowych: kontekst, kontrola, wydajność, dynamiczne koszty, bezpieczeństwo (Prompt Injection), stabilność API, skalowanie, prywatność, naruszenia regulaminów i konieczność elastycznej architektury. Problemy te pojawiają się już przy pierwszych użytkownikach.

### Kontrola nad działaniami agenta
System musi umożliwić modelowi samodzielną naprawę błędów (error recovery) lub wymagać zaangażowania człowieka — przed lub po wykonaniu akcji. Mechanizm "zaufanych narzędzi" pozwala użytkownikowi jednorazowo zatwierdzić narzędzie, ale z zastrzeżeniami: identyfikacja narzędzia musi być unikatowa, zmiana schematu narzędzia powinna automatycznie usunąć je z listy zaufanych, a zatwierdzenie musi być deterministyczne (przez kod, nie decyzję LLM).

### Wydajność i architektura
Heartbeat (informowanie o postępie), wielowątkowość (możliwość wysyłania nowych wiadomości podczas długiego generowania), przetwarzanie w tle (odporność na zamknięcie przeglądarki), wznawianie zadań (architektura oparta o zdarzenia) i ograniczanie zbędnych zapytań do LLM — to elementy, które muszą być uwzględnione na poziomie architektury. Alternatywą dla optymalizacji promptów jest fine-tuning mniejszych modeli lub destylacja większych, choć modele "Flash" często wystarczają.

### Dynamika kosztów na produkcji
Jednostkowa cena tokenów spada, ale realne koszty rosną z kilku powodów: modele LRM generują znacznie więcej tokenów, na jedną wiadomość użytkownika przypada często >50 zapytań do AI, rosnąca złożoność agentów wydłuża łańcuchy interakcji, a proaktywne AI działające w tle pali tokeny w sposób ciągły. Tańszy model nie zawsze oznacza niższy koszt — GPT-4.1-nano wymagał więcej kroków niż GPT-4.1-mini i okazał się droższy.

### Limity tokenów — jawne i ukryte
Modele mają limit tokenów wyjściowych (2k–128k). Przy oknie 400k i limicie wyjścia 128k zostaje 272k na wejście. Estymacja tokenów przez `chars / 4` z buforem 20% pozwala wstępnie kontrolować zużycie. Po wysłaniu zapytania API zwraca dokładne dane o tokenach, co pozwala doprecyzować estymację. Kompresję i ekstrakcję kontekstu warto uruchamiać już przy ~30% zużycia limitu.

### Niejawne ograniczenia — gwarancja struktury ≠ gwarancja wartości
Structured Output gwarantuje poprawny kształt JSON-a, ale nie poprawność wartości w nim zawartych. Dynamicznie generowany wykres może mieć prawidłową strukturę, a błędne dane — i system tego nie wykryje. Nawet weryfikacja przez model nie daje pewności. Problem jest szczególnie widoczny w modelach Flash, które potrafią pełni halucynować treść strony www na podstawie samego URL-a.

### Decyzje architektoniczne dla generatywnych aplikacji
Cztery zasady: wspólny interfejs dla providerów (łatwe przełączanie modeli), brak frameworków AI (LangChain, CrewAI szybko stają się obciążeniem), niezależność od natywnych funkcjonalności API i platform z utrudnionym eksportem, oraz przemyślana architektura zapewniająca elastyczność wobec dynamicznych zmian.

### Produkcyjny agent — pełna architektura
Przykład `01_05_agent` prezentuje kompletną architekturę: API z endpointem `/api/chat`, zabezpieczenia (CORS, rate-limit, klucz API jako hash w DB), pętla agenta oparta o zdarzenia (start, iteracja, narzędzia, wstrzymanie, błędy, anulowanie), ujednolicony interfejs dla OpenAI i Gemini z warstwą tłumaczeń, narzędzia dedykowane + MCP, zarządzanie kontekstem z prompt cache i kompresją, monitorowanie przez Langfuse, oraz deployment przez GitHub Actions na VPS.

## Najważniejsze do zapamiętania

1. **Użytkownicy nie znają limitów LLM** — będą przesyłać kilkusetstronicowe PDF-y, aktywować setki narzędzi MCP jednocześnie i oczekiwać nieskończonych konwersacji. Trzeba to uwzględnić programistycznie.
2. **Kontrola użytkownika nad agentem jest konieczna** — wszędzie gdzie agent ma dostęp do danych i akcji, potwierdzenie musi zawierać wszystkie detale operacji, nie tylko jej nazwę.
3. **Zmiana schematu narzędzia MCP musi automatycznie usuwać je z listy zaufanych** — interfejs serwera MCP może zmienić się bez wiedzy użytkownika, co jest krytycznym ryzykiem bezpieczeństwa.
4. **Estymuj tokeny jako `chars / 4` z buforem 20%** — to najprostszy sposób na wstępną kontrolę zużycia okna kontekstowego przed wysłaniem zapytania.
5. **Kompresję kontekstu uruchamiaj wcześnie, już przy ~30% zużycia** — nie czekaj na wyczerpanie limitu, bo wtedy jest już za późno na sensowną reakcję.
6. **Tańszy model ≠ tańsze rozwiązanie** — model nano wymagający więcej kroków może kosztować więcej niż model mini. Optymalizuj na podstawie obserwacji, nie intuicji.
7. **Na jedną wiadomość użytkownika może przypadać >50 zapytań do AI** — planuj koszty i cache'owanie z uwzględnieniem tej proporcji.
8. **Gwarancja struktury JSON nie oznacza gwarancji wartości** — Structured Output zapewnia poprawny kształt, ale wartości mogą być całkowicie zmyślone.
9. **Unikaj frameworków AI na produkcji** — dynamiczny rozwój modeli i API sprawia, że LangChain czy CrewAI szybko stają się obciążeniem. Stosuj oficjalne SDK lub własne wrappery.
10. **Architektura oparta o zdarzenia to fundament produkcyjnego agenta** — umożliwia wznawianie zadań, monitorowanie, kompresję kontekstu i asynchroniczne działanie.
11. **Stosuj Moderation API przy pracy z modelami OpenAI** — brak moderacji może doprowadzić do zablokowania całego konta organizacji.
12. **Informuj model o jego ograniczeniach wprost** — czy web search jest aktywny, czy ma dostęp do plików — to zmniejsza ryzyko halucynacji.
13. **Loguj i monitoruj wszystkie zdarzenia agenta, włącznie z instrukcjami systemowymi** — błędy aplikacji (np. niewczytane instrukcje) mogą wyglądać jak halucynacje modelu.
14. **Narzucaj limity zapytań użytkownikom niezależnie od limitów providera** — OpenRouter umożliwia programistyczne zarządzanie kluczami z indywidualnymi limitami.
15. **Wdrożenie AI nie zawsze oznacza pełną automatyzację** — optymalizacja procesu o kilka-kilkanaście procent jest biznesowo uzasadniona i często realistyczniejsza.

## Anty-wzorce

- **Poleganie na Structured Output jako gwarancji poprawności** — poprawna struktura JSON nie chroni przed błędnymi wartościami. Zawsze weryfikuj krytyczne dane niezależnie od formatu.
- **Pomijanie moderacji treści** — przy modelach OpenAI brak Moderation API grozi blokadą konta. Przy innych providerach warto mieć własne reguły klasyfikacji.
- **Zatwierdzanie akcji agenta przez LLM zamiast kodu** — decyzja o akceptacji/odrzuceniu musi być deterministyczna, realizowana przez interfejs graficzny lub logikę programistyczną.
- **Ignorowanie limitu tokenów wyjściowych** — deklarowane okno kontekstowe zawiera zarówno wejście jak i wyjście. Przy 400k oknie i 128k limicie wyjścia na wejście zostaje 272k.
- **Brak heartbeatu przy długich operacjach** — użytkownik bez informacji o postępie pracy agenta odbiera system jako zawieszony i powtarza zapytania.
- **Brak odporności na zamknięcie przeglądarki/utratę połączenia** — przetwarzanie w tle musi kontynuować się niezależnie od stanu klienta, inaczej użytkownik traci minuty pracy agenta.
- **Stosowanie frameworków AI (LangChain, CrewAI) na produkcji** — szybko stają się obciążeniem przez dynamiczne zmiany w API i modelach. Aktualizacja i migracja są problematyczne.
- **Wybieranie najtańszego modelu bez benchmarku kosztowego** — model generujący więcej kroków może być droższy. Decyzję podejmuj na podstawie obserwacji zużycia tokenów, nie ceny za token.
- **Utrzymywanie zaufania do narzędzia MCP po zmianie jego schematu** — zmiana nazwy, opisu lub parametrów narzędzia musi automatycznie wymagać ponownej autoryzacji.
- **Sięganie po LLM tam, gdzie wystarczy kod** — każde zapytanie kosztuje tokeny i czas. Jeśli zadanie da się zrealizować programistycznie, nie angażuj modelu.
