# S05E04 — Produkcja — Podsumowanie

## O czym jest ta lekcja? (TL;DR)

Przejście z prototypu do produkcji w aplikacjach AI to nie tylko kwestia skalowania — to zupełnie nowy zestaw problemów, które nie istnieją w środowisku developerskim. Lekcja pokazuje, jak drobne detale (usuwanie wiadomości, halucynacje audio, wydajność textarea) potrafią zepsuć doświadczenie użytkownika i bezpieczeństwo systemu. Na konkretnym przykładzie pełnej aplikacji (UI + API) demonstruje produkcyjną architekturę systemu wieloagentowego — od scheduler'a i heartbeat'ów, przez delegację między agentami, po recovery po awariach.

## Mapa koncepcji

- **Przepaść dev→prod** — dlaczego środowisko produkcyjne jest fundamentalnie inne
  - **Detale UX w czacie AI** — problemy z usuwaniem/edycją wiadomości, wydajnością textarea
  - **Halucynacje audio** — specyficzne problemy Whisper i modeli speech-to-text
  - **Bezpieczeństwo konwersacji** — many-shot jailbreaking przez edycję historii
- **Produkcyjna architektura agentów** — od monolitu do systemu wieloagentowego
  - **Scheduler + Readiness Engine** — kolejkowanie i priorytetyzacja zadań
  - **Heartbeat + Claim + Recovery** — odporność na awarie procesów
  - **Delegacja i hierarchia agentów** — parent/child run z przekazywaniem kontekstu
- **Filozofia produkcji AI** — budowanie "dla agentów", rola jakości, agent bez czatu

## Kluczowe koncepcje

### Przepaść między dev a produkcją

**W jednym zdaniu:** Aplikacje AI na produkcji napotykają problemy, których nie da się przewidzieć w środowisku developerskim — i są to często drobiazgi, nie wielkie decyzje architektoniczne.

**Rozwinięcie:** To jak różnica między gotowaniem obiadu dla siebie a prowadzeniem restauracji. Przepis ten sam, ale nagle musisz myśleć o alergiach, prędkości podawania, temperaturze talerzy. W aplikacjach AI te "drobiazgi" to np. usuwanie wiadomości ze środka konwersacji — API Anthropic i Gemini wymagają, by ostatnia wiadomość była od użytkownika, więc usunięcie wiadomości user'a ze środka łamie alternację ról i zwraca 400 Bad Request. Dlatego ChatGPT czy Claude oferują rozgałęzianie konwersacji zamiast usuwania.

**Przykład z lekcji:** Diagram "Message Deletion — API Error" pokazuje sekwencję: user pyta → model odpowiada → user usuwa swoją wiadomość → naruszenie kolejności ról → błąd 400 Bad Request. Rozwiązanie produkcyjne to branching konwersacji zamiast usuwania.

### Many-shot jailbreaking przez edycję wiadomości

**W jednym zdaniu:** Pozwolenie użytkownikowi na edycję odpowiedzi modelu otwiera drogę do ataku, w którym sfabrykowana historia konwersacji staje się "dowodem", że model już wcześniej wykonywał zabronione akcje.

**Rozwinięcie:** To jak podrabianie protokołów z poprzednich spotkań — jeśli ktoś zmieni notatki tak, że "zarząd zatwierdził wydatek", to następnym razem nikt nie kwestionuje podobnego wydatku. Model traktuje swoją wcześniejszą (edytowaną) odpowiedź jako precedens i uznaje zabronioną akcję za dopuszczalną. W produkcyjnym systemie edycja wiadomości modelu (szczególnie agenta z narzędziami) musi być zablokowana.

**Przykład z lekcji:** Diagram "Many-Shot Jailbreaking via Message Editing" pokazuje atak krok po kroku: użytkownik prosi o przelew $500 → model odmawia → użytkownik edytuje odpowiedź modelu na "Transfer completed" → przy kolejnych prośbach model widzi "precedens" i wykonuje przelew bez oporu.

### Halucynacje w przetwarzaniu audio

**W jednym zdaniu:** Modele speech-to-text (np. Whisper) halucynują w ciszy i mylą języki — prawdopodobnie dlatego, że trenowano je na napisach filmowych.

