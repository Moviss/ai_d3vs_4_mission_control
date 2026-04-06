# Kontekstowy feedback wspierający skuteczność agentów — Podsumowanie

## O czym jest ta lekcja? (TL;DR)

Agenci nie muszą czekać na wiadomość użytkownika, żeby zacząć działać. Ta lekcja pokazuje, jak budować systemy, które **proaktywnie reagują na otoczenie** (czas, lokalizację, zdarzenia zewnętrzne), **uczą się na błędach** w ramach sesji i między sesjami, oraz **wymuszają kompletność workflow** przez hooki — wszystko to przy zachowaniu możliwości kontaktu z człowiekiem, gdy agent sobie nie radzi.

## Mapa koncepcji

- **Autonomiczne wyzwalacze** — co sprawia, że agent zaczyna działać bez udziału użytkownika
  - **Jeden punkt wejścia** — różne triggery (cron, webhook, heartbeat) przesyłają zadania w języku naturalnym
  - **Proaktywna sesja** — "nieskończona" sesja z kompresją kontekstu + periodyczne sprawdzanie tasks.md
- **Kontekst z otoczenia** — metadane (czas, lokalizacja, pogoda) wstrzykiwane do każdego kroku
  - **Wzbogacanie wiadomości** — agent łączy szczątkowe informacje z różnych źródeł w kompletne akcje
- **Feedback i uczenie** — agent poprawia się w trakcie i między sesjami
  - **FeedbackTracker** — śledzenie wyników narzędzi, generowanie hintsów przy błędach
  - **Interventions** — syntetyczne wiadomości wstrzykiwane gdy agent utknął
  - **Persistent learning** — zapisywanie wniosków do plików instrukcji na przyszłe sesje
- **Hooki jako strażnicy workflow** — beforeToolCall, afterToolResult, beforeFinish
  - **beforeFinish gate** — blokada zakończenia sesji dopóki nie ukończono wymaganych kroków

## Kluczowe koncepcje

### Autonomiczne wyzwalacze i jeden punkt wejścia

**W jednym zdaniu:** System agentowy może mieć jeden uniwersalny "inbox", do którego wpływają zadania z różnych źródeł — od wiadomości użytkownika, przez webhooki, po zadania cron — a agent sam interpretuje, co trzeba zrobić.

**Rozwinięcie:** W klasycznym programowaniu masz osobny handler na każdy webhook, osobny cron job na każdy raport. W systemie agentowym wszystkie te triggery mogą przesyłać zadania **w języku naturalnym** do jednego punktu wejścia. Agent interpretuje treść, sięga po potrzebne narzędzia i wykonuje zadanie. To daje niesamowitą elastyczność — nowy rodzaj triggera nie wymaga nowego kodu, wystarczy nowa wiadomość. Pięć typów wyzwalaczy: **Messages** (od ludzi/agentów), **Hooks** (zdarzenia wewnętrzne), **Webhooks** (zdarzenia zewnętrzne), **Cron** (harmonogram), **Heartbeat** (regularne sprawdzanie stanu).

**Przykład z lekcji:** Diagram "Jeden punkt wejścia" pokazuje, jak różne źródła (kalendarz, e-mail, heartbeat) kierują wiadomości do tego samego agenta, który dynamicznie dobiera narzędzia i kontekst do zadania.

### Proaktywna sesja z kontekstem otoczenia

**W jednym zdaniu:** Agent utrzymuje "nieskończoną" sesję z użytkownikiem (dzięki kompresji kontekstu) i co określony czas sam sprawdza, czy ma coś do zrobienia — reagując na zmiany w otoczeniu, nie na polecenia.

**Rozwinięcie:** Wyobraź sobie asystenta, który nie czeka na pytanie, ale sam mówi: "Za godzinę masz spotkanie z klientem X, pada deszcz, potrzebujesz 40 minut na dojazd — chcesz przełożyć?". To możliwe, gdy agent (1) ma trwałą sesję z historią rozmów, (2) dostaje metadane z otoczenia (czas, lokalizacja, pogoda) wstrzykiwane jako blok `<metadata>` do każdego kroku, (3) co interwał heartbeat sprawdza plik tasks.md z priorytetowymi zadaniami. Jeśli nic nie wymaga działania — agent milczy. Jeśli coś wymaga uwagi — sam wznawia sesję.

**Przykład z lekcji:** Agent kalendarzowy w `03_03_calendar` buduje blok `<metadata>` z aktualnym czasem, lokalizacją i pogodą. W fazie powiadomień reaguje na webhooki (zbliżające się wydarzenie), sprawdza trasę przez `get_route()`, uwzględnia pogodę i wysyła kontekstowe powiadomienie — bez pytania użytkownika.

### FeedbackTracker — uczenie się na błędach w ramach sesji

