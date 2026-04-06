# Architektura — Podsumowanie

## O czym jest ta lekcja? (TL;DR)

Lekcja odpowiada na pytanie: jak zaprojektować architekturę aplikacji, w której AI jest fundamentem, a nie dodatkiem? Kluczowy wniosek: zamiast projektować wokół "funkcjonalności" (czat, wiadomości, dokumenty), projektuj wokół **prymitywów** (zdarzenia, aktorzy, artefakty) — to daje elastyczność, której potrzebujesz, gdy "prosty czatbot" za miesiąc zmieni się w system wieloagentowy. Lekcja pokazuje konkretną architekturę Agent Graph łączącą Orchestratora, Blackboard, DAG Scheduler i Event Bus — oraz praktyczne podejście do integracji wielu providerów AI.

## Mapa koncepcji

- **Cechy generatywnych aplikacji** — Gateway, API, system plików, baza danych, zależności
  - **"Pewniaki" architektoniczne** — centralizacja AI, multi-provider, streaming, multimodalność, logika agentów
- **Prymitywy zamiast funkcjonalności** — zdarzenia zamiast wiadomości, aktorzy zamiast użytkowników, artefakty zamiast typowanych dokumentów
  - **Schema flexibility** — Messages (zamknięty) vs Items (polimorficzny, otwarty)
- **Agent Graph** — Orchestrator + Blackboard + DAG Scheduler + Specialists
  - **DAG Scheduler** — deterministyczna logika rozwiązująca zależności między zadaniami
  - **Execution Trace** — rundy, delegacja, artefakty, wznowienia
- **Multi-provider** — OpenRouter vs biblioteki vs własna logika
  - **Responses API jako domyślny format** + mapowanie do Anthropic/Gemini

## Kluczowe koncepcje

### Cechy generatywnych aplikacji — 5 filarów architektury

**W jednym zdaniu:** Każda aplikacja z AI wymaga decyzji w 5 obszarach: Gateway (centralizacja komunikacji z modelem), API (wyspecjalizowane endpointy zamiast surowego /chat), system plików (uprawnienia agentów), baza danych (struktury dla agentów i ich wiedzy) oraz zależności (ewaluacja, obserwowanie, rendering).

**Rozwinięcie:** Diagram "Generative App — Architecture" pokazuje pełny stos: **Client** (Web/Mobile App — sends typed requests, no direct model access) → **API Layer** (Specialized Endpoints — express intent, not raw inference, np. POST /product/review, POST /document/summarize) → **AI Gateway** [single switching point] (centralizes all model communication, swap providers without touching business logic; implementacje: AI SDK, LiteLLM, custom adapter) → **LLM Providers** (OpenAI, Anthropic, Google, Local/OSS — interchangeable) → **Filesystem** (Agent File Access z scoped permissions, path sandboxing, audit trail — "agents can delete directories accidentally") + **Database** (Agent State & Knowledge — interaction history, scheduled tasks, agent definitions, tool config, vector store) → **Tooling & Libraries** (observability: evaluation, tracing, monitoring; documents: markdown transforms, streaming→HTML; search: semantic search, embeddings; frameworks: LangChain [optional], LlamaIndex [optional]).

**Przykład z lekcji:** Analogia do systemu płatności — tak jak integrujesz Stripe z możliwością przełączenia na innego operatora, tak integrujesz AI z możliwością przełączenia między OpenAI a Anthropic. Centralizacja i abstrahowanie od konkretnego providera to te same wzorce.

### "Pewniaki" architektoniczne

**W jednym zdaniu:** Niezależnie od skali projektu, 6 decyzji jest prawie zawsze takich samych — centralizacja AI, multi-provider, streaming, multimodalność, logika agentów i obsługa długich zadań.

**Rozwinięcie:** (1) **Centralizacja** — wysyłanie zapytań z wielu miejsc utrudnia zarządzanie ustawieniami i przełączanie modeli. (2) **Multi-provider** — nie blokuj się na jednym dostawcy; lepszy model od konkurenta może pojawić się jutro. (3) **Streaming** — informowanie o postępach i zmniejszenie czasu reakcji. (4) **Multimodalność** — nawet jeśli dziś przetwarzasz tylko tekst, zbuduj struktury bazy danych tak, by dodanie obrazu/audio było łatwe. (5) **Logika agentów** — zamiast tabeli `messages` z tekstem, użyj `items` z typami zdarzeń (message, function_call, reasoning). (6) **Długie zadania** — użytkownik zamknie kartę, timeout połączenia minie; potrzebujesz asynchronicznego wykonywania.