**Rozwinięcie:** Wyobraź sobie tłumacza, który w momencie ciszy zaczyna recytować napisy końcowe filmu, bo to jedyne co "słyszał" podczas treningu. Whisper w ciszy generuje frazy typu "Thanks for watching!", "Subtitles by Amara.org community". Przy mieszaniu języków (np. polska nazwa ulicy w angielskim zdaniu) model transliteruje nazwę własną do dominującego języka treningowego — "Piotrkowska" staje się "Петрковская" lub "Piotrkowska-Straße".

**Przykład z lekcji:** Diagram "Whisper — Transcription Hallucinations" ilustruje dwa przypadki: (1) cisza interpretowana jako napisy filmowe, (2) mieszanie języków przy nazwie "Piotrkowska Street" — Whisper generuje wersję rosyjską i niemiecką zamiast polskiej.

### Degradacja wydajności textarea przy dużym tekście

**W jednym zdaniu:** Wklejenie dużej ilości tekstu do pola czatu może sprawić, że interfejs staje się nieużywalny — problem znany w klasycznych aplikacjach, ale w czacie AI występuje znacznie częściej.

**Rozwinięcie:** Przy krótkim tekście ("Hello world") każde naciśnięcie klawisza to ~2ms. Po wklejeniu 12 000 znaków — ~900ms na keystroke, co zamraża interfejs. Rozwiązanie produkcyjne: wykrywanie dużej ilości wklejonego tekstu i automatyczna konwersja na załącznik plikowy (np. "pasted-content.txt"), dzięki czemu pole tekstowe pozostaje responsywne.

**Przykład z lekcji:** Diagram "Textarea — Large Paste Degradation" pokazuje porównanie: pole z krótkim tekstem (2ms/keystroke) vs. po wklejeniu 12 000 znaków (900ms/keystroke, UI frozen). Fix: automatyczna zamiana dużego wklejenia na załącznik.

### Produkcyjna architektura systemu wieloagentowego

**W jednym zdaniu:** System produkcyjny traktuje każdą wiadomość użytkownika jak "zadanie do wykonania" (Job), które przechodzi przez kolejkę, scheduler i pętlę agenta z mechanizmami odporności na awarie.

**Rozwinięcie:** To jak system zarządzania zadaniami w fabryce. Wiadomość użytkownika to zlecenie (Job), które trafia do kolejki. Scheduler cyklicznie sprawdza bazę danych, szukając zadań wymagających działania. Worker rezerwuje zadanie (Claim) z czasem wygaśnięcia i uruchamia heartbeat — cykliczne "jestem żywy". Jeśli proces padnie, heartbeat przestaje bić, rezerwacja wygasa, a scheduler automatycznie przydziela zadanie innemu worker'owi. Architektura obejmuje: Tenant → Account → Workspace → Session → Thread → Messages → Jobs → Runs → Items → Dependencies → Executions.

**Przykład z lekcji:** Diagram "Agent Runtime" przedstawia pełny cykl życia zapytania: HTTP Request → Inicjalizacja (sesja, wątek, job, run) → Kolejka → Scheduler → Claim/Heartbeat → Pętla Agenta (model → narzędzia → iteracja) → Delegacja do child run → Delivery wyniku → Persistence. Każdy krok ma obsługę błędów i recovery.

### Delegacja między agentami

**W jednym zdaniu:** Gdy agent wywołuje `delegate_to_agent`, system tworzy prywatny child run z własnym kontekstem, a parent run przechodzi w stan oczekiwania — jak stos wywołań funkcji, ale dla agentów.

**Rozwinięcie:** Delegacja działa jak wywołanie funkcji w programowaniu: parent agent "wywołuje" child agenta, przekazując mu kontekst i uprawnienia do plików. Parent zatrzymuje się (stan `waiting`) i czeka na wynik. Child run może sam delegować dalej, tworząc zagnieżdżony łańcuch. Gdy child kończy pracę, scheduler dostarcza wynik z powrotem do parent'a jako odpowiedź narzędzia, parent wraca do kolejki i wznawia pętlę od miejsca, w którym się zatrzymał.

**Przykład z lekcji:** Struktura danych wspiera to przez pola `parentRunId` i `rootRunId` w tabeli runs, tabelę `runDependencies` ze statusami (pending/resolved/cancelled/timed_out), oraz `jobDependencies` do śledzenia relacji parent-child.

### Agent bez interfejsu czatu

**W jednym zdaniu:** Spojrzenie na agentów poza kontekstem czatu otwiera zupełnie nowe zastosowania — od reagowania na akcje użytkownika po przetwarzanie w tle.

