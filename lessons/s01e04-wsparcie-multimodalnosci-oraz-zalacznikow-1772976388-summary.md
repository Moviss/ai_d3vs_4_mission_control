# Wsparcie multimodalności oraz załączników — Podsumowanie

## TL;DR
Lekcja omawia praktyczne podejścia do integracji obrazów, audio i wideo z agentami AI poprzez API. Główny przekaz: multimodalność nie jest jeszcze standardem — wymaga świadomego wyboru modeli, technik przekazywania załączników między narzędziami oraz akceptacji niepełnej skuteczności z weryfikacją człowieka.

## Kluczowe koncepcje

### Przekazywanie załączników agentowi poprzez tag "media"
LLM przesyłany obraz (Base64/URL) nie "widzi" adresu pliku — nie może go przekazać do narzędzi. Rozwiązanie: obok treści pytania i obrazu dodaj dodatkowy element (np. tag `<media>`) z odnośnikiem do pliku. Instrukcja systemowa agenta wyjaśnia, jak korzystać z tego odnośnika. Programistycznie odnośnik zamienia się na Base64 lub publiczny URL.

### Agent vs workflow przy klasyfikacji obrazów
Gdy klasyfikacja jest prosta i dane statyczne — wystarczy workflow. Gdy dane (opisy, zbiory obrazów) zmieniają się w czasie i mogą być zbyt obszerne do wczytania z góry — potrzebny jest agent. Instrukcja agenta powinna opisywać cel, limity i uniwersalne wzorce, a nie sztywny proces ani konkretne dane.

### Narzędzie do analizy obrazu jako "oczy" agenta
Agent generujący obrazy nie może ich fizycznie zobaczyć. Rozwiązanie: dedykowane narzędzie do analizy obrazu (np. pytanie wobec wskazanych obrazów). Dzięki temu agent może iteracyjnie poprawiać generowane grafiki, sprawdzając czy spełniają wymagania.

### JSON Prompt do generowania spójnych obrazów
Format JSON jako szablon promptu do generowania obrazów pozwala na precyzyjną podmianę obiektów lub ustawień sceny. Agent klonuje szablon, modyfikuje wybrane fragmenty i przekazuje referencję do narzędzia generującego. To ułatwia utrzymanie spójności stylu i organizację informacji.

### Uczenie agenta stylu z obrazów referencyjnych
Agent może "nauczyć się" stylu generowania grafik, tworząc szablony JSON na podstawie przesłanych zdjęć referencyjnych. Grafiki referencyjne pozwalają sterować kompozycją, kadrem i pozą postaci. W połączeniu z JSON Prompt umożliwia to zachowanie spójności postaci w różnych scenach.

### Przetwarzanie audio: trzy podejścia
Można (1) rozdzielić TTS/STT na osobne modele, (2) użyć modeli multimodalnych do całościowego przetwarzania, lub (3) sięgnąć po modele do interakcji w czasie rzeczywistym. Wybór zależy od ceny, jakości, szybkości i dostępnych możliwości. Gemini oferuje najszersze możliwości, ElevenLabs najwyższą jakość audio, ale jest droższy.

### Analiza wideo i generowanie filmów
Gemini API pozwala na bezpośrednią analizę wideo (w tym filmów YouTube) bez dzielenia na klatki. Generowanie filmów (Veo, Sora, Kling) pozwala wskazać klatki początkową i końcową. Agent może generować dłuższe filmy, używając ostatniej klatki jednego fragmentu jako pierwszej kolejnego.

## Najważniejsze do zapamiętania

1. **LLM nie widzi adresu URL przesyłanego obrazu** — musisz jawnie przekazać odnośnik do pliku obok samego obrazu, żeby agent mógł go użyć w narzędziach.
2. **Instrukcja agenta powinna opisywać cel i ograniczenia, nie sztywny proces** — jeśli musisz opisywać konkretne kroki zależne od danych, to prawdopodobnie potrzebujesz workflow, nie agenta.
3. **Agent nie widzi obrazów, które sam wygenerował** — potrzebuje dedykowanego narzędzia do analizy obrazu, aby ocenić wynik i ewentualnie powtórzyć generowanie.
4. **100% skuteczności klasyfikacji obrazów przez agenta jest nieosiągalne** — zawsze planuj weryfikację przez człowieka, ale weryfikacja jest łatwiejsza niż wykonanie pracy od zera.
5. **Szablony (style-guide, template) klonowane przez agenta** pozwalają na precyzyjne modyfikacje bez przepisywania całego dokumentu — to wzorzec powtarzający się przy obrazach, PDF-ach i raportach.
6. **Format JSON jako prompt do generowania grafik** organizuje informacje lepiej niż tekst i ułatwia programistyczną podmianę fragmentów.
7. **Grafiki referencyjne (pozy, kompozycja) znacząco zwiększają kontrolę** nad generowanym obrazem — w połączeniu z JSON Prompt zachowują spójność postaci.
8. **Halucynacje występują też przy generowaniu obrazów** — model może poprawnie odwzorować 95% detali, a subtelny "glitch" w pozostałych 5% jest trudny do zauważenia.
9. **Styl wypowiedzi agenta audio musi być dostosowany do formatu** — unikaj dyktowania URL, tabel i formatowania, które nie przekłada się na dźwięk.
10. **Modele lokalne (np. Kokoro-TTS) osiągnęły jakość porównywalną z komercyjnymi** — warto rozważyć je ze względu na prywatność i koszty.
11. **Analiza wideo przez Gemini API eliminuje potrzebę dzielenia na klatki** — ale API jest jeszcze w fazie preview.
12. **Agent do generowania filmów może tworzyć dłuższe materiały** łącząc fragmenty, gdzie ostatnia klatka jednego staje się pierwszą następnego.
13. **Wybór modelu powinien być podyktowany dopasowaniem do problemu, nie wygodą** — jeden model "do wszystkiego" rzadko jest optymalny.

## Anty-wzorce

- **Ignorowanie problemu przekazywania plików między narzędziami** — bez mechanizmu referencji (tag media) agent nie jest w stanie odwołać się do przesłanego obrazu w narzędziu.
- **Pisanie instrukcji agenta uzależnionych od konkretnego zestawu danych** — instrukcja powinna dotyczyć klasy problemów, nie konkretnych danych.
- **Zakładanie, że agent "widzi" wygenerowane obrazy** — bez narzędzia do analizy obrazu agent działa na ślepo i nie może iteracyjnie poprawiać wyników.
- **Poleganie wyłącznie na benchmarkach** — benchmarki dobrze pokazują trendy, ale mają ograniczoną skuteczność w ocenie faktycznych możliwości modeli.
- **Pomijanie optymalizacji plików audio/wideo** — brak kompresji zwiększa koszty i czas przetwarzania. Przyspieszenie nagrania może pomóc, o ile nie tracimy istotnych detali.
- **Używanie zaawansowanego formatowania (URL, tabele) w odpowiedziach audio** — informacje te nie mogą być skutecznie przekazane wyłącznie przez dźwięk.
