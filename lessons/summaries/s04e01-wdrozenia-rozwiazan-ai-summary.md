# Wdrożenia rozwiązań AI — Podsumowanie

## O czym jest ta lekcja? (TL;DR)

Wdrożenie AI zaczyna się od zderzenia oczekiwań ("zrobimy J.A.R.V.I.S.a!") z rzeczywistością ("agent nie przetworzy 50-stronowego PDF"). Ta lekcja na przykładzie **Cyfrowego Ogrodu** — osobistej bazy wiedzy z agentem AI — pokazuje pełen proces: od ogólnych fundamentów, przez mapowanie decyzji architektonicznych, po konkretny system z sandboxem (Daytona), publikacją (GitHub Pages), skills i workflows. Kluczowa lekcja: **nie możesz zrobić wszystkiego, ale możesz zrobić cokolwiek** — trzeba wybrać.

## Mapa koncepcji

- **Oczekiwania vs rzeczywistość** — ogromne możliwości, ale konkretne ograniczenia (kontekst, koszty, szybkość)
  - **"Nie możesz zrobić wszystkiego, ale możesz zrobić cokolwiek"** — wybór fokusa jest kluczowy
- **Synchroniczna vs asynchroniczna współpraca** — dwie kategorie z różnymi priorytetami
  - **Synchroniczna** — interfejs, personalizacja, feedback, nadzór człowieka
  - **Asynchroniczna** — integracja, zdefiniowane procesy, autonomia, raportowanie
- **Mapa decyzji architektonicznych** — Constraint → Decision → Consequence dla każdego wymiaru
  - **Użytkownik, treść, format, integracje, publikacja, dostępność**
- **Fundament + iteracja** — minimalny punkt startowy, szybkie testy, stopniowa rozbudowa
- **Balans kod vs AI** — elementy klasycznej aplikacji nadal stanowią większość architektury

## Kluczowe koncepcje

### Zderzenie oczekiwań z rzeczywistością

**W jednym zdaniu:** Agent z dostępem do terminala, plików i kodu ma teoretycznie nieograniczone możliwości — ale w praktyce nie przetworzy zbyt długich dokumentów, nie zobaczy obrazów w tekście, jest za wolny i za drogi.

**Rozwinięcie:** To jak kupno samochodu terenowego — teoretycznie pojedzie wszędzie, ale w praktyce ma ograniczenia paliwa, prześwitu i wytrzymałości. Agent Cyfrowego Ogrodu może: poruszać się po bazie wiedzy, tworzyć/edytować markdown, uruchamiać kod, publikować zmiany. Ale chwilę później orientujesz się, że nie widzi obrazów, nie parsuje PDF-ów, nie wejdzie na niektóre strony, generuje za duże koszty. Każdy z tych problemów **da się rozwiązać** — ale nie wszystkie naraz. Stąd fundamentalne pytanie wdrożeniowe: **na czym skupić uwagę?**

**Przykład z lekcji:** Agent `04_01_garden` to punkt startowy z celowo ograniczoną funkcjonalnością (brak interfejsu, brak kompresji kontekstu, minimalna liczba narzędzi). Jego użyteczność jest ograniczona, ale stanowi **fundament** do dalszej rozbudowy.

### Synchroniczna vs asynchroniczna współpraca z AI

**W jednym zdaniu:** Praca synchroniczna (czat, edytor) wymaga interfejsu, personalizacji i nadzoru człowieka; praca asynchroniczna (cron, webhooks) wymaga zdefiniowanych procesów, autonomii i minimalnego zaangażowania — to prawie dwie różne kategorie produktów.

**Rozwinięcie:** Synchroniczna: użytkownik rozmawia z agentem w edytorze, prosi o dodanie książek, widzi wynik natychmiast. Priorytet: UX, personalizacja, współdzielony stan, feedback loop. Asynchroniczna: agent co noc przeszukuje Internet, przygotowuje notatki z researchu, wysyła newsletter — bez udziału człowieka. Priorytet: precyzyjnie zdefiniowane procesy, integracje, self-recovery, raportowanie artefaktów. Najciekawsze jest podejście **hybrydowe**: agent działa w tle (async), ale użytkownik może go "przywołać" do bezpośredniej rozmowy (sync).

**Przykład z lekcji:** Diagram "Agentic Collaboration Modes" zestawia oba tryby: synchroniczny (configuration → direct message → agentic loop → human in the loop → shared state → result) vs asynchroniczny (integration setup → schedule trigger → defined workflow → feedback → report/artifact). Cyfrowy Ogród łączy oba: edytor markdown (sync) + agenty researchu/newslettera (async).