**Przykład z lekcji:** Zamiast tabeli `messages` dla czatbota, tabela `items` ze strukturą z lekcji S01E01 — ułatwia monitorowanie akcji występujących "pomiędzy" wiadomościami.

### Prymitywy zamiast funkcjonalności — schema flexibility

**W jednym zdaniu:** Projektuj schematy danych wokół prymitywów (zdarzenia, aktorzy, artefakty) zamiast wyspecjalizowanych struktur (wiadomości, użytkownicy, dokumenty) — to daje elastyczność na przyszłe zmiany.

**Rozwinięcie:** Diagram "Schema Flexibility — Messages vs Items" porównuje dwa podejścia. **Messages — Specialized** (zamknięty schemat): `id`, `conversation_id`, `role` (enum: user|assistant), `content` (text), `created_at`. "Schema is closed — new interaction types require structural changes." **Items — Polymorphic** (otwarty schemat): `id`, `agent_id`, `sequence` (integer), `type` (enum: message, function_call, function_call_output, reasoning). Dla type=message: `role` (enum?), `content` (text|json). Dla type=function_call: `name` (string?), `arguments` (json?). Dla type=reasoning: `summary` (json?), `encrypted_content` (string?). "+ new type..." — "Schema is open — new actors and event types extend without breaking existing structure." To jak różnica między klasą z polami a sum typem w TypeScript.

**Przykład z lekcji:** Artefakty to metadane reprezentujące różne formy treści — obrazy, pliki, interaktywne interfejsy z własnym stanem. Zamiast oddzielnych tabel dla każdego typu, jeden polimorficzny schemat.

### Agent Graph — Orchestrator + Blackboard + DAG Scheduler

**W jednym zdaniu:** Architektura Agent Graph łączy trzy wzorce (Orchestrator zarządzający agentami, Blackboard jako współdzielony stan, DAG Scheduler rozwiązujący zależności) w jeden elastyczny system zdolny do obsługi zarówno prostych czatów, jak i złożonych zadań wieloagentowych.

**Rozwinięcie:** Diagram "Agent Graph — Architecture Overview" pokazuje przepływ: **Entry** (User request: "Write a blog post and email it") → **Orchestrator** (LLM Agent — decomposes request, creates actors, delegates tasks with dependency chains, stops) → **Blackboard** (Shared State — sessions, actors, tasks, items, artifacts, relations) → **DAG Scheduler** (Deterministic, NO LLM — resolves task readiness via dependency graph, executes in order, promotes on completion) → **Specialists** (Researcher [research-notes.md], Writer [blog-post.md], Email Writer [email sent]). Cross-cutting: **Memory** (between rounds — Observer extracts, Reflector compresses, injected into every agent context) i **Event Bus** (fire-and-forget — typed events stream to Dashboard via SSE, read-only, cannot affect execution). Kluczowa zasada: "Flat implementation, hierarchical behavior. Every agent is the same structure. Role is determined by tools granted and system prompt — not code."

**Przykład z lekcji:** Orchestrator nie jest "specjalnym typem" agenta w kodzie — to ten sam agent co Researcher czy Writer, ale z innymi narzędziami (`delegate_task`, `create_actor`) i innym system promptem.

### DAG Scheduler — deterministyczna logika bez LLM

**W jednym zdaniu:** Scheduler to czysta logika kodu (bez LLM), która zarządza cyklem życia zadań — od `todo` przez `in_progress` do `done` lub `blocked` — rozwiązując zależności między nimi w kolejnych rundach.

**Rozwinięcie:** Diagram "DAG Scheduler" pokazuje state machine: `todo` (delegate_task, no deps) / `waiting` (delegate_task, with deps) → `in_progress` (scheduler picks it up / deps met + no children in flight) → `done` (complete_task) / `waiting` (children delegated) / `blocked` (block_task / error). Round Loop: (1) Find ready tasks — `todo`, `waiting` whose deps are met and no children in flight, `blocked` with auto-retry whose timer elapsed. Sort by priority. (2) None ready → exit. Session complete. (3) For each ready task — sequential: set `in_progress`, find assigned actor, run actor loop (LLM steps). Result: `done` unblocks parents, `waiting`, `blocked` with recovery info. (4) Memory cycle — Observer extracts from completed work, Reflector compresses if over budget, injected into next round's context. Stale recovery: "Session start: any task stuck in `in_progress` is reset to `todo` — stale recovery from crashed runs."

