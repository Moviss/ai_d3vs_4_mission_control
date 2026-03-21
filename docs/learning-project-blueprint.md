# agents-lab

Projekt do nauki, eksperymentów z AI i przygotowania do live codingów.

## Tech Stack

| Warstwa | Technologia | Uwagi |
|---|---|---|
| **Monorepo** | pnpm workspaces | prostota, brak overheadu Nx |
| **Frontend** | React + TypeScript + Vite | React Router, TanStack Query |
| **UI** | Tailwind CSS + shadcn/ui | gotowe komponenty, łatwa customizacja |
| **State** | TanStack Query (server state) | Zustand dodać gdy pojawi się potrzeba na UI state |
| **Backend** | NestJS | enterprise patterns, popularny na rynku PL |
| **ORM** | Drizzle | type-safe, bliżej SQL-a niż Prisma |
| **Baza danych** | PostgreSQL | Docker Compose |
| **Auth** | Better Auth | biblioteka TS, natywna integracja z Drizzle |
| **Wektory** | pgvector | później, w tym samym Postgresie |
| **Graf** | Neo4j | jeszcze później, osobny kontener |

## Struktura monorepo

```
pnpm-workspace.yaml
tsconfig.base.json
docker-compose.yml
packages/
  shared/          ← Zod schemas, kontrakty API, typy
  db/              ← Drizzle schema, migracje, client
apps/
  web/             ← React + Vite + shadcn + TanStack Query
  api/             ← NestJS + Better Auth
```

### pnpm-workspace.yaml

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

### Nazewnictwo pakietow

Kazdy package/app ma namespace w `package.json`, np.:
- `@agents-lab/shared`
- `@agents-lab/db`
- `@agents-lab/web`
- `@agents-lab/api`

Zaleznosci miedzy pakietami:

```json
{ "dependencies": { "@agents-lab/shared": "workspace:*", "@agents-lab/db": "workspace:*" } }
```

## TypeScript — konfiguracja bazowa

Pliki tworzyc recznie (nie przez `tsc --init`). NestJS CLI i Vite wygeneruja swoje `tsconfig.json` w swoich katalogach — te tylko musza extendowac baze.

### Root: tsconfig.base.json

Wspoldzielone opcje kompilatora. Zaden kod nie kompiluje sie bezposrednio z tego pliku — sluzy tylko jako baza do dziedziczenia.

```jsonc
// tsconfig.base.json (root)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

### packages/shared/tsconfig.json

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

### packages/db/tsconfig.json

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

### apps/api (NestJS)

NestJS CLI wygeneruje `tsconfig.json` i `tsconfig.build.json`. Po wygenerowaniu zmien `tsconfig.json` zeby extentowal baze. Opcje ktore juz sa w `tsconfig.base.json` (`esModuleInterop`, `skipLibCheck`, `sourceMap`, `declaration`) mozna usunac — sa dziedziczone.

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "resolvePackageJsonExports": true,
    "isolatedModules": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,     // wymagane przez NestJS DI
    "experimentalDecorators": true,    // wymagane przez NestJS dekoratory
    "allowSyntheticDefaultImports": true,
    "target": "ES2023",
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "strictNullChecks": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitAny": false,            // TODO: wlaczyc pozniej (strict)
    "strictBindCallApply": false,      // TODO: wlaczyc pozniej (strict)
    "noFallthroughCasesInSwitch": false
  }
}
```

### apps/web (Vite + React)

Vite wygeneruje `tsconfig.json`, `tsconfig.app.json` i `tsconfig.node.json`. Zmien `tsconfig.json`:

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",              // JSX transform bez importu React
    "noEmit": true                   // Vite kompiluje przez esbuild, tsc tylko sprawdza typy
  },
  "include": ["src"],
  "references": [
    { "path": "./tsconfig.node.json" }
  ]
}
```

`tsconfig.node.json` (dla vite.config.ts i innych plikow Node):

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

### Jak to dziala razem

```
tsconfig.base.json (root)
  ├── packages/shared/tsconfig.json   (extends baze)
  ├── packages/db/tsconfig.json       (extends baze)
  ├── apps/api/tsconfig.json          (extends baze + dekoratory NestJS)
  └── apps/web/tsconfig.json          (extends baze + jsx + noEmit)
