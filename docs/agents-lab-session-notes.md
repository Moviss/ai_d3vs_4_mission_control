# agents-lab — notatki z sesji planowania

Kontekst do kontynuacji pracy w nowej konwersacji. Pelny blueprint: `docs/learning-project-blueprint.md`.

## Co juz zrobione

- [x] Zaplanowano stack i architekture (blueprint)
- [x] Zainicjalizowano repo z git + init commit
- [x] Stworzono `apps/api` przez NestJS CLI (`nest new`)
- [x] Stworzono `apps/web` przez `pnpm create vite@latest web -- --template react-ts` (wariant TypeScript, bez React Compiler)
- [x] Zainstalowano Tailwind CSS v4 (`tailwindcss` + `@tailwindcss/vite`)
- [x] Dodano `.gitignore` (wazne: bez spacji na poczatku linii, inaczej wzorce nie dzialaja)
- [x] Uruchomiono `pnpm approve-builds` (pnpm v10 blokuje postinstall skrypty domyslnie)

## Co w trakcie / do zrobienia

- [ ] shadcn/ui init — **bez flagi `--monorepo`** (z flaga szuka `packages/ui/` wewnatrz `apps/web/`). Alias `@/*` musi byc w glownym `tsconfig.json` (nie tylko w `tsconfig.app.json`), bo shadcn czyta glowny plik
- [ ] React Router (`pnpm add react-router`) — **declarative mode**, nie framework mode
- [ ] TanStack Query (`pnpm add @tanstack/react-query`)
- [ ] Konfiguracja `vite.config.ts` (tailwind plugin, alias `@`, proxy `/api`)
- [ ] tsconfig — Vite generowal split config (`tsconfig.json` + `tsconfig.app.json` + `tsconfig.node.json`). Docelowo extendowac `tsconfig.base.json` z roota
- [ ] NestJS tsconfig — juz ustawiony z dekoratorami, `noImplicitAny: false` i `strictBindCallApply: false` na razie, TODO wlaczyc strict pozniej
- [ ] `tsconfig.base.json` w roocie
- [ ] `pnpm-workspace.yaml`
- [ ] `packages/shared` i `packages/db` — jeszcze nie utworzone
- [ ] Docker Compose z Postgres (obraz `pgvector/pgvector:pg17`)
- [ ] ESLint flat config + Prettier w roocie
- [ ] Usunac lokalne `.eslintrc.js` i `.prettierrc` z NestJS

## Gotcha / wazne ustalenia

1. **shadcn init**: uzyc `pnpm dlx shadcn@latest init -t vite` (BEZ `--monorepo`). Alias `@/*` musi byc w glownym `tsconfig.json`
2. **Tailwind v4**: brak `tailwind.config.js`, konfiguracja w CSS przez `@theme`. Plugin `@tailwindcss/vite`
3. **React Router v7**: 3 tryby (Framework, Data, Declarative). Uzywamy Declarative — bo mamy NestJS jako backend
4. **pnpm approve-builds**: wymagane w pnpm v10 dla paczek z postinstall skryptami
5. **NestJS tsconfig**: `module: "nodenext"`, `emitDecoratorMetadata: true`, `experimentalDecorators: true`
6. **Import miedzy pakietami w dev**: `"main": "./src/index.ts"` w package.json shared/db — konsumenci kompiluja zrodla bezposrednio
7. **Docker Compose**: obraz `pgvector/pgvector:pg17` zamiast `postgres` — pgvector gotowy na pozniej
