# Techniki łączenia modelu z narzędziami — Podsumowanie

## TL;DR
Lekcja omawia Function Calling jako mechanizm łączenia LLM z narzędziami — od technicznego schematu działania, przez projektowanie schematów i walidacji, po zarządzanie kontekstem i bezpieczeństwo agentów. Główny przekaz: narzędzia dla LLM to nie kopia istniejącego API, lecz starannie zaprojektowany interfejs z domyślnymi wartościami, precyzyjnymi opisami błędów i minimalistycznymi schematami.

## Kluczowe koncepcje

### Function Calling — mechanizm działania
Model nie wchodzi w interakcję z otoczeniem bezpośrednio — generuje JSON z nazwą narzędzia i argumentami, a kod aplikacji uruchamia odpowiednią funkcję. Wynik wraca do kontekstu konwersacji i model jest wywoływany ponownie. Interakcja to zawsze minimum dwa zapytania do LLM, a definicje narzędzi są dołączane do każdego zapytania, nawet jeśli nie zostaną użyte.

### Projektowanie narzędzi ≠ mapowanie API
Największy błąd to mapowanie istniejącego API 1:1 na narzędzia LLM. API jest projektowane dla programistów z dostępem do dokumentacji. Narzędzia LLM powinny łączyć powiązane akcje (np. `workspace_metadata` zamiast osobnych endpointów dla statusów, etykiet i zespołów), pomijać rzadko używane operacje i blokować niebezpieczne akcje (np. `delete_project`).

### Augmented Function Calling
Wzbogacanie wywołań narzędzi o dodatkowe instrukcje kontekstowe (Commands, Skills, Prompts). Mogą być dołączane statycznie (przez użytkownika), dynamicznie (przez model) lub hybrydowo. Przykład: to samo narzędzie do generowania grafik daje generyczny wynik bez kontekstu, ale z dodatkową instrukcją stylistyczną produkuje spójne rezultaty.

### Workflow vs Agent AI
Workflow to narzucony schemat realizacji zadań krok po kroku — przewidywalny, ale sztywny. Agent to model w pętli zapytań, samodzielnie decydujący o kolejnych krokach — elastyczny, ale niepewny. Wybór zależy od kontekstu: jeśli potrzebna 100% skuteczność — LLM to raczej zły pomysł; jeśli proces jest sztywny — workflow wystarczy; jeśli problemy są otwarte — agent, ale lepiej zawęzić zakres niż rzucać agenta na zbyt szeroki problem.

### Context Engineering w logice aplikacji
Zarządzanie kontekstem obejmuje stabilność instrukcji systemowej (dynamiczne dane niszczą prompt cache), kompresję wątku (auto-compact zamiast usuwania starych wiadomości) i wykorzystanie systemu plików jako rozszerzenia pamięci agenta. Wyniki narzędzi mogą być zapisywane do plików, a agent wczytuje tylko potrzebne fragmenty.

### Transformacja zapytań
Zapytanie użytkownika rzadko pasuje wprost do treści dokumentów. Agent musi transformować zapytania przez synonimy i powiązane zagadnienia. Kluczowe jest dostarczenie agentowi „mapy treści" (np. automatycznie generowany `_index.md`), bo bez niej model „nie wie, że coś wie".

### Prompt Injection — problem otwarty
Zmiana zachowania modelu wbrew instrukcji systemowej nie ma obecnie skutecznej obrony. Agent z dostępem do kalendarza i maila może zostać nakłoniony przez złośliwą wiadomość do ujawnienia danych. Jedyna realna obrona to ograniczenia na poziomie środowiskowym i unikanie agentów w scenariuszach z ryzykiem wycieku danych.

## Najważniejsze do zapamiętania

