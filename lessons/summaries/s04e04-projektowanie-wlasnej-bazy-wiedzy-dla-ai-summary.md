# Projektowanie własnej bazy wiedzy dla AI — Podsumowanie

## O czym jest ta lekcja? (TL;DR)

Lekcja odpowiada na pytanie: jak zbudować **prywatną bazę wiedzy**, która jest jednocześnie użyteczna dla nas i nawigowalna dla agentów AI? Kluczowy wniosek: baza wiedzy to nie zbiór notatek — to **system operacyjny dla agentów**, w którym struktura katalogów, szablony notatek i zasady linkowania decydują o tym, czy agent potrafi samodzielnie odnaleźć informacje i podjąć działania. Człowiek odpowiada za treść i zasady, AI za organizację, walidację i wykonanie procesów opisanych w prostych plikach markdown.

## Mapa koncepcji

- **Od codzienności do zakresu agenta** — 4-warstwowy lejek zawężający obszar bazy wiedzy
  - **Mapowanie narzędzi i aktywności** → odrzucenie tego, czego nie chcemy automatyzować
- **Struktura bazy wiedzy** — Me / World / Craft / Ops / System
  - **Szablony notatek (blueprints)** — predefiniowane struktury dla każdego typu treści
  - **Anatomia notatki** — frontmatter z metadanymi + treść z wikilinkami
- **Markdown — zalety i ograniczenia** — kiedy .md, kiedy Notion/Docs
- **Notatki bez kontekstu** — co agent "nie widzi" i jak to naprawić
- **Balans zaangażowania** — spektrum od human-dominant po AI-dominant
- **Procesy w Ops** — 4 pliki markdown = powtarzalny proces wieloagentowy

## Kluczowe koncepcje

### Od codzienności do zakresu agenta (Agentic Scope)

**W jednym zdaniu:** Zanim zaczniesz budować bazę wiedzy, przejdź przez 4-warstwowy lejek, który zawęzi zakres do tego, co faktycznie ma sens.

**Rozwinięcie:** To jak refactoring wymagań — zamiast budować wszystko, usuwasz to, co niepotrzebne. Warstwa 1: wypisz **wszystkie obszary codzienności** (Messages, Events, Email, Coding, Shopping, Marketing, Health, Hobbies...). Warstwa 2: zidentyfikuj **regularnie używane narzędzia** (Communicators, Mailbox, Calendars, Code Editor, Task Manager...) — te wyszarzone to te, których nie używasz regularnie. Warstwa 3: odpowiedz "**gdzie AI może pomóc?**" (Learning, Creating, Research, Scheduling, Managing, Coding...) — znów, część odpada. Warstwa 4: z tego co zostało, **usuń to, czego nie chcesz podłączać do AI** → otrzymujesz swój Personal Knowledge System. Najlepsze pomysły nie są powodem wykonanej pracy, lecz jej rezultatem — więc zacznij od jednej aktywności, nie od całego systemu.

**Przykład z lekcji:** Diagram "From Daily Life to Agentic Scope" pokazuje jak z ~15 obszarów życia (Layer 1) przez ~10 narzędzi (Layer 2) i ~8 aktywności (Layer 3) dochodzimy do jednego, skoncentrowanego Personal Knowledge System (Layer 4). Wyszarzone elementy na każdej warstwie to świadome odrzucenia.

### Struktura bazy wiedzy — Me / World / Craft / Ops / System

**W jednym zdaniu:** Baza wiedzy dzieli się na 5 przestrzeni o różnych właścicielach i celach — od profilu osobistego po maszynowy katalog systemowy.

**Rozwinięcie:** To jak monorepo z wydzielonymi pakietami, gdzie każdy ma jasną odpowiedzialność. **Me** (kim jestem, jak działam) — Identity, Preferences, Wellbeing, Thinking, Process. **World** (ludzie, miejsca, narzędzia) — People, Places, Services, Sources. **Craft** (co robię i tworzę) — Ideas, Projects, Knowledge, Lab, Shared. **Ops** (jak agenci mają pracować) — Tasks, Calendar, Email, Newsletter, Research, Design, Development, Marketing, Publishing, Config. **System** (warstwa maszynowa) — Status, Agents. Kluczowe: Ops i System to przestrzenie głównie dla agentów, Me i Craft głównie dla człowieka, a World jest współdzielone.

**Przykład z lekcji:** Diagram "Personal Knowledge Base — Structure" pokazuje 5 kolumn z przykładowymi podkategoriami. Ops jest najbardziej rozbudowane (12 podkategorii), co odzwierciedla fakt, że to tu agenci wykonują większość pracy.