**Przykład z lekcji:** Różnica względem heartbeata z przykładu 03_02_events: tam plan zadań był określony z góry, tutaj plan jest **kształtowany dynamicznie** przez Orchestratora — bardziej elastycznie, ale mniej przewidywalnie.

### Execution Trace — 4 rundy od zapytania do wyniku

**W jednym zdaniu:** Konkretny przykład działania Agent Graph: zapytanie o wpis na bloga o TypeScript przechodzi przez 4 rundy z 3 agentami, delegacją zadań, artefaktami i wznowieniami Orchestratora.

**Rozwinięcie:** Diagram "Execution Trace — TypeScript 5.0 Blog Post" (4 rounds, 3 agents, 26 items): **Round 1** — Orchestrator receives user message, `create_actor` researcher, `delegate_task` "Research TypeScript 5.0", root task → waiting. Memory observer: 7 sealed, 2 items active tail, 130 tokens. **Round 2** — Researcher: web search, `write_artifact` research-notes.md, `complete_task` "research complete". Task → done, writer task unlocked. Memory observer: 8 sealed, 363 tokens. **Round 3** — Orchestrator RESUMED: sees research done, `create_actor` writer, `delegate_task` "Draft blog post". Writer: `read_artifact` research-notes.md, `write_artifact` blog-post.md (4,975 chars), `complete_task` "blog post drafted". **Round 4** — Orchestrator RESUMED: sees all children done, `complete_task` "all work finished". Root task → done, session → done.

**Przykład z lekcji:** Memory observer po każdej rundzie: "extracts: user goal, researcher created, task delegated" → skompresowany kontekst wstrzykiwany do następnej rundy. To jak git squash dla pamięci agenta.

### Multi-provider — trzy podejścia do integracji

**W jednym zdaniu:** Integracja wielu providerów AI to problem mapowania API — różne struktury wiadomości, ustawienia reasoning i sygnatury — z trzema opcjami: OpenRouter, biblioteki (AI SDK/LiteLLM) lub własna logika.

**Rozwinięcie:** Diagram "Multi-Provider API Architecture" pokazuje podejście z własną logiką: **Your System** — POST /v1/responses z domyślnym formatem (model: "claude-opus-*", instructions, input, reasoning). **Provider Router** mapuje prefix modelu na provider: "gpt-*", "o1-*", "o3-*" → OpenAI mapper; "claude-*" → Anthropic mapper; "gemini-*" → Gemini mapper. **Field Mapping**: OpenAI (pass-through, translate — instructions→instructions, input→input, reasoning_effort→reasoning_effort); Anthropic (translate — instructions→system, input→messages, reasoning_effort→budget_tokens, reasoning_trace→signature); Gemini (translate — instructions→system_instruction, input→contents, reasoning_effort→thinking_level, reasoning_trace→thought_signature). **Provider APIs**: api.openai.com/v1/responses, api.anthropic.com/v1/messages, generativelanguage.googleapis.com/v1beta/interactions. **Response Normalization** — back to Responses API format. "Provider is chosen by reading model field prefix. Your code never changes — swap providers by changing the model name."

**Przykład z lekcji:** Thought Signatures — Gemini wymaga ich od wersji 3+, tylko przy wywołaniu narzędzi, tylko w bieżącej turze. Anthropic ma swoje sygnatury. OpenAI nie ma. Takie różnice sprawiają, że mapowanie API to "nieoczywiste" wyzwanie.

## Teoria w praktyce

### Agent Graph (`05_01_agent_graph`)

Pełna implementacja systemu wieloagentowego z Orchestratorem, DAG Schedulerem, Blackboard i Event Bus.

#### Domain model — prymitywy zamiast wiadomości

```typescript
// domain.ts — polimorficzne typy zamiast wyspecjalizowanych struktur
export type ItemType = 'message' | 'decision' | 'invocation' | 'result'

export interface Item {
  id: string
  session_id: string
  task_id?: string
  actor_id?: string
  type: ItemType
  content: Record<string, unknown>  // otwarty kształt — zależy od type
  sequence: number
  created_at: string
}

export type ArtifactKind = 'file' | 'plan' | 'diff' | 'image'
export interface Artifact {
  id: string; session_id: string; task_id?: string
  kind: ArtifactKind; path: string; version: number
  metadata?: Record<string, unknown>
}

export type RelationType = 'depends_on' | 'assigned_to' | 'produces' | 'uses'
```