1. **Narzędzia muszą być zrozumiałe bez dokumentacji** — model nie ma do niej dostępu, więc nazwa, opis i schemat to jedyne źródło informacji o tym, jak użyć narzędzia.
2. **Nie mapuj API 1:1** — łącz powiązane zasoby w jedno narzędzie, pomijaj rzadkie akcje, blokuj niebezpieczne. API jest dla programistów, narzędzia LLM są dla modelu.
3. **Nazwy narzędzi muszą być unikatowe i jednoznaczne** — „send" to zła nazwa, „send_email" to dobra nazwa, bo minimalizuje ryzyko kolizji z innymi narzędziami.
4. **Schematy powinny zawierać tylko to, co model musi uzupełnić** — identyfikatory użytkownika, hashe, flagi wewnętrzne powinny być uzupełniane programistycznie, nie przez LLM.
5. **Komunikaty o błędach muszą być szczegółowe i zawierać wskazówki** — zamiast „400 Bad Request" podaj „team_id jest nieprawidłowy. Wskazówka: pobierz go z pomocą akcji workspace_metadata".
6. **Domyślne wartości ułatwiają życie agentowi** — np. automatyczne przypisanie zadania do bieżącego użytkownika, ale z możliwością zmiany. Informuj model o domyślnych wartościach w opisie narzędzia.
7. **Prompt cache to priorytet wydajnościowy** — stabilna instrukcja systemowa i niezmienne wiadomości w wątku drastycznie redukują czas odpowiedzi (TTFT) i koszty.
8. **Nieodwracalne akcje wymagają potwierdzenia użytkownika przez UI** — nie przez wiadomość do modelu, lecz przez przyciski. Model może zignorować odmowę wyrażoną słowami.
9. **System plików to pamięć rozszerzona agenta** — wyniki narzędzi zapisane w plikach pozwalają agentowi eksplorować dane bez zaśmiecania kontekstu.
10. **Agent powinien mieć max 10–15 narzędzi** — więcej rozprasza uwagę modelu. Nadmiarowe narzędzia przenoś do sub-agentów lub udostępniaj przez code execution.
11. **Reasoning pomaga, ale nie jest niezawodny** — zmiana kolejności informacji w prompcie potrafi obniżyć skuteczność o 40%. Wspieraj rozumowanie planowaniem, odkrywaniem i uśrednianiem wielu modeli.
12. **Walidacja narzędzi powinna być wybaczająca** — gdy model poda status „done" zamiast „completed", wskazówka „czy chodziło Ci o...?" jest lepsza niż suchy błąd.
13. **Tryb dry-run jako zabezpieczenie** — gdy nie można uzyskać zgody użytkownika ani programistycznie ograniczyć dostępu, narzędzie z wbudowanym dry-run pozwala agentowi zweryfikować skutki przed wykonaniem.
14. **Prompt injection to otwarty problem bez rozwiązania** — jedyna obrona to ograniczenia środowiskowe i unikanie agentów w scenariuszach z ryzykiem wycieku danych.

## Anty-wzorce

- **Mapowanie API 1:1 na narzędzia LLM** — API dla programistów nie nadaje się wprost dla modelu, który nie ma dostępu do dokumentacji i potrzebuje zredukowanego, dobrze opisanego interfejsu.
- **Generyczne komunikaty o błędach** — „coś poszło nie tak" praktycznie przekreśla szansę agenta na ukończenie zadania. Model potrzebuje konkretnej informacji co poszło nie tak i co może zrobić.
- **Dawanie agentowi zbyt wielu narzędzi naraz** — rozprasza uwagę modelu, zużywa kontekst i obniża skuteczność. Powyżej 10–15 narzędzi wymaga reorganizacji (sub-agenci, progressive disclosure).
- **Dynamiczne dane w instrukcji systemowej** — nawet dodanie bieżącej daty i godziny niszczy prompt cache i dramatycznie wpływa na wydajność systemu.
- **Poleganie na modelu przy krytycznych danych wejściowych** — identyfikatory użytkownika, uprawnienia i dane wrażliwe muszą być kontrolowane programistycznie, nie przez LLM.
- **Poleganie wyłącznie na wiadomościach tekstowych do potwierdzania akcji** — model może zignorować lub błędnie zinterpretować odmowę użytkownika. Deterministyczny UI (przyciski) to jedyne bezpieczne rozwiązanie.
- **Zbyt szczegółowe instrukcje obsługi narzędzi w prompcie systemowym** — mogą negatywnie wpływać na zachowanie agenta. Lepiej przechowywać „mapy treści" w plikach zewnętrznych.
- **Automatyczne tłumaczenie API na schematy narzędzi bez nadzoru człowieka** — obecne modele nie radzą sobie z pełną automatyzacją tego procesu; nadzór ludzki jest niezbędny.
- **Stosowanie agentów tam, gdzie wymagana jest 100% skuteczność** — bez nadzoru człowieka lub jasnych wskaźników sukcesu LLM nie gwarantuje powtarzalnych wyników.
