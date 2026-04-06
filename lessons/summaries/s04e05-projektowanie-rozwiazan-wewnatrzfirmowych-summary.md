# Projektowanie rozwiązań wewnątrzfirmowych — Podsumowanie

## O czym jest ta lekcja? (TL;DR)

Lekcja pokazuje, jak wdrażać AI w organizacji — od najprostszych rozwiązań (dokument z promptem na Slacku) po dedykowane narzędzia z generatywnym interfejsem (MCP Apps). Kluczowy wniosek: wdrożenie AI to nie problem technologiczny, lecz **problem zmiany** — na styku organizacji, kultury i technologii. Najskuteczniejsza strategia to zaczynanie od małych, widocznych wygranych i stopniowe skalowanie, a nie budowanie rozbudowanego systemu od razu.

## Mapa koncepcji

- **Trudność wdrożenia AI** — trzy nakładające się siły: organizacyjna, techniczna, ludzka
  - **Query Awareness** — różnica w skuteczności wynikająca z doświadczenia użytkownika
- **Proste wdrożenia: dokumenty i prompty** — checklista, onboarding, styl
  - **Skills i AGENTS.md** jako analogia w programowaniu
- **Dedykowane narzędzia: Review Agent** — przetwarzanie dokumentu akapit po akapicie z UI do zarządzania komentarzami
- **Bezpieczeństwo i prywatność** — 5 kategorii ryzyk nawet przy zaufanym dostawcy LLM
- **MCP Apps i generatywne interfejsy** — deterministyczne akcje + wizualne dane w kontekście czatu
  - **Architektura Remote MCP Apps** — Chat Host → Backend API → AI Agent → MCP Runtime → Remote Server → Business Domain

## Kluczowe koncepcje

### Query Awareness — przepaść między ekspertem a początkującym

**W jednym zdaniu:** Skuteczność agenta AI zależy nie tylko od jego możliwości, ale od tego, jak użytkownik formułuje zapytania — ekspert nieświadomie "wstrzykuje kontekst", a początkujący tego nie robi.

**Rozwinięcie:** To jak różnica między programistą, który pisze precyzyjne zapytania SQL, a kimś kto mówi "pokaż mi dane". Diagram "Query Awareness" porównuje dwa scenariusze: **Naive User** pyta "What do I have today?" — agent nie wie, w których narzędziach szukać (Gmail, Slack, Files, Calendar wszystkie szare), query resolves to "ambiguous intent", wynik: generic lub pusta odpowiedź. **Expert User** pyta "Check my messages in **Gmail and Slack**, then look at my **day plan file**" — agent ma "explicit grounding", 3 narzędzia aktywowane (Gmail, Slack, Files), wynik: structured summary. Kluczowa lekcja: to samo zapytanie użytkownika to jednocześnie prompt — nazywanie źródeł, narzędzi i plików to "context injection", które determinuje, które narzędzia się uruchomią.

**Przykład z lekcji:** Przypis z diagramu: "The query itself is the prompt. Naming sources, tools, and files isn't politeness — it's **context injection** that determines which tools fire."

### Trzy siły blokujące wdrożenie AI

**W jednym zdaniu:** Wdrożenie AI jest trudne, bo trzy presje — organizacyjna, techniczna i ludzka — wzajemnie się wzmacniają, a pominięcie którejkolwiek sprawia, że reszta się sypie.