Kluczowe: `Item` z polimorficznym `type` zamiast tabeli `messages`. `Artifact` z `kind` i `version` zamiast osobnych tabel na pliki/obrazy. `Relation` łączy dowolne encje (`task depends_on task`, `task assigned_to actor`, `task produces artifact`) — to graf, nie drzewo.

#### DAG Scheduler — findReadyTasks i processSession

```typescript
// scheduler/graph.ts — logika znajdowania gotowych zadań
const findReadyTasks = async (sessionId: string): Promise<Task[]> => {
  const candidates = await rt.tasks.find(
    t => t.session_id === sessionId && (
      t.status === 'todo' || t.status === 'waiting' || t.status === 'blocked'
    ),
  )
  const ready: Task[] = []
  for (const task of candidates) {
    if (task.status === 'todo') {
      if (!await areDependenciesMet(task)) continue
      ready.push(task)              // todo + deps met → ready
    }
    if (task.status === 'waiting') {
      if (await areDependenciesMet(task) && !await hasUnfinishedChildren(task)) {
        await rt.tasks.update(task.id, { status: 'todo' })
        ready.push({ ...task, status: 'todo' })  // waiting + deps met + no children → ready
      }
    }
    if (task.status === 'blocked' && shouldAutoRetryTask(task)) {
      await rt.tasks.update(task.id, { status: 'todo' })
      ready.push({ ...task, status: 'todo' })    // blocked + auto-retry timer → ready
    }
  }
  return ready.sort((a, b) => a.priority - b.priority)
}
```

Scheduler to czysta logika bez LLM — sprawdza zależności między zadaniami (relacje `depends_on`), promuje `waiting` → `todo` gdy children są `done`, i obsługuje auto-retry dla `blocked` z transient errors.

```typescript
// scheduler/loop.ts — główna pętla rund
export async function processSession(sessionId: string, rt: Runtime): Promise<void> {
  const graph = createGraphQueries(rt)
  let round = 0
  await recoverStaleTasks(sessionId, rt)  // stale recovery: in_progress → todo

  while (round < MAX_ROUNDS) {  // MAX_ROUNDS = 20
    round++
    const ready = await graph.findReadyTasks(sessionId)
    if (ready.length === 0) break  // żadne zadanie nie jest gotowe → koniec

    for (const task of ready) {
      await processOneTask(task, rt)  // sekwencyjnie w rundzie
    }
  }
}
```

Pętla `processSession` to serce systemu: recovery → rundy → find ready → process → repeat. Stale recovery na starcie (zadania stuck w `in_progress` wracają do `todo`) chroni przed crashami. `MAX_ROUNDS = 20` to hard limit zapobiegający nieskończonym pętlom.

## Najważniejsze zasady (cheat sheet)

1. **Projektuj wokół prymitywów, nie funkcjonalności** — zdarzenia zamiast wiadomości, aktorzy zamiast użytkowników, artefakty zamiast typowanych dokumentów. Otwarty schemat rośnie bez łamania istniejącej struktury.
2. **Centralizuj komunikację z AI w jednym Gateway** — budowanie i wysyłanie zapytań z wielu miejsc aplikacji uniemożliwia zarządzanie ustawieniami i przełączanie modeli.
3. **Wystawiaj wyspecjalizowane endpointy, nie surowy /chat** — klient nie powinien mieć bezpośredniego dostępu do modelu. `/product/review` zamiast `/api/chat` — ograniczaj kontakt z modelem na poziomie API.
4. **Buduj na elastyczność od startu** — multi-provider, streaming, multimodalność, logika agentów i długie zadania to "pewniaki" niezależnie od skali projektu.
5. **Dalszy rozwój modeli powinien wzmacniać Twój system, nie go zastępować** — nie buduj produktu, który stanie się niepotrzebny po premierze lepszego modelu.
6. **DAG Scheduler to deterministyczna logika bez LLM** — rozwiązywanie zależności między zadaniami, kolejność wykonania i wznowienia to kod, nie prompt.
7. **Flat implementation, hierarchical behavior** — każdy agent ma tę samą strukturę; rolę determinują narzędzia i system prompt, nie kod.
8. **Event Bus dla obserwacji, nie kontroli** — zdarzenia strumieniowane przez SSE są read-only. Przydatne do dashboardu, ewaluacji i guardrails.
9. **Memory cycle między rundami** — Observer wyciąga, Reflector kompresuje, wynik wstrzykiwany do kontekstu następnej rundy.
10. **Responses API jako domyślny format wewnętrzny** — mapuj do/z Anthropic i Gemini. "Your code never changes — swap providers by changing the model name."
11. **Zachowaj ostrożność przy frameworkach AI** — niestabilne fundamenty mogą zablokować dostęp do nowych funkcjonalności. Własna logika z AI SDK jest dziś realistyczna.
12. **"Prosty czatbot" szybko zmienia się w agenta** — projektuj schematy danych tak, jakby to miało się stać jutro.

