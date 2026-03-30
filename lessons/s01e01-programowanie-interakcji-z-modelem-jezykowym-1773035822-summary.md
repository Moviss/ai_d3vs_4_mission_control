# Programowanie interakcji z modelem językowym — Podsumowanie

## TL;DR
Lekcja wprowadza fundamenty programistycznej pracy z LLM: od mechaniki tokenów i autoregresji, przez strukturyzowanie odpowiedzi (Structured Outputs, JSON Schema), po strategie doboru modeli i organizację promptów w kodzie. Główny przekaz: programowanie generatywnych aplikacji to zarządzanie kontekstem modelu z poziomu kodu, gdzie niedeterministyczne wyniki LLM łączymy z deterministyczną logiką aplikacji.

## Kluczowe koncepcje

### Autoregresja i tokeny
Model generuje odpowiedź token po tokenie, gdzie każdy kolejny zależy od danych wejściowych i wszystkich dotychczas wygenerowanych tokenów. Wygenerowany token nie może zostać usunięty. Oznacza to, że na jakość odpowiedzi wpływa nie tylko prompt użytkownika, ale także instrukcja systemowa i sama generowana treść. API jest bezstanowe — za każdym razem przesyłamy komplet danych w ramach okna kontekstowego.

### Sterowanie zachowaniem modelu z poziomu kodu
Programistyczna kontrola nad kontekstem pozwala budować łańcuchy zapytań, np. najpierw klasyfikacja zapytania, potem dopasowanie promptu do wyniku klasyfikacji. Dla użytkownika to nadal "pytanie-odpowiedź", ale pod spodem możemy dowolnie manipulować kontekstem między zapytaniami, co zwiększa skuteczność kosztem czasu i pieniędzy.

### Structured Outputs i JSON Schema
Structured Outputs wymusza na modelu odpowiedź w ściśle określonym formacie JSON. Struktura jest gwarantowana (w trybie `strict`), ale wartości generuje model na podstawie treści wejściowej oraz nazw i opisów pól w schemacie. Kolejność właściwości w schemacie ma znaczenie — wcześniejsze pola wpływają na generowanie kolejnych (np. `reasoning` -> `sentiment` -> `confidence`). Warto uwzględniać wartości neutralne ("nieznany", "mieszany"), aby nie zmuszać modelu do odpowiedzi gdy nie ma wystarczających danych.

### Semantyczne zdarzenia zamiast surowego tekstu
Interakcja z agentem to seria zdarzeń (tokeny rozumowania, wywołania narzędzi, generowane obrazy, tekst docelowy), nie prosta wymiana "pytanie-odpowiedź". Komunikacja oparta o semantyczne zdarzenia z metadanymi (ID, typ) jest znacznie lepsza niż zapisywanie surowego tekstu wiadomości — łatwiej ją rozbudować, pogrupować i zaprezentować w interfejsie bez konieczności migracji danych.

### Strategie doboru modeli
Nie ma "najlepszego modelu" — jest "najlepszy model w tej sytuacji". Cztery strategie: (1) jeden główny model, (2) główny + alternatywny (duży/skuteczny + mały/szybki), (3) główny + specjalistyczne (np. jeden do kodu, inny do tekstu), (4) zespół małych modeli z dekompozycją i głosowaniem. Jedyny sposób wyboru to testowanie na własnych zadaniach, najlepiej z automatyzacją (Promptfoo, DeepEval).

### Organizacja promptów w kodzie
Cztery podejścia: inline, oddzielne pliki z kompozycją, zewnętrzne systemy (Langfuse), pliki markdown z frontmatter YAML. Markdown z frontmatter to rekomendowany wybór — łączy elastyczność wszystkich pozostałych i umożliwia dynamiczną modyfikację promptów przez agentów w runtime. Agent może tworzyć nowe umiejętności (prompty) dla innych agentów.

### Generalizowanie generalizacji w promptach
Zamiast dodawać reguły powiązane z konkretnymi błędami, lepiej tworzyć zgeneralizowane procesy myślowe. Przykład: model źle wybiera narzędzia → zamiast reguły "nie używaj add_event do zadań" lepiej instrukcja "zastanów się głośno nad wyborem narzędzia, określ poziom pewności, poproś o doprecyzowanie w razie wątpliwości". Taka reguła adresuje całą kategorię błędów, nie pojedynczy przypadek.

### In-context learning i few-shot
Model potrafi uczyć się z przykładów umieszczonych w kontekście. Dla zewnętrznej wiedzy wystarczy jej obecność w zapytaniu. Dla kształtowania umiejętności (np. sposobu klasyfikacji) warto pokazać przykłady interakcji (few-shot) w sekcji `<examples>`. Nowoczesne podejście: zamiast ładować wszystko do system prompt, wyposażyć model w narzędzia do wczytywania kontekstu na żądanie.