**W jednym zdaniu:** Każde wywołanie narzędzia jest śledzone, a przy błędach agent dostaje kontekstowe podpowiedzi — od prostych "spróbuj innego selektora" po strategiczne "zmień podejście po 3 porażkach".

**Rozwinięcie:** To dwuwarstwowy system. **Warstwa 1** (inline hints): `FeedbackTracker` analizuje historię wywołań narzędzi i przy błędzie generuje specyficzne podpowiedzi dołączane do wyniku narzędzia. Na przykład: timeout na `click` → "Element may not be visible. Try scrolling first." Trzy porażki z rzędu → "Multiple failures detected. Consider changing strategy." **Warstwa 2** (interventions): gdy agent utknął, do konwersacji wstrzykiwane są syntetyczne wiadomości użytkownika. Na przykład: 2+ porażki z rzędu → "Call take_screenshot to visually inspect the page." Po odzyskaniu → "Save what worked to instructions/{site}-discoveries.md".

**Przykład z lekcji:** W `03_03_browser` feedback tracker zlicza consecutive failures per tool. Hints są kontekstowe — `fs_write` z Invalid JSON dostaje inną podpowiedź niż `click` z timeout. Interventions mają `InterventionState` zapobiegający wielokrotnemu wysyłaniu tego samego tipa.

### Persistent learning — nauka między sesjami

**W jednym zdaniu:** Agent po odzyskaniu z błędu jest zachęcany do zapisania wniosków w pliku instrukcji, który czyta na starcie następnej sesji — tworząc pętlę uczenia bez fine-tuningu.

**Rozwinięcie:** To elegancki mechanizm: agent przeglądarkowy popełnia błąd na Goodreads (np. nie może znaleźć elementu), próbuje kilku podejść, w końcu odnajduje rozwiązanie. W tym momencie intervention mówi: "Save what worked to instructions/goodreads-discoveries.md." Przy następnej sesji agent ładuje ten plik i **zna** strukturę strony od razu. To cross-session learning bez żadnego treningu modelu — po prostu pliki markdown. Ten sam wzorzec można zastosować do praktycznie każdego agenta.

**Przykład z lekcji:** Katalog `instructions/` w `03_03_browser` może zawierać statyczne opisy stron, ale też dynamicznie tworzone notatki z błędów. Agent czyta je na starcie, dzięki czemu nie odkrywa serwisu od nowa.

### Hooki jako strażnicy wieloetapowego workflow

**W jednym zdaniu:** Trzy hooki — `beforeToolCall`, `afterToolResult`, `beforeFinish` — obserwują postęp agenta, śledzą stan workflow i **blokują zakończenie sesji**, dopóki wszystkie wymagane kroki nie zostaną ukończone.

**Rozwinięcie:** Agent do nauki angielskiego musi przejść przez trzy fazy: odsłuchanie nagrania → wygenerowanie feedbacku audio → zapisanie sesji i profilu. Problem: LLM może "stwierdzić", że skończył po drugim kroku. Rozwiązanie: `beforeFinish` sprawdza flagi (`listen_done`, `feedback_done`, `session_saved`, `profile_updated`) i jeśli czegoś brakuje, **wstrzykuje wiadomość** z listą niedokończonych kroków, wymuszając kontynuację. Agent loop pozostaje generyczny — cała logika workflow żyje w hookach.

**Przykład z lekcji:** W `03_03_language` hook `afterToolResult` obserwuje wyniki narzędzi i aktualizuje `PhaseFlags`. Po ukończeniu wszystkich flag resetuje stan, umożliwiając przejście do analizy kolejnego nagrania. `beforeFinish` działa jak gate — `{ allow: false, missing: [...], inject_message: "You must complete..." }`. Wyjątek: jeśli wystąpiły błędy (`phase_errors`) lub przekroczono MAX_TURNS — agent może zakończyć mimo braków.

### Rola człowieka w systemach proaktywnych

**W jednym zdaniu:** Nawet najbardziej autonomiczny agent potrzebuje interfejsu do kontaktu z człowiekiem — nie tylko defensywnie (gdy coś nie działa), ale ofensywnie (głos, powiadomienia, wymagania jakościowe).

**Rozwinięcie:** Proaktywność nie eliminuje potrzeby interakcji z człowiekiem. Hooki mogą wymagać **zatwierdzenia niezaufanej akcji**. Agent może **prosić o brakujące informacje** zamiast zgadywać. System może **informować użytkownika** o wymaganiach jakościowych (np. "nagraj wyraźnie, w cichym otoczeniu"). Projektowanie UX agenta to nie tylko kwestia techniczna — problemy ze skutecznością agentów często leżą po stronie użytkowników, którzy nie wiedzą, jak z nimi pracować.