### Mapa decyzji architektonicznych

**W jednym zdaniu:** Każdy wymiar projektu (użytkownik, treść, format, integracje, publikacja, dostępność) ma constraint, który prowadzi do decision, która ma consequence — i te łańcuchy trzeba przejść świadomie.

**Rozwinięcie:** To nie jest abstrakcja — to praktyczny framework. Przykład: **Constraint**: użytkownik jest programistą → **Decision**: pozwól na wyższą złożoność narzędzi (terminal, code execution) → **Consequence**: sandbox wymagany dla bezpieczeństwa (Daytona). Albo: **Constraint**: HTML jest niewygodny do pisania → **Decision**: markdown jako source format → **Consequence**: pipeline budowania jest obowiązkowy (grove/marked.ts). Każda decyzja jest odwracalna, **z wyjątkiem dostępności** — remote-first to commitment strukturalny, który kształtuje wszystko inne.

**Przykład z lekcji:** Diagram "Architecture Decision Map" pokazuje 6 wymiarów jako tabelę Constraint → Decision → Consequence. Np. Content: "User-authored, personal" → "Agent enriches, never replaces" → "Canonical content stays human (promotion gate)". Agent tworzy drafty, człowiek promuje do publikacji.

### Skills i Workflows — agenci działający według plików

**W jednym zdaniu:** Workflows to pliki markdown opisujące procesy (np. research), skills to bardziej złożone definicje z dozwolonymi narzędziami i skryptami runtime'owymi — razem dają agentowi elastyczną, rozszerzalną strukturę działania.

**Rozwinięcie:** Workflow to trigger + instrukcje: gdy użytkownik pyta o research, agent przeszukuje web, wyciąga 3-5 kluczowych wniosków, zapisuje notatkę w `vault/research/`. Skill to bardziej zaawansowany konstrukt — `product-compare` ma dozwolone narzędzia (`web_search, code_mode, terminal`), 9-sekcyjny schemat per produkt, i deterministyczny skrypt JavaScript (`merge-overview.js`) uruchamiany przez `code_mode`, który łączy notatki w porównanie. Użytkownik aktywuje skill przez `/product-compare`, a system automatycznie zawęża narzędzia i wstrzykuje metadane.

**Przykład z lekcji:** Skill `product-compare` wymusza: (1) web search per produkt, (2) notatka z 9 sekcjami + źródła URL, (3) explicit "not found" dla brakujących danych, (4) merge script walidujący kompletność. To deterministyczna struktura wokół niedeterministycznego agenta.

### Code Mode — sandboxowane wykonywanie kodu

**W jednym zdaniu:** Narzędzie `code_mode` pozwala agentowi generować i uruchamiać TypeScript w sandboxie Daytona z typed API (`codemode.vault.read/write/list/search`, `codemode.runtime.exec`, `codemode.output.set`).

**Rozwinięcie:** Agent nie dostaje surowego shell access — dostaje API do vault (read/write/list/search/move) i runtime (exec). Kod jest uruchamiany w izolowanym sandboxie Daytona z timeoutem 30s. `LazySandbox` zarządza cyklem życia: tworzenie sandbox on-demand, upload vault na start, bidirectional sync co 700ms (lokalne zmiany → sandbox), download vault na destroy. To pozwala agentowi na potężne operacje (parsowanie danych, generowanie plików, agregowanie treści) bez ryzyka uszkodzenia lokalnego systemu.

**Przykład z lekcji:** Runner `code_mode` buduje wrapper z `codemode` obiektem, który abstrahuje filesystem sandboxa. Agent pisze TypeScript używający `codemode.vault.read()` zamiast bezpośredniego `fs.readFile()` — izolacja na poziomie API.

### Fundament + szybkie iteracje

**W jednym zdaniu:** Zacznij od minimalnego fundamentu (agent + vault + build), testuj założenia szybkimi prototypami, i stopniowo rozbudowuj — AI drastycznie przyspiesza cykl prototypowania.

**Rozwinięcie:** Klasyczny cykl prototypowania: pomysł → projekt → implementacja → test → feedback → iteracja — tygodnie. Z AI: pomysł → wygenerowanie prototypu → test → feedback → iteracja — godziny lub dni. Nie chodzi tylko o szybkość: chodzi o **testowanie wielu pomysłów równolegle** i **weryfikowanie tez w rozbudowanych środowiskach testowych**. Prosty test "czy agent dobrze wzbogaca notatki?" może ujawnić, że potrzebna jest właściwość frontmatter z wskazówką użytkownika — zanim zainwestujesz tygodnie w pełną implementację.

