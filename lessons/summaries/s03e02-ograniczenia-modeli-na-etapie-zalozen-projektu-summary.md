# Ograniczenia modeli na etapie założeń projektu — Podsumowanie

## O czym jest ta lekcja? (TL;DR)

Największą wartość w projektowaniu aplikacji AI daje umiejętność określenia, **czego model nie powinien robić**. Ta lekcja pokazuje, jak zamiast budować "pełną automatyzację" (RAG na całą firmę, autonomiczny czatbot, all-in-one agent), zaprojektować wyspecjalizowane narzędzia, które maksymalnie wykorzystują możliwości modeli, jednocześnie programistycznie adresując ich słabe strony — od prompt injection, przez halucynacje, po wydajność i koszty.

## Mapa koncepcji

- **Rola AI w projekcie** — Full Automation vs Agentic Support
  - **Programistyczna izolacja zasobów** — kontrola dostępu agenta do danych (account lock, contact-type scoping)
  - **Obrona przed prompt injection** — Guard LLM + programistyczna weryfikacja
- **Kontrola trudności zadań** — rozbijanie złożonych celów na zarządzalne kroki
  - **Heartbeat pattern** — cykliczna pętla sprawdzająca stan i przydzielająca zadania agentom
  - **Plan jako kontrakt** — struktura zadań z zależnościami, statusami i właścicielami
- **Generowanie i wykonywanie kodu** — agent pisze kod zamiast "liczyć w pamięci"
  - **Sandbox (Deno)** — izolowane środowisko z kontrolą uprawnień
  - **Tool Bridge** — HTTP most łączący sandbox z narzędziami hosta

## Kluczowe koncepcje

### Full Automation vs Agentic Support

**W jednym zdaniu:** Zamiast automatyzować cały proces (co jest ryzykowne i kruche), lepiej budować wyspecjalizowane narzędzia wspierające ludzi w konkretnych zadaniach.

**Rozwinięcie:** To jak różnica między samochodem autonomicznym (Level 5) a asystentem parkowania. Pierwszy wymaga perfekcji w każdej sytuacji, drugi rozwiązuje jeden konkretny problem i robi to dobrze. Lekcja pokazuje cztery typowe scenariusze: "RAG na całą firmę" (lepiej: wyspecjalizowany Onboarding MVP), "czatbot na stronę" (lepiej: background agent wspierający konsultantów), "masowe auto-maile" (lepiej: draft assistant, człowiek wysyła), "all-in-one agent" (lepiej: dedykowane, modułowe narzędzia).

**Przykład z lekcji:** Diagram "Defining AI Role and Engagement" zestawia te scenariusze: po lewej Full Automation z tagami "High effort", "Relationship risk", "Low quality at scale", "Fragile/Exposed/Injection risk" → po prawej Agentic Support z tagami "Specialized", "Quality boost/Human leverage", "Personalization/Human sends", "Modular/Contained/Reliable".

### Programistyczna izolacja zasobów agenta

**W jednym zdaniu:** Dostęp agenta do danych musi być kontrolowany przez kod, nie przez prompt — bo prompt można złamać, a `if` w kodzie nie.

**Rozwinięcie:** Wyobraź sobie agenta e-mailowego pracującego z wieloma kontami. Nie możesz polegać na instrukcji "nie mieszaj danych między kontami" — model może to zignorować, szczególnie pod wpływem prompt injection. Zamiast tego: gdy agent zaczyna pracę ze skrzynką A, kod **programistycznie blokuje** dostęp do danych skrzynki B (access lock). Gdy agent szkicuje odpowiedź do osoby z domeny @firma.com, baza wiedzy jest **automatycznie zawężana** do informacji wspólnych + tych dotyczących tego klienta (contact-type scoping). Kategoryzacja nie wymaga takich ograniczeń, bo nie generuje treści wychodzących.

**Przykład z lekcji:** Diagram "Email Agent — Safety Mechanics" pokazuje czterowarstwowy Defense Stack: L1 Isolated sessions (Hard), L2 Knowledge base lock (Hard), L3 Contact-type scoping (Hard), L4 Prompt-level rules (Soft). Kluczowa zasada: L1-L3 są wymuszane przez system. L4 zależy od compliance AI, ale jest bezpieczne, bo L1-L3 **już usunęły niebezpieczne dane** z kontekstu.

### Heartbeat pattern — zarządzanie złożonymi zadaniami

**W jednym zdaniu:** Heartbeat to cykliczna pętla, która po każdej rundzie sprawdza stan wszystkich zadań, rozwiązuje zależności i przydziela kolejne zadania odpowiednim agentom — jak manager prowadzący stand-up co 5 minut.