**Przykład z lekcji:** Agent językowy w `03_03_language` wymaga jakościowego nagrania audio. Bez wyraźnej wymowy i zaangażowania nawet najlepsza analiza Gemini nie da wartościowego feedbacku. Onboarding użytkownika jest tak samo ważny jak architektura agenta.

## Teoria w praktyce

### FeedbackTracker — kontekstowe hinty przy błędach (`03_03_browser`)
Agent przeglądarkowy śledzi każde wywołanie narzędzia i generuje specyficzne podpowiedzi przy porażkach.

```typescript
// feedback/tracker.ts — generowanie hintsów na podstawie historii błędów
const generateHints = (tool: string, outcome: ToolOutcome, error?: string): string[] => {
  if (outcome !== 'fail') return [];

  // Hint specyficzny dla typu błędu i narzędzia
  if (error?.includes('Invalid JSON arguments')) {
    const hints = ['Arguments must be a single valid JSON object...'];
    if (tool === 'fs_write') {
      hints.push('For fs_write, include path/operation/content...');
    }
    return hints;
  }
  if (tool === 'click' && error?.includes('timeout')) {
    return ['The element may not be visible. Try scrolling first.'];
  }

  // Strategiczny hint po wielokrotnych porażkach
  const recentFailures = recentOf(tool, 3).filter((e) => e.outcome === 'fail').length;
  if (recentFailures >= 3) {
    return ['Multiple failures detected. Consider changing strategy before retrying.'];
  }
  return [];
};
```

Hinty są dołączane jako `[feedback]` do wyników narzędzi — LLM widzi je inline i może dostosować kolejny krok.

### Interventions — wstrzykiwanie wiadomości gdy agent utknął (`03_03_browser`)
Gdy feedback tracker wykrywa spiralę porażek, system wstrzykuje syntetyczne wiadomości użytkownika.

```typescript
// agent/interventions.ts — interwencje wstrzykiwane między turami
const collectTurnInterventions = (feedback: FeedbackTracker, recovered: boolean, state) => {
  const items: ResponseInputItem[] = [];
  const failureCount = feedback.consecutiveFailures();

  // Po 2+ porażkach z rzędu: zachęć do zrzutu ekranu
  if (failureCount >= 2 && !state.screenshotTipSent) {
    state.screenshotTipSent = true;
    items.push({
      role: 'user',
      content: `You've had ${failureCount} consecutive failures. ` +
        `Call take_screenshot to visually inspect the current page...`,
    });
  }

  // Po odzyskaniu z błędów: zachęć do zapisania wniosków
  if (recovered && !state.discoveryTipSent) {
    state.discoveryTipSent = true;
    items.push({
      role: 'user',
      content: `You recovered from earlier failures. Save what worked ` +
        `to instructions/${site}-discoveries.md using fs_write...`,
    });
  }
  return { items, nextState: state };
};
```

`InterventionState` gwarantuje, że każdy tip jest wysyłany **raz** — bez powtarzalnego naprzykrzania się.

### beforeFinish — strażnik kompletności workflow (`03_03_language`)
Agent do nauki angielskiego nie może zakończyć sesji, dopóki nie przejdzie przez wszystkie wymagane kroki.

```typescript
// hooks.ts — beforeFinish blokuje przedwczesne zakończenie
beforeFinish: (finalText) => {
  if (state.phase_errors.length > 0) return { allow: true, missing: [] }; // błędy → pozwól zakończyć

  const missing: string[] = [];
  if (!state.phase_flags.listen_done) missing.push('listen to audio');
  if (!state.phase_flags.feedback_done) missing.push('generate feedback');
  if (!state.phase_flags.session_saved) missing.push('save session');
  if (!state.profile_updated) missing.push('update profile.json weakAreas');

  if (missing.length === 0) return { allow: true, missing: [] };
  return {
    allow: false, missing,
    inject_message: ['You must complete these before finishing:',
      ...missing.map((m) => `- ${m}`)].join('\n'),
  };
},