**Przykład z lekcji:** Trzy testy do przeprowadzenia na starcie: (1) wzbogacanie — czy model sam wie co dodać? (2) budowanie — czy agent dobrze klasyfikuje URL do właściwej sekcji? (3) dostępność — czy chatbot jest konieczny, czy wystarczy wyszukiwarka?

## Teoria w praktyce

### Agent loop z response chaining (`04_01_garden`)
Pętla agenta łączy turowe wywołanie LLM z równoległym wykonywaniem narzędzi i chainingiem odpowiedzi.

```typescript
// loop.ts — core agent loop z OpenAI response chaining
export async function run(userMessage: string, context: ToolContext): Promise<AgentResult> {
  const template = await loadTemplate("main");
  const skillContext = resolveSkillContext(userMessage, template.skills, template.tools);
  const tools = definitions(skillContext.toolNames);

  let input: ResponseInputItem[] = [{ role: "user", content: skillContext.userMessage }];
  let previousResponseId: string | undefined;

  for (let turn = 0; turn < config.maxTurns; turn++) {
    const response = await completion({
      model: template.model, instructions: template.instructions,
      input, tools, previousResponseId,
    });
    previousResponseId = response.id; // response chaining

    const toolCalls = response.output.filter(
      (item): item is ResponseFunctionToolCall => item.type === "function_call",
    );
    if (toolCalls.length === 0) {
      return { text: response.output_text, turns: turn + 1, totalTokens };
    }
    input = await Promise.all(toolCalls.map((call) => executeToolCall(call, context)));
  }
}
```

`previousResponseId` zapewnia context chaining bez ręcznego zarządzania historią. Narzędzia wykonywane równolegle (`Promise.all`).

### Dynamiczny template z vault (`04_01_garden`)
Agent ładuje tożsamość, workflows i skills z plików markdown w vault — zmiana pliku zmienia zachowanie agenta.

```typescript
// template.ts — ładowanie instrukcji z vault
export async function loadTemplate(agent: string): Promise<AgentTemplate> {
  const path = join(SYSTEM_DIR, `${agent}.agent.md`);
  const { data, content } = matter(await Bun.file(path).text());

  const workflows = await loadWorkflows();    // vault/system/workflows/*.md
  const loadedSkills = await loadSkills();     // vault/system/skills/*/SKILL.md
  const today = new Date().toISOString().slice(0, 10);

  const instructions = [workflows, loadedSkills.section, content.trim()]
    .filter(Boolean).join("\n\n")
    .replaceAll("{{date}}", today);           // inject current date

  return {
    name: data.name ?? agent,
    model: data.model ?? "gpt-5.2",
    tools: data.tools ?? [],
    instructions,
    skills: loadedSkills.skills,
  };
}
```

Workflows i skills to po prostu pliki markdown — dodanie nowego workflow = dodanie pliku, zero zmian w kodzie.

### LazySandbox — bidirectional sync (`04_01_garden`)
Sandbox Daytona tworzony leniwie, z ciągłą synchronizacją vault między lokalnym systemem a sandboxem.

```typescript
// sandbox/client.ts — lazy sandbox z bidirectional sync
export class LazySandbox {
  private instance: Sandbox | null = null;
  private localSyncTimer: ReturnType<typeof setInterval> | null = null;

  async get(): Promise<Sandbox> {
    if (!this.instance) {
      const sandbox = await daytona.create({ language: "typescript" });
      await initSandbox(sandbox);              // upload vault
      this.instance = sandbox;
      this.startLocalSyncLoop();               // push local changes every 700ms
    }
    return this.instance;
  }

  async destroy(): Promise<void> {
    if (this.instance) {
      this.stopLocalSyncLoop();
      await this.syncLocalVaultNow();          // last push
      await this.syncVaultBackNow();           // pull sandbox changes back
      await this.instance.delete();
    }
  }
}
```

Użytkownik edytuje pliki lokalnie (Obsidian), zmiany trafiają do sandboxa co 700ms. Przy zamknięciu — sandbox vault jest pobierany z powrotem.

## Najważniejsze zasady (cheat sheet)