### Anatomia notatki — frontmatter i treść z wikilinkami

**W jednym zdaniu:** Notatka w bazie wiedzy to nie zwykły tekst — to dokument z metadanymi kontrolującymi dostęp, status, odpowiedzialność, a nawet prompt dla agenta.

**Rozwinięcie:** Diagram "Note Anatomy" pokazuje plik `transformer-architecture.md` z rozbudowanym frontmatterem: `title`, `description`, `status` (growing), `publish` (draft→review→live→updated), `tags` (AI, architecture, deep-learning, transformers), `access.read` (all), `access.write` (adam, allie, tony), `attention` z polami `who` (adam) i `reason` ("initial research done, review before expanding"). Treść zawiera wikilinki (`[[Craft/Knowledge/AI/attention-mechanisms]]`) umożliwiające agentowi nawigację po powiązanych notatkach. Na dole sekcja "Related Notes" z linkami do powiązanych dokumentów. Pasek na samym dole: `frontmatter.req → string.dates → search.delay → comment → published → auditor`.

**Przykład z lekcji:** Pole `attention` z `who: adam` i `reason` to mechanizm, przez który agent może "oznaczyć" notatkę do przeglądu przez konkretną osobę — bez konieczności wysyłania powiadomienia, bo osoba zobaczy to przy następnym otwarciu.

### Markdown — gdzie się sprawdza, gdzie nie

**W jednym zdaniu:** Markdown jest natywny dla AI i git-friendly, ale nie zastąpi Notion/Docs tam, gdzie potrzebna jest współpraca zespołowa, uprawnienia czy komentarze.

**Rozwinięcie:** Diagram dzieli cechy na "Works well" i "Falls short". **Zalety**: Native to AI (agents), Plain text — full control (tooling), Frontmatter as metadata (agents), Git-friendly (tooling), Wikilinks & graph traversal (knowledge base), Offline, portable, durable (knowledge base). **Wady**: No real-time collaboration (team), No granular permissions (team), No comments or review mode (team), No rich embeds or databases (tooling), Lossy conversion to Notion/Docs (tooling), Rendering varies by tool (tooling). Tabela scenariuszy: Personal knowledge base → .md, Agent ops playbooks → .md, Code documentation → .md, Published content drafts → .md, Multi-author team docs → Notion/Docs, Client-facing documents → Notion/Docs, Project management → Linear/Notion.

**Przykład z lekcji:** Kluczowa zasada z diagramu: "Agent-readable? Use .md. Team editing, comments, permissions? Use Notion or Docs. Pick the boundary once per area — don't mix."

### Notatki bez kontekstu — co agent "nie widzi"

**W jednym zdaniu:** Notatki muszą być pisane tak, jakby czytelnik nie posiadał żadnego dodatkowego kontekstu — bo agent go nie ma.

**Rozwinięcie:** Diagram "Notes Without Context" pokazuje 5 typowych problemów, każdy z wersją "as written" i "with context": (1) **Nazwy projektów i osób bez kontekstu** — "Sync with Marek about the Phoenix deadline" → agent nie wie kim jest Marek, czym Phoenix ani co to za spotkanie. Z kontekstem: wikilinki do `[[World/People/Marek-kowalski]]` i `[[Craft/Projects/Phoenix]]`. (2) **Skrócone/nieprzejrzyste linki** — `bit.ly/x7kQp` jest niewidoczny dla agenta. Z kontekstem: pełny wikilink z opisem. (3) **Niejasne referencje czasowe** — "in the last call", "the previous approach" — brak ścieżki do eksploracji. Z kontekstem: link do konkretnej daty i dokumentu. (4) **Link pojawia się raz** — jeśli agent wczyta fragment bez linku, nie dotrze do powiązania. Rozwiązanie: powtarzaj kluczowe linki w frontmatter. (5) **Nadpisane wersje** — agent traci dostęp do historii zmian.

**Przykład z lekcji:** Podsumowanie z diagramu: "Write as if the reader has zero prior context. Names, links, references, and relations must be self-contained — the agent has no memory outside what's on the page."

### Balans zaangażowania — kto za co odpowiada

**W jednym zdaniu:** Istnieje spektrum od zadań wyłącznie ludzkich (kierunek, pisanie) przez współdzielone (transformacja, komentowanie) po zdominowane przez AI (szablony, linkowanie, walidacja, indeksowanie, audyt).

