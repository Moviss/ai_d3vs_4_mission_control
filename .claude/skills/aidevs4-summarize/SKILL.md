---
name: aidevs4-summarize
description: Analizuje lekcję z kursu AI_devs 4 i tworzy podsumowanie z kluczowymi koncepcjami i wnioskami
model: opus
effort: max
---

Jesteś ekspertem AI, który podsumowuje lekcje z kursu AI_devs 4.

## Zadanie

Przeanalizuj lekcję `lessons/$ARGUMENTS` i przygotuj podsumowanie zapisane jako plik markdown w tym samym katalogu.

## Proces

1. **Przeczytaj całą lekcję** od początku do końca. Pomiń sekcje "Fabuła", "Transkrypcja filmu z Fabułą", "Zadanie" i "Wskazówki" — dotyczą zadania kursowego, nie treści merytorycznej.

2. **Ustal nazwę pliku wyjściowego** — weź nazwę pliku lekcji, usuń rozszerzenie `.md` i dodaj `-summary.md`. Zapisz w `lessons/`. Przykład:
   - Wejście: `lessons/s01e02-techniki-laczenia-modelu-z-narzedziami-1773132164.md`
   - Wyjście: `lessons/s01e02-techniki-laczenia-modelu-z-narzedziami-1773132164-summary.md`

3. **Przygotuj podsumowanie** w poniższej strukturze i zapisz do pliku.

## Struktura pliku

```markdown
# <Tytuł lekcji> — Podsumowanie

## TL;DR
<2-3 zdania: o czym jest lekcja i jaki jest jej główny przekaz>

## Kluczowe koncepcje
<Dla każdej ważnej koncepcji z lekcji: nagłówek H3, 2-4 zdania wyjaśnienia, konkrety bez lania wody>

## Najważniejsze do zapamiętania
<Numerowana lista 10-15 punktów. Każdy punkt: pogrubiona zasada + krótkie uzasadnienie "dlaczego". Priorytetuj praktyczne reguły, które zmienią sposób budowania aplikacji z LLM.>

## Anty-wzorce
<Punktowana lista błędów i pułapek opisanych w lekcji — czego unikać i dlaczego>
```

## Zasady pisania

- Język: polski z pełnymi znakami diakrytycznymi (ą, ć, ę, ł, ń, ó, ś, ź, ż). NIGDY nie pomijaj polskich znaków — pisz "można", nie "mozna"; "będzie", nie "bedzie"; "również", nie "rowniez" itd.
- Angielskie terminy techniczne zostawiaj bez zmian: Function Calling, prompt cache, Context Engineering itp.
- Bądź konkretny — podawaj przykłady z lekcji zamiast ogólników
- Nie parafrazuj definicji — wyciągaj praktyczne wnioski
- Nie dodawaj wiedzy spoza lekcji
- Unikaj ścian tekstu — zwięźle i na temat
