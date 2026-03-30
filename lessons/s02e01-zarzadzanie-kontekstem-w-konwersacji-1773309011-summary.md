# S02E01 — Zarządzanie kontekstem w konwersacji — Podsumowanie

## TL;DR
Lekcja pokazuje, że Context Engineering to nie tylko pisanie promptów systemowych, ale projektowanie całej infrastruktury wokół modelu — od dynamicznych instrukcji, przez agentic search, po zarządzanie stanem poza oknem kontekstowym. Kluczem jest generalizowanie zasad zamiast tworzenia sztywnych procesów oraz budowanie warunków, w których proporcja sygnału do szumu pozostaje wysoka.

## Kluczowe koncepcje

### Instrukcja systemowa jako "mapa"
Prompt systemowy nie zawiera wszystkich informacji potrzebnych agentowi — pełni rolę mapy orientacyjnej. Powinien informować o otoczeniu (system operacyjny, aktywne tryby, profil użytkownika), uniwersalnych zasadach (rola pamięci, główne obszary wiedzy) oraz stanie sesji. Specyficzne instrukcje, które są potrzebne tylko w wąskich scenariuszach, stanowią szum i nie powinny trafiać do promptu systemowego.

### Sygnał vs szum w kontekście agentów
Właściwa proporcja sygnału do szumu wynika bezpośrednio z jakości detali systemu: poprawnego dostarczania kontekstu, dopracowanej logiki aplikacji, generycznych mechanizmów (kompresja, planowanie) oraz przestrzeni na interwencję człowieka. Nie kontrolujemy sygnału wprost — stwarzamy warunki, w których jego poziom jest możliwie wysoki.

### Agentic RAG — budowanie kontekstu przez obserwację
Agent domyślnie "nie wie, o czym wie". Zamiast sztywnych procesów wyszukiwania, stosujemy generyczne zasady: skanowanie struktury zasobów, pogłębianie przez serię pytań (synonimy, powiązane tematy), eksplorowanie relacji (przyczyna/skutek, część/całość, problem/rozwiązanie) i weryfikowanie pokrycia przed przejściem do zadania. Agent sam dostosowuje zachowanie na podstawie obserwacji otoczenia.

### Generalizowanie instrukcji
Instrukcje dla agenta powinny być na tyle uniwersalne, aby działały niezależnie od konkretnych narzędzi czy danych. Tylko niewielki fragment promptu powinien być ściśle powiązany z dostępnymi zasobami — reszta to sugestie i zasady zapisane w elastyczny sposób. To wymaga umiejętności znanych z projektowania architektury oprogramowania, połączonych z kompetencjami językowymi.

### Iterowanie promptów z pomocą modelu
Model potrafi uzasadnić swoje zachowanie i zasugerować zmiany w instrukcjach, choć początkowo proponuje zbyt bezpośrednie poprawki. Proces iteracji obejmuje: analizę problemu, generalizację (szukanie kategorii problemów zamiast konkretnego przypadku), własne uwagi (kierunek zmian) i kolejne iteracje z prostymi wskazówkami. Model jest świetny w tworzeniu zwięzłych, precyzyjnych sformułowań — lepszych niż te, do których doszlibyśmy samodzielnie.

### Dynamiczna instrukcja systemowa i prompt cache
Narzędzia znajdują się pod instrukcją systemową w kontekście — zmiana promptu systemowego kasuje cache definicji narzędzi. Dynamiczne informacje (status git, otwarte pliki, data) powinny trafiać do wiadomości użytkownika w tagach XML, a nie do promptu systemowego. Najważniejsze instrukcje warto powtarzać w kolejnych wiadomościach, bo model gubi fakty w miarę rozwoju konwersacji.

### Agent Harness — infrastruktura wokół modelu
Zarządzanie kontekstem wykracza poza okno kontekstowe. Sesje mogą być monitorowane przez hooki, pamięć może być budowana asynchronicznie (np. raz na dobę przez Batch API), pliki służą jako medium komunikacji między agentami, a otoczenie jest aktualizowane na podstawie zewnętrznych warunków. Agent Harness to cała infrastruktura, w której agent funkcjonuje — nie tylko SDK czy framework.

### Maskowanie kontekstu (technika Manus)
Zespół Manus stosował uzupełnianie początku wypowiedzi modelu (prefilling), aby deterministycznie ograniczyć dostępne narzędzia — np. wymuszając użycie wyłącznie narzędzi przeglądarki, gdy sesja przeglądarkowa była aktywna. Technika ta jest już deprecated w API Anthropic, ale ilustruje, że kreatywne podejścia do sterowania kontekstem mogą adresować całe klasy problemów.

### Planowanie i listy zadań jako zarządzanie uwagą
Listy zadań pełnią podwójną rolę: informują użytkownika o postępach i — co ważniejsze — przypominają modelowi o najważniejszych krokach przez powtórzenie. Treści generowane przez model mogą mieć większy wpływ na jego zachowanie niż treści przekazane z zewnątrz (koncepcja Many-shot jailbreaking). Tryb planowania działa analogicznie — zmienia zachowanie agenta bez modyfikacji wcześniejszych wiadomości.