### Struktury baz danych dla agentów
Prosta struktura czatbota (conversations + messages) nie wystarcza dla agentów. Przykładowa architektura: **sessions** (sesja z nadrzędnym agentem), **agents** (instancje agentów z zadaniami i statusem), **items** (etapy interakcji — wiadomości, wywołania narzędzi, załączniki). Umożliwia dwukierunkową komunikację między agentami i z użytkownikiem.

## Najważniejsze do zapamiętania

1. **Kontekst to sterowanie** — programistyczna kontrola nad danymi wejściowymi i łańcuchami zapytań to główny mechanizm wpływania na zachowanie LLM.
2. **Kolejność pól w JSON Schema wpływa na jakość** — wcześniejsze pola (np. reasoning) kierują generowaniem kolejnych (np. sentiment), więc układ schematu to część promptu.
3. **Zawsze uwzględniaj wartości neutralne** — "nieznany", "mieszany" w schematach klasyfikacji zmniejszają ryzyko halucynacji, bo model nie jest zmuszony do odpowiedzi przy niewystarczających danych.
4. **Nazwy i opisy w schemacie to instrukcje** — model generuje wartości na podstawie nazw pól i ich opisów, więc muszą być precyzyjne i zrozumiałe.
5. **Semantyczne zdarzenia od początku** — budowanie komunikacji na surowych wiadomościach szybko staje się długiem technicznym; zdarzenia z metadanymi są rozszerzalne bez migracji.
6. **Prompty w plikach markdown z frontmatter** — rekomendowane podejście, bo łączy elastyczność, dostępność dla agentów i możliwość dynamicznej modyfikacji.
7. **Generalizuj reguły w promptach** — zamiast łatać konkretne błędy, twórz zgeneralizowane procesy myślowe adresujące całe kategorie problemów.
8. **Przetwarzaj tekst fragmentami** — nawet jeśli całość zmieści się w kontekście, mniejsze fragmenty skupiają uwagę modelu i zwiększają skuteczność.
9. **Wysyłaj zapytania równolegle w grupach** — zmniejsza czas wykonania, ale kontroluje rate-limit API.
10. **Unikaj vendor lock-in** — architektura aplikacji powinna umożliwiać łatwą zmianę providera LLM, bo liderzy rynku zmieniają się szybko.
11. **Prompt cache to must-have** — mechanizm ograniczający przeliczanie danych wejściowych, obniżający koszt i czas reakcji, kluczowy dla agentów.
12. **Testuj modele na własnych zadaniach** — benchmarki nie odpowiadają na pytanie "czy ten model jest dobry dla mnie"; automatyzuj ewaluację.
13. **Frameworki LLM są nierekomendowane** — narzucają ograniczenia bez proporcjonalnej wartości; lepiej budować własne integracje z SDK providerów.
14. **Instrukcja systemowa nie jest granicą bezpieczeństwa** — ograniczenia w prompcie można ominąć (jailbreaking); krytyczne zabezpieczenia muszą być w kodzie i architekturze.

## Anty-wzorce

- **Przesyłanie surowego tekstu jako odpowiedzi** — prowadzi do długu technicznego; każda rozbudowa interfejsu wymaga zmian w bazie, back-endzie i front-endzie jednocześnie.
- **Jeden model do wszystkiego** — różne zadania mają różne wymagania; używanie jednego modelu to kompromis skuteczności, szybkości i kosztu.
- **Brak wartości neutralnych w schematach** — zmuszanie modelu do wyboru między "pozytywny"/"negatywny" bez opcji "nieznany" zwiększa ryzyko konfabulacji.
- **Ładowanie całej wiedzy do system prompt** — generuje szum; lepiej dać modelowi narzędzia do wczytywania kontekstu na żądanie.
- **Reguły reaktywne zamiast generalizacji** — łatanie promptu regułą na regule po każdym błędzie zamiast tworzenia ogólnych procesów myślowych.
- **Poleganie wyłącznie na instrukcjach promptu jako zabezpieczeniu** — prompt injection jest realnym zagrożeniem; bezpieczeństwo musi być adresowane na poziomie kodu.
- **Ignorowanie kolejności generowania w schemacie** — umieszczenie `confidence` przed `reasoning` sprawia, że model ocenia pewność zanim "pomyśli".
- **Uzależnienie od jednego providera** — zmiana lidera rynku modeli może wymusić kosztowną migrację; architektura powinna być agnostyczna.