## Czego unikać (anty-wzorce)

- **Tabela `messages` z role/content jako fundament** → **Polimorficzna tabela `items` z typami zdarzeń** — zamknięty schemat wymaga zmian strukturalnych przy każdym nowym typie interakcji.

- **Bezpośredni dostęp klienta do modelu przez /api/chat** → **Wyspecjalizowane endpointy z ustalonym kształtem danych** — surowy endpoint to zaproszenie do prompt injection i brak kontroli nad kosztami.

- **Blokowanie się na jednym providerze AI** → **Warstwa tłumaczeń z domyślnym formatem** — lepszy model od konkurenta może pojawić się jutro; centralizacja i mapowanie dają swobodę przełączania.

- **Oparcie architektury o framework AI bez stabilnych fundamentów** → **Własna logika z oficjalnymi SDK providerów** — frameworki mogą blokować dostęp do nowych funkcjonalności i mieć niski priorytet naprawy zaawansowanych bugów.

- **Scheduler oparty o LLM** → **Deterministyczny DAG Scheduler w kodzie** — rozwiązywanie zależności, kolejność wykonania i recovery to logika, nie prompt. LLM decyduje CO robić, scheduler decyduje KIEDY.

- **Budowanie produktu adresującego obszar, w którym modele szybko się poprawiają** → **Buduj wokół wartości, której sam model nie da** — jeśli kolejna wersja modelu rozwiąże problem lepiej niż Twój produkt, zainwestowane wysiłki nie zwrócą się.

- **Budowanie wszystkiego od razu pod "skalę"** → **Zacznij od prymitywów i rozszerzaj** — otwarty schemat danych pozwala na przyrostową rozbudowę bez rewrite'ów.

## Sprawdź się (pytania do refleksji)

- **Porównaj schemat `messages` i `items` z lekcji. Jakie nowe typy zdarzeń musiałbyś dodać do `messages`, gdyby Twój czatbot zaczął używać narzędzi? A do `items`?** *Wskazówka: w `messages` potrzebujesz ALTER TABLE. W `items` dodajesz nowy type do enum — istniejące dane nie są dotknięte.*

- **Zaprojektuj DAG Scheduler dla prostego procesu: research → outline → draft → review. Jakie stany mają zadania? Kiedy scheduler promuje zadanie z `waiting` do `in_progress`?** *Wskazówka: zadanie jest ready, gdy wszystkie jego deps mają status `done` i nie ma aktywnych children.*

- **Gdybyś miał zbudować własny AI Gateway z domyślnym formatem Responses API — jakie 5 pól zapytania i 5 pól odpowiedzi byłyby w Twoim minimalnym MVP?** *Wskazówka: zapytanie: model, instructions, input, tools, reasoning. Odpowiedź: output, input_tokens, output_tokens, reasoning, usage.*

- **Lekcja mówi "dalszy rozwój modeli powinien wzmacniać system". Podaj przykład produktu, który spełnia tę zasadę, i jeden, który jej nie spełnia.** *Wskazówka: produkt, który buduje wartość z DANYCH (kontekst, wiedza, relacje) się wzmacnia. Produkt, który buduje wartość z KOMPENSACJI słabości modelu — nie.*

- **Porównaj trzy podejścia do multi-provider (OpenRouter, AI SDK, własna logika). W jakim projekcie wybrałbyś każde z nich?** *Wskazówka: OpenRouter gdy tylko LLM, AI SDK gdy provider jest wspierany i nie potrzebujesz edge features, własna logika gdy potrzebujesz pełnej kontroli nad mapowaniem i thought signatures.*