**Rozwinięcie:** Większość osób myśli o agencie AI jako o czatbocie. Ale produkcyjnie znacznie łatwiej zbudować logikę, która obserwuje zachowania użytkownika i reaguje na zdarzenia (wciśnięcie przycisku, wgranie pliku) bez okna czatu. Mamy wtedy większą kontrolę nad danymi wejściowymi i scenariuszami. Co więcej, powinniśmy zacząć budować aplikacje "dla agentów" — z myślą o tym, że to agenty będą działać w imieniu użytkowników, nie ludzie bezpośrednio.

**Przykład z lekcji:** Architektura 05_04_api wspiera ten paradygmat — zlecenia (jobs) mogą być tworzone nie tylko przez użytkownika, ale także przez innych agentów lub zewnętrzne zdarzenia. System zdarzeń (Event Dispatcher) z outbox pattern zapewnia niezawodne dostarczanie zdarzeń do wielu konsumentów.

## Teoria w praktyce

### Pętla agenta z turn loop (`05_04_api`)

Główna pętla agenta implementuje cykliczne wykonywanie tur z pełną kontrolą stanu i limitami. Każda tura to: załadowanie kontekstu → interakcja z modelem → wykonanie narzędzi → powtórz lub zakończ.

```typescript
// src/application/runtime/drive-run.ts
export const executeRunTurnLoop = async (
  context: CommandContext,
  run: RunRecord,
  overrides: RunInteractionOverrides,
): Promise<CommandResult<RunExecutionOutput>> => {
  const abortController = new AbortController()
  let currentRun = run
  let turn = currentRun.turnCount + 1

  try {
    while (true) {
      if (abortController.signal.aborted) {
        return await finalizeCancelledRun(currentRun.id)
      }
      if (currentRun.status !== 'running') {
        return err(toInactiveRunError(currentRun))
      }
      if (turn > context.config.multiagent.maxRunTurns) {
        return failRun(context, currentRun, {...})
      }
      // Load context, assemble interaction, stream response...
```

Kluczowe: pętla sprawdza trzy warunki przed każdą turą — anulowanie, status run'a i limit tur. To zabezpieczenie przed niekontrolowanym działaniem agenta.

### Readiness Engine — decyzje schedulera (`05_04_api`)

Zamiast prostego pollingu kolejki, scheduler używa "silnika gotowości", który analizuje stan całego systemu i podejmuje priorytetyzowane decyzje o tym, co wykonać następne.

```typescript
// src/application/runtime/readiness-engine.ts
// Typy decyzji schedulera — od najwyższego priorytetu:
// 1. deliver_resolved_child_result  — dostarczanie wyników od subagentów
// 2. resume_waiting_run             — wznawianie oczekujących run'ów
// 3. requeue_stale_running_run      — odzyskiwanie po awariach
// 4. execute_pending_run            — nowe zadania

const isHeartbeatPast = (value: string | null, threshold: string): boolean =>
  typeof value === 'string' && value.length > 0 && value <= threshold
```

Priorytetyzacja ma sens: najpierw dostarczamy wyniki (bo ktoś czeka), potem wznawiamy, potem naprawiamy, a dopiero na końcu startujemy nowe zadania.

### Heartbeat i distributed locking (`05_04_api`)

System rezerwacji run'ów implementuje distributed locking z automatycznym odzyskiwaniem — worker rezerwuje run z TTL, a jeśli przestanie odświeżać claim, inny worker może go przejąć.

```typescript
// src/domain/runtime/run-claim-repository.ts
if (existing.workerId !== input.workerId && existing.expiresAt > input.acquiredAt) {
  return err({ message: `run ${input.runId} is already claimed...`, type: 'conflict' })
}

// Update claim if owned by same worker OR claim has expired
const result = db.update(runClaims).set({...})
  .where(and(
    eq(runClaims.runId, input.runId),
    existing.workerId === input.workerId
      ? eq(runClaims.workerId, input.workerId)
      : lte(runClaims.expiresAt, input.acquiredAt),
  ))
```

Wzorzec znany z Redis SETNX, ale zaimplementowany na SQLite. Exponential backoff przy stale recovery (`2^n * baseDelay`) zapobiega "thundering herd" przy jednoczesnych próbach odzyskania.

## Najważniejsze zasady (cheat sheet)

