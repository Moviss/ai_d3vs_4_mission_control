# S05E02 — Zestaw narzędzi — Podsumowanie

## O czym jest ta lekcja? (TL;DR)

Lekcja to praktyczny przegląd narzędzi i platform, które warto znać budując aplikacje z generatywnym AI. Nie chodzi o teoretyczne wymienienie bibliotek, ale o zrozumienie **kiedy i dlaczego** sięgać po konkretne rozwiązania — od renderowania czatu ze strumieniowaniem, przez agentów głosowych, po strategie wyszukiwania kontekstu. Kluczowy przekaz: nie buduj wszystkiego od zera, ale też nie komplikuj architektury bez realnej potrzeby.

## Mapa koncepcji

- **Interfejs czatu dla agentów** — renderowanie strumieniowanego Markdown z niestandardowymi blokami to fundament UX agenta
  - **Biblioteki renderujące** — markdown-it, highlight.js, DOMPurify, remend, marked rozwiązują konkretne problemy strumieniowania
  - **Wirtualizacja listy wiadomości** — niezbędna przy setkach/tysiącach wiadomości w konwersacji
- **Agenci głosowi** — dwa tryby interakcji: STT/TTS (3 modele) vs Realtime (1 model multimodalny)
- **Ekosystem narzędzi** — gotowe rozwiązania do przeglądarki, sandbox'ów, przeszukiwania sieci, audio/wideo
- **Architektura wyszukiwania (RAG)** — od prostych rozszerzeń bazy danych po dedykowane silniki wyszukiwania i bazy wektorowe
  - **Proces decyzyjny** — dobieranie złożoności architektury do skali i wymagań projektu
- **Własne narzędzia** — budowanie biblioteki promptów, CLI, serwerów MCP i integracji dopasowanych do swoich potrzeb

## Kluczowe koncepcje

### Generatywny interfejs czatu

**W jednym zdaniu:** Interfejs czatu dla agenta AI to nie prosty komunikator — wymaga renderowania strumieniowanego Markdown, niestandardowych bloków (reasoning, narzędzia, artefakty) i optymalizacji dla długich konwersacji.

**Rozwinięcie:** Pomyśl o tym jak o edytorze kodu vs prostym polu tekstowym — niby oba wyświetlają tekst, ale jeden obsługuje kolorowanie składni, autouzupełnianie i nawigację. Podobnie interfejs agenta musi jednocześnie: naprawiać niekompletny Markdown w trakcie strumieniowania (np. niezamknięte bloki kodu), renderować bloki reasoning/narzędzi/artefaktów jako osobne komponenty, obsługiwać wirtualizację dla setek wiadomości i dbać o detale UX jak animacje czy kursor typowania.

**Przykład z lekcji:** Grafika z przykładu `05_02_ui` pokazuje interfejs z oddzielnymi blokami: wiadomość użytkownika, sekcja THINKING (reasoning), wywołania narzędzi GET_SALES_REPORT i RENDER_CHART z parametrami i statusami, osadzony wykres słupkowy jako artefakt, wyjaśnienie tekstowe i blok kodu Python — wszystko w jednej odpowiedzi agenta.

### Zestaw bibliotek do renderowania Markdown w strumieniu

**W jednym zdaniu:** Pięć bibliotek tworzy pipeline: tokenizacja narastającego tekstu (marked) → naprawa niekompletnej składni (remend) → konwersja na HTML (markdown-it) → kolorowanie kodu (highlight.js) → sanityzacja (DOMPurify).