**Rozwinięcie:** Agenty AI mają problem z długimi, wieloetapowymi zadaniami — "zapominają" o aktualizacji list zadań, gubią kontekst. Heartbeat odwraca kontrolę: to **kod** jest managerem, a agenci są wykonawcami. Plan składa się z zadań (Task Contracts) posiadających id, status, właściciela, zależności i wymagane capabilities. Co rundę kod: (1) sprawdza zależności i odblokowuje gotowe zadania, (2) obsługuje oczekujące na człowieka, (3) przydziela zadania agentom wg capabilities, (4) aktualizuje stan. Agenci komunikują się przez system plików, a każdy ma Observational Memory do kompresji kontekstu.

**Przykład z lekcji:** Diagram "Heartbeat Cycle" pokazuje 6 zadań (T-01 do T-06) rozłożonych na 7 rund. T-01 i T-02 startują równolegle w R1. T-03 czeka na zależności do R3, w R4 przechodzi w status "waiting" (potrzebuje dodatkowych danych), a heartbeat wykrywa to i wznawia w R5. T-06 (Review & QA) otwiera się dopiero w R7 gdy wszystkie poprzednie są "done".

### Guard LLM jako bariera przed prompt injection

**W jednym zdaniu:** Wiadomość użytkownika przechodzi przez oddzielne, izolowane zapytanie do LLM, które klasyfikuje ją jako "bezpieczną" lub "niebezpieczną", a wynik jest weryfikowany programistycznie.

**Rozwinięcie:** Atakujący musi złamać dwa niezależne systemy: (1) Guard LLM, który nie ma dostępu do kontekstu głównej konwersacji i zwraca tylko jedno słowo, (2) programistyczną weryfikację tego słowa (`if result === "bezpieczne"`). Atakujący nie zna fraz, bo guard działa w izolacji. To nie jest gwarancja, ale znacznie podnosi poprzeczkę. Jednocześnie fundamentem bezpieczeństwa pozostaje **brak uprawnień do niebezpiecznych akcji** — agent e-mailowy nie ma narzędzia do wysyłania maili.

**Przykład z lekcji:** Diagram "Prompt Injection — Filtering Barrier" pokazuje pełny flow: User Message ("Ignore previous instructions...") → Separate Request → Guard LLM (isolated, no shared context): "Classify as bezpieczne or niebezpieczne. Return only that word." → Response: "niebezpieczne" → Programmatic Verification → Block(message).

### Generowanie kodu zamiast "liczenia w pamięci"

**W jednym zdaniu:** Gdy agent musi przetworzyć tysiące rekordów, nie ładuj ich do kontekstu — niech agent **napisze kod**, który je przetworzy w sandboxie.

**Rozwinięcie:** To fundamentalna zmiana podejścia. Zamiast wrzucać 150,000 linii danych finansowych do okna kontekstowego (co jest niemożliwe i prowadziłoby do halucynacji), agent: (1) eksploruje strukturę katalogów, (2) czyta **fragmenty** plików, aby zrozumieć format, (3) pisze skrypt agregujący dane, (4) pisze skrypt generujący PDF. Całość w 6-10 krokach. Obliczenia wykonuje kod (deterministic), nie model (probabilistic). Agent korzysta z Deno sandbox z granularną kontrolą uprawnień (safe → standard → network → full) i Tool Bridge do komunikacji z hostem.

**Przykład z lekcji:** Diagram "Code Execution Agent — Runtime" pokazuje 3 fazy w 6 turach: Discover (explore workspace tree, locate JSON files, read one file schema), Process (aggregate 240 files → summary.json, 11,200 records, $20,536,005), Output (generate styled PDF with pdfkit). Kluczowe: model **nigdy nie widzi** surowych danych — widzi tylko strukturę i pisze kod, który dane przetwarza.

### Architektura agenta z sandboxem

**W jednym zdaniu:** Agent z code execution to trzy procesy: Host (logika agenta), MCP (narzędzia plikowe), Sandbox (Deno z ograniczonymi uprawnieniami), połączone HTTP bridge'em.

**Rozwinięcie:** Host Process uruchamia agent loop i komunikuje się z LLM API. Gdy model chce manipulować plikami, ma dwie ścieżki: Direct Path (MCP client → files-mcp, szybki, bez kodu) lub Sandbox Path (Deno sandbox z prelude codegen, który wstrzykuje obiekt `tools` pozwalający sandboxowi wywoływać narzędzia hosta przez HTTP). Sandbox jest izolowany — ograniczone read/write do workspace, brak dostępu do sieci (chyba że explicit). Architektura jest złożona, ale korzyści kosztowe i jakościowe są nieporównywalne.