### Workspace i współdzielenie informacji między agentami
Przestrzeń robocza agentów powinna obejmować: załączniki użytkownika, notatki z sesji, dokumenty publiczne (dla użytkownika) i wewnętrzne (dla innych agentów). Katalogi organizowane są per sesja i per data. Agent główny (root) kontroluje przepływ dokumentów między sub-agentami poprzez inbox/outbox, zapewniając programistyczne ograniczenia dostępu.

## Najważniejsze do zapamiętania

1. **Prompt systemowy to mapa, nie terytorium** — powinien dawać orientację (otoczenie, zasady, sesja), ale nie próbować opisać wszystkiego. Zbyt specyficzne instrukcje to szum.

2. **Dynamiczne dane nie należą do promptu systemowego** — informacje zmieniające się często (status git, data, otwarte pliki) powinny trafiać do wiadomości użytkownika w tagach XML, aby nie niszczyć prompt cache.

3. **Narzędzia w kontekście leżą pod promptem systemowym** — każda zmiana promptu systemowego kasuje cache definicji narzędzi. Stabilność promptu systemowego bezpośrednio przekłada się na koszty i szybkość.

4. **Agent "nie wie, o czym wie"** — musi aktywnie eksplorować zasoby. Generyczne zasady eksploracji (skanuj, pogłębiaj, eksploruj relacje, weryfikuj pokrycie) działają lepiej niż sztywne procesy.

5. **Generalizuj instrukcje zamiast pisać pod konkretne przypadki** — instrukcja "szukaj powiązanych zagadnień" jest lepsza niż "zapytany o X, szukaj Y", ale wymaga precyzyjnego sformułowania, aby uniknąć nadinterpretacji.

6. **Iteruj prompty z modelem, ale prowadź kierunek** — model świetnie tworzy zwięzłe sformułowania, ale domyślnie proponuje zbyt bezpośrednie poprawki. Wymuś generalizację i sam oceń wynik.

7. **Jakość sygnału wynika z detali systemu** — poprawne dostarczanie danych, dopracowana logika, generyczne mechanizmy i przestrzeń na interwencję człowieka to fundamenty, nie prompt engineering.

8. **Powtarzaj najważniejsze instrukcje w kolejnych wiadomościach** — model gubi fakty w miarę rozwoju konwersacji. Powtórzenia zarządzają jego uwagą.

9. **Listy zadań służą modelowi, nie tylko użytkownikowi** — ich główna wartość to przypominanie modelowi o krokach do wykonania. Treści generowane przez model mogą silniej wpływać na jego zachowanie niż zewnętrzne instrukcje.

10. **Agent Harness to więcej niż aplikacja** — hooki, asynchroniczna pamięć, system plików, monitoring otoczenia i współpraca między agentami tworzą infrastrukturę, w której agent funkcjonuje.

11. **Współdzielenie kontekstu między agentami wymaga struktury** — wyraźny podział na sesje, katalogi per agent (inbox/outbox/notes) i programistyczne ograniczenia dostępu zapewniają kontrolowany przepływ informacji.

12. **Rola kodu się zmienia, ale nie maleje** — w systemach wieloagentowych kod jest mniej obszerny, ale musi być niezwykle dopracowany. Błędy w głównym systemie agenta są trudne do "ominięcia".

13. **Obszar prawdopodobieństwa, nie pewności** — żadna instrukcja nie gwarantuje 100% skuteczności. Dążymy do możliwie najlepszych rezultatów, akceptując, że agent nie zawsze znajdzie wszystkie informacje.

## Anty-wzorce

- **Modyfikowanie promptu systemowego w trakcie sesji** — niszczy prompt cache i tworzy problemy z chronologią, bo starsze fakty w prompcie systemowym mogą kolidować z nowszymi wiadomościami w konwersacji.
- **Zbyt specyficzne instrukcje systemowe** — np. "zapytany o zarządzanie oknem kontekstowym, szukaj informacji o limitach modeli" — poprawiają skuteczność dla jednego przypadku, ale nie pomagają z innymi.
- **Sztywne, wieloetapowe procesy eksploracji** — zwiększają skuteczność dla złożonych zapytań, ale wymuszają niepotrzebne kroki dla prostych pytań.
- **Dodawanie postępów realizacji zadania do promptu systemowego** — zaburza chronologię zdarzeń, bo prompt systemowy prezentuje starsze fakty niż treść dalszych wiadomości.
- **Uzależnianie instrukcji systemowej od konkretnych narzędzi** — narzędzia mogą być dołączane do różnych agentów, więc opisy w prompcie systemowym powinny być zgeneralizowane.
- **Oczekiwanie, że model sam zaproponuje idealne instrukcje** — LLM domyślnie wybiera zbyt bezpośrednie rozwiązania. Bez prowadzenia kierunku przez człowieka, 60% propozycji nie ma sensu.
- **Brak przestrzeni na interwencję człowieka** — błędy i sytuacje, w których agent nie może kontynuować, z pewnością będą się zdarzać. System musi przewidywać dostarczanie "sygnału" przez człowieka lub inne agenty.