**Rozwinięcie:** Diagram "AI Engagement in the Knowledge Base" pokazuje 10 aktywności na osi Human↔AI: **Human-dominant**: Direction (WHAT MATTERS — "Goals and priorities set — AI has no say"), Writing (AUTHOR + assist — "Your words, your perspective"), Curation (JUDGE + surface — "You decide what stays, expands, or gets archived"). **Shared**: Transformation (SOURCE + format — "Image/Voice/Rough draft — Structured and formatted"), Commenting (CONTENT + annotate — "AI adds observations in a separate block"), Organisation (DECIDE + suggest — "AI suggests correct location with reasoning. You confirm"). **AI-dominant**: Templates (DEFINE → apply — "Structure defined once in System/ — AI applies right template"), Linking (RULES → propose links — "AI scans vault and proposes [[wikilinks]]"), Validation (STANDARDS → flag violations — "AI flags missing frontmatters, broken links, wrong placement"), Indexing (CURATE → generate MoC — "Topic cluster grows — AI generates and updates Map of Content"), Auditing (ACT → scan & report — "AI surfaces orphans, duplicates, noise. You decide").

**Przykład z lekcji:** Kluczowy wniosek: "my odpowiadamy za treść oraz główne zasady, a AI za jej organizację". Direction jest jedyną aktywnością w pełni po stronie człowieka — tu "AI has no say".

### Szablony notatek (Blueprint System)

**W jednym zdaniu:** Szablony w `workspace/system/templates` definiują strukturę notatek dla każdego typu treści — agent wie, jak sformatować nową notatkę, zamiast wymyślać strukturę od zera.

**Rozwinięcie:** Diagram "Note Templates — Blueprint System" pokazuje 9 szablonów w 2 obszarach: **Craft** (Idea [minimal], Knowledge [standard], Project [standard], Experiment [standard], Shared [full]) i **World** (Person [minimal], Source [standard], Event [standard], Service [standard]). Każdy szablon definiuje: ścieżkę (np. `Craft/Ideas/slug.md`), wymagany frontmatter (np. `title, description, status, tags`) i sekcje treści (np. Knowledge: Overview, Core concepts, Relevance, Sources, Related notes). Trzy poziomy frontmatter: **minimal** (title, tags), **standard** (+ description, status, tags), **full** (+ publish, tags z rozbudowaną listą). Agent przy tworzeniu notatki najpierw sprawdza mapę treści, potem odpowiedni szablon, i na tej podstawie decyduje o strukturze i lokalizacji.

**Przykład z lekcji:** Diagram "Agent Note Placement — Decision Flow" pokazuje pełny proces: Intent received → "What kind of note is this?" (classify type, map to topic) → Taxonomy scan (fs_search w odpowiednich katalogach) → "How to structure the note?" (match template, check existing) → Write + Confirm.

### 4 pliki = powtarzalny proces wieloagentowy

**W jednym zdaniu:** Cztery proste pliki markdown w `ops/daily-news/` (info + research + assemble + deliver) wystarczą, by zdefiniować powtarzalny proces delegowany między agentami.

**Rozwinięcie:** Diagram "Agent Delegation — Daily-News Process" pokazuje przepływ: **Scheduler** wysyła "Execute process: daily-news" → **Main Agent** czyta 4 pliki z ops/ → rozdziela zadania na 3 sub-agentów: **Research** (read source wikilinks, fetch + scan each source, extract relevant items → raw findings), **Assemble** (receive research output, rank + deduplicate, format into digest → formatted digest), **Deliver** (receive assembled digest, apply delivery format, send to channel / write note → delivered). Drugi diagram "4 Files → Infinite Runs" pokazuje, że te 4 pliki instrukcji nigdy się nie zmieniają — każde wykonanie (np. 2026-03-08, 2026-03-09, 2026-03-10) tworzy nowy datowany folder z artefaktami (s1.md, dev.md, startups.md, digest.html, status.md). Każdy dzień to: research Ellie → assemble Tony → deliver Rose.

**Przykład z lekcji:** Przypis z diagramu: "The 4 instruction files never change. Each run produces a new dated folder. Same process, fresh data, every day at 07:00."

## Najważniejsze zasady (cheat sheet)

