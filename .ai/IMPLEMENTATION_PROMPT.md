# Implementation Prompt

> Skopiuj poniższy prompt i wklej jako wiadomość w nowej sesji Claude Code.
> Zastąp `{{STEP_NUMBERS}}` numerami kroków do implementacji (np. `1`, `3-4`, `12`).

---

```
Implementuj krok {{STEP_NUMBERS}} z planu implementacji.

Kontekst:
- Plan implementacji: @.ai/IMPLEMENTATION_PLAN.md
- PRD projektu: @.ai/MISSION_CONTROL_PRD.md
- Konwencje: @CLAUDE.md

Zasady pracy:
1. Przeczytaj sekcję odpowiedniego kroku z IMPLEMENTATION_PLAN.md — jest tam lista plików, decyzje, zależności i kryteria weryfikacji.
2. Przed pisaniem kodu sprawdź aktualny stan repo (git status, istniejące pliki w packages/ i tasks/) — poprzednie kroki mogły zmienić interfejsy lub dodać kod, którego plan nie przewidział. Adaptuj się do tego co jest, nie do tego co plan zakładał.
3. Implementuj zgodnie z planem, ale jeśli w trakcie odkryjesz lepsze rozwiązanie lub konieczną korektę — zastosuj je i wyjaśnij dlaczego.
4. Po zakończeniu implementacji uruchom weryfikację opisaną w kroku (testy, build, dry-run).
5. Napraw wszystkie błędy z weryfikacji zanim zakończysz.
6. Zaktualizuj tabelę "Implementation Progress" w CLAUDE.md — zmień status ukończonych kroków na `done`.
7. Na koniec: git status + krótkie podsumowanie co zostało zrobione i czy są uwagi do kolejnych kroków.
```