1. **Traktuj wiadomość użytkownika jak zadanie (Job), nie jak request-response** — to otwiera przestrzeń na wznawianie, delegację i asynchroniczne przetwarzanie.
2. **Nigdy nie pozwalaj na usuwanie wiadomości ze środka konwersacji** — zamiast tego oferuj rozgałęzianie (branching) lub przywracanie do punktu.
3. **Blokuj edycję odpowiedzi modelu/agenta** — edycja historii otwiera ścieżkę do many-shot jailbreaking przez sfabrykowane precedensy.
4. **Implementuj heartbeat z automatycznym recovery** — jeśli proces padnie, scheduler powinien automatycznie ponowić zadanie po wygaśnięciu rezerwacji.
5. **Priorytetyzuj decyzje schedulera** — najpierw delivery wyników, potem wznawianie, potem recovery, na końcu nowe zadania.
6. **Wykrywaj duże wklejenia i konwertuj na załączniki** — 12 000 znaków w textarea to ~900ms na keystroke, co zamraża interfejs.
7. **Waliduj dane z modeli audio pod kątem halucynacji** — cisza generuje "Thanks for watching!", mieszane języki produkują transliteracje.
8. **Nie wspominaj w system prompt o możliwościach, które nie są aktywne** — model może zachować się tak, jakby narzędzie było dostępne, nawet jeśli nie jest.
9. **Buduj z myślą o agentach, nie tylko o ludziach** — aplikacje coraz częściej będą obsługiwane przez agentów działających w imieniu użytkowników.
10. **Zakładaj zerową wiedzę użytkownika o AI** — zbudowanie rozwiązania łatwego w obsłudze dla osoby nieznającej modeli to jedno z największych wyzwań produkcyjnych.
11. **Używaj outbox pattern dla zdarzeń** — gwarantuje dostarczenie nawet po awarii, z retry i dead letter queue.
12. **Jakość > prędkość** — w świecie, gdzie każdy może wygenerować aplikację, wyróżnikiem staje się dbałość o detale i jakość wykonania.

## Czego unikać (anty-wzorce)

- **Usuwanie wiadomości z historii** → **Branching konwersacji** — usuwanie łamie alternację ról wymaganą przez API i zaburza kontekst modelu.
- **Pozwalanie na edycję odpowiedzi agenta** → **Blokada edycji lub ograniczenie do wiadomości użytkownika** — edytowana historia tworzy fałszywe precedensy, które model traktuje jako dowód dopuszczalności.
- **Proste request-response dla agentów** → **Job/Run z kolejką i scheduler'em** — bez tego nie ma możliwości wznawiania, delegacji ani recovery po awariach.
- **Polling kolejki bez priorytetyzacji** → **Readiness Engine z typami decyzji** — priorytetyzacja zapewnia, że wyniki dla czekających agentów są dostarczane przed startowaniem nowych zadań.
- **Optymalizacja wyłącznie pod prędkość generowania kodu** → **Skupienie na jakości i detalach** — różnicę na produkcji robią detale, które modele AI same pominą.
- **Zakładanie, że użytkownik rozumie AI** → **Projektowanie dla zerowej wiedzy o modelach** — to ogromne wyzwanie, ale kluczowe dla adopcji.

## Sprawdź się (pytania do refleksji)

- **Dlaczego czat z agentem AI wymaga fundamentalnie innego podejścia do zarządzania historią konwersacji niż zwykły messenger?** *Wskazówka: pomyśl o tym, jak model interpretuje historię wiadomości i jakie wymagania narzucają API providerów.*

- **Jakie korzyści daje traktowanie wiadomości użytkownika jako "zadania" (Job) z osobnym "wykonaniem" (Run) zamiast prostego request-response?** *Wskazówka: rozważ scenariusze, w których proces padnie w połowie, agent musi poczekać na wynik subagenta, lub użytkownik zamknie przeglądarkę.*

- **W jaki sposób system heartbeat + claim + recovery zapewnia odporność na awarie bez duplikowania pracy?** *Wskazówka: pomyśl o distributed locking z TTL i o tym, co się dzieje, gdy worker przestaje odświeżać rezerwację.*

- **Dlaczego "agent bez czatu" może być łatwiejszy do wdrożenia na produkcji niż agent z interfejsem konwersacyjnym?** *Wskazówka: rozważ kontrolę nad danymi wejściowymi i liczbę scenariuszy do obsłużenia.*

- **Jak zaprojektowałbyś system delegacji między agentami, aby wspierał wielopoziomowe zagnieżdżenie bez ryzyka nieskończonej rekursji?** *Wskazówka: pomyśl o limicie głębokości, budżecie tokenów i tym, jak stos wywołań "unwinduje się" przy dostarczaniu wyników.*