1. **Zacznij od jednej aktywności, nie od całego systemu** — wybierz coś, co Ci się podoba (newsletter, podcast, hobby), a dopiero potem to, co jest faktycznie użyteczne.
2. **Struktura: Me / World / Craft / Ops / System** — jasny podział odpowiedzialności między człowiekiem a agentami.
3. **Notatki pisz tak, jakby czytelnik nie miał żadnego kontekstu** — pełne nazwy, wikilinki, daty absolutne, brak skróconych linków.
4. **Człowiek odpowiada za treść i zasady, AI za organizację** — Direction, Writing i Curation to wyłącznie nasze; Templates, Linking, Validation i Auditing to domena AI.
5. **Szablony definiuj raz w System/, agent stosuje je automatycznie** — trzy poziomy: minimal, standard, full.
6. **Frontmatter to metadane dla agenta** — status, tagi, access-write, attention z who/reason dają agentowi kontekst bez czytania treści.
7. **Markdown dla agentów i bazy wiedzy, Notion/Docs dla zespołu** — wybierz granicę raz per obszar i nie mieszaj.
8. **Obrazy w markdown osadzaj jako zdalne linki, nie lokalne pliki** — agent nie obsłuży ścieżki lokalnej, a zdalny link może cytować w odpowiedziach.
9. **Linkuj obficie i powtarzaj kluczowe linki w frontmatter** — agent może wczytać fragment dokumentu, w którym jedyny link nie istnieje.
10. **4 pliki w Ops = powtarzalny proces** — info.md + research.md + assemble.md + deliver.md to kompletna definicja daily pipeline.
11. **Procesy opisane w markdown są wersjonowalne, audytowalne i czytelne** — to kod, ale w języku naturalnym.
12. **Nie buduj od razu — podłącz katalog do Claude Code** i kształtuj strukturę iteracyjnie, dopiero potem pisz logikę agenta.

## Czego unikać (anty-wzorce)

- **Generowanie treści bazy wiedzy w całości przez AI** → **Człowiek jest źródłem, AI formatuje i organizuje** — utrata kontroli nad bazą wiedzy to utrata jej sensu.

- **Pisanie notatek "dla siebie"** → **Pisz jakby czytelnik nie miał kontekstu** — "Sync with Marek about Phoenix" jest bezużyteczne dla agenta bez wikilinków do osób i projektów.

- **Używanie skróconych linków w notatkach** → **Pełne URL-e lub wikilinki z opisem** — `bit.ly/x7kQp` jest niewidoczne dla agenta i kruche w czasie.

- **Mieszanie Markdown i Notion w tym samym obszarze** → **Wybierz format raz per obszar** — konwersja między formatami jest stratna i niepraktyczna.

- **Planowanie całej struktury bazy wiedzy na start** → **Zacznij od jednego katalogu i jednej aktywności** — rozbudowuj iteracyjnie na podstawie doświadczenia.

- **Nadpisywanie notatek bez wersjonowania** → **Git lub jawne wersje** — agent traci dostęp do historii, a nadpisanie może usunąć ważny kontekst.

- **Jednokrotne linkowanie powiązanych notatek** → **Powtarzaj kluczowe powiązania** — agent czytający fragment dokumentu może nie trafić na link umieszczony tylko raz na końcu.

## Sprawdź się (pytania do refleksji)

- **Przejdź przez 4-warstwowy lejek z lekcji (Daily life → Tools → AI activities → Knowledge System). Ile obszarów zostanie po odrzuceniu tego, czego nie chcesz automatyzować?** *Wskazówka: bądź bezwzględny w warstwie 4 — lepiej zacząć od 3 obszarów niż od 15.*

- **Weź jedną ze swoich notatek i przepisz ją tak, jakby czytelnik nie miał żadnego kontekstu. Co musisz dodać? Wikilinki, daty, opisy linków, pełne nazwy?** *Wskazówka: sprawdź 5 problemów z diagramu "Notes Without Context" — ile z nich występuje w Twojej notatce?*

- **Zaprojektuj szablon (blueprint) dla jednego typu notatki w swoim kontekście — np. "Meeting Notes" lub "Tool Review". Jaki frontmatter jest potrzebny? Jakie sekcje?** *Wskazówka: pomyśl o trzech poziomach (minimal/standard/full) i o tym, które pola frontmatter pomogą agentowi nawigować.*

- **Jak wygląda podział Direction/Writing/Curation vs Templates/Linking/Validation w Twoim kontekście? Czy są aktywności, które przesunąłbyś na inny punkt spektrum?** *Wskazówka: Direction jest zawsze ludzkie, ale granica "Shared" może się przesuwać w zależności od zaufania do agenta i konsekwencji błędu.*

- **Zaprojektuj prosty 3-plikowy proces w Ops (np. weekly-review lub content-pipeline). Jakie pliki instrukcji potrzebujesz? Kto (który agent) wykonuje każdy krok?** *Wskazówka: wzoruj się na daily-news (info + research + assemble + deliver) i pomyśl jakie artefakty produkuje każdy krok.*