1. **"Nie możesz zrobić wszystkiego, ale możesz zrobić cokolwiek"** — wybierz obszary fokusa. Próba automatyzacji "wszystkiego" to recepta na porażkę.
2. **Zacznij od fundamentu, nie od wizji** — minimalny agent + vault + build to lepszy start niż "pełna automatyzacja z 10 integracjami".
3. **Synchroniczna i asynchroniczna to różne produkty** — inne priorytety (UX vs procesy), inny poziom nadzoru, inny design. Hybrydowe podejście łączy oba.
4. **Mapa decyzji: Constraint → Decision → Consequence** — przejdź przez każdy wymiar (user, content, format, integrations, publish, availability) świadomie.
5. **Agent wzbogaca, nie zastępuje** — treść tworzy człowiek, agent drafuje/enrichuje/kategoryzuje. Promotion gate: agent tworzy drafty, człowiek promuje.
6. **Workflows i skills jako pliki markdown** — dodanie nowego procesu = dodanie pliku. Zero zmian w kodzie. Agenci rozszerzalni przez design.
7. **Sandbox jest obowiązkowy** — gdy agent ma terminal i code execution, Daytona (lub podobne) chroni przed niekontrolowanymi efektami ubocznymi.
8. **Bidirectional sync: użytkownik ↔ sandbox** — lokalne zmiany (Obsidian) trafiają do sandboxa, zmiany agenta wracają na dysk. Jedno źródło prawdy: vault.
9. **Kod to nadal większość architektury** — elementy klasycznej aplikacji (build pipeline, CI/CD, sync, routing) stanowią 60-80% systemu. AI to ważna, ale nie dominująca warstwa.
10. **Szybkie testy weryfikują założenia** — zanim zainwestujesz tygodnie, przetestuj kluczowe tezy (wzbogacanie, klasyfikacja, dostępność) prototypem w godziny.
11. **Remote-first to nieodwracalne commitment** — jeśli agent ma być dostępny z dowolnego miejsca, vault musi być online. Ta decyzja kształtuje resztę architektury.

## Czego unikać (anty-wzorce)

- **Budowanie J.A.R.V.I.S.a od dnia pierwszego** → **Minimalny fundament z możliwością rozbudowy** — ogromna wizja bez fundamentu to projekt, który nigdy nie ruszy.
- **"Pełna automatyzacja" jako cel** → **Współpraca AI + człowiek z jasnym podziałem ról** — AI generujące cały blog nie daje wartości użytkownikowi. AI wzbogacające notatki — tak.
- **Pomijanie ograniczeń na etapie planowania** → **Jawne mapowanie constraints** — "agent nie widzi obrazów" i "agent jest za wolny" to nie problemy do rozwiązania później — to constraints kształtujące architekturę teraz.
- **Jeden agent do wszystkiego** → **Wyspecjalizowani agenci ze współdzielonym vault** — research agent, newsletter agent, learning agent — każdy z dedykowanym procesem, wymiana danych przez pliki.
- **Code execution bez sandboxa** → **Daytona/Docker z granularnymi uprawnieniami** — agent z `rm -rf /` w terminalu to katastrofa czyha na moment nieuwagi.
- **Tygodnie planowania przed pierwszym testem** → **Szybkie prototypy weryfikujące kluczowe założenia** — AI przyspiesza cykl prototypowania z tygodni do godzin. Wykorzystaj to.

## Sprawdź się (pytania do refleksji)

- **Projektujesz wewnątrzfirmowy system wiedzy z AI. Jak wyglądałaby Twoja mapa decyzji (Constraint → Decision → Consequence) dla wymiarów: użytkownik (nietechniczny), treść (poufna), dostępność (wiele osób)?** *Wskazówka: porównaj z Cyfrowym Ogrodem — co się zmienia gdy user nie jest programistą i dane nie są publiczne?*

- **Twój agent Cyfrowego Ogrodu ma zarówno tryb synchroniczny (czat) jak i asynchroniczny (nightly research). Jak zaprojektujesz współdzielenie stanu, żeby oba tryby nie kolidowały?** *Wskazówka: pomyśl o vault jako single source of truth i o tym, kto ma prawo do write w danym momencie.*

- **Kiedy "nie stosowanie AI" jest lepszą decyzją niż automatyzacja? Podaj 2-3 konkretne scenariusze z kontekstu osobistej bazy wiedzy.** *Wskazówka: pomyśl o zadaniach, gdzie wartość leży w samym procesie (np. pisanie), nie w wyniku.*

- **Masz budżet na 3 integracje dla Cyfrowego Ogrodu. Które wybierasz i dlaczego? Jak priorytetyzujesz?** *Wskazówka: pomyśl o ROI — która integracja daje największą wartość przy najmniejszym ryzyku i koszcie.*

- **Agent z code_mode może uruchamiać dowolny TypeScript w sandboxie. Jakie dodatkowe zabezpieczenia byś dodał poza sandboxem Daytona?** *Wskazówka: pomyśl o timeoutach, limitach zasobów, whiteliście operacji i logowaniu.*
