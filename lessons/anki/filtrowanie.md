# Filtrowanie kart Anki — instrukcja

Wszystkie karty w tym katalogu są tagowane według schematu:

```
<kod-lekcji> <tagi-tematyczne> <typ-karty>
```

Przykład: `s01e02 function-calling tool-use concept`

- **kod lekcji** (zawsze pierwszy): `s01e01`, `s02e05`, `s05e04`...
- **tagi tematyczne** (1-3): `structured-outputs`, `prompt-cache`, `multiagent`, `mcp`...
- **typ karty** (zawsze dokładnie jeden): `concept`, `why`, `problem`, `antipattern`, `compare`

To pozwala filtrować karty na trzy sposoby, zależnie od tego czy chcesz **zajrzeć**, **pouczyć się jednorazowo**, czy **zbudować stałą ścieżkę powtórek**.

---

## Składnia wyszukiwania — fundament wszystkiego

Ta sama składnia działa w **Przeglądaj**, w **Nauka własna** i w talii filtrowanej.

| Zapytanie | Co filtruje |
|-----------|-------------|
| `tag:s01e02` | Wszystkie karty z lekcji S01E02 |
| `tag:why` | Wszystkie karty "dlaczego" — ze **wszystkich** lekcji |
| `tag:s01e02 tag:problem` | Problemy tylko z S01E02 (logiczne AND) |
| `tag:concept OR tag:why` | Concepty i "why" razem (OR) |
| `-tag:concept` | Wszystko **oprócz** conceptów |
| `tag:s01e0*` | Wszystkie lekcje sezonu 1 (wildcard `*`) |
| `tag:function-calling` | Wszystkie karty o Function Calling (pan-lekcja, temat) |
| `tag:s01e02 -tag:antipattern` | S01E02 bez anty-wzorców |
| `tag:problem OR tag:antipattern` | Tylko karty praktyczne (problem + anty-wzorce) |

**Uwaga**: tagi w Anki są case-sensitive — `tag:Why` nie znajdzie `why`. Używaj lowercase, tak jak w kartach.

---

## Trzy sposoby filtrowania

### 1. Przeglądaj — inspekcja kart (nie nauka)

**Kiedy**: chcesz zobaczyć jakie karty istnieją, zweryfikować treść, poprawić literówkę, sprawdzić ile jest kart danego typu.

**Jak**:
1. Górny pasek → **Przeglądaj**
2. W polu wyszukiwania wpisz zapytanie (np. `tag:antipattern`)
3. Lista kart się filtruje, możesz je klikać i edytować

**Bonus**: lewy panel w Przeglądaj pokazuje drzewo wszystkich tagów. Kliknięcie tagu automatycznie wpisuje zapytanie — nie musisz pamiętać dokładnych nazw.

**Ograniczenie**: z tego poziomu **nie uczysz się** — tylko przeglądasz.

### 2. Nauka własna — jednorazowa sesja z filtrem

**Kiedy**: chcesz dziś pouczyć się tylko konkretnych kart (np. tylko S02E01 po opanowaniu nowej lekcji), ale jutro wrócić do normalnego harmonogramu powtórek.

**Jak**:
1. Kliknij talię (**ai_d3vs_4**) → przycisk **Nauka własna** na dole
2. Wybierz **"Nauka tylko z wybranych tagów"** (lub w en.: *"Study by card state or tag"*)
3. W dialogu odznacz wszystkie tagi i zaznacz tylko te, których chcesz (np. `s02e01` + `why`)
4. Anki tworzy **tymczasową talię** z tylko tymi kartami — uczysz się jak normalnie
5. Gdy skończysz, tymczasowa talia znika — oryginalne karty wracają do zwykłego harmonogramu

**Use case**: *"Dziś chcę przerobić tylko nowe karty z S02E01, jutro wracam do normalnego trybu."*

### 3. Talia filtrowana — stały filtr na wielokrotne powtarzanie

**Kiedy**: chcesz **powtarzalnie** uczyć się konkretnego zestawu — np. "co tydzień powtarzam wszystkie karty `why` osobno, żeby utrwalić fundamenty".