// agent.ts — hook wpleciony w agent loop
if (calls.length === 0) {
  const check = hooks.beforeFinish(text);
  if (!check.allow && turn < MAX_TURNS) {
    input = [{ type: 'text', text: check.inject_message }]; // wymuś kolejną turę
    continue;
  }
  break;
}
```

Wzorzec jest reużywalny: agent loop pozostaje generyczny, reguły workflow żyją w hookach. `PhaseFlags` resetują się po ukończeniu analizy jednego pliku, umożliwiając przetworzenie kolejnych nagrań.

## Najważniejsze zasady (cheat sheet)

1. **Jeden punkt wejścia + wiele wyzwalaczy** — wiadomości, webhooki, cron i heartbeat mogą kierować zadania w języku naturalnym do tego samego agenta. Nowy trigger = nowa wiadomość, nie nowy kod.
2. **Metadane z otoczenia wstrzykuj programistycznie** — czas, lokalizację, pogodę, status użytkownika dodawaj jako `<metadata>` blok do każdego kroku. Agent nie musi o nie pytać.
3. **Domyślnie nowa sesja na zdarzenie** — unikaj zanieczyszczania kontekstu. Współdziel sesję tylko gdy kontekst z poprzednich interakcji jest istotny.
4. **Proaktywność = heartbeat + tasks.md** — agent periodycznie sprawdza, czy ma zadania do wykonania. Jeśli nie — milczy. Jeśli tak — sam wznawia sesję.
5. **Dwuwarstwowy feedback: hints inline + interventions between turns** — hinty korygują konkretne błędy narzędzi, interventions zmieniają strategię. Razem tworzą self-correcting loop.
6. **Persistent learning przez pliki** — zapisuj wnioski z błędów do `instructions/*.md`. Czytaj je na starcie sesji. Cross-session learning bez fine-tuningu.
7. **Hooki do wymuszania workflow, nie do logiki biznesowej** — `beforeFinish` jako gate, `afterToolResult` jako tracker stanu. Agent loop zostaje generyczny.
8. **InterventionState zapobiega spamowaniu** — każdy tip wyślij raz. Agent potrzebuje nowych informacji, nie powtórzeń.
9. **Narzędzia agenta mogą wywoływać osobne API** — `listen` i `feedback` w agencie językowym wywołują Gemini API. To częsty wzorzec (MCP Sampling to jego formalizacja).
10. **Projektuj interfejs kontaktu z człowiekiem od początku** — nie tylko defensywnie (gdy agent nie sobie radzi), ale ofensywnie (głos, onboarding, wymagania jakościowe).

## Czego unikać (anty-wzorce)

- **Agent czekający wyłącznie na wiadomość użytkownika** → **Proaktywny agent z wyzwalaczami** — webhooki, cron i heartbeat pozwalają dostarczać wartość bez angażowania człowieka.
- **Brak kontekstu z otoczenia** → **Programistyczne wstrzykiwanie metadanych** — agent bez informacji o czasie, lokalizacji i pogodzie nie może podejmować kontekstowych decyzji. Dodaj `<metadata>` blok.
- **Powtarzanie tych samych błędów między sesjami** → **Zapisywanie wniosków do plików instrukcji** — agent przeglądarkowy, który za każdym razem odkrywa strukturę Goodreads od nowa, marnuje tokeny i czas.
- **Poleganie na LLM w śledzeniu stanu workflow** → **Programistyczne flagi w hookach** — agent "zapomni" zaktualizować status. `PhaseFlags` obserwowane przez `afterToolResult` są deterministyczne.
- **Pozwalanie agentowi na przedwczesne zakończenie** → **beforeFinish gate z inject_message** — LLM lubi "stwierdzić, że skończył" po połowie pracy. Gate z listą brakujących kroków wymusza kompletność.
- **Wstrzykiwanie tych samych porad w kółko** → **InterventionState z flagami one-shot** — "Take a screenshot" wysłane 5 razy z rzędu to spam, nie feedback.

## Sprawdź się (pytania do refleksji)

- **Masz agenta do monitorowania social media, który powinien reagować na wzmianki o Twojej marce. Jakie wyzwalacze zastosujesz i jak zaprojektujesz "punkt wejścia" dla różnych źródeł (Twitter, LinkedIn, Reddit)?** *Wskazówka: pomyśl o webhookach z platform i o tym, jak zunifikować format wiadomości dla jednego agenta.*

- **Agent przeglądarkowy popełnia ten sam błąd na trzech różnych stronach (np. klikanie zamkniętego cookie bannera). Jak zaprojektujesz feedback, który jest jednocześnie specyficzny dla strony i generalny dla kategorii problemu?** *Wskazówka: pomyśl o hierarchii instrukcji — ogólne reguły vs site-specific discoveries.*

- **Twój proaktywny agent kalendarzowy wysyła powiadomienie o spotkaniu, ale użytkownik jest w samolocie (brak internetu). Jak system powinien obsłużyć sytuacje, gdy powiadomienie nie może być dostarczone?** *Wskazówka: rozważ retry z uwzględnieniem zmiany kontekstu (np. spotkanie minęło) vs kolejkowanie.*

- **Jak byś zdecydował, które zdarzenia powinny tworzyć nową sesję agenta, a które powinny trafiać do istniejącej, "nieskończonej" sesji?** *Wskazówka: pomyśl o tym, czy kontekst z poprzednich interakcji jest potrzebny do wykonania zadania.*

- **Hook `beforeFinish` wymusza kompletność workflow, ale co jeśli agent utknął w pętli (MAX_TURNS) bez ukończenia wszystkich kroków? Jak zaprojektujesz graceful degradation?** *Wskazówka: rozważ `phase_errors`, powiadomienie człowieka i częściowe zapisanie postępów.*