```

### Import miedzy pakietami w dev

Pakiety `shared` i `db` — najprostsze podejscie: w ich `package.json` ustaw `"main": "./src/index.ts"`. Dzieki temu konsumenci (api, web) importuja zrodla bezposrednio — Vite kompiluje je przez esbuild, NestJS przez tsc/swc. Bez kroku budowania na dev. Na produkcje — zbuduj do `dist/` i zmien `"main"` na `"./dist/index.js"`.

## Przepyw danych

```
[React Component]
    ↓ useUsers() / useCreateUser()
[TanStack Query]
    ↓ fetch('/api/users')
[Vite proxy → localhost:3000]
    ↓
[NestJS Controller]
    ↓ ZodValidationPipe (schema z @agents-lab/shared)
[NestJS Service]
    ↓ this.db.select().from(users)
[Drizzle ORM]
    ↓ SQL
[PostgreSQL]
```

Typy plyno:
- **DB → backend:** Drizzle schema inferuje typy (`$inferSelect`)
- **backend ↔ frontend:** Zod schemas w `@agents-lab/shared` (single source of truth)

## packages/shared — kontrakty API

Zod schemas sluzo jako jedyne zrodlo prawdy dla typow i walidacji na obu koncach:

```typescript
// packages/shared/src/contracts/user.ts
import { z } from 'zod';

export const CreateUserDto = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});
export type CreateUserDto = z.infer<typeof CreateUserDto>;

export const UserResponse = z.object({
  id: z.string().uuid(),
  email: z.string(),
  name: z.string(),
});
export type UserResponse = z.infer<typeof UserResponse>;
```

NestJS uzywa tego samego schema do walidacji (przez `ZodValidationPipe`), frontend do walidacji formularzy.

## packages/db — Drizzle + Postgres

### Schema

```typescript
// packages/db/src/schema/user.ts
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Client

```typescript
// packages/db/src/client.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export function createDb(connectionString: string) {
  return drizzle(connectionString, { schema });
}
export type Database = ReturnType<typeof createDb>;
```

### Migracje

`drizzle-kit generate` → `drizzle-kit migrate`. Konfig w `drizzle.config.ts` w pakiecie `db`.

## apps/api — NestJS

### Database Module (Drizzle provider)

```typescript
// apps/api/src/database/database.module.ts
import { Module, Global } from '@nestjs/common';
import { createDb } from '@agents-lab/db';

const DB_PROVIDER = {
  provide: 'DATABASE',
  useFactory: () => createDb(process.env.DATABASE_URL!),
};

@Global()
@Module({
  providers: [DB_PROVIDER],
  exports: [DB_PROVIDER],
})
export class DatabaseModule {}
```

### Uzycie w serwisie

```typescript
// apps/api/src/users/users.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { Database } from '@agents-lab/db';
import { users } from '@agents-lab/db/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class UsersService {
  constructor(@Inject('DATABASE') private db: Database) {}

  findAll() {
    return this.db.select().from(users);
  }

  findOne(id: string) {
    return this.db.select().from(users).where(eq(users.id, id));
  }
}
```

## Autentykacja — Better Auth

Biblioteka TypeScript, bez dodatkowych kontenerow. Natywna integracja z Drizzle — tabele userow, sesji, kont OAuth tworzone w Twoim Postgresie.

### Backend

```typescript
// apps/api/src/auth/auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@agents-lab/db';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
});
```

### Frontend

```typescript
// apps/web/src/lib/auth-client.ts
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: '/api/auth',
});

// w komponencie:
const { data: session } = authClient.useSession();
```

## apps/web — React + Vite

### Krok po kroku

#### 1. Scaffold

```bash
cd apps
pnpm create vite@latest web -- --template react-ts
```

Wybierz wariant **TypeScript** (bez React Compiler — eksperymentalny, dodasz pozniej jesli chcesz).

Usun domyslne pliki (loga, style), ktore nie sa potrzebne.

#### 2. Tailwind CSS v4

```bash
pnpm add tailwindcss @tailwindcss/vite
```

Tailwind v4 nie ma juz `tailwind.config.js` — konfiguracja jest w CSS przez `@theme`.

W `src/index.css` zamien zawartosc na:

```css
@import "tailwindcss";
```

#### 3. shadcn/ui

```bash
pnpm dlx shadcn@latest init -t vite --monorepo
```