**Jak**:
1. Menu **Talie** → **Utwórz talię filtrowaną** (en.: *Create Filtered Deck*) — skrót **F6**
2. W polu **Wyszukiwanie** wpisz dowolne zapytanie (np. `tag:why`)
3. Nazwij talię (np. `AI_devs — tylko why`)
4. Kliknij **Budowanie** — talia pojawia się jako osobna pozycja na liście talii

**Cykl pracy**:
- **Buduj** — Anki wypełnia talię filtrowaną aktualnym zestawem kart pasujących do zapytania
- **Ucz się** — powtarzasz karty w tej talii
- **Opróżnij** — karty wracają do oryginalnej talii (ale talia filtrowana **zostaje** jako forma do ponownego użycia)
- Następnego dnia znów **Budujesz** — dostajesz aktualny zestaw

**Use case**: *"Mam stałe 'tory' nauki — poniedziałek: tylko `why`, wtorek: tylko `problem`, reszta tygodnia: cała talia normalnie."*

---

## Gotowe przepisy dla AI_devs 4

Konkretne filtry dopasowane do systemu tagów w tym projekcie:

### Nauka "kluczowych dlaczego" (rekomendowane)
```
tag:why
```
Karty "dlaczego" są najcenniejsze dla zmiany myślenia. Stwórz talię filtrowaną i powtarzaj osobno — utrwala fundament całego kursu.

### Świeże karty z konkretnej lekcji
```
tag:s02e01
```
Po wygenerowaniu nowej paczki (`aidevs4-anki s02e01`) zrób **Nauka własna** z tym filtrem. Świeże karty w skupionym kontekście lepiej się zakorzeniają niż pomieszane z resztą talii.

### Przegląd praktyczny — problemy i anty-wzorce
```
tag:problem OR tag:antipattern
```
Karty które trenują rozpoznawanie wzorców i korygują błędne nawyki. Dobra ścieżka na weekend gdy chcesz "aktywnego" powtarzania zamiast odtwarzania definicji.

### Jeden temat przez cały kurs
```
tag:mcp
```
albo
```
tag:structured-outputs
```
Wszystkie karty o konkretnym temacie (MCP, Structured Outputs, prompt cache, agent harness...) — bez względu na lekcję. Przydatne gdy chcesz usystematyzować wiedzę o jednym obszarze.

### Cały sezon bez jednego typu
```
tag:s01e0* -tag:concept
```
Wszystkie lekcje sezonu 1 bez kart-definicji. Praktyczne gdy już masz concepty opanowane i chcesz tylko "głębsze" pytania.

### Konkretna lekcja, tylko problemy
```
tag:s05e04 tag:problem
```
Gdy wracasz do trudnej lekcji i chcesz się skupić na scenariuszach praktycznych, nie na definicjach.

---

## Quick reference — najczęściej używane

| Co chcę zrobić | Gdzie | Zapytanie |
|----------------|-------|-----------|
| Zobaczyć listę kart z filtra | Przeglądaj | `tag:...` |
| Dziś tylko jedną lekcję | Nauka własna | wybór tagów w dialogu |
| Stały "tor" do powtarzalnej nauki | Talia filtrowana (F6) | `tag:...` |
| Tylko "dlaczego" | Talia filtrowana | `tag:why` |
| Tylko problemy + anty-wzorce | Nauka własna | `tag:problem OR tag:antipattern` |
| Jedna lekcja bez conceptów | Nauka własna | `tag:s02e03 -tag:concept` |
| Cały sezon | Talia filtrowana | `tag:s01e0*` |
| Konkretny temat przez kurs | Talia filtrowana | `tag:prompt-cache` |

---

## Uwagi

- **Tagi są płaskie** — nie ma hierarchii typu `anki::s01::e02`, każdy tag to osobna etykieta. To zamierzone: daje więcej elastyczności w kombinowaniu (s01e02 + why + function-calling w jednym zapytaniu).
- **Case-sensitive** — `tag:Why` nie zadziała, musisz napisać `tag:why`.
- **Spacje w tagach** rozbijają tag na wiele — dlatego wielosłowowe tagi używają `kebab-case` (`structured-outputs`, nie `structured outputs`).
- **Kombinuj typy z tematami** — najciekawsze filtry łączą oba wymiary, np. `tag:mcp tag:antipattern` (wszystkie anty-wzorce związane z MCP w całym kursie).