**Przykład z lekcji:** Diagram "Code Execution Agent — Architecture" pokazuje pełny flow: Host Process (index.ts → agent.ts, max 25 turns) → LLM API (GPT-5.2) → Tool Dispatch → Direct Path (MCP, "cheap, fast, no code gen") lub Sandbox Path (sandbox.ts, "TypeScript in Deno", 30s timeout, no stdin, npm support) → Prelude (codegen.ts, "injects tools object into script") → HTTP Bridge (localhost) → Filesystem (workspace/, data/ 240 JSON files, deliverables/ PDF output).

## Teoria w praktyce

### Izolacja bazy wiedzy w agencie e-mailowym (`03_02_email`)
Agent e-mailowy używa dwóch mechanizmów do programistycznej kontroli dostępu: mutex-like lock na konto i scoping po typie kontaktu.

```typescript
// access-lock.ts — mutex blokujący dostęp do obcych kont
let lockedAccount: string | null = null;

export const lockKnowledgeToAccount = (account: string): void => {
  if (lockedAccount !== null) {
    throw new Error(
      `Knowledge base is already locked to "${lockedAccount}".`
    );
  }
  lockedAccount = account;
};

export const assertAccountAccess = (requestedAccount: string): void => {
  if (lockedAccount !== null && requestedAccount !== lockedAccount) {
    throw new Error(
      `ACCESS_DENIED: Knowledge base is locked to "${lockedAccount}".`
    );
  }
};
```

Prosty, ale skuteczny wzorzec: gdy agent zaczyna szkicować odpowiedź dla konta A, lock uniemożliwia dostęp do danych konta B — niezależnie od tego, co model "postanowi".

### Scoping bazy wiedzy po typie kontaktu (`03_02_email`)
Drugi poziom izolacji — nawet w ramach jednego konta, baza wiedzy jest zawężana wg domeny osoby kontaktowej.

```typescript
// scoping.ts — filtrowanie KB po koncie i typie kontaktu
export const getScopedKnowledge = (account: string, contactType: ContactType): ScopedKBResult => {
  assertAccountAccess(account); // L2: sprawdź lock

  const allowedCategories = new Set(KB_CATEGORIES[contactType]); // L3: dozwolone kategorie
  const accountEntries = knowledgeBase.filter(
    (e) => e.account === 'shared' || e.account === account, // account isolation
  );

  for (const entry of accountEntries) {
    if (allowedCategories.has(entry.category)) {
      loaded.push({ ...entry });       // dozwolone → agent widzi
    } else {
      blocked.push({ ...entry, reason: `Category not permitted for "${contactType}"` });
    }
  }
  // Entries z innych kont → blocked z "account isolation" reason
  return { loaded, blocked };
};
```

Trzy warstwy filtrowania w jednej funkcji: (1) assertAccountAccess — lock na konto, (2) filtrowanie po account (`shared` lub bieżące), (3) filtrowanie po dozwolonych kategoriach dla typu kontaktu. Agent fizycznie nie ma dostępu do zablokowanych danych.

### Deno sandbox z kontrolą uprawnień (`03_02_code`)
Agent generujący raporty PDF uruchamia kod w izolowanym sandboxie Deno z granularną kontrolą uprawnień.

```typescript
// sandbox.ts — budowanie flag uprawnień Deno
const buildPermissionFlags = (level: PermissionLevel, workspace: string): string[] => {
  const base = ['--no-prompt'];
  switch (level) {
    case 'safe':    return [...base]; // zero dostępu
    case 'standard': return [...base,
      `--allow-read=${workspace}`, `--allow-write=${workspace}`]; // tylko workspace
    case 'network': return [...base,
      `--allow-read=${workspace}`, `--allow-write=${workspace}`,
      '--allow-net']; // + sieć
    case 'full':   return ['--allow-all'];
  }
};

// Kod jest zapisywany do tymczasowego pliku i uruchamiany z timeoutem
const proc = Bun.spawn(['deno', 'run', '--node-modules-dir=auto', ...flags, tempFile], {
  cwd: workspace,
  env: { ...process.env, NO_COLOR: '1', DENO_NO_UPDATE_CHECK: '1' },
});
```

Kluczowy design: model pisze kod TypeScript, ale nigdy go nie wykonuje bezpośrednio. Kod trafia do temp file → Deno sandbox → z ograniczeniami read/write tylko do workspace. Tool Bridge (HTTP localhost) pozwala kodowi z sandbox wołać narzędzia hosta.

## Najważniejsze zasady (cheat sheet)