Flaga `--monorepo` jest potrzebna w kontekscie pnpm workspaces. Kreator skonfiguruje aliasy `@/`, `components.json` i katalog `src/components/ui/`.

Dodawanie komponentow:

```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add input
pnpm dlx shadcn@latest add card
```

#### 4. React Router v7 (library/declarative mode)

```bash
pnpm add react-router
```

Uzywamy **declarative mode** (nie framework mode) — bo mamy osobny backend NestJS. Nie uzywaj `create-react-router` — to tworzy framework mode z wlasnym serwerem.

#### 5. TanStack Query v5

```bash
pnpm add @tanstack/react-query
pnpm add -D @tanstack/react-query-devtools
```

#### 6. main.tsx — wszystko razem

```tsx
// apps/web/src/main.tsx
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
);
```

#### 7. vite.config.ts — finalna wersja

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),  // dla shadcn/ui
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
```

#### 8. tsconfig.json

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]    // alias dla shadcn/ui
    }
  },
  "include": ["src"]
}
```

#### Kolejnosc instalacji ma znaczenie

```
1. pnpm create vite (scaffold)
2. Tailwind CSS (plugin do Vite)
3. shadcn/ui init (wymaga Tailwind)
4. React Router
5. TanStack Query
6. tsconfig + vite proxy
```

### API client

```typescript
// apps/web/src/api/users.ts
import type { CreateUserDto, UserResponse } from '@agents-lab/shared';

export async function getUsers(): Promise<UserResponse[]> {
  const res = await fetch('/api/users');
  return res.json();
}

export async function createUser(data: CreateUserDto): Promise<UserResponse> {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}
```

### TanStack Query hooks

```typescript
// apps/web/src/hooks/use-users.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, createUser } from '../api/users';

export function useUsers() {
  return useQuery({ queryKey: ['users'], queryFn: getUsers });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}
```

## pgvector — pozniejszy etap

Dodaje sie do istniejocego Postgres i Drizzle, zero nowej infrastruktury:

```typescript
// packages/db/src/schema/embeddings.ts
import { pgTable, uuid, text, vector } from 'drizzle-orm/pg-core';

export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
});
```

## Docker Compose

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg17
    environment:
      POSTGRES_DB: projekt
      POSTGRES_USER: projekt
      POSTGRES_PASSWORD: projekt
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

Uzycie obrazu `pgvector/pgvector` zamiast czystego `postgres` — pgvector bedzie gotowy gdy go potrzebujesz, a do tego czasu dziala jak zwykly Postgres.

## ESLint + Prettier — wspoldzielona konfiguracja

Jedna konfiguracja w roocie monorepo, wspoldzielona przez NestJS i React.

### Prettier

```jsonc
// .prettierrc (root)
{
  "singleQuote": true,
  "trailingComma": "all",
  "semi": true,
  "printWidth": 100
}
```

Zero konfiguracji per package — Prettier szuka configu w gore drzewa.

### ESLint (flat config)

```bash
pnpm add -Dw eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh eslint-config-prettier globals
```

```typescript
// eslint.config.mjs (root)
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['**/dist', '**/node_modules']),

  // --- reguly dla calego monorepo (TS) ---
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      prettier, // wylacza reguly kolidujace z Prettier
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },

  // --- reguly tylko dla React (apps/web) ---
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },

  // --- reguly tylko dla Node (apps/api, packages) ---
  {
    files: ['apps/api/**/*.ts', 'packages/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
]);
```

### Skrypty w root package.json

```jsonc
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

### Po wygenerowaniu NestJS przez CLI

Usun lokalne `.eslintrc.js` i `.prettierrc` z katalogu `apps/api/` — root config przejmuje kontrole.

## Kolejnosc stawiania

1. **pnpm workspace + tsconfig** — szkielet monorepo
2. **Docker Compose** — Postgres
3. **`packages/db`** — Drizzle schema, migracja, client
4. **`apps/api`** — NestJS, database module, jeden CRUD endpoint
5. **`packages/shared`** — Zod schema dla tego endpointu
6. **`apps/web`** — Vite + React Router + shadcn + TanStack Query, podpiecie do API
7. **Better Auth** — auth w NestJS + auth client w React
8. **pgvector** — eksperymenty z embeddingami
9. **Neo4j** — eksperymenty z grafami
