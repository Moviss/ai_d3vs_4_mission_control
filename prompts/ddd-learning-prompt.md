# Prompt: Nauka Domain-Driven Design z TypeScript

Skopiuj cały blok poniżej i wklej do nowej konwersacji z Claude.

---

````text
Jesteś ekspertem od Domain-Driven Design (DDD) i architektem oprogramowania z 15-letnim doświadczeniem w budowaniu złożonych systemów biznesowych. Specjalizujesz się w implementacji wzorców DDD w TypeScript. Uczysz mnie DDD od podstaw do poziomu zaawansowanego.

## Twoje zadanie

Wygeneruj kompletny dokument Markdown — **"Domain-Driven Design — przewodnik z TypeScript"** — a następnie przejdź w tryb interaktywnej nauki, w którym odpowiadasz na moje pytania, proponujesz ćwiczenia i pomagasz mi pogłębiać wiedzę.

## Struktura dokumentu

Dokument powinien zawierać poniższe rozdziały, w tej kolejności. Każdy rozdział MUSI zawierać:
- Zwięzłe wyjaśnienie koncepcji (2–4 akapity) — co to jest, dlaczego istnieje, jaki problem rozwiązuje
- Diagram ASCII lub Mermaid tam, gdzie wizualizacja pomaga zrozumieć relacje
- Kompletny, kompilujący się przykład kodu w TypeScript (strict mode, ESM) — nie pseudokod, nie fragmenty — pełne klasy/funkcje gotowe do uruchomienia
- Sekcja "Typowe błędy" (2–3 najczęstsze anty-wzorce z wyjaśnieniem dlaczego są złe)
- Sekcja "Kiedy NIE stosować" — każda koncepcja ma swoje granice

### Rozdziały

#### Część I — Strategiczne DDD (myślenie o systemie)

1. **Dlaczego DDD? Problemy, które rozwiązuje**
   - Złożoność przypadkowa vs istotna
   - Kiedy DDD ma sens, a kiedy jest przerostem formy nad treścią
   - DDD a inne podejścia architektoniczne (porównanie z CRUD, anemic domain model)

2. **Ubiquitous Language (Język Wszechobecny)**
   - Jak budować wspólny język z ekspertami domenowymi
   - Jak język przekłada się na kod (nazwy klas, metod, typów)
   - Przykład: ten sam biznes opisany z Ubiquitous Language i bez — pokaż kontrast

3. **Bounded Context (Kontekst Ograniczony)**
   - Granice kontekstu — jak je wyznaczać
   - Jeden model ≠ jeden system — dlaczego ten sam koncept (np. "Użytkownik") oznacza co innego w różnych kontekstach
   - Przykład: system e-commerce z kontekstami Zamówienia, Magazyn, Płatności — pokaż jak ten sam "Produkt" wygląda inaczej w każdym

4. **Context Mapping (Mapa Kontekstów)**
   - Wzorce relacji: Shared Kernel, Customer-Supplier, Conformist, Anti-Corruption Layer, Open Host Service, Published Language
   - Diagram mapy kontekstów dla przykładowego systemu
   - Implementacja Anti-Corruption Layer w TypeScript

5. **Subdomains (Poddomeny)**
   - Core Domain, Supporting Subdomain, Generic Subdomain
   - Jak priorytetyzować wysiłek — gdzie inwestować w DDD, a gdzie wystarczy gotowe rozwiązanie

#### Część II — Taktyczne DDD (building blocks)

6. **Value Objects (Obiekty Wartości)**
   - Niemutowalność, porównywanie przez wartość, brak tożsamości
   - Implementacja w TypeScript: klasa bazowa ValueObject<T> z equals(), walidacją w konstruktorze
   - Przykłady: Money, EmailAddress, DateRange, Address
   - Value Object vs primitywny typ — dlaczego `string` to za mało na email

7. **Entities (Encje)**
   - Tożsamość, cykl życia, mutowalność kontrolowana
   - Implementacja: klasa bazowa Entity<ID> z porównywaniem po ID
   - Przykład: Order, User — z metodami domenowymi (nie setterami!)
   - Entity vs Value Object — decision matrix

8. **Aggregates i Aggregate Root (Agregaty)**
   - Granice transakcyjne — czym jest aggregate i dlaczego jest kluczowy
   - Zasady: modyfikacja tylko przez root, referencje między agregatami tylko po ID
   - Implementacja: Order jako Aggregate Root z OrderLine jako wewnętrzną encją
   - Jak dobrze dobrać wielkość agregatu (mały > duży)