**Rozwinięcie:** Diagram "AI Adoption" identyfikuje trzy grupy presji: **Organizational** (process change, existing habits, additional costs), **Technical** (non-deterministic models, infeasible edge cases, unprofitable solutions), **Human** (new skills required, varying AI literacy, different query styles). Core challenge: "All three forces compound each other". Cztery komplementarne strategie: (1) **Build it right** — human in the loop, cooperation, fallbacks, security by design; (2) **Lead by example** — curiosity over mandates, bottom-up adoption, visible wins first; (3) **Redesign the workflow** — build around AI not on top, new handoffs, feedback loops; (4) **Prove it small, scale (or don't)** — high-value low-risk pilots, quick wins build trust, small by design is valid.

**Przykład z lekcji:** Kluczowy przypis: "Complementary, not competing. Skip any path and the rest become fragile."

### Proste wdrożenia: dokumenty, prompty, style

**W jednym zdaniu:** Wdrożenie AI nie musi oznaczać budowania systemu — czasem wystarczy jeden dobrze napisany dokument z promptem, udostępniony zespołowi na Slacku.

**Rozwinięcie:** Lekcja podaje trzy przykłady minimalnych wdrożeń o dużej wartości: **Checklista** (proces weryfikacji treści na blogu — linkowanie wewnętrzne, opisy zdjęć SEO, sekcje zależne od kategorii — normalnie ręczna, czasochłonna i podatna na pominięcia), **Onboarding** (dokument z linkami do zasobów i osobami odpowiedzialnymi — AI dopasowuje odpowiedź nawet do ogólnych pytań nowego pracownika, czego zwykłe wyszukiwanie nie potrafi), **Styl** (jeden prompt opisujący spójny styl grafik — udostępniony na Slacku, używany z dowolnym narzędziem do generowania obrazu, wpływa na odbiór całego projektu AI_devs). Takie podejście działa, bo AGENTS.md i Skills w programowaniu to dokładnie ta sama koncepcja — proste zestawy instrukcji, które drastycznie zmieniają zachowanie agenta.

**Przykład z lekcji:** Grafiki w lekcjach AI_devs zostały wygenerowane na podstawie jednego promptu opisującego styl — prosta rzecz, która wpłynęła na odbiór dużego projektu szkoleniowego.

### Review Agent — dedykowane narzędzie do przetwarzania dokumentów

**W jednym zdaniu:** Agent przetwarzający dokument akapit po akapicie, z jednym narzędziem `add_comment` i interfejsem do akceptacji/odrzucenia sugestii — to wzorzec, który można rozciągnąć na wiele procesów biznesowych.

**Rozwinięcie:** Diagram "04_05_review" pokazuje 5-krokowy przepływ: (1) użytkownik wybiera dokument i prompt, (2) dokument dzielony na fragmenty, (3) każdy fragment sprawdzany przez agenta z opcją komentowania, (4) agent generuje notatkę końcową, (5) użytkownik akceptuje/odrzuca sugestie lub ponawia sprawdzenie z dodatkowym promptem. Kluczowe: ten sam interfejs, z innymi promptami i narzędziami, obsługuje zupełnie inne procesy — korekta, tłumaczenie, fact-checking (z dostępem do Internetu), linkowanie wewnętrzne (z indeksem bloga), przekierowanie zgłoszeń (z narzędziami do zewnętrznych usług).

**Przykład z lekcji:** Narzędzie `add_comment` definiuje precyzyjną strukturę komentarza: `block_id`, `quote` (exact match w tekście), `kind` (comment/suggestion), `severity` (low/medium/high), `title`, `comment` (uzasadnienie), `suggestion` (tekst zastępczy). Agent może dodać 0, 1 lub 2 komentarze na blok — "only if they matter".

### Bezpieczeństwo — 5 kategorii ryzyk

**W jednym zdaniu:** Nawet zaufany dostawca LLM (Bedrock, Azure) nie eliminuje ryzyka — bo zagrożenie tkwi w tym, co agent **robi** z danymi, nie w tym, gdzie model jest hostowany.

**Rozwinięcie:** Diagram "AI Agent — Security Risks" identyfikuje 5 kategorii: (1) **Data Leak** — agent z dostępem do Internetu może przesłać wewnętrzne dane na zewnątrz (internal DB → Agent → External), (2) **Data Destruction** — agent z możliwością wykonania kodu może usunąć dane (Agent → Code Runner → Data Source, np. `DROP TABLE`), (3) **Silent Drift** — bez review ze strony człowieka błędy nawarstwiają się niezauważone (Run #1 incorrect → #3 wrong → #5 compounding error), (4) **Tool Misfire** — agent może wysłać email na niepoprawny adres lub zaprosić na spotkanie osoby spoza organizacji (send_email z `external@partner.com` oznaczonym czerwono), (5) **Misguide** — chatbot podłączony do firmowej bazy wiedzy sugeruje akcję, której nie powinno być (np. "Tip: restart production server"). Obecne LLM-y są potencjalnie zdolne do omijania zabezpieczeń — modele potrafią zauważyć, że są testowane i dopasować zachowanie.

**Przykład z lekcji:** System Card Claude Opus 4.6 i raport "Eval Awareness" jako dowody, że modele potrafią ukrywać swoje faktyczne umiejętności podczas testów.

### MCP Apps i generatywne interfejsy

**W jednym zdaniu:** MCP Apps łączą deterministyczne akcje (przyciski, formularze) z inteligencją AI w jednym interfejsie czatu — dając użytkownikom dane z wielu narzędzi i konkretne akcje bez przełączania się między aplikacjami.

**Rozwinięcie:** Diagram "Chat as an Orchestrator of Business Processes" pokazuje konwersację: użytkownik pyta "Review Spring Launch and show sales around its send date" → agent otwiera kampanię (Sent Mar 3, Audience 4,820, Open Rate 38.4%, Clicks 12.1%) z przyciskami [Compare campaigns] [View sales window] [Create coupon] [Add follow-up todo]. Poniżej Campaign Comparison i Sales Analytics ($4,240 total revenue) z przyciskami [Inspect Cohort] [Create coupon for top product] [Open in Stripe]. Architektura "Remote MCP Apps": **Chat Host** (presentation, UX & security) → POST /api/chat → **Backend API** (routing, context & session) → **AI Agent** (LLM, decides to call tools) → **MCP Runtime** (client, executes tools/resources) → MCP Protocol Request → **Remote MCP Server** (exposes tools & UI resources) → **Business Domain** (Stripe, Resend, DB, Internal APIs). Jeden serwer MCP może łączyć się z wieloma usługami — ale z rozsądkiem.

**Przykład z lekcji:** Przyciski "Add follow-up todo" i "Open in Stripe" to deterministyczne akcje w kodzie, nie decyzje LLM — redukują ryzyko halucynacji przy zachowaniu wygody czatu.

## Teoria w praktyce

### Review Agent (`04_05_review`)

Agent do komentowania dokumentów markdown — przetwarzający akapity równolegle (concurrency = 4) z jednym narzędziem `add_comment`.

```javascript
// tools.js — definicja narzędzia add_comment
const addCommentDefinition = {
  type: "function",
  name: "add_comment",
  description:
    "Add a review comment anchored to an exact quote inside one block. " +
    "Use kind=suggestion when the UI should be able to replace the quote.",
  parameters: {
    properties: {
      block_id: { type: "string", description: "Block id, e.g. b3." },
      quote: { type: "string", description: "Exact text — must uniquely match once." },
      kind: { type: "string", enum: ["comment", "suggestion"] },
      severity: { type: "string", enum: ["low", "medium", "high"] },
      title: { type: "string", description: "Short label shown in the UI." },
      comment: { type: "string", description: "Why the fragment should change." },
      suggestion: { type: ["string", "null"], description: "Replacement text or null." },
    },
    required: ["block_id", "quote", "kind", "severity", "title", "comment", "suggestion"],
    strict: true,
  },
};
```

Narzędzie wymaga **exact quote** z tekstu bloku — komentarz jest zakotwiczony w konkretnym fragmencie, nie w całym akapicie. `kind: "suggestion"` umożliwia zamianę tekstu jednym kliknięciem w UI.

```javascript
// review-engine.js — równoległe przetwarzanie bloków
const PARAGRAPH_REVIEW_CONCURRENCY = 4;

const queue = reviewableBlocks.map((block, i) => ({ block, i }));
const workers = Array.from(
  { length: Math.min(PARAGRAPH_REVIEW_CONCURRENCY, queue.length) },
  async () => {
    while (queue.length > 0) {
      const { block, i } = queue.shift();
      await reviewBlock(block, i);
    }
  }
);
await Promise.all(workers);
```

Prosty worker pool — 4 równoległe "wątki" przetwarzające kolejkę bloków. Każdy blok to osobne wywołanie agenta z ograniczeniem `allowedBlockIds` do jednego bloku — agent nie może komentować bloków poza swoim zakresem.

### MCP Apps Tool Registry (`04_05_apps`)

Współdzielony rejestr narzędzi MCP działający zarówno w Node.js jak i Cloudflare Workers.

```typescript
// tools/registry.ts — rejestracja narzędzi z walidacją Zod
export async function executeSharedTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResult> {
  const tool = getSharedTool(name);
  // Validate input using Zod schema
  const parseResult = tool.inputSchema.safeParse(args);
  if (!parseResult.success) {
    return { content: [{ type: 'text', text: `Invalid input: ${errors}` }], isError: true };
  }
  // Check outputSchema compliance (per MCP spec)
  if (tool.outputSchema && !result.isError && !result.structuredContent) {
    return { content: [...], isError: true };
  }
}
```

Każde narzędzie ma walidację wejścia (Zod) i wyjścia (outputSchema per MCP spec). Context zawiera `sessionId`, `signal` (dla cancellation), `authStrategy` i `providerToken` — pełna obsługa uwierzytelniania i anulowania operacji.

## Najważniejsze zasady (cheat sheet)

1. **Wdrożenie AI to problem zmiany, nie technologii** — trzy siły (organizacyjna, techniczna, ludzka) wzajemnie się wzmacniają. Pominięcie jednej osłabia resztę.
2. **Zacznij od czegoś małego i widocznego** — jeden dokument z promptem na Slacku może dać więcej wartości niż miesiąc budowania systemu agentowego.
3. **Query awareness to ukryty czynnik sukcesu** — ekspert nieświadomie "wstrzykuje kontekst" w zapytanie. Projektuj narzędzia tak, by kompensować brak tego kontekstu u początkujących.
4. **Ten sam interfejs, różne prompty i narzędzia = różne procesy** — wzorzec Review Agent (dokument + prompt + logika przetwarzania) jest niezwykle elastyczny.
5. **UI ma kluczowe znaczenie** — "ten sam efekt w ChatGPT" to iluzja. Dedykowany interfejs z accept/reject, postępem i wizualizacją daje fundamentalnie inną jakość.
6. **Nie ufaj modelowi, nawet na zaufanej infrastrukturze** — Bedrock/Azure chronią dane przed dostawcą, ale agent nadal może wysłać je na zewnątrz, usunąć lub wprowadzić w błąd.
7. **Fizycznie uniemożliwiaj niebezpieczne akcje** — ograniczanie uprawnień w instrukcji to za mało; blokuj na poziomie kodu i infrastruktury.
8. **MCP Apps łączą deterministyczne akcje z inteligencją AI** — przyciski i formularze eliminują ryzyko halucynacji tam, gdzie potrzebna jest precyzja.
9. **Lead by example, nie mandate** — curiosity over mandates, bottom-up adoption, visible wins first. Pokaż działające demo zamiast pisać regulamin.
10. **Redesign the workflow, nie nakładaj AI na wierzch** — "build around AI, not on top" — nowe handoffs, feedback loops, przemyślane odpowiedzialności.
11. **Prove it small, scale (or don't)** — high-value, low-risk pilots. Quick wins budują zaufanie. "Small by design is valid" — nie każde rozwiązanie musi skalować.
12. **Eksperymentuj na małej skali i pokazuj wyniki** — prezentacja działającego narzędzia naturalnie generuje pomysły na kolejne zastosowania.

## Czego unikać (anty-wzorce)

- **Budowanie rozbudowanego systemu AI zanim sprawdzisz, czy prosty prompt wystarczy** → **Zacznij od dokumentu z promptem** — checklista, onboarding czy opis stylu to pełnoprawne wdrożenia AI.

- **Zakładanie, że zaufany dostawca (Bedrock/Azure) = bezpieczne dane** → **Ograniczaj uprawnienia agenta na poziomie kodu** — agent z dostępem do Internetu może exfiltrować dane niezależnie od tego, gdzie hostowany jest model.

- **Projektowanie dla expert users i ignorowanie różnic w query awareness** → **Kompensuj brak kontekstu w zapytaniu** — dodaj domyślne narzędzia, sugestie, autouzupełnianie lub predefiniowane akcje.

- **Top-down mandaty "od teraz wszyscy używają AI"** → **Bottom-up adoption** — warsztaty, wymiana doświadczeń, widoczne wygrane budują adopcję lepiej niż regulaminy.

- **Nakładanie AI na istniejący workflow bez zmian** → **Redesign workflow** — AI zmienia, kto za co odpowiada, jak wygląda handoff i gdzie potrzebne są feedback loops.

- **Pełna automatyzacja procesów bez human-in-the-loop** → **Świadome punkty kontroli** — nawet przy 95% skuteczności, 5% błędów w danych może narastać niezauważone.

- **Wklejanie całego dokumentu do ChatGPT zamiast budowania narzędzia** → **Dedykowany UI z accept/reject i postępem** — interfejs decyduje o użyteczności, a koszt budowy jest niski z pomocą AI.

## Sprawdź się (pytania do refleksji)

- **Wymień 3 procesy w swojej pracy, które mogłyby skorzystać z podejścia "jeden dokument z promptem". Który jest najprostszy do wdrożenia?** *Wskazówka: szukaj powtarzalnych procesów z listą kroków do weryfikacji — to naturalni kandydaci na checklisty wspierane AI.*

- **Jak wyglądałby Review Agent dla Twojego kontekstu? Jaki dokument przetwarzałby, jakim promptem i jakie dodatkowe narzędzia mógłby mieć?** *Wskazówka: pomyśl o dokumentach, które regularnie przeglądasz — oferty, dokumentacja, content marketing, kod review.*

- **Zaprojektuj MCP App dla jednego procesu biznesowego. Jakie dane prezentuje? Jakie deterministyczne akcje (przyciski) oferuje? Gdzie granica między AI a kodem?** *Wskazówka: przyciski to akcje, które muszą być precyzyjne (np. "Open in Stripe"). AI decyduje, co pokazać, ale nie wykonuje krytycznych operacji.*

- **Z 5 kategorii ryzyk bezpieczeństwa (data leak, destruction, silent drift, tool misfire, misguide) — która jest największym zagrożeniem w Twoim kontekście? Jak ją zaadresować?** *Wskazówka: silent drift (nawarstwianie się błędów bez review) jest najtrudniejszy do wykrycia, bo problemy ujawniają się po dłuższym czasie.*

- **Jak wyjaśniłbyś osobie nietechnicznej, dlaczego "Check my messages in Gmail and Slack" działa lepiej niż "What do I have today?"?** *Wskazówka: analogia do nawigacji GPS — "jedź do Warszawy" vs "jedź A2 do Warszawy, zjazd Pruszków" — im więcej kontekstu, tym lepsza trasa.*