**Rozwinięcie:** Każda biblioteka rozwiązuje inny problem. Bez `marked` musielibyśmy re-renderować całą wiadomość przy każdym tokenie — jak przebudowywanie całego domu po dołożeniu jednej cegły. Bez `remend` niezamknięty blok kodu `` ```typescript `` w trakcie strumieniowania "zjadłby" resztę treści. A bez `DOMPurify` model mógłby wstrzyknąć złośliwy JavaScript — to nie paranoja, tylko krytyczne zabezpieczenie, bo LLM generuje dowolny HTML.

**Przykład z lekcji:** W kodzie `05_02_ui` widać to w praktyce: `streaming-markdown.ts` dzieli treść na "committed segments" (zamknięte bloki, renderowane raz) i "live tail" (aktualnie strumieniowany blok, re-renderowany co delta). Dzięki temu przy 1500 wiadomościach przeglądarka nie zamiera.

### Tryby agentów głosowych: STT/TTS vs Realtime

**W jednym zdaniu:** Agent głosowy może działać w trybie trzech oddzielnych modeli (Speech-to-Text → LLM → Text-to-Speech) albo jednego modelu multimodalnego (Gemini Live), co fundamentalnie zmienia architekturę i opóźnienia.

**Rozwinięcie:** To jak różnica między tłumaczem konferencyjnym a osobą dwujęzyczną. Tłumacz (tryb STT/TTS) słucha → przetwarza tekst → mówi — trzy kroki, wyraźna granica między audio a tekstem, wyższa latencja. Osoba dwujęzyczna (tryb Realtime) przetwarza wszystko natywnie w jednym umyśle — niższa latencja, brak konwersji, ale drożej. W trybie STT/TTS mamy pełną kontrolę nad każdym krokiem (możemy np. podmienić TTS na ElevenLabs), w trybie Realtime delegujemy wszystko jednemu modelowi.

**Przykład z lekcji:** Diagram "Voice Agent Modes" z lekcji jasno to ilustruje: lewa strona (STT/TTS) to trzy pudełka modeli połączone strzałkami z etykietami "audio → text", "text → text", "text → audio". Prawa strona (Realtime) to jedno zielone pudełko "Gemini Live" obsługujące natywnie audio, tekst, obrazy i wideo. Tagi podsumowujące: „3 models / text boundary / higher latency" vs „1 model / no conversion / lower latency".

### Architektura wyszukiwania: rozszerzenia bazy vs dedykowane silniki

**W jednym zdaniu:** Wyszukiwanie kontekstu dla RAG można zrealizować prostymi rozszerzeniami bazy danych (fts5, sqlite-vec) albo dedykowanymi silnikami (Elasticsearch, Qdrant) — wybór zależy od skali i wymagań, nie od ambicji.

**Rozwinięcie:** To jak wybór między SQLite a klastrem PostgreSQL — oba przechowują dane, ale jeden uruchamiasz jednym plikiem, a drugi wymaga infrastruktury. Rozszerzenia bazy danych (fts5 + sqlite-vec) dają hybrydowe wyszukiwanie w jednej transakcji, bez synchronizacji, ale ze skalą ograniczoną do jednego serwera. Dedykowane silniki (PostgreSQL + Elasticsearch + Qdrant) wymagają synchronizacji danych między trzema magazynami, ale oferują masową skalę i zaawansowane filtrowanie. Ważne: rola wyszukiwania semantycznego spadła — twórcy Claude Code opierają się wyłącznie o grep, a Cursor łączy oba podejścia.

**Przykład z lekcji:** Diagram "RAG Architecture Patterns" porównuje oba podejścia: po lewej dane trafiają do jednej bazy SQLite/PostgreSQL z rozszerzeniami, zapytanie hybrydowe (`WHERE fts MATCH ? OR vec_distance < 0.3`) zwraca wyniki z jednego źródła. Po prawej te same dane muszą być zsynchronizowane do trzech magazynów (PostgreSQL, Elasticsearch, Qdrant), zapytania idą równolegle (FTS + VEC), wyniki łączy RRF/re-rank, a na końcu trzeba jeszcze pobrać pełne rekordy z PostgreSQL po shared ID.

### Proces decyzyjny przy wyborze wyszukiwania

**W jednym zdaniu:** Zanim sięgniesz po bazę wektorową, sprawdź czy nie wystarczy wczytanie dokumentów do kontekstu, nawigacja po plikach tekstowych, albo grep.

**Rozwinięcie:** Lekcja prezentuje cztery poziomy złożoności, od najprostszego: (1) bezpośrednie wczytywanie treści — jak pamięć ChatGPT, która priorytetyzuje szybkość nad skuteczność; (2) agent nawigujący po plikach z grepem — proste i często wystarczające; (3) podejście hybrydowe z wyszukiwaniem semantycznym — ale tylko jako rozszerzenie grepa/FTS, nigdy samodzielnie; (4) grafy wiedzy — najwyższa skuteczność, ale też najwyższa złożoność i koszt. Kluczowa zasada: stosowanie wyłącznie wyszukiwania semantycznego jest już nierekomendowane.

**Przykład z lekcji:** Autor podkreśla, że w swoich projektach wykorzystuje pierwsze trzy podejścia i „raczej nie ma tutaj uniwersalnego rozwiązania". Analiza pamięci ChatGPT sugeruje, że nawet OpenAI znacząco priorytetyzuje szybkość działania nad skutecznością wyszukiwania.

### Budowanie własnego zestawu narzędzi

**W jednym zdaniu:** Wartość nie leży w pojedynczych narzędziach, ale w komponowalnym zestawie — promptów, integracji CLI/MCP, sandboxów i interfejsów — który dopasowujesz do swoich potrzeb jak klocki LEGO.

**Rozwinięcie:** Lekcja wymienia siedem obszarów, w których warto budować własne rozwiązania: biblioteka promptów (przypisanych do skrótów klawiszowych), zarządzanie plikami, dostęp do chmury, generowanie dokumentów, przetwarzanie mediów, sandboxe dla agentów, oraz CLI/MCP jako przenośne integracje. Kluczowe jest to, że nawet prosta integracja (jeden serwer MCP, jedno narzędzie CLI) natychmiast staje się częścią codziennej pracy i otwiera oczy na potrzebę kolejnych.

**Przykład z lekcji:** Wśród gotowych narzędzi lekcja wskazuje m.in. `just-bash` (wirtualny system plików przez komendy bash — alternatywa dla Files MCP bez dawania agentowi dostępu do terminala), `agent-browser` (lokalna przeglądarka headless z komendami zoptymalizowanymi pod agentów) czy `live-kit` (framework do interfejsów audio/video z detekcją ciszy i przerywania).

## Teoria w praktyce

### Inkrementalne renderowanie Markdown (`05_02_ui`)
Przykład `05_02_ui` implementuje pełny pipeline renderowania czatu w Svelte. Kluczowa innowacja to podział treści na "committed segments" i "live tail" — zamiast re-renderować całą wiadomość przy każdym tokenie.

```typescript
// streaming-markdown.ts — inkrementalna aktualizacja widoku
const delta = content.slice(currentView.processedContent.length)
const candidateTail = currentView.liveTail + delta
const blocks = parseMarkdownIntoBlocks(candidateTail)
const { finalizedSources, liveTail } = splitBlocks(blocks, streaming)