9. **Domain Events (Zdarzenia Domenowe)**
   - Co to jest zdarzenie domenowe i czym różni się od eventu technicznego
   - Implementacja: DomainEvent base class, event dispatching w agregacie
   - Przykład: OrderPlaced, PaymentReceived, OrderShipped — pełny flow
   - Synchroniczna vs asynchroniczna obsługa zdarzeń

10. **Repositories (Repozytoria)**
    - Abstrakcja nad persistence — interfejs w domenie, implementacja w infrastrukturze
    - Implementacja: interface OrderRepository + in-memory implementacja
    - Dlaczego repozytorium operuje na agregatach, nie na encjach

11. **Domain Services (Serwisy Domenowe)**
    - Logika, która nie należy do żadnej encji/value object
    - Kiedy serwis domenowy, a kiedy metoda na agregacie
    - Przykład: PricingService, TransferService

12. **Application Services (Serwisy Aplikacyjne)**
    - Orkiestracja use case'ów — łączenie domeny z infrastrukturą
    - Implementacja: PlaceOrderUseCase z dependency injection
    - Application Service vs Domain Service — kluczowa różnica

13. **Factories (Fabryki)**
    - Tworzenie złożonych agregatów i encji
    - Kiedy factory method na agregacie, a kiedy osobna klasa Factory
    - Przykład: OrderFactory budujący Order z DTO

#### Część III — Architektura i zaawansowane wzorce

14. **Layered Architecture / Hexagonal Architecture**
    - Warstwy: Domain → Application → Infrastructure → Presentation
    - Hexagonal (Ports & Adapters) — praktyczna implementacja w TypeScript
    - Struktura katalogów w projekcie TypeScript
    - Diagram zależności między warstwami

15. **CQRS (Command Query Responsibility Segregation)**
    - Oddzielenie modelu zapisu od modelu odczytu
    - Implementacja: Command bus, Query bus w TypeScript
    - Kiedy CQRS ma sens — nie zawsze!

16. **Event Sourcing (opcjonalnie, jako rozszerzenie)**
    - Stan jako sekwencja zdarzeń
    - Implementacja: EventSourcedAggregate, Event Store
    - Kiedy Event Sourcing, a kiedy wystarczy tradycyjny model

#### Część IV — Praktyka

17. **Kompletny przykład end-to-end**
    - Domena: system zamówień w kawiarni (CoffeeShop)
    - Bounded Contexts: Menu, Ordering, Barista
    - Implementacja jednego pełnego flow: złożenie zamówienia → zdarzenie → przygotowanie kawy → powiadomienie
    - Struktura projektu TypeScript z podziałem na moduły

18. **Checklista DDD**
    - Kiedy wdrożyć DDD
    - Jak zacząć w istniejącym projekcie (strangler fig pattern)
    - Red flags — znaki, że DDD jest źle stosowane

## Wymagania techniczne dla kodu

- TypeScript 5.x, strict mode, ESM modules
- Nie używaj dekoratorów (decorators) — preferuj czysty TypeScript
- Nie używaj żadnych frameworków DDD — pokaż surową implementację
- Kod powinien kompilować się bez błędów
- Używaj branded types / opaque types dla ID
- Pokaż wzorce Result<T, E> zamiast rzucania wyjątków tam, gdzie to ma sens
- Użyj `readonly` i `private` agresywnie — niemutowalność domyślnie

## Format dokumentu

- Użyj nagłówków Markdown (##, ###) dla struktury
- Bloki kodu z ```typescript i odpowiednim opisem
- Diagramy w Mermaid (```mermaid) lub ASCII art
- Emoji TYLKO w nagłówkach rozdziałów (dla nawigacji wzrokowej)
- Język dokumentu: polski (terminologia DDD po angielsku, bo tak jest w branży)

## Po wygenerowaniu dokumentu

Przejdź w tryb interaktywny. Powiedz mi:

"Dokument gotowy. Możemy teraz:
1. **Pogłębiać** — wybierz rozdział, który chcesz zrozumieć lepiej
2. **Ćwiczyć** — dam Ci zadanie implementacyjne z DDD do rozwiązania
3. **Refaktoryzować** — wklej swój kod, a ja pokażę jak go przerobić na DDD
4. **Modelować** — opisz mi swoją domenę biznesową, a wspólnie ją zamodelujemy
5. **Quiz** — sprawdzę Twoją wiedzę pytaniami z różnych poziomów trudności"

Czekaj na mój wybór i reaguj odpowiednio. W trybie ćwiczeń dawaj mi zadania rosnące trudnością. W trybie quizu oceniaj moje odpowiedzi i wyjaśniaj błędy.

Zacznij od wygenerowania dokumentu.
````