1. **Agentic Support > Full Automation** — buduj wyspecjalizowane narzędzia wspierające ludzi, nie autonomiczne systemy zastępujące całe procesy. Mniejsze ryzyko, większa wartość.
2. **Blokuj akcje, nie intencje** — agent nie powinien mieć narzędzia do wysyłania maili. To ważniejsze niż jakikolwiek prompt.
3. **Kontroluj dostęp programistycznie, nie promptem** — programistyczne locki, filtry i scoping są odporne na prompt injection. Instrukcje w prompcie nie są.
4. **Buduj Defense Stack warstwowo** — twarde warstwy (system) usuwają niebezpieczne dane z kontekstu. Miękka warstwa (prompt) działa na "bezpiecznym" zbiorze — nawet jeśli zawiedzie, szkody są ograniczone.
5. **Heartbeat pattern do złożonych zadań** — zamiast ufać agentowi w zarządzaniu planem, niech kod będzie managerem: sprawdza stan, rozwiązuje zależności, przydziela zadania.
6. **Plan jako kontrakt** — zadania z id, statusem, zależnościami, właścicielem i wymaganymi capabilities. Deterministyczny kod decyduje, co można wykonać.
7. **Generuj kod zamiast ładować dane do kontekstu** — 150,000 linii w oknie kontekstowym = halucynacje i koszty. Skrypt w sandboxie = determinizm i precyzja.
8. **Sandbox z granularnymi uprawnieniami** — nie dawaj agentowi `--allow-all`. Ogranicz read/write do workspace, kontroluj dostęp do sieci.
9. **Prompt systemowy traktuj jako publiczny** — nie umieszczaj w nim sekretów, kluczy, wewnętrznych danych. Zakładaj, że zostanie wyekstrahowany.
10. **Regularnie aktualizuj przekonania** — to co dziś jest "niemożliwe" jutro może być trywialne. Nie buduj architektury na dziś, ale nie projektuj na za dwa lata.

## Czego unikać (anty-wzorce)

- **"RAG na całą firmę" jako pierwszy projekt** → **Wyspecjalizowany MVP na konkretny use case** — zbieranie danych z wielu źródeł to ogromny wysiłek, a efekt trudno zweryfikować. Zacznij od onboardingu, FAQ sprzedażowego lub narzędzia dla managerów.
- **Agent z możliwością wysyłania wiadomości** → **Agent przygotowujący szkice, człowiek zatwierdza** — konsekwencje błędu w automatycznie wysłanym mailu mogą być katastrofalne. Draft assistant daje 90% wartości przy 10% ryzyka.
- **Kontrola dostępu przez prompt** → **Programistyczne locki i filtry** — "Nie mieszaj danych między kontami" w prompcie to życzenie, nie zabezpieczenie. `assertAccountAccess()` to gwarancja.
- **Ładowanie tysięcy rekordów do kontekstu** → **Generowanie kodu przetwarzającego dane w sandboxie** — model nie potrafi "liczyć w pamięci" na 150,000 liniach. Napisany przez niego skrypt — tak.
- **All-in-one agent z pełnymi uprawnieniami** → **Dedykowane narzędzia z minimalnym zakresem** — im szerszy zakres, tym więcej powierzchni ataku i edge case'ów. Modułowość = niezawodność.
- **Ufanie agentowi w zarządzaniu wieloetapowym planem** → **Heartbeat pattern z deterministycznym routingiem** — agenci "zapominają" aktualizować listy zadań. Niech kod zarządza stanem, a agenci wykonują przydzielone zadania.

## Sprawdź się (pytania do refleksji)

- **Projektujesz agenta do obsługi wewnętrznego helpdesku IT. Jakie akcje powinien móc wykonywać autonomicznie, a jakie wymagają zatwierdzenia człowieka? Jak zaprojektujesz Defense Stack?** *Wskazówka: pomyśl o tym, które akcje są odwracalne (reset hasła vs usunięcie konta) i jakie dane agent potrzebuje w kontekście.*

- **Masz agenta, który musi przetworzyć 50,000 logów serwera i przygotować raport anomalii. Jak zbudujesz pipeline, żeby uniknąć halucynacji i zoptymalizować koszty?** *Wskazówka: pomyśl o fazach Discover → Process → Output i o tym, co powinien robić kod, a co model.*

- **Heartbeat pattern vs prosty sekwencyjny workflow — kiedy jeden jest lepszy od drugiego?** *Wskazówka: rozważ zadania z zależnościami, możliwość równoległego wykonywania i potrzebę kontaktu z człowiekiem w trakcie.*

- **Twój agent e-mailowy przez prompt injection zaczyna wstawiać wrażliwe dane z konta A do szkiców dla konta B. Jak Twój Defense Stack powinien temu zapobiec — i na której warstwie?** *Wskazówka: pomyśl o tym, co powinno się stać zanim prompt w ogóle zobaczy dane z obu kont.*

- **Kiedy warto zdecydować się na pełną automatyzację procesu mimo ryzyk, a kiedy Agentic Support jest jedyną rozsądną opcją?** *Wskazówka: rozważ konsekwencje błędu, częstotliwość procesu i dostępność człowieka do nadzoru.*