// Zamknięte bloki dołączane do niezmiennej listy,
// tylko "ogon" jest re-parsowany co delta
return {
  committedSegments: currentView.committedSegments.concat(
    toSegments(blockId, currentView.nextSegmentIndex, finalizedSources),
  ),
  liveTail,  // tylko ten fragment jest re-renderowany
  processedContent: content,
  nextSegmentIndex: currentView.nextSegmentIndex + finalizedSources.length,
}
```

To samo podejście co append-only log w bazach danych: zamknięte segmenty są immutable i cachowane, re-renderowany jest tylko aktualnie strumieniowany "ogon". Dzięki temu interfejs pozostaje responsywny nawet przy bardzo długich odpowiedziach.

### Blokowy renderer wiadomości (`05_02_ui`)
Komponent `BlockRenderer.svelte` traktuje każdą odpowiedź agenta jako sekwencję typowanych bloków — nie jako monolityczny tekst.

```svelte
<!-- BlockRenderer.svelte — dispatcher bloków wg typu -->
{#each visibleBlocks as block, index (block.id)}
  {#if block.type === 'text'}
    <TextBlock {block} shouldTypewrite={gatingActive} />
  {:else if block.type === 'thinking'}
    <ThinkingBlock {block} />
  {:else if block.type === 'tool_interaction'}
    <ToolBlock {block} />
  {:else if block.type === 'artifact'}
    <ArtifactBlock {block} />
  {:else if block.type === 'error'}
    <ErrorBlock {block} />
  {/if}
{/each}
```

Wzorzec Strategy/Visitor dla UI: każdy typ bloku ma dedykowany komponent ze swoim stanem i logiką wyświetlania. Thinking może się animować, ToolBlock pokazuje parametry i status wywołania, ArtifactBlock renderuje interaktywny wykres. Typewriter gating kontroluje tempo wyświetlania — bloki pojawiają się sekwencyjnie, nie wszystkie naraz.

### Agent głosowy z LiveKit (`05_02_voice`)
Przykład `05_02_voice` to kompletny agent głosowy z automatyczną detekcją trybu (Gemini Realtime / OpenAI+ElevenLabs / OpenAI) i integracją z narzędziami MCP.

```javascript
// agent.js — definicja agenta z LiveKit
export default defineAgent({
  prewarm: async (proc) => {
    proc.userData.vad = await silero.VAD.load();       // detekcja aktywności głosowej
    proc.userData.mcp = await createMcpManager(PROJECT_DIR); // narzędzia MCP
  },
  entry: async (ctx) => {
    await ctx.connect();
    const participant = await ctx.waitForParticipant();
    const tools = await createTools(ctx.proc.userData.mcp);  // MCP → LiveKit tools
    const agent = new voice.Agent({ instructions: INSTRUCTIONS, tools });
    const { mode, sessionOptions } = createSessionConfig(ctx.proc.userData.vad);
    const session = new voice.AgentSession(sessionOptions);
    await session.start({ agent, room: ctx.room });
  },
});
```

Architektura jest elegancko prosta: `prewarm` ładuje ciężkie zasoby (VAD, MCP) raz, `entry` łączy agenta z uczestnikiem rozmowy. Narzędzia MCP (np. Firecrawl do przeszukiwania sieci, system plików) są dynamicznie konwertowane z JSON Schema na Zod i udostępniane agentowi głosowemu — ten sam agent potrafi odpowiadać głosem i jednocześnie szukać w internecie.

## Najważniejsze zasady (cheat sheet)

1. **DOMPurify jest obowiązkowy** — LLM generuje dowolny HTML; bez sanityzacji wystawiasz się na XSS z każdą odpowiedzią modelu.
2. **Parsuj strumieniowany Markdown inkrementalnie** — re-renderowanie całej wiadomości co token zabija wydajność; dziel na committed segments + live tail.
3. **Naprawiaj niekompletną składnię Markdown przed renderowaniem** — narzędzia jak `remend` zamykają otwarte bloki kodu i formatowanie w trakcie strumieniowania.
4. **Wirtualizuj długie listy wiadomości** — bez tego interfejs staje się nieużywalny powyżej ~100 wiadomości; chunkuj i renderuj tylko widoczny zakres.
5. **Nie zaczynaj od bazy wektorowej** — sprawdź najpierw: czy wystarczy wczytanie dokumentów do kontekstu? grep? FTS? Wyszukiwanie semantyczne dołączaj dopiero jako rozszerzenie.
6. **Stosowanie wyłącznie wyszukiwania semantycznego jest nierekomendowane** — zawsze łącz z wyszukiwaniem pełnotekstowym w podejściu hybrydowym.
7. **Rozszerzenia bazy danych (fts5, sqlite-vec, pgvector) wystarczą dla większości projektów** — dedykowane silniki (Elasticsearch, Qdrant) dodawaj dopiero przy realnej potrzebie skali.
8. **W trybie STT/TTS masz kontrolę nad każdym krokiem** — możesz podmienić TTS na ElevenLabs, STT na Whisper; w Realtime delegujesz wszystko jednemu modelowi.
9. **Zbuduj nawet jedną integrację CLI/MCP** — próg wejścia jest niski, a natychmiastowe włączenie jej do pracy otwiera oczy na kolejne potrzeby.
10. **Opracuj bibliotekę powtarzalnych promptów** — przypisz je do skrótów klawiszowych, makr lub umiejętności agenta; to najprostsza i najszybsza inwestycja.
11. **Zachowaj dystans do nowych narzędzi AI** — wiele projektów jest porzucanych; wybieraj te sprawdzone na produkcji.

## Czego unikać (anty-wzorce)

- **Re-renderowanie całej wiadomości co token** → **Inkrementalne parsowanie z podziałem na committed/live** — bez tego interfejs zamiera przy długich odpowiedziach.
- **Renderowanie HTML od modelu bez sanityzacji** → **Zawsze przepuszczaj przez DOMPurify** — model może wygenerować `<script>` czy `<iframe>` celowo lub przypadkowo.
- **Sięganie od razu po Elasticsearch + Qdrant** → **Zaczynaj od rozszerzeń bazy (fts5, sqlite-vec)** — synchronizacja trzech magazynów danych to ogromna złożoność, niepotrzebna w większości projektów.
- **Stosowanie samego wyszukiwania semantycznego** → **Hybrydowe podejście (FTS + wektory)** — same embeddingi są już niewystarczające i nieprecyzyjne przy keyword-matching.
- **Budowanie wszystkiego od zera** → **Korzystaj z gotowych narzędzi na jasno zdefiniowane problemy** — markdown-it, LiveKit, Firecrawl rozwiązują problemy, nad którymi nie warto spędzać tygodni.
- **Dawanie agentowi bezpośredniego dostępu do terminala** → **Wirtualny system plików (just-bash) lub sandbox** — ogranicza blast radius błędów agenta.

## Sprawdź się (pytania do refleksji)

- **Dlaczego podział na "committed segments" i "live tail" jest kluczowy dla wydajności renderowania czatu?** *Wskazówka: pomyśl o tym, co się dzieje z DOM-em, gdy model wygenerował już 500 linii tekstu i przychodzi 501. token.*

- **Kiedy wybrałbyś tryb STT/TTS zamiast Realtime dla agenta głosowego, nawet jeśli Realtime ma niższą latencję?** *Wskazówka: pomyśl o kontroli nad jakością poszczególnych kroków i o kosztach.*

- **Masz aplikację z 10 000 dokumentów i agent potrzebuje szukać kontekstu. Jak zdecydujesz, czy wystarczą rozszerzenia SQLite, czy potrzebujesz Elasticsearch + Qdrant?** *Wskazówka: diagram z lekcji porównuje oba podejścia — jakie są konkretne koszty drugiego?*

- **Dlaczego autor lekcji mówi, że "stosowanie wyłącznie wyszukiwania semantycznego jest już nierekomendowane"?** *Wskazówka: pomyśl o różnicy między "find documents about authentication" a "find references to AUTH_TOKEN_EXPIRY".*

- **Gdybyś miał zbudować jeden własny serwer MCP na start — jaki obszar wybrałbyś i dlaczego?** *Wskazówka: pomyśl o tym, co robisz powtarzalnie każdego dnia w pracy z AI.*
