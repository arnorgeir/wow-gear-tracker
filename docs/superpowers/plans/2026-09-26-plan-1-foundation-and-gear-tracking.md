# Plan 1: foundation and gear tracking

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Next.js app that tracks WoW characters and compares their gear to Method.gg's BiS lists, with upgrade tracks, item states, rarity-colored item cards and Wowhead tooltips.

**Architecture:** One Next.js App Router app. All logic lives in framework-free TypeScript under `src/core`: clients fetch external data, pure logic modules compute item states, and a sync layer combines clients with a SQLite database through Drizzle ORM. Pages and route handlers under `src/app` stay thin and call into `src/core` through a small `src/server` wiring layer.

**Tech Stack:** Node.js 24+, Next.js 16 (App Router), React 19, TypeScript 5 (strict), Tailwind CSS 4, Drizzle ORM with `@libsql/client` (SQLite), Vitest, ESLint.

**Spec:** `docs/superpowers/specs/2026-09-26-gear-tracker-design.md`

**Plan series:** This is plan 1 of 3. Plan 2 adds SimC paste, bag and vault items, crests and upgrade flags. Plan 3 adds season loot tables, dungeon priority and the group page. This plan leaves hooks for both: `snapshot_items.location`, `gear_snapshots.source`, and the `inBags` item state.

## Global Constraints

- Node.js 24 or later. npm is the package manager.
- TypeScript in strict mode. Pin `typescript@5`: TypeScript 7 is the native compiler port and isn't yet supported by Next.js tooling.
- Nothing in `src/core` imports `next`, `react`, or anything under `src/app`, `src/components` or `src/server`.
- Logic functions take only the data they need, never a database client or whole character records.
- Sync functions receive their clients and database as parameters.
- No class hierarchies, dependency injection containers, or single-implementation interfaces, except `BisSource`.
- `.env`, `data/` and `.cache/` are gitignored. Never commit credentials or real character names.
- Test fixtures use made-up character names and trimmed pages only.
- Commit messages never mention AI tools. Commits in this repo use `arnorgeir91@gmail.com`, already set in the repo's local git config.
- Blizzard API locale is `en_GB`. Namespaces are `profile-{region}`, `static-{region}` and `dynamic-{region}`.
- Refresh rules: gear when the last sync is over 5 minutes old, Method lists daily, Raidbots track data daily.
- External requests: at most 4 in parallel per client. A 429 response waits for `Retry-After`, then retries once.
- A failed refresh never blanks a page. Show the last good data with its age and a short note about what failed.

## Review Focus

1. **Character names with capitals or non-ASCII letters,** like "Birkibjörn": the Blizzard path must use the lowercased, URL-encoded name. Pinned in Task 3.
2. **Cosmetic or empty slots:** a shirt or tabard must be ignored, and an empty slot must show as `missing`, not crash. Pinned in Tasks 3 and 6.
3. **Adding the same character twice,** even with different capitalization: return the existing character, never a duplicate. Pinned in Tasks 8 and 11.
4. **A spec with no Method page, or a page with no BiS tables:** show a clear error and keep any previous list. Pinned in Task 10.
5. **Blizzard failing mid-sync** with a 429, 5xx or 404: keep the last gear, record the error, and mark 404s as `notFound`. Pinned in Tasks 2 and 9.

---

## File structure

```
.github/workflows/ci.yml             CI: typecheck, lint, test
drizzle/                             generated SQL migrations
drizzle.config.ts                    drizzle-kit config
eslint.config.mjs
next.config.ts
postcss.config.mjs
tsconfig.json
vitest.config.ts                     unit and integration tests
vitest.live.config.ts                opt-in live API checks
src/
  core/
    types.ts                         shared domain types and slot constants
    errors.ts                        UserError
    config.ts                        reads .env settings
    http.ts                          fetchJson, retry on 429, concurrency limiter
    format.ts                        formatAge
    blizzard/client.ts               OAuth token, profile, equipment, media, realms, classes
    method/method.ts                 BisSource for Method.gg, HTML parser, spec slugs
    raidbots/tracks.ts               bonus ID to upgrade track
    gear/evaluate.ts                 BiS matching and item states
    db/schema.ts                     Drizzle tables
    db/client.ts                     openDb with migrations
    db/queries.ts                    all database reads and writes
    sync/character-sync.ts           gear sync with staleness and dedupe
    sync/reference-sync.ts           BiS lists, tracks, item icons
    raiderio/search.ts               character search by name
    characters/add-character.ts      add flow
    live.live.test.ts                opt-in live checks
  server/
    services.ts                      singleton wiring of config, db and clients
    views.ts                         page view models
    route-helpers.ts                 request parsing and error responses
  app/
    layout.tsx, globals.css
    page.tsx                         characters page
    characters/[id]/page.tsx         character page
    api/search/route.ts
    api/realms/route.ts
    api/characters/route.ts
    api/characters/[id]/route.ts
    api/characters/[id]/sync/route.ts
  components/
    class-colors.ts
    ItemCard.tsx
    StateBadge.tsx
    CharacterCard.tsx
    AddCharacterBar.tsx              client
    StaleSync.tsx                    client
    RefreshButton.tsx                client
    RemoveCharacterButton.tsx        client
    CharacterSettings.tsx            client
    SetupNotice.tsx
    WowheadRefresh.tsx               client
  test/
    fake-fetch.ts                    test helper
```

Branch: create `feat/gear-tracking-foundation` from `chore/initial-spec` before Task 1.

```bash
git checkout -b feat/gear-tracking-foundation
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `vitest.live.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Modify: `.gitignore`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:live`, `db:generate`. Path alias `@/*` for `src/*`. Tailwind theme tokens used by every later UI task: colors `bg`, `surface`, `surface-2`, `raised`, `line`, `line-strong`, `ink`, `muted`, `gold`, `crest`, `vault`, `bags`, `upgrade`, and fonts `display`, `sans`, `mono`.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "wow-gear-tracker",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:live": "vitest run --config vitest.live.config.ts",
    "db:generate": "drizzle-kit generate"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install next@16 react@19 react-dom@19
npm install -D typescript@5 @types/node@24 @types/react@19 @types/react-dom@19 tailwindcss@4 @tailwindcss/postcss@4 eslint eslint-config-next@16 vitest
```

Expected: both commands finish without errors and create `package-lock.json`. If npm reports a peer dependency conflict between `eslint` and `eslint-config-next`, rerun the second command with `eslint@9` instead of `eslint`.

- [ ] **Step 3: Write the config files**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2023"],
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "scripts"]
}
```

`next.config.ts`:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

`postcss.config.mjs`:

```js
export default { plugins: { '@tailwindcss/postcss': {} } };
```

`eslint.config.mjs`:

```js
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: { '@next/next/no-img-element': 'off' } },
  globalIgnores(['.next/**', 'drizzle/**', 'scripts/**', 'next-env.d.ts']),
]);
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.live.test.ts', 'node_modules/**'],
  },
});
```

`vitest.live.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'node', include: ['src/**/*.live.test.ts'], testTimeout: 60_000 },
});
```

Append to `.gitignore`:

```
.next/
next-env.d.ts
*.tsbuildinfo
```

- [ ] **Step 4: Write the minimal app**

`src/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-bg: #14120f;
  --color-surface: #1d1a16;
  --color-surface-2: #26221c;
  --color-raised: #2b261f;
  --color-line: #3a342b;
  --color-line-strong: #4a4237;
  --color-ink: #ece6da;
  --color-muted: #a79e8e;
  --color-gold: #f2c14e;
  --color-crest: #c9a4f5;
  --color-vault: #7fb4f0;
  --color-bags: #5fd6bd;
  --color-upgrade: #7be38a;
}

@theme inline {
  --font-display: var(--font-cinzel), Georgia, serif;
  --font-sans: var(--font-barlow), system-ui, sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, monospace;
}

body {
  background: var(--color-bg);
  color: var(--color-ink);
  font-family: var(--font-sans);
}
```

`src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { Barlow, Cinzel, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const cinzel = Cinzel({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-cinzel' });
const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-barlow' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['500'], variable: '--font-plex-mono' });

export const metadata: Metadata = { title: 'Gear Tracker', description: 'WoW gear versus BiS' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${barlow.variable} ${plexMono.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:

```tsx
export default function Home() {
  return <main className="p-16 font-display text-4xl">Gear Tracker</main>;
}
```

- [ ] **Step 5: Verify the scaffold**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all three succeed. `next build` may add settings to `tsconfig.json` on first run, which is fine.

Run: `npm test`
Expected: Vitest reports "No test files found" and exits with code 1. That's expected until Task 2.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs vitest.config.ts vitest.live.config.ts .gitignore src/app
git commit -m "chore: scaffold Next.js app with Tailwind, ESLint and Vitest"
```

---

### Task 2: Shared types, config, errors and HTTP helpers

**Files:**
- Create: `src/core/types.ts`, `src/core/errors.ts`, `src/core/config.ts`, `src/core/http.ts`, `src/core/format.ts`, `src/test/fake-fetch.ts`
- Test: `src/core/config.test.ts`, `src/core/http.test.ts`, `src/core/format.test.ts`

**Interfaces:**
- Produces:
  - `type Region = 'eu' | 'us' | 'kr' | 'tw'`, `REGIONS: readonly Region[]`
  - `type SlotType` and `SLOT_TYPES: readonly SlotType[]` (16 gear slots, no shirt or tabard)
  - `type Quality`, `type ListType = 'overall' | 'raid' | 'mythicPlus'`, `LIST_TYPES`
  - `interface GearItem { slot; itemId; name; itemLevel: number | null; quality: Quality; bonusIds: number[]; isTier: boolean }`
  - `interface BisRow`, `type BisLists = Record<ListType, BisRow[]>`, `interface BisSource { name: string; fetchLists(specSlug: string): Promise<BisLists> }`
  - `interface Track { bonusId; name; step; max; currencyId: number | null; costPerStep: number | null }`
  - `type ItemState = 'missing' | 'inBags' | 'belowMyth' | 'mythUpgradable' | 'done'`
  - `type ItemLocation = 'equipped' | 'bag' | 'vault'`, `type SnapshotSource = 'blizzard' | 'simc'`
  - `class UserError extends Error`
  - `readConfig(env?): AppConfig`, `class MissingConfigError { missing: string[] }`
  - `type FetchFn = typeof fetch`, `class HttpError { status; url }`, `fetchJson<T>(fetchFn, url, init?, sleep?)`, `fetchWithRetry(fetchFn, url, init?, sleep?)`, `createLimiter(max): <T>(fn: () => Promise<T>) => Promise<T>`
  - `formatAge(fromMs: number, nowMs: number): string`
  - Test helpers `fakeFetch(routes)`, `on(substring, respond)`, `json(body, status?, headers?)`

- [ ] **Step 1: Write the types and errors**

`src/core/types.ts`:

```ts
export type Region = 'eu' | 'us' | 'kr' | 'tw';
export const REGIONS: readonly Region[] = ['eu', 'us', 'kr', 'tw'];

export const SLOT_TYPES = [
  'HEAD', 'NECK', 'SHOULDER', 'BACK', 'CHEST', 'WRIST', 'HANDS', 'WAIST', 'LEGS', 'FEET',
  'FINGER_1', 'FINGER_2', 'TRINKET_1', 'TRINKET_2', 'MAIN_HAND', 'OFF_HAND',
] as const;
export type SlotType = (typeof SLOT_TYPES)[number];

export type Quality = 'POOR' | 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'ARTIFACT' | 'HEIRLOOM';

export type ListType = 'overall' | 'raid' | 'mythicPlus';
export const LIST_TYPES: readonly ListType[] = ['overall', 'raid', 'mythicPlus'];

export type ItemLocation = 'equipped' | 'bag' | 'vault';
export type SnapshotSource = 'blizzard' | 'simc';

export interface GearItem {
  slot: SlotType;
  itemId: number;
  name: string;
  itemLevel: number | null;
  quality: Quality;
  bonusIds: number[];
  isTier: boolean;
}

export interface BisRow {
  slotLabel: string;
  slots: SlotType[];
  itemId: number;
  name: string;
  bonusIds: number[];
  isTier: boolean;
  isCatalyst: boolean;
  source: string;
}

export type BisLists = Record<ListType, BisRow[]>;

export interface BisSource {
  name: string;
  fetchLists(specSlug: string): Promise<BisLists>;
}

export interface Track {
  bonusId: number;
  name: string;
  step: number;
  max: number;
  currencyId: number | null;
  costPerStep: number | null;
}

export type ItemState = 'missing' | 'inBags' | 'belowMyth' | 'mythUpgradable' | 'done';
export const ITEM_STATES: readonly ItemState[] = ['done', 'mythUpgradable', 'belowMyth', 'inBags', 'missing'];
```

`src/core/errors.ts`:

```ts
/** An error whose message is safe and useful to show to the user. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}
```

- [ ] **Step 2: Write the failing tests for config, HTTP and format**

`src/test/fake-fetch.ts`:

```ts
export interface Route {
  match: (url: string) => boolean;
  respond: (url: string, init?: RequestInit) => Response | Promise<Response>;
}

export function fakeFetch(routes: Route[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const route = routes.find((r) => r.match(url));
    if (!route) return new Response('no route', { status: 404 });
    return route.respond(url, init);
  }) as typeof fetch;
  return { fn, calls };
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

export const on = (substring: string, respond: Route['respond']): Route => ({
  match: (url) => url.includes(substring),
  respond,
});
```

`src/core/config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MissingConfigError, readConfig } from './config';

describe('readConfig', () => {
  it('reads credentials and defaults the database URL', () => {
    const config = readConfig({ BLIZZARD_CLIENT_ID: ' id ', BLIZZARD_CLIENT_SECRET: 'secret' });
    expect(config).toEqual({ blizzardClientId: 'id', blizzardClientSecret: 'secret', databaseUrl: 'file:data/app.db' });
  });

  it('uses DATABASE_URL when set', () => {
    const config = readConfig({ BLIZZARD_CLIENT_ID: 'id', BLIZZARD_CLIENT_SECRET: 's', DATABASE_URL: 'file:other.db' });
    expect(config.databaseUrl).toBe('file:other.db');
  });

  it('lists every missing setting', () => {
    try {
      readConfig({ BLIZZARD_CLIENT_ID: '  ' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(MissingConfigError);
      expect((err as MissingConfigError).missing).toEqual(['BLIZZARD_CLIENT_ID', 'BLIZZARD_CLIENT_SECRET']);
    }
  });
});
```

`src/core/http.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createLimiter, fetchJson, HttpError } from './http';
import { fakeFetch, json, on } from '@/test/fake-fetch';

describe('fetchJson', () => {
  it('returns parsed JSON', async () => {
    const { fn } = fakeFetch([on('/ok', () => json({ a: 1 }))]);
    expect(await fetchJson(fn, 'https://x/ok')).toEqual({ a: 1 });
  });

  it('throws HttpError with the status on failure', async () => {
    const { fn } = fakeFetch([on('/boom', () => new Response('nope', { status: 500 }))]);
    await expect(fetchJson(fn, 'https://x/boom')).rejects.toMatchObject({ status: 500 });
    await expect(fetchJson(fn, 'https://x/boom')).rejects.toBeInstanceOf(HttpError);
  });

  it('waits for Retry-After on 429 and retries once', async () => {
    let n = 0;
    const waits: number[] = [];
    const { fn, calls } = fakeFetch([
      on('/limited', () => (n++ === 0 ? new Response('', { status: 429, headers: { 'retry-after': '2' } }) : json({ ok: true }))),
    ]);
    const result = await fetchJson(fn, 'https://x/limited', undefined, async (ms) => { waits.push(ms); });
    expect(result).toEqual({ ok: true });
    expect(waits).toEqual([2000]);
    expect(calls).toHaveLength(2);
  });

  it('gives up after one retry', async () => {
    const { fn, calls } = fakeFetch([on('/limited', () => new Response('', { status: 429 }))]);
    await expect(fetchJson(fn, 'https://x/limited', undefined, async () => {})).rejects.toMatchObject({ status: 429 });
    expect(calls).toHaveLength(2);
  });
});

describe('createLimiter', () => {
  it('never runs more than max tasks at once', async () => {
    const limit = createLimiter(2);
    let active = 0;
    let peak = 0;
    const task = () => limit(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
    });
    await Promise.all([task(), task(), task(), task(), task()]);
    expect(peak).toBe(2);
  });
});
```

`src/core/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatAge } from './format';

const MIN = 60_000;

describe('formatAge', () => {
  it.each([
    [30_000, 'just now'],
    [3 * MIN, '3 min ago'],
    [90 * MIN, '1 h ago'],
    [26 * 60 * MIN, '1 day ago'],
    [6 * 24 * 60 * MIN, '6 days ago'],
  ])('formats %i ms as %s', (age, text) => {
    expect(formatAge(1_000_000_000 - age, 1_000_000_000)).toBe(text);
  });
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run src/core`
Expected: FAIL, because `./config`, `./http` and `./format` don't exist yet.

- [ ] **Step 4: Implement config, HTTP and format**

`src/core/config.ts`:

```ts
export class MissingConfigError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing settings in .env: ${missing.join(', ')}`);
    this.name = 'MissingConfigError';
  }
}

export interface AppConfig {
  blizzardClientId: string;
  blizzardClientSecret: string;
  databaseUrl: string;
}

export function readConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const required = ['BLIZZARD_CLIENT_ID', 'BLIZZARD_CLIENT_SECRET'];
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length > 0) throw new MissingConfigError(missing);
  return {
    blizzardClientId: env.BLIZZARD_CLIENT_ID!.trim(),
    blizzardClientSecret: env.BLIZZARD_CLIENT_SECRET!.trim(),
    databaseUrl: env.DATABASE_URL?.trim() || 'file:data/app.db',
  };
}
```

`src/core/http.ts`:

```ts
export type FetchFn = typeof fetch;
export type SleepFn = (ms: number) => Promise<void>;

const defaultSleep: SleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class HttpError extends Error {
  constructor(public readonly status: number, public readonly url: string, body: string) {
    super(`HTTP ${status} for ${url}: ${body.slice(0, 200)}`);
    this.name = 'HttpError';
  }
}

/** Fetches once; on 429 waits for Retry-After (default 1 s) and tries one more time. */
export async function fetchWithRetry(fetchFn: FetchFn, url: string, init?: RequestInit, sleep: SleepFn = defaultSleep): Promise<Response> {
  const res = await fetchFn(url, init);
  if (res.status !== 429) return res;
  const seconds = Number(res.headers.get('retry-after'));
  await sleep((Number.isFinite(seconds) && seconds > 0 ? seconds : 1) * 1000);
  return fetchFn(url, init);
}

export async function fetchJson<T>(fetchFn: FetchFn, url: string, init?: RequestInit, sleep?: SleepFn): Promise<T> {
  const res = await fetchWithRetry(fetchFn, url, init, sleep);
  if (!res.ok) throw new HttpError(res.status, url, await res.text());
  return (await res.json()) as T;
}

/** Runs at most `max` async tasks at once; extra tasks wait in order. */
export function createLimiter(max: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async function limit<T>(task: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((resolve) => waiting.push(resolve));
    active++;
    try {
      return await task();
    } finally {
      active--;
      waiting.shift()?.();
    }
  };
}
```

`src/core/format.ts`:

```ts
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function formatAge(fromMs: number, nowMs: number): string {
  const age = Math.max(0, nowMs - fromMs);
  if (age < MIN) return 'just now';
  if (age < HOUR) return `${Math.floor(age / MIN)} min ago`;
  if (age < DAY) return `${Math.floor(age / HOUR)} h ago`;
  const days = Math.floor(age / DAY);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run src/core`
Expected: PASS for all tests in `config.test.ts`, `http.test.ts` and `format.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/core src/test
git commit -m "feat: add core types, config, HTTP helpers and age formatting"
```

---

### Task 3: Blizzard API client

**Files:**
- Create: `src/core/blizzard/client.ts`
- Test: `src/core/blizzard/client.test.ts`

**Interfaces:**
- Consumes: `fetchJson`, `HttpError`, `createLimiter`, `FetchFn`, `SleepFn` from `src/core/http.ts`. `GearItem`, `Quality`, `Region`, `SlotType`, `SLOT_TYPES` from `src/core/types.ts`.
- Produces:
  - `interface CharacterRef { region: Region; realmSlug: string; name: string }`
  - `interface CharacterProfile { name; realmId; realmSlug; realmName; className; specName }`
  - `interface Realm { id: number; name: string; slug: string }`
  - `interface PlayableClass { id: number; name: string; specs: string[] }`
  - `interface BlizzardClient { getProfile(ref); getEquipment(ref): Promise<GearItem[]>; getItemIconUrl(region, itemId): Promise<string | null>; getRealms(region): Promise<Realm[]>; getClasses(region): Promise<PlayableClass[]> }`
  - `createBlizzardClient({ clientId, clientSecret, fetchFn?, now?, sleep? }): BlizzardClient`

- [ ] **Step 1: Write the failing tests**

`src/core/blizzard/client.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createBlizzardClient } from './client';
import { fakeFetch, json, on } from '@/test/fake-fetch';
import { HttpError } from '../http';

const token = () => json({ access_token: 'tok', expires_in: 86_400 });

const equipment = {
  equipped_items: [
    { slot: { type: 'HEAD' }, item: { id: 111 }, name: 'Test Helm', level: { value: 321 }, quality: { type: 'EPIC' }, bonus_list: [1, 2], set: { item_set: { id: 9 } } },
    { slot: { type: 'SHIRT' }, item: { id: 222 }, name: 'Plain Shirt', level: { value: 1 }, quality: { type: 'COMMON' } },
    { slot: { type: 'TABARD' }, item: { id: 223 }, name: 'Guild Tabard', level: { value: 1 }, quality: { type: 'COMMON' } },
    { slot: { type: 'FINGER_1' }, item: { id: 333 }, name: 'Test Ring', level: { value: 311 }, quality: { type: 'RARE' } },
  ],
};

const profile = {
  name: 'Birkibjörn',
  realm: { id: 1306, name: 'Tarren Mill', slug: 'tarren-mill' },
  character_class: { name: 'Druid' },
  active_spec: { name: 'Guardian' },
};

function client(routes: Parameters<typeof fakeFetch>[0]) {
  const fake = fakeFetch([on('oauth.battle.net/token', token), ...routes]);
  return { ...fake, api: createBlizzardClient({ clientId: 'id', clientSecret: 'secret', fetchFn: fake.fn, sleep: async () => {} }) };
}

const ref = { region: 'eu' as const, realmSlug: 'tarren-mill', name: 'Birkibjörn' };

describe('Blizzard client', () => {
  it('maps equipment, skipping shirt and tabard', async () => {
    const { api } = client([on('/equipment', () => json(equipment))]);
    expect(await api.getEquipment(ref)).toEqual([
      { slot: 'HEAD', itemId: 111, name: 'Test Helm', itemLevel: 321, quality: 'EPIC', bonusIds: [1, 2], isTier: true },
      { slot: 'FINGER_1', itemId: 333, name: 'Test Ring', itemLevel: 311, quality: 'RARE', bonusIds: [], isTier: false },
    ]);
  });

  it('lowercases and URL-encodes the character name', async () => {
    const { api, calls } = client([on('/equipment', () => json(equipment))]);
    await api.getEquipment(ref);
    const url = calls.find((c) => c.url.includes('/equipment'))!.url;
    expect(url).toContain('/profile/wow/character/tarren-mill/birkibj%C3%B6rn/equipment');
    expect(url).toContain('namespace=profile-eu');
    expect(url).toContain('locale=en_GB');
  });

  it('maps the profile', async () => {
    const { api } = client([on('/character/tarren-mill/', () => json(profile))]);
    expect(await api.getProfile(ref)).toEqual({
      name: 'Birkibjörn', realmId: 1306, realmSlug: 'tarren-mill', realmName: 'Tarren Mill', className: 'Druid', specName: 'Guardian',
    });
  });

  it('reuses the token across calls', async () => {
    const { api, calls } = client([on('/equipment', () => json(equipment))]);
    await api.getEquipment(ref);
    await api.getEquipment(ref);
    expect(calls.filter((c) => c.url.includes('oauth')).length).toBe(1);
  });

  it('gets a new token after a 401 and retries', async () => {
    let first = true;
    const { api, calls } = client([
      on('/equipment', () => {
        if (first) { first = false; return new Response('expired', { status: 401 }); }
        return json(equipment);
      }),
    ]);
    expect(await api.getEquipment(ref)).toHaveLength(2);
    expect(calls.filter((c) => c.url.includes('oauth')).length).toBe(2);
  });

  it('throws HttpError 404 for an unknown character', async () => {
    const { api } = client([on('/equipment', () => new Response('', { status: 404 }))]);
    await expect(api.getEquipment(ref)).rejects.toBeInstanceOf(HttpError);
    await expect(api.getEquipment(ref)).rejects.toMatchObject({ status: 404 });
  });

  it('returns the icon URL, or null when the item has no media', async () => {
    const { api } = client([
      on('/media/item/111', () => json({ assets: [{ key: 'icon', value: 'https://render.worldofwarcraft.com/eu/icons/56/x.jpg' }] })),
      on('/media/item/999', () => new Response('', { status: 404 })),
    ]);
    expect(await api.getItemIconUrl('eu', 111)).toBe('https://render.worldofwarcraft.com/eu/icons/56/x.jpg');
    expect(await api.getItemIconUrl('eu', 999)).toBeNull();
  });

  it('loads realms once per region', async () => {
    const { api, calls } = client([on('/realm/index', () => json({ realms: [{ id: 1306, name: 'Tarren Mill', slug: 'tarren-mill' }] }))]);
    expect(await api.getRealms('eu')).toEqual([{ id: 1306, name: 'Tarren Mill', slug: 'tarren-mill' }]);
    await api.getRealms('eu');
    expect(calls.filter((c) => c.url.includes('/realm/index')).length).toBe(1);
    expect(calls.find((c) => c.url.includes('/realm/index'))!.url).toContain('namespace=dynamic-eu');
  });

  it('loads classes with their specs', async () => {
    const { api } = client([
      on('/playable-class/index', () => json({ classes: [{ id: 11, name: 'Druid' }] })),
      on('/playable-class/11', () => json({ specializations: [{ name: 'Balance' }, { name: 'Guardian' }] })),
    ]);
    expect(await api.getClasses('eu')).toEqual([{ id: 11, name: 'Druid', specs: ['Balance', 'Guardian'] }]);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/blizzard`
Expected: FAIL, because `./client` doesn't exist.

- [ ] **Step 3: Implement the client**

`src/core/blizzard/client.ts`:

```ts
import { createLimiter, fetchJson, HttpError, type FetchFn, type SleepFn } from '../http';
import { SLOT_TYPES, type GearItem, type Quality, type Region, type SlotType } from '../types';

export interface CharacterRef { region: Region; realmSlug: string; name: string }
export interface CharacterProfile { name: string; realmId: number; realmSlug: string; realmName: string; className: string; specName: string }
export interface Realm { id: number; name: string; slug: string }
export interface PlayableClass { id: number; name: string; specs: string[] }

export interface BlizzardClient {
  getProfile(ref: CharacterRef): Promise<CharacterProfile>;
  getEquipment(ref: CharacterRef): Promise<GearItem[]>;
  getItemIconUrl(region: Region, itemId: number): Promise<string | null>;
  getRealms(region: Region): Promise<Realm[]>;
  getClasses(region: Region): Promise<PlayableClass[]>;
}

interface Options {
  clientId: string;
  clientSecret: string;
  fetchFn?: FetchFn;
  now?: () => number;
  sleep?: SleepFn;
}

interface RawEquipment {
  equipped_items?: {
    slot: { type: string };
    item: { id: number };
    name: string;
    level?: { value: number };
    quality?: { type: string };
    bonus_list?: number[];
    set?: unknown;
  }[];
}

interface RawProfile {
  name: string;
  realm: { id: number; name: string; slug: string };
  character_class: { name: string };
  active_spec?: { name: string };
}

const GEAR_SLOTS = new Set<string>(SLOT_TYPES);
type Namespace = 'profile' | 'static' | 'dynamic';

export function createBlizzardClient(options: Options): BlizzardClient {
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? Date.now;
  const limit = createLimiter(4);
  const realmCache = new Map<Region, Promise<Realm[]>>();
  const classCache = new Map<Region, Promise<PlayableClass[]>>();
  let token: { value: string; expiresAt: number } | null = null;

  async function getToken(): Promise<string> {
    if (token && token.expiresAt > now() + 60_000) return token.value;
    const url = 'https://oauth.battle.net/token';
    const res = await fetchFn(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${options.clientId}:${options.clientSecret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) throw new HttpError(res.status, url, await res.text());
    const data = (await res.json()) as { access_token: string; expires_in: number };
    token = { value: data.access_token, expiresAt: now() + data.expires_in * 1000 };
    return token.value;
  }

  async function api<T>(region: Region, path: string, namespace: Namespace): Promise<T> {
    const separator = path.includes('?') ? '&' : '?';
    const url = `https://${region}.api.blizzard.com${path}${separator}namespace=${namespace}-${region}&locale=en_GB`;
    const call = async () => fetchJson<T>(fetchFn, url, { headers: { Authorization: `Bearer ${await getToken()}` } }, options.sleep);
    return limit(async () => {
      try {
        return await call();
      } catch (err) {
        if (err instanceof HttpError && err.status === 401) {
          token = null;
          return call();
        }
        throw err;
      }
    });
  }

  const characterPath = (ref: CharacterRef) =>
    `/profile/wow/character/${ref.realmSlug}/${encodeURIComponent(ref.name.toLowerCase())}`;

  return {
    async getProfile(ref) {
      const raw = await api<RawProfile>(ref.region, characterPath(ref), 'profile');
      return {
        name: raw.name,
        realmId: raw.realm.id,
        realmSlug: raw.realm.slug,
        realmName: raw.realm.name,
        className: raw.character_class.name,
        specName: raw.active_spec?.name ?? '',
      };
    },

    async getEquipment(ref) {
      const raw = await api<RawEquipment>(ref.region, `${characterPath(ref)}/equipment`, 'profile');
      return (raw.equipped_items ?? [])
        .filter((item) => GEAR_SLOTS.has(item.slot.type))
        .map((item) => ({
          slot: item.slot.type as SlotType,
          itemId: item.item.id,
          name: item.name,
          itemLevel: item.level?.value ?? null,
          quality: (item.quality?.type ?? 'COMMON') as Quality,
          bonusIds: item.bonus_list ?? [],
          isTier: Boolean(item.set),
        }));
    },

    async getItemIconUrl(region, itemId) {
      try {
        const media = await api<{ assets?: { key: string; value: string }[] }>(region, `/data/wow/media/item/${itemId}`, 'static');
        return media.assets?.find((asset) => asset.key === 'icon')?.value ?? null;
      } catch (err) {
        if (err instanceof HttpError && err.status === 404) return null;
        throw err;
      }
    },

    getRealms(region) {
      let cached = realmCache.get(region);
      if (!cached) {
        cached = api<{ realms: Realm[] }>(region, '/data/wow/realm/index', 'dynamic')
          .then((data) => data.realms.map(({ id, name, slug }) => ({ id, name, slug })));
        cached.catch(() => realmCache.delete(region));
        realmCache.set(region, cached);
      }
      return cached;
    },

    getClasses(region) {
      let cached = classCache.get(region);
      if (!cached) {
        cached = (async () => {
          const index = await api<{ classes: { id: number; name: string }[] }>(region, '/data/wow/playable-class/index', 'static');
          return Promise.all(index.classes.map(async (cls) => {
            const detail = await api<{ specializations?: { name: string }[] }>(region, `/data/wow/playable-class/${cls.id}`, 'static');
            return { id: cls.id, name: cls.name, specs: (detail.specializations ?? []).map((s) => s.name) };
          }));
        })();
        cached.catch(() => classCache.delete(region));
        classCache.set(region, cached);
      }
      return cached;
    },
  };
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/core/blizzard`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/blizzard
git commit -m "feat: add Blizzard API client with token cache and gear mapping"
```

---

### Task 4: Method.gg BiS source

**Files:**
- Create: `src/core/method/method.ts`, `src/core/method/__fixtures__/gearing.html`
- Test: `src/core/method/method.test.ts`

**Interfaces:**
- Consumes: `fetchWithRetry`, `HttpError`, `FetchFn` from `src/core/http.ts`. `BisLists`, `BisRow`, `BisSource`, `ListType`, `SlotType` from `src/core/types.ts`.
- Produces:
  - `parseGearingHtml(html: string): BisLists`
  - `methodSpecSlug(specName: string, className: string): string`, for example `('Beast Mastery', 'Hunter')` gives `'beast-mastery-hunter'`
  - `createMethodSource(fetchFn?: FetchFn): BisSource` with `name: 'Method'`

- [ ] **Step 1: Write the fixture**

`src/core/method/__fixtures__/gearing.html` is a trimmed copy of the table markup from a Method gearing page:

```html
<html><body>
<div class="tab-content">
<div role="tabpanel" class="tab-pane" id="overall_table"><div class="gear-table-inner"><h3>Overall Best Gear</h3>
<table class="table table-bordered table-article"><tbody>
<tr><th><b>Slot</b></th><th><b>Item</b></th><th><b>Source</b></th></tr>
<tr><td>Head</td><td><a href="https://www.wowhead.com/ptr/item=271875/gaze-of-the-coiled-watcher" class="q4"><span class="iconsmall"><ins></ins><del></del></span><span>Gaze of the Coiled Watcher</span></a> (Tier Set)</td><td>Ula&rsquo;tek (Catalyst)</td></tr>
<tr><td>Neck</td><td><a href="https://www.wowhead.com/ptr/item=268265/aqirbane-reliquary" class="q4"><span>Aqirbane Reliquary</span></a></td><td>Ula&rsquo;tek</td></tr>
<tr><td>Ring</td><td><a href="https://www.wowhead.com/ptr/item=159459/ritual-binders-ring?bonus=13440:12854" class="q4"><span>Ritual Binder&#039;s Ring</span></a></td><td>Kings&rsquo; Rest</td></tr>
<tr><td>Ring</td><td><a href="https://www.wowhead.com/ptr/item=268266/alluring-bubbleband" class="q4"><span>Alluring Bubbleband</span></a></td><td>Nymrissa Wavecaller</td></tr>
<tr><td>Trinket</td><td><a href="https://www.wowhead.com/item=250245/tumor-of-the-swarm?bonus=13440:12854" class="q4"><span>Tumor of the Swarm</span></a></td><td>Voidscar Arena</td></tr>
<tr><td>Weapon</td><td><a href="https://www.wowhead.com/ptr/item=268215/abyssal-broodfiends-bardiche" class="q4"><span>Abyssal Broodfiend&#039;s Bardiche</span></a></td><td>Ula&rsquo;tek</td></tr>
<tr><td>Tabard</td><td>No item link in this row</td><td>Vendor</td></tr>
</tbody></table></div></div>
<div role="tabpanel" class="tab-pane" id="raid_table"><div class="gear-table-inner">
<table class="table"><tbody>
<tr><th><b>Slot</b></th><th><b>Item</b></th><th><b>Source</b></th></tr>
<tr><td>Shoulders</td><td><a href="https://www.wowhead.com/ptr/item=271526/enigmatic-dreamwatchers-plumage"><span>Enigmatic Dreamwatcher&#039;s Plumage</span></a></td><td>The Lost Explorers</td></tr>
</tbody></table></div></div>
<div role="tabpanel" class="tab-pane active" id="dungeon_table"><div class="gear-table-inner">
<table class="table"><tbody>
<tr><th><b>Slot</b></th><th><b>Item</b></th><th><b>Source</b></th></tr>
<tr><td>Cloak</td><td><a href="https://www.wowhead.com/ptr/item=159288/cloak-of-the-restless-tribes?bonus=13440:12854"><span>Cloak of the Restless Tribes</span></a></td><td>Kings&rsquo; Rest</td></tr>
<tr><td>Off Hand</td><td><a href="https://www.wowhead.com/ptr/item=251150/tempests-shelter"><span>Tempest&#039;s Shelter</span></a></td><td>Den of Nalorakk</td></tr>
</tbody></table></div></div>
</div>
</body></html>
```

- [ ] **Step 2: Write the failing tests**

`src/core/method/method.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createMethodSource, methodSpecSlug, parseGearingHtml } from './method';
import { fakeFetch, on } from '@/test/fake-fetch';

const html = readFileSync(new URL('./__fixtures__/gearing.html', import.meta.url), 'utf8');

describe('parseGearingHtml', () => {
  const lists = parseGearingHtml(html);

  it('parses every list and skips rows without an item link', () => {
    expect(lists.overall).toHaveLength(6);
    expect(lists.raid).toHaveLength(1);
    expect(lists.mythicPlus).toHaveLength(2);
  });

  it('flags tier and catalyst rows and cleans their text', () => {
    expect(lists.overall[0]).toEqual({
      slotLabel: 'Head', slots: ['HEAD'], itemId: 271875, name: 'Gaze of the Coiled Watcher',
      bonusIds: [], isTier: true, isCatalyst: true, source: 'Ula’tek',
    });
  });

  it('decodes entities and reads bonus IDs', () => {
    expect(lists.overall[2]).toMatchObject({
      slots: ['FINGER_1', 'FINGER_2'], itemId: 159459, name: "Ritual Binder's Ring", bonusIds: [13440, 12854], source: 'Kings’ Rest',
    });
  });

  it('reads links without the /ptr/ prefix', () => {
    expect(lists.overall[4]).toMatchObject({ slots: ['TRINKET_1', 'TRINKET_2'], itemId: 250245 });
  });

  it('maps Cloak and Off Hand labels', () => {
    expect(lists.mythicPlus.map((r) => r.slots)).toEqual([['BACK'], ['OFF_HAND']]);
  });

  it('returns empty lists when the tables are missing', () => {
    expect(parseGearingHtml('<html></html>')).toEqual({ overall: [], raid: [], mythicPlus: [] });
  });
});

describe('methodSpecSlug', () => {
  it.each([
    ['Guardian', 'Druid', 'guardian-druid'],
    ['Beast Mastery', 'Hunter', 'beast-mastery-hunter'],
    ['Blood', 'Death Knight', 'blood-death-knight'],
  ])('%s %s gives %s', (spec, cls, slug) => {
    expect(methodSpecSlug(spec, cls)).toBe(slug);
  });
});

describe('createMethodSource', () => {
  it('fetches the gearing page for the slug', async () => {
    const { fn, calls } = fakeFetch([on('/guides/guardian-druid/gearing', () => new Response(html))]);
    const lists = await createMethodSource(fn).fetchLists('guardian-druid');
    expect(calls[0]!.url).toBe('https://www.method.gg/guides/guardian-druid/gearing');
    expect(lists.overall).toHaveLength(6);
  });

  it('throws an HttpError with status 404 for an unknown spec', async () => {
    const { fn } = fakeFetch([]);
    await expect(createMethodSource(fn).fetchLists('nope-nope')).rejects.toMatchObject({ status: 404 });
  });
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run src/core/method`
Expected: FAIL, because `./method` doesn't exist.

- [ ] **Step 4: Implement the Method source**

`src/core/method/method.ts`:

```ts
import { fetchWithRetry, HttpError, type FetchFn } from '../http';
import type { BisLists, BisRow, BisSource, ListType, SlotType } from '../types';

const TABLE_IDS: Record<ListType, string> = { overall: 'overall_table', raid: 'raid_table', mythicPlus: 'dungeon_table' };

const SLOT_MAP: Record<string, SlotType[]> = {
  Head: ['HEAD'], Neck: ['NECK'], Shoulders: ['SHOULDER'], Shoulder: ['SHOULDER'], Cloak: ['BACK'], Back: ['BACK'],
  Chest: ['CHEST'], Wrist: ['WRIST'], Wrists: ['WRIST'], Gloves: ['HANDS'], Hands: ['HANDS'], Belt: ['WAIST'], Waist: ['WAIST'],
  Legs: ['LEGS'], Boots: ['FEET'], Feet: ['FEET'],
  Ring: ['FINGER_1', 'FINGER_2'], Trinket: ['TRINKET_1', 'TRINKET_2'],
  Weapon: ['MAIN_HAND'], 'Main Hand': ['MAIN_HAND'], 'Main-Hand': ['MAIN_HAND'], 'Off Hand': ['OFF_HAND'], 'Off-Hand': ['OFF_HAND'],
};

const ENTITIES: Record<string, string> = {
  amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—',
};

function decodeHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&(\w+);/g, (match, name: string) => ENTITIES[name] ?? match)
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTable(html: string, tableId: string): BisRow[] {
  const start = html.indexOf(`id="${tableId}"`);
  if (start === -1) return [];
  const end = html.indexOf('</table>', start);
  const table = html.slice(start, end === -1 ? undefined : end);
  const rows: BisRow[] = [];
  for (const [, rowHtml] of table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...rowHtml!.matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) => m[1]!);
    if (cells.length < 3) continue;
    const link = cells[1]!.match(/href="[^"]*?item=(\d+)[^"?]*(?:\?bonus=([\d:]+))?"/);
    if (!link) continue;
    const slotLabel = decodeHtml(cells[0]!);
    const itemText = decodeHtml(cells[1]!);
    const sourceText = decodeHtml(cells[2]!);
    rows.push({
      slotLabel,
      slots: SLOT_MAP[slotLabel] ?? [],
      itemId: Number(link[1]),
      name: itemText.replace(/\s*\(Tier Set\)\s*$/i, ''),
      bonusIds: link[2] ? link[2].split(':').map(Number) : [],
      isTier: /\(Tier Set\)/i.test(itemText),
      isCatalyst: /\(Catalyst\)/i.test(sourceText),
      source: sourceText.replace(/\s*\(Catalyst\)\s*$/i, ''),
    });
  }
  return rows;
}

export function parseGearingHtml(html: string): BisLists {
  return {
    overall: parseTable(html, TABLE_IDS.overall),
    raid: parseTable(html, TABLE_IDS.raid),
    mythicPlus: parseTable(html, TABLE_IDS.mythicPlus),
  };
}

const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function methodSpecSlug(specName: string, className: string): string {
  return `${slugify(specName)}-${slugify(className)}`;
}

export function createMethodSource(fetchFn: FetchFn = fetch): BisSource {
  return {
    name: 'Method',
    async fetchLists(specSlug) {
      const url = `https://www.method.gg/guides/${specSlug}/gearing`;
      const res = await fetchWithRetry(fetchFn, url, { headers: { 'User-Agent': 'Mozilla/5.0 (personal gear tracker)' } });
      if (!res.ok) throw new HttpError(res.status, url, await res.text());
      return parseGearingHtml(await res.text());
    },
  };
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run src/core/method`
Expected: PASS, 11 tests.

- [ ] **Step 6: Commit**

```bash
git add src/core/method
git commit -m "feat: add Method.gg BiS source and gearing page parser"
```

---

### Task 5: Raidbots upgrade tracks

**Files:**
- Create: `src/core/raidbots/tracks.ts`
- Test: `src/core/raidbots/tracks.test.ts`

**Interfaces:**
- Consumes: `fetchJson`, `FetchFn` from `src/core/http.ts`. `Track` from `src/core/types.ts`.
- Produces:
  - `parseRaidbotsBonuses(data: Record<string, unknown>): Track[]`
  - `decodeTrack(bonusIds: number[], tracks: ReadonlyMap<number, Track>): Track | null`
  - `trackLabel(track: Track): string`, for example `'Myth 3/6'`
  - `createRaidbotsTracksFetcher(fetchFn?: FetchFn): () => Promise<Track[]>`

- [ ] **Step 1: Write the failing tests**

`src/core/raidbots/tracks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createRaidbotsTracksFetcher, decodeTrack, parseRaidbotsBonuses, trackLabel } from './tracks';
import { fakeFetch, json, on } from '@/test/fake-fetch';

const sample = {
  '12850': { upgrade: { group: 618, level: 2, max: 6, name: 'Myth', fullName: 'Myth 2/6', bonusId: 12850, costs: [{ amounts: [{ currencyId: 3446, amount: 20 }] }] } },
  '12833': { upgrade: { group: 616, level: 1, max: 6, name: 'Champion', fullName: 'Champion 1/6', bonusId: 12833 } },
  '13440': { id: 13440, tag: 'Mythic+' },
};

describe('parseRaidbotsBonuses', () => {
  it('keeps only upgrade bonuses, with their cost per step', () => {
    expect(parseRaidbotsBonuses(sample)).toEqual([
      { bonusId: 12850, name: 'Myth', step: 2, max: 6, currencyId: 3446, costPerStep: 20 },
      { bonusId: 12833, name: 'Champion', step: 1, max: 6, currencyId: null, costPerStep: null },
    ]);
  });
});

describe('decodeTrack', () => {
  const tracks = new Map(parseRaidbotsBonuses(sample).map((t) => [t.bonusId, t]));

  it('finds the track among other bonus IDs', () => {
    expect(decodeTrack([13440, 6652, 12850], tracks)?.name).toBe('Myth');
  });

  it('returns null when no bonus ID is a track', () => {
    expect(decodeTrack([13440, 40], tracks)).toBeNull();
  });

  it('formats a label', () => {
    expect(trackLabel(tracks.get(12850)!)).toBe('Myth 2/6');
  });
});

describe('createRaidbotsTracksFetcher', () => {
  it('fetches the live bonus data', async () => {
    const { fn, calls } = fakeFetch([on('raidbots.com/static/data/live/bonuses.json', () => json(sample))]);
    expect(await createRaidbotsTracksFetcher(fn)()).toHaveLength(2);
    expect(calls).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/raidbots`
Expected: FAIL, because `./tracks` doesn't exist.

- [ ] **Step 3: Implement the tracks module**

`src/core/raidbots/tracks.ts`:

```ts
import { fetchJson, type FetchFn } from '../http';
import type { Track } from '../types';

export const RAIDBOTS_BONUSES_URL = 'https://www.raidbots.com/static/data/live/bonuses.json';

interface RawUpgrade {
  name?: string;
  level?: number;
  max?: number;
  costs?: { amounts?: { currencyId?: number; amount?: number }[] }[];
}

export function parseRaidbotsBonuses(data: Record<string, unknown>): Track[] {
  const tracks: Track[] = [];
  for (const [key, value] of Object.entries(data)) {
    const upgrade = (value as { upgrade?: RawUpgrade } | null)?.upgrade;
    if (!upgrade?.name || typeof upgrade.level !== 'number' || typeof upgrade.max !== 'number') continue;
    const amount = upgrade.costs?.[0]?.amounts?.[0];
    tracks.push({
      bonusId: Number(key),
      name: upgrade.name,
      step: upgrade.level,
      max: upgrade.max,
      currencyId: amount?.currencyId ?? null,
      costPerStep: amount?.amount ?? null,
    });
  }
  return tracks;
}

export function decodeTrack(bonusIds: number[], tracks: ReadonlyMap<number, Track>): Track | null {
  for (const id of bonusIds) {
    const track = tracks.get(id);
    if (track) return track;
  }
  return null;
}

export const trackLabel = (track: Track) => `${track.name} ${track.step}/${track.max}`;

export function createRaidbotsTracksFetcher(fetchFn: FetchFn = fetch) {
  return async () => parseRaidbotsBonuses(await fetchJson<Record<string, unknown>>(fetchFn, RAIDBOTS_BONUSES_URL));
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/core/raidbots`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/raidbots
git commit -m "feat: decode upgrade tracks from Raidbots bonus data"
```

---

### Task 6: BiS matching and item states

**Files:**
- Create: `src/core/gear/evaluate.ts`
- Test: `src/core/gear/evaluate.test.ts`

**Interfaces:**
- Consumes: `decodeTrack` from `src/core/raidbots/tracks.ts`. `BisRow`, `GearItem`, `ItemState`, `ITEM_STATES`, `SlotType`, `Track` from `src/core/types.ts`.
- Produces:
  - `interface GearRow { row: BisRow; slot: SlotType; equipped: GearItem | null; track: Track | null; matched: boolean; state: ItemState }`
  - `evaluateGear(input: { equipped: GearItem[]; bisRows: BisRow[]; tracks: ReadonlyMap<number, Track>; bagItemIds?: ReadonlySet<number> }): GearRow[]`
  - `countStates(rows: GearRow[]): Record<ItemState, number>`

- [ ] **Step 1: Write the failing tests**

`src/core/gear/evaluate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { countStates, evaluateGear } from './evaluate';
import type { BisRow, GearItem, SlotType, Track } from '../types';

const track = (bonusId: number, name: string, step: number, max = 6): Track => ({ bonusId, name, step, max, currencyId: null, costPerStep: null });
const tracks = new Map<number, Track>([
  [1, track(1, 'Myth', 6)],
  [2, track(2, 'Myth', 2)],
  [3, track(3, 'Hero', 5)],
]);

const item = (slot: SlotType, itemId: number, bonusIds: number[] = [], isTier = false): GearItem =>
  ({ slot, itemId, name: `Item ${itemId}`, itemLevel: 300, quality: 'EPIC', bonusIds, isTier });

const row = (slots: SlotType[], itemId: number, isTier = false): BisRow =>
  ({ slotLabel: slots[0]!, slots, itemId, name: `BiS ${itemId}`, bonusIds: [], isTier, isCatalyst: isTier, source: 'Somewhere' });

describe('evaluateGear', () => {
  it('matches normal rows by item ID', () => {
    const [hit, miss] = evaluateGear({
      equipped: [item('NECK', 10, [1]), item('BACK', 99)],
      bisRows: [row(['NECK'], 10), row(['BACK'], 20)],
      tracks,
    });
    expect(hit).toMatchObject({ slot: 'NECK', matched: true, state: 'done' });
    expect(miss).toMatchObject({ slot: 'BACK', matched: false, state: 'missing', equipped: { itemId: 99 } });
  });

  it('matches tier rows with any tier piece in the slot', () => {
    const [head] = evaluateGear({ equipped: [item('HEAD', 555, [2], true)], bisRows: [row(['HEAD'], 777, true)], tracks });
    expect(head).toMatchObject({ matched: true, state: 'mythUpgradable' });
  });

  it('does not match a tier row with a non-tier item', () => {
    const [head] = evaluateGear({ equipped: [item('HEAD', 777)], bisRows: [row(['HEAD'], 777, true)], tracks });
    expect(head).toMatchObject({ matched: false, state: 'missing' });
  });

  it('matches rings in either slot and assigns exact matches first', () => {
    const rows = evaluateGear({
      equipped: [item('FINGER_1', 200), item('FINGER_2', 100, [1])],
      bisRows: [row(['FINGER_1', 'FINGER_2'], 100), row(['FINGER_1', 'FINGER_2'], 200)],
      tracks,
    });
    expect(rows.map((r) => [r.slot, r.matched])).toEqual([['FINGER_2', true], ['FINGER_1', true]]);
  });

  it('shows the unmatched paired slot when one ring is missing', () => {
    const rows = evaluateGear({
      equipped: [item('FINGER_1', 300), item('FINGER_2', 100)],
      bisRows: [row(['FINGER_1', 'FINGER_2'], 100), row(['FINGER_1', 'FINGER_2'], 200)],
      tracks,
    });
    expect(rows[1]).toMatchObject({ slot: 'FINGER_1', matched: false, equipped: { itemId: 300 } });
  });

  it('derives states from the track', () => {
    const states = evaluateGear({
      equipped: [item('HEAD', 1, [1]), item('NECK', 2, [2]), item('BACK', 3, [3]), item('WRIST', 4, [])],
      bisRows: [row(['HEAD'], 1), row(['NECK'], 2), row(['BACK'], 3), row(['WRIST'], 4)],
      tracks,
    }).map((r) => r.state);
    expect(states).toEqual(['done', 'mythUpgradable', 'belowMyth', 'done']);
  });

  it('marks a missing BiS item as inBags when the bags hold it', () => {
    const [belt] = evaluateGear({ equipped: [item('WAIST', 9)], bisRows: [row(['WAIST'], 42)], tracks, bagItemIds: new Set([42]) });
    expect(belt!.state).toBe('inBags');
  });

  it('treats an empty slot as missing', () => {
    const [offHand] = evaluateGear({ equipped: [], bisRows: [row(['OFF_HAND'], 5)], tracks });
    expect(offHand).toMatchObject({ slot: 'OFF_HAND', equipped: null, state: 'missing' });
  });

  it('skips rows whose slot label is unknown', () => {
    expect(evaluateGear({ equipped: [], bisRows: [{ ...row(['HEAD'], 1), slots: [] }], tracks })).toEqual([]);
  });
});

describe('countStates', () => {
  it('counts every state, including zeros', () => {
    const rows = evaluateGear({ equipped: [item('HEAD', 1, [1])], bisRows: [row(['HEAD'], 1), row(['NECK'], 2)], tracks });
    expect(countStates(rows)).toEqual({ done: 1, mythUpgradable: 0, belowMyth: 0, inBags: 0, missing: 1 });
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/gear`
Expected: FAIL, because `./evaluate` doesn't exist.

- [ ] **Step 3: Implement the evaluation**

`src/core/gear/evaluate.ts`:

```ts
import { decodeTrack } from '../raidbots/tracks';
import { ITEM_STATES, type BisRow, type GearItem, type ItemState, type SlotType, type Track } from '../types';

export interface GearRow {
  row: BisRow;
  slot: SlotType;
  equipped: GearItem | null;
  track: Track | null;
  matched: boolean;
  state: ItemState;
}

interface Input {
  equipped: GearItem[];
  bisRows: BisRow[];
  tracks: ReadonlyMap<number, Track>;
  bagItemIds?: ReadonlySet<number>;
}

const isMatch = (row: BisRow, item: GearItem | undefined) =>
  item !== undefined && (row.isTier ? item.isTier : item.itemId === row.itemId);

function stateFor(row: BisRow, matched: boolean, track: Track | null, bagItemIds: ReadonlySet<number>): ItemState {
  if (!matched) return !row.isTier && bagItemIds.has(row.itemId) ? 'inBags' : 'missing';
  if (!track) return 'done';
  if (track.name === 'Myth') return track.step >= track.max ? 'done' : 'mythUpgradable';
  return 'belowMyth';
}

export function evaluateGear({ equipped, bisRows, tracks, bagItemIds = new Set() }: Input): GearRow[] {
  const bySlot = new Map(equipped.map((item) => [item.slot, item]));
  const used = new Set<SlotType>();
  const rows = bisRows.filter((row) => row.slots.length > 0);

  // First pass: exact matches claim their slot, so one item can't satisfy two rows.
  const matchedSlots = rows.map((row) => {
    const slot = row.slots.find((s) => !used.has(s) && isMatch(row, bySlot.get(s)));
    if (slot) used.add(slot);
    return slot ?? null;
  });

  // Second pass: unmatched rows show what's in their first free slot.
  return rows.map((row, index) => {
    let slot = matchedSlots[index] ?? null;
    const matched = slot !== null;
    if (!slot) {
      slot = row.slots.find((s) => !used.has(s)) ?? row.slots[0]!;
      used.add(slot);
    }
    const item = bySlot.get(slot) ?? null;
    const track = item ? decodeTrack(item.bonusIds, tracks) : null;
    return { row, slot, equipped: item, track, matched, state: stateFor(row, matched, track, bagItemIds) };
  });
}

export function countStates(rows: GearRow[]): Record<ItemState, number> {
  const counts = Object.fromEntries(ITEM_STATES.map((s) => [s, 0])) as Record<ItemState, number>;
  for (const row of rows) counts[row.state]++;
  return counts;
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/core/gear`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/gear
git commit -m "feat: match gear against BiS rows and derive item states"
```

---

### Task 7: Database schema and client

**Files:**
- Create: `src/core/db/schema.ts`, `src/core/db/client.ts`, `drizzle.config.ts`, `drizzle/` (generated), `src/test/db.ts`
- Test: `src/core/db/client.test.ts`

**Interfaces:**
- Consumes: `Region`, `ItemLocation`, `SnapshotSource`, `Quality`, `ListType`, `SlotType` from `src/core/types.ts`.
- Produces:
  - Drizzle tables `characters`, `gearSnapshots`, `snapshotItems`, `bisLists`, `bisItems`, `items`, `upgradeTracks`, `meta`
  - `type Db`, `openDb(url: string, migrationsFolder?: string): Promise<Db>`
  - Test helper `openTestDb(): Promise<Db>` (in-memory, migrated)

- [ ] **Step 1: Install the database packages**

```bash
npm install drizzle-orm @libsql/client
npm install -D drizzle-kit
```

- [ ] **Step 2: Write the schema and drizzle-kit config**

`src/core/db/schema.ts`:

```ts
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { ItemLocation, ListType, Quality, Region, SlotType, SnapshotSource } from '../types';

export const characters = sqliteTable('characters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  region: text('region').$type<Region>().notNull(),
  realmId: integer('realm_id').notNull(),
  realmSlug: text('realm_slug').notNull(),
  realmName: text('realm_name').notNull(),
  name: text('name').notNull(),
  nameKey: text('name_key').notNull(),
  className: text('class_name').notNull(),
  specName: text('spec_name').notNull(),
  specOverride: text('spec_override'),
  priorityList: text('priority_list').$type<'mythicPlus' | 'overall'>().notNull().default('mythicPlus'),
  status: text('status').$type<'ok' | 'notFound'>().notNull().default('ok'),
  lastSyncedAt: integer('last_synced_at'),
  lastSyncError: text('last_sync_error'),
  addedAt: integer('added_at').notNull(),
}, (t) => [uniqueIndex('characters_identity').on(t.region, t.realmId, t.nameKey)]);

export const gearSnapshots = sqliteTable('gear_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  characterId: integer('character_id').notNull().references(() => characters.id, { onDelete: 'cascade' }),
  source: text('source').$type<SnapshotSource>().notNull(),
  createdAt: integer('created_at').notNull(),
  contentHash: text('content_hash').notNull(),
}, (t) => [index('gear_snapshots_character').on(t.characterId, t.createdAt)]);

export const snapshotItems = sqliteTable('snapshot_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  snapshotId: integer('snapshot_id').notNull().references(() => gearSnapshots.id, { onDelete: 'cascade' }),
  location: text('location').$type<ItemLocation>().notNull(),
  slot: text('slot').notNull(),
  itemId: integer('item_id').notNull(),
  name: text('name').notNull(),
  itemLevel: integer('item_level'),
  quality: text('quality').$type<Quality>().notNull(),
  bonusIds: text('bonus_ids', { mode: 'json' }).$type<number[]>().notNull(),
  isTier: integer('is_tier', { mode: 'boolean' }).notNull(),
}, (t) => [index('snapshot_items_snapshot').on(t.snapshotId)]);

export const bisLists = sqliteTable('bis_lists', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  specSlug: text('spec_slug').notNull(),
  listType: text('list_type').$type<ListType>().notNull(),
  fetchedAt: integer('fetched_at').notNull(),
}, (t) => [uniqueIndex('bis_lists_spec_type').on(t.specSlug, t.listType)]);

export const bisItems = sqliteTable('bis_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  listId: integer('list_id').notNull().references(() => bisLists.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  slotLabel: text('slot_label').notNull(),
  slots: text('slots', { mode: 'json' }).$type<SlotType[]>().notNull(),
  itemId: integer('item_id').notNull(),
  name: text('name').notNull(),
  bonusIds: text('bonus_ids', { mode: 'json' }).$type<number[]>().notNull(),
  isTier: integer('is_tier', { mode: 'boolean' }).notNull(),
  isCatalyst: integer('is_catalyst', { mode: 'boolean' }).notNull(),
  source: text('source').notNull(),
});

export const items = sqliteTable('items', {
  itemId: integer('item_id').primaryKey(),
  iconUrl: text('icon_url'),
  fetchedAt: integer('fetched_at').notNull(),
});

export const upgradeTracks = sqliteTable('upgrade_tracks', {
  bonusId: integer('bonus_id').primaryKey(),
  name: text('name').notNull(),
  step: integer('step').notNull(),
  max: integer('max').notNull(),
  currencyId: integer('currency_id'),
  costPerStep: integer('cost_per_step'),
});

export const meta = sqliteTable('meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
```

`drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({ dialect: 'sqlite', schema: './src/core/db/schema.ts', out: './drizzle' });
```

- [ ] **Step 3: Generate the first migration**

Run: `npm run db:generate -- --name init`
Expected: a new `drizzle/0000_init.sql` and a `drizzle/meta/` folder.

- [ ] **Step 4: Write the failing test**

`src/test/db.ts`:

```ts
import { openDb } from '@/core/db/client';

export const openTestDb = () => openDb(':memory:');
```

`src/core/db/client.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openTestDb } from '@/test/db';
import { characters, gearSnapshots } from './schema';

const character = {
  region: 'eu' as const, realmId: 1, realmSlug: 'test-realm', realmName: 'Test Realm',
  name: 'Testname', nameKey: 'testname', className: 'Druid', specName: 'Guardian', addedAt: 1,
};

describe('openDb', () => {
  it('creates the tables', async () => {
    const db = await openTestDb();
    const [row] = await db.insert(characters).values(character).returning();
    expect(row).toMatchObject({ id: 1, priorityList: 'mythicPlus', status: 'ok' });
  });

  it('rejects a duplicate character identity', async () => {
    const db = await openTestDb();
    await db.insert(characters).values(character);
    await expect(db.insert(characters).values(character)).rejects.toThrow();
  });

  it('deletes snapshots with their character', async () => {
    const db = await openTestDb();
    const [c] = await db.insert(characters).values(character).returning();
    await db.insert(gearSnapshots).values({ characterId: c!.id, source: 'blizzard', createdAt: 1, contentHash: 'x' });
    await db.delete(characters).where(eq(characters.id, c!.id));
    expect(await db.select().from(gearSnapshots)).toEqual([]);
  });
});
```

- [ ] **Step 5: Run the test to see it fail**

Run: `npx vitest run src/core/db`
Expected: FAIL, because `./client` doesn't exist.

- [ ] **Step 6: Implement the client**

`src/core/db/client.ts`:

```ts
import path from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from './schema';

export function createDrizzle(url: string) {
  const client = createClient({ url });
  return { client, db: drizzle(client, { schema }) };
}

export type Db = ReturnType<typeof createDrizzle>['db'];

/** Opens the database, turns on foreign keys and applies pending migrations. */
export async function openDb(url: string, migrationsFolder = path.join(process.cwd(), 'drizzle')): Promise<Db> {
  const { client, db } = createDrizzle(url);
  await client.execute('PRAGMA foreign_keys = ON');
  await migrate(db, { migrationsFolder });
  return db;
}
```

- [ ] **Step 7: Run the test to see it pass**

Run: `npx vitest run src/core/db`
Expected: PASS, 3 tests.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json drizzle.config.ts drizzle src/core/db src/test/db.ts
git commit -m "feat: add SQLite schema, migrations and database client"
```

---

### Task 8: Database queries

**Files:**
- Create: `src/core/db/queries.ts`
- Test: `src/core/db/queries.test.ts`

**Interfaces:**
- Consumes: `Db` and all tables from Task 7. `BisLists`, `GearItem`, `ItemLocation`, `LIST_TYPES`, `Quality`, `Region`, `SlotType`, `SnapshotSource`, `Track` from `src/core/types.ts`.
- Produces:
  - `type CharacterRow = typeof characters.$inferSelect`
  - `interface NewCharacter { region; realmId; realmSlug; realmName; name; className; specName }`
  - `insertCharacter(db, input: NewCharacter, now: number): Promise<{ id: number; created: boolean }>`
  - `listCharacters(db): Promise<CharacterRow[]>`, `getCharacter(db, id): Promise<CharacterRow | undefined>`
  - `updateCharacter(db, id, patch): Promise<void>`, `deleteCharacter(db, id): Promise<void>`
  - `interface SnapshotItemInput { location; slot; itemId; name; itemLevel; quality; bonusIds; isTier }`
  - `gearToSnapshotItems(gear: GearItem[]): SnapshotItemInput[]`
  - `saveSnapshotIfChanged(db, characterId, source, items, now): Promise<{ snapshotId: number; changed: boolean }>`
  - `interface Snapshot { id; source; createdAt; items: SnapshotItemInput[] }`, `getLatestSnapshot(db, characterId): Promise<Snapshot | null>`
  - `equippedGear(snapshot: Snapshot): GearItem[]`
  - `replaceBisLists(db, specSlug, lists: BisLists, now)`, `getBisLists(db, specSlug): Promise<{ lists: BisLists; fetchedAt: number } | null>`
  - `replaceTracks(db, tracks: Track[])`, `getTrackMap(db): Promise<Map<number, Track>>`
  - `getMeta(db, key): Promise<{ value: string; updatedAt: number } | null>`, `setMeta(db, key, value, now)`
  - `upsertItemIcons(db, entries: { itemId: number; iconUrl: string | null }[], now)`, `getItemIcons(db, ids: number[]): Promise<Map<number, string | null>>`

- [ ] **Step 1: Write the failing tests**

`src/core/db/queries.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import {
  deleteCharacter, equippedGear, getBisLists, getCharacter, getItemIcons, getLatestSnapshot, getMeta, getTrackMap,
  gearToSnapshotItems, insertCharacter, listCharacters, replaceBisLists, replaceTracks, saveSnapshotIfChanged,
  setMeta, updateCharacter, upsertItemIcons, type NewCharacter,
} from './queries';
import type { BisLists, GearItem } from '../types';

const newCharacter: NewCharacter = {
  region: 'eu', realmId: 1306, realmSlug: 'tarren-mill', realmName: 'Tarren Mill',
  name: 'Birkibjörn', className: 'Druid', specName: 'Guardian',
};

const gear: GearItem[] = [
  { slot: 'HEAD', itemId: 1, name: 'Helm', itemLevel: 321, quality: 'EPIC', bonusIds: [12850], isTier: true },
  { slot: 'NECK', itemId: 2, name: 'Neck', itemLevel: 318, quality: 'EPIC', bonusIds: [], isTier: false },
];

describe('characters', () => {
  it('inserts, lists, updates and deletes', async () => {
    const db = await openTestDb();
    const { id, created } = await insertCharacter(db, newCharacter, 100);
    expect(created).toBe(true);
    await updateCharacter(db, id, { specOverride: 'Feral', lastSyncedAt: 200 });
    expect(await getCharacter(db, id)).toMatchObject({ name: 'Birkibjörn', nameKey: 'birkibjörn', specOverride: 'Feral', lastSyncedAt: 200 });
    expect(await listCharacters(db)).toHaveLength(1);
    await deleteCharacter(db, id);
    expect(await getCharacter(db, id)).toBeUndefined();
  });

  it('returns the existing character when added again with different capitalization', async () => {
    const db = await openTestDb();
    const first = await insertCharacter(db, newCharacter, 100);
    const second = await insertCharacter(db, { ...newCharacter, name: 'BIRKIBJÖRN' }, 200);
    expect(second).toEqual({ id: first.id, created: false });
    expect(await listCharacters(db)).toHaveLength(1);
  });
});

describe('snapshots', () => {
  it('saves a snapshot only when the gear changed', async () => {
    const db = await openTestDb();
    const { id } = await insertCharacter(db, newCharacter, 1);
    const first = await saveSnapshotIfChanged(db, id, 'blizzard', gearToSnapshotItems(gear), 10);
    const again = await saveSnapshotIfChanged(db, id, 'blizzard', gearToSnapshotItems([...gear].reverse()), 20);
    expect(first.changed).toBe(true);
    expect(again).toEqual({ snapshotId: first.snapshotId, changed: false });

    const upgraded = gear.map((g) => (g.slot === 'NECK' ? { ...g, itemLevel: 321 } : g));
    const changed = await saveSnapshotIfChanged(db, id, 'blizzard', gearToSnapshotItems(upgraded), 30);
    expect(changed.changed).toBe(true);

    const latest = await getLatestSnapshot(db, id);
    expect(latest).toMatchObject({ id: changed.snapshotId, source: 'blizzard', createdAt: 30 });
    expect(equippedGear(latest!)).toEqual(expect.arrayContaining([expect.objectContaining({ slot: 'NECK', itemLevel: 321 })]));
  });

  it('returns null when a character has no snapshot', async () => {
    const db = await openTestDb();
    const { id } = await insertCharacter(db, newCharacter, 1);
    expect(await getLatestSnapshot(db, id)).toBeNull();
  });
});

describe('BiS lists', () => {
  const lists: BisLists = {
    overall: [{ slotLabel: 'Head', slots: ['HEAD'], itemId: 5, name: 'Helm', bonusIds: [], isTier: true, isCatalyst: true, source: 'Boss' }],
    raid: [],
    mythicPlus: [{ slotLabel: 'Ring', slots: ['FINGER_1', 'FINGER_2'], itemId: 6, name: 'Ring', bonusIds: [1, 2], isTier: false, isCatalyst: false, source: 'Dungeon' }],
  };

  it('replaces and reads lists in order', async () => {
    const db = await openTestDb();
    expect(await getBisLists(db, 'guardian-druid')).toBeNull();
    await replaceBisLists(db, 'guardian-druid', lists, 50);
    await replaceBisLists(db, 'guardian-druid', lists, 60);
    expect(await getBisLists(db, 'guardian-druid')).toEqual({ lists, fetchedAt: 60 });
  });
});

describe('tracks, meta and icons', () => {
  it('stores tracks by bonus ID', async () => {
    const db = await openTestDb();
    await replaceTracks(db, [{ bonusId: 12850, name: 'Myth', step: 2, max: 6, currencyId: 3446, costPerStep: 20 }]);
    expect((await getTrackMap(db)).get(12850)?.name).toBe('Myth');
  });

  it('stores meta values', async () => {
    const db = await openTestDb();
    expect(await getMeta(db, 'x')).toBeNull();
    await setMeta(db, 'x', 'one', 1);
    await setMeta(db, 'x', 'two', 2);
    expect(await getMeta(db, 'x')).toEqual({ value: 'two', updatedAt: 2 });
  });

  it('stores icons, including known-missing ones', async () => {
    const db = await openTestDb();
    await upsertItemIcons(db, [{ itemId: 1, iconUrl: 'https://i/1.jpg' }, { itemId: 2, iconUrl: null }], 1);
    const icons = await getItemIcons(db, [1, 2, 3]);
    expect(new Map([...icons.entries()].sort())).toEqual(new Map([[1, 'https://i/1.jpg'], [2, null]]));
    expect((await getItemIcons(db, [])).size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/db/queries.test.ts`
Expected: FAIL, because `./queries` doesn't exist.

- [ ] **Step 3: Implement the queries**

`src/core/db/queries.ts`:

```ts
import { createHash } from 'node:crypto';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from './client';
import { bisItems, bisLists, characters, gearSnapshots, items, meta, snapshotItems, upgradeTracks } from './schema';
import {
  LIST_TYPES, type BisLists, type GearItem, type ItemLocation, type Quality, type Region, type SlotType, type SnapshotSource, type Track,
} from '../types';

export type CharacterRow = typeof characters.$inferSelect;

export interface NewCharacter {
  region: Region;
  realmId: number;
  realmSlug: string;
  realmName: string;
  name: string;
  className: string;
  specName: string;
}

const nameKeyOf = (name: string) => name.toLocaleLowerCase('en');

export async function insertCharacter(db: Db, input: NewCharacter, now: number): Promise<{ id: number; created: boolean }> {
  const nameKey = nameKeyOf(input.name);
  const existing = await db.select({ id: characters.id }).from(characters)
    .where(and(eq(characters.region, input.region), eq(characters.realmId, input.realmId), eq(characters.nameKey, nameKey)))
    .get();
  if (existing) return { id: existing.id, created: false };
  const [row] = await db.insert(characters).values({ ...input, nameKey, addedAt: now }).returning({ id: characters.id });
  return { id: row!.id, created: true };
}

export const listCharacters = (db: Db) => db.select().from(characters).orderBy(asc(characters.addedAt), asc(characters.id));

export const getCharacter = (db: Db, id: number) => db.select().from(characters).where(eq(characters.id, id)).get();

export async function updateCharacter(db: Db, id: number, patch: Partial<Omit<CharacterRow, 'id' | 'addedAt' | 'nameKey'>>) {
  await db.update(characters).set(patch).where(eq(characters.id, id));
}

export async function deleteCharacter(db: Db, id: number) {
  await db.delete(characters).where(eq(characters.id, id));
}

export interface SnapshotItemInput {
  location: ItemLocation;
  slot: string;
  itemId: number;
  name: string;
  itemLevel: number | null;
  quality: Quality;
  bonusIds: number[];
  isTier: boolean;
}

export interface Snapshot {
  id: number;
  source: SnapshotSource;
  createdAt: number;
  items: SnapshotItemInput[];
}

export const gearToSnapshotItems = (gear: GearItem[]): SnapshotItemInput[] =>
  gear.map((g) => ({ location: 'equipped', slot: g.slot, itemId: g.itemId, name: g.name, itemLevel: g.itemLevel, quality: g.quality, bonusIds: g.bonusIds, isTier: g.isTier }));

function hashItems(list: SnapshotItemInput[]): string {
  const normalized = list
    .map((i) => [i.location, i.slot, i.itemId, i.itemLevel, i.bonusIds.join(':'), i.isTier].join('|'))
    .sort();
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export async function saveSnapshotIfChanged(
  db: Db, characterId: number, source: SnapshotSource, list: SnapshotItemInput[], now: number,
): Promise<{ snapshotId: number; changed: boolean }> {
  const contentHash = hashItems(list);
  const latest = await db.select().from(gearSnapshots).where(eq(gearSnapshots.characterId, characterId))
    .orderBy(desc(gearSnapshots.createdAt), desc(gearSnapshots.id)).get();
  if (latest && latest.contentHash === contentHash && latest.source === source) return { snapshotId: latest.id, changed: false };
  return db.transaction(async (tx) => {
    const [snapshot] = await tx.insert(gearSnapshots).values({ characterId, source, createdAt: now, contentHash }).returning({ id: gearSnapshots.id });
    if (list.length > 0) await tx.insert(snapshotItems).values(list.map((i) => ({ ...i, snapshotId: snapshot!.id })));
    return { snapshotId: snapshot!.id, changed: true };
  });
}

export async function getLatestSnapshot(db: Db, characterId: number): Promise<Snapshot | null> {
  const latest = await db.select().from(gearSnapshots).where(eq(gearSnapshots.characterId, characterId))
    .orderBy(desc(gearSnapshots.createdAt), desc(gearSnapshots.id)).get();
  if (!latest) return null;
  const rows = await db.select().from(snapshotItems).where(eq(snapshotItems.snapshotId, latest.id)).orderBy(asc(snapshotItems.id));
  return {
    id: latest.id,
    source: latest.source,
    createdAt: latest.createdAt,
    items: rows.map(({ location, slot, itemId, name, itemLevel, quality, bonusIds, isTier }) =>
      ({ location, slot, itemId, name, itemLevel, quality, bonusIds, isTier })),
  };
}

export const equippedGear = (snapshot: Snapshot): GearItem[] =>
  snapshot.items
    .filter((i) => i.location === 'equipped')
    .map((i) => ({ slot: i.slot as SlotType, itemId: i.itemId, name: i.name, itemLevel: i.itemLevel, quality: i.quality, bonusIds: i.bonusIds, isTier: i.isTier }));

export async function replaceBisLists(db: Db, specSlug: string, lists: BisLists, now: number) {
  await db.transaction(async (tx) => {
    await tx.delete(bisLists).where(eq(bisLists.specSlug, specSlug));
    for (const listType of LIST_TYPES) {
      const [list] = await tx.insert(bisLists).values({ specSlug, listType, fetchedAt: now }).returning({ id: bisLists.id });
      const rows = lists[listType];
      if (rows.length > 0) await tx.insert(bisItems).values(rows.map((row, position) => ({ ...row, listId: list!.id, position })));
    }
  });
}

export async function getBisLists(db: Db, specSlug: string): Promise<{ lists: BisLists; fetchedAt: number } | null> {
  const listRows = await db.select().from(bisLists).where(eq(bisLists.specSlug, specSlug));
  if (listRows.length === 0) return null;
  const lists: BisLists = { overall: [], raid: [], mythicPlus: [] };
  for (const list of listRows) {
    const rows = await db.select().from(bisItems).where(eq(bisItems.listId, list.id)).orderBy(asc(bisItems.position));
    lists[list.listType] = rows.map(({ slotLabel, slots, itemId, name, bonusIds, isTier, isCatalyst, source }) =>
      ({ slotLabel, slots, itemId, name, bonusIds, isTier, isCatalyst, source }));
  }
  return { lists, fetchedAt: Math.min(...listRows.map((l) => l.fetchedAt)) };
}

export async function replaceTracks(db: Db, tracks: Track[]) {
  await db.transaction(async (tx) => {
    await tx.delete(upgradeTracks);
    for (let i = 0; i < tracks.length; i += 500) await tx.insert(upgradeTracks).values(tracks.slice(i, i + 500));
  });
}

export async function getTrackMap(db: Db): Promise<Map<number, Track>> {
  const rows = await db.select().from(upgradeTracks);
  return new Map(rows.map((t) => [t.bonusId, t]));
}

export async function getMeta(db: Db, key: string) {
  const row = await db.select().from(meta).where(eq(meta.key, key)).get();
  return row ? { value: row.value, updatedAt: row.updatedAt } : null;
}

export async function setMeta(db: Db, key: string, value: string, now: number) {
  await db.insert(meta).values({ key, value, updatedAt: now })
    .onConflictDoUpdate({ target: meta.key, set: { value, updatedAt: now } });
}

export async function upsertItemIcons(db: Db, entries: { itemId: number; iconUrl: string | null }[], now: number) {
  for (const entry of entries) {
    await db.insert(items).values({ ...entry, fetchedAt: now })
      .onConflictDoUpdate({ target: items.itemId, set: { iconUrl: entry.iconUrl, fetchedAt: now } });
  }
}

export async function getItemIcons(db: Db, ids: number[]): Promise<Map<number, string | null>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(items).where(inArray(items.itemId, [...new Set(ids)]));
  return new Map(rows.map((r) => [r.itemId, r.iconUrl]));
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/core/db`
Expected: PASS, 11 tests across both files.

- [ ] **Step 5: Commit**

```bash
git add src/core/db/queries.ts src/core/db/queries.test.ts
git commit -m "feat: add database queries for characters, snapshots, BiS lists and reference data"
```

---

### Task 9: Character gear sync

**Files:**
- Create: `src/core/sync/character-sync.ts`
- Test: `src/core/sync/character-sync.test.ts`

**Interfaces:**
- Consumes: `BlizzardClient` from Task 3. `Db` from Task 7. `getCharacter`, `updateCharacter`, `saveSnapshotIfChanged`, `gearToSnapshotItems` from Task 8. `HttpError` from `src/core/http.ts`.
- Produces:
  - `GEAR_TTL_MS = 5 * 60 * 1000`
  - `isStale(lastSyncedAt: number | null, now: number, ttlMs?: number): boolean`
  - `type SyncResult = 'skipped' | 'unchanged' | 'updated' | 'notFound' | 'error'`
  - `interface CharacterSyncer { sync(characterId: number, options?: { force?: boolean }): Promise<SyncResult> }`
  - `createCharacterSyncer(deps: { db: Db; blizzard: BlizzardClient; now?: () => number; ttlMs?: number }): CharacterSyncer`

- [ ] **Step 1: Write the failing tests**

`src/core/sync/character-sync.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { createCharacterSyncer, isStale } from './character-sync';
import { getCharacter, getLatestSnapshot, insertCharacter } from '../db/queries';
import { HttpError } from '../http';
import type { BlizzardClient, CharacterProfile } from '../blizzard/client';
import type { GearItem } from '../types';

const profile: CharacterProfile = { name: 'Testchar', realmId: 1, realmSlug: 'test-realm', realmName: 'Test Realm', className: 'Druid', specName: 'Feral' };
const gear: GearItem[] = [{ slot: 'HEAD', itemId: 1, name: 'Helm', itemLevel: 300, quality: 'EPIC', bonusIds: [], isTier: false }];

function fakeBlizzard(overrides: Partial<BlizzardClient> = {}) {
  const calls = { profile: 0, equipment: 0 };
  const client: BlizzardClient = {
    getProfile: async () => { calls.profile++; return profile; },
    getEquipment: async () => { calls.equipment++; return gear; },
    getItemIconUrl: async () => null,
    getRealms: async () => [],
    getClasses: async () => [],
    ...overrides,
  };
  return { client, calls };
}

async function setup(overrides: Partial<BlizzardClient> = {}, now = 1_000_000) {
  const db = await openTestDb();
  const { id } = await insertCharacter(db, { region: 'eu', realmId: 1, realmSlug: 'test-realm', realmName: 'Test Realm', name: 'Testchar', className: 'Druid', specName: 'Guardian' }, 0);
  const blizzard = fakeBlizzard(overrides);
  let clock = now;
  const syncer = createCharacterSyncer({ db, blizzard: blizzard.client, now: () => clock });
  return { db, id, syncer, calls: blizzard.calls, advance: (ms: number) => { clock += ms; } };
}

describe('isStale', () => {
  it('treats never-synced and old data as stale', () => {
    expect(isStale(null, 10)).toBe(true);
    expect(isStale(0, 5 * 60 * 1000)).toBe(true);
    expect(isStale(0, 5 * 60 * 1000 - 1)).toBe(false);
  });
});

describe('createCharacterSyncer', () => {
  it('saves gear and profile on the first sync', async () => {
    const { db, id, syncer } = await setup();
    expect(await syncer.sync(id)).toBe('updated');
    expect(await getCharacter(db, id)).toMatchObject({ specName: 'Feral', lastSyncedAt: 1_000_000, status: 'ok', lastSyncError: null });
    expect((await getLatestSnapshot(db, id))?.items).toHaveLength(1);
  });

  it('skips fresh data unless forced, and reports unchanged gear', async () => {
    const { id, syncer, calls, advance } = await setup();
    await syncer.sync(id);
    expect(await syncer.sync(id)).toBe('skipped');
    expect(await syncer.sync(id, { force: true })).toBe('unchanged');
    advance(6 * 60 * 1000);
    expect(await syncer.sync(id)).toBe('unchanged');
    expect(calls.equipment).toBe(3);
  });

  it('shares one in-progress sync between concurrent callers', async () => {
    const { id, syncer, calls } = await setup();
    const [a, b] = await Promise.all([syncer.sync(id), syncer.sync(id)]);
    expect([a, b]).toEqual(['updated', 'updated']);
    expect(calls.equipment).toBe(1);
  });

  it('marks a character notFound on a Blizzard 404', async () => {
    const { db, id, syncer } = await setup({ getProfile: async () => { throw new HttpError(404, 'u', ''); } });
    expect(await syncer.sync(id)).toBe('notFound');
    expect(await getCharacter(db, id)).toMatchObject({ status: 'notFound' });
  });

  it('keeps the last gear and records the error on other failures', async () => {
    let fail = false;
    const { db, id, syncer, advance } = await setup({
      getEquipment: async () => { if (fail) throw new HttpError(503, 'u', 'down'); return gear; },
    });
    await syncer.sync(id);
    fail = true;
    advance(6 * 60 * 1000);
    expect(await syncer.sync(id)).toBe('error');
    const character = await getCharacter(db, id);
    expect(character?.lastSyncError).toMatch(/Blizzard/);
    expect(character?.lastSyncedAt).toBe(1_000_000);
    expect((await getLatestSnapshot(db, id))?.items).toHaveLength(1);
  });

  it('throws for an unknown character ID', async () => {
    const { syncer } = await setup();
    await expect(syncer.sync(999)).rejects.toThrow('Character 999 not found');
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/sync/character-sync.test.ts`
Expected: FAIL, because `./character-sync` doesn't exist.

- [ ] **Step 3: Implement the syncer**

`src/core/sync/character-sync.ts`:

```ts
import type { BlizzardClient } from '../blizzard/client';
import type { Db } from '../db/client';
import { gearToSnapshotItems, getCharacter, saveSnapshotIfChanged, updateCharacter } from '../db/queries';
import { HttpError } from '../http';

export const GEAR_TTL_MS = 5 * 60 * 1000;

export const isStale = (lastSyncedAt: number | null, now: number, ttlMs = GEAR_TTL_MS) =>
  lastSyncedAt === null || now - lastSyncedAt >= ttlMs;

export type SyncResult = 'skipped' | 'unchanged' | 'updated' | 'notFound' | 'error';

export interface CharacterSyncer {
  sync(characterId: number, options?: { force?: boolean }): Promise<SyncResult>;
}

interface Deps {
  db: Db;
  blizzard: BlizzardClient;
  now?: () => number;
  ttlMs?: number;
}

export function createCharacterSyncer({ db, blizzard, now = Date.now, ttlMs = GEAR_TTL_MS }: Deps): CharacterSyncer {
  const inFlight = new Map<number, Promise<SyncResult>>();

  async function run(characterId: number, force: boolean): Promise<SyncResult> {
    const character = await getCharacter(db, characterId);
    if (!character) throw new Error(`Character ${characterId} not found`);
    const time = now();
    if (!force && !isStale(character.lastSyncedAt, time, ttlMs)) return 'skipped';

    const ref = { region: character.region, realmSlug: character.realmSlug, name: character.name };
    try {
      const [profile, gear] = await Promise.all([blizzard.getProfile(ref), blizzard.getEquipment(ref)]);
      await updateCharacter(db, characterId, {
        className: profile.className,
        specName: profile.specName || character.specName,
        status: 'ok',
        lastSyncedAt: time,
        lastSyncError: null,
      });
      const { changed } = await saveSnapshotIfChanged(db, characterId, 'blizzard', gearToSnapshotItems(gear), time);
      return changed ? 'updated' : 'unchanged';
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) {
        await updateCharacter(db, characterId, { status: 'notFound', lastSyncedAt: time, lastSyncError: 'Blizzard can’t find this character' });
        return 'notFound';
      }
      const reason = err instanceof HttpError ? `Blizzard returned ${err.status}` : 'Blizzard couldn’t be reached';
      await updateCharacter(db, characterId, { lastSyncError: `${reason}. Showing the last saved gear.` });
      return 'error';
    }
  }

  return {
    sync(characterId, options = {}) {
      const existing = inFlight.get(characterId);
      if (existing) return existing;
      const promise = run(characterId, options.force ?? false).finally(() => inFlight.delete(characterId));
      inFlight.set(characterId, promise);
      return promise;
    },
  };
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/core/sync/character-sync.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/sync/character-sync.ts src/core/sync/character-sync.test.ts
git commit -m "feat: sync character gear with staleness, dedupe and error fallback"
```

---

### Task 10: Reference data sync

**Files:**
- Create: `src/core/sync/reference-sync.ts`
- Test: `src/core/sync/reference-sync.test.ts`

**Interfaces:**
- Consumes: `BisSource`, `BisLists`, `Region`, `Track` from `src/core/types.ts`. `BlizzardClient` from Task 3. `getBisLists`, `replaceBisLists`, `getMeta`, `setMeta`, `replaceTracks`, `getTrackMap`, `getItemIcons`, `upsertItemIcons` from Task 8. `HttpError`.
- Produces:
  - `DAY_MS = 86_400_000`
  - `interface BisResult { lists: BisLists | null; fetchedAt: number | null; error: string | null }`
  - `ensureBisLists(deps: { db; source: BisSource; now: number }, specSlug: string): Promise<BisResult>`
  - `ensureTracks(deps: { db; fetchTracks: () => Promise<Track[]>; now: number }): Promise<Map<number, Track>>`
  - `ensureItemIcons(deps: { db; blizzard: BlizzardClient; now: number }, region: Region, itemIds: number[]): Promise<Map<number, string | null>>`

- [ ] **Step 1: Write the failing tests**

`src/core/sync/reference-sync.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { DAY_MS, ensureBisLists, ensureItemIcons, ensureTracks } from './reference-sync';
import { HttpError } from '../http';
import type { BisLists, BisSource, Track } from '../types';
import type { BlizzardClient } from '../blizzard/client';

const lists: BisLists = {
  overall: [{ slotLabel: 'Head', slots: ['HEAD'], itemId: 5, name: 'Helm', bonusIds: [], isTier: false, isCatalyst: false, source: 'Boss' }],
  raid: [],
  mythicPlus: [],
};

function source(impl: () => Promise<BisLists>) {
  let calls = 0;
  const s: BisSource = { name: 'Fake', fetchLists: async () => { calls++; return impl(); } };
  return { s, calls: () => calls };
}

describe('ensureBisLists', () => {
  it('fetches once and serves the cache for a day', async () => {
    const db = await openTestDb();
    const { s, calls } = source(async () => lists);
    expect(await ensureBisLists({ db, source: s, now: 1000 }, 'guardian-druid')).toEqual({ lists, fetchedAt: 1000, error: null });
    await ensureBisLists({ db, source: s, now: 1000 + DAY_MS - 1 }, 'guardian-druid');
    expect(calls()).toBe(1);
    await ensureBisLists({ db, source: s, now: 1000 + DAY_MS }, 'guardian-druid');
    expect(calls()).toBe(2);
  });

  it('keeps the previous list when the page has no BiS tables', async () => {
    const db = await openTestDb();
    await ensureBisLists({ db, source: source(async () => lists).s, now: 1000 }, 'guardian-druid');
    const empty = source(async () => ({ overall: [], raid: [], mythicPlus: [] }));
    const result = await ensureBisLists({ db, source: empty.s, now: 1000 + DAY_MS }, 'guardian-druid');
    expect(result).toEqual({ lists, fetchedAt: 1000, error: 'BiS list couldn’t be updated' });
  });

  it('explains a missing Method page when nothing is cached', async () => {
    const db = await openTestDb();
    const missing = source(async () => { throw new HttpError(404, 'u', ''); });
    expect(await ensureBisLists({ db, source: missing.s, now: 1 }, 'nope-nope')).toEqual({
      lists: null, fetchedAt: null, error: 'Fake has no gearing page for "nope-nope"',
    });
  });
});

describe('ensureTracks', () => {
  const tracks: Track[] = [{ bonusId: 1, name: 'Myth', step: 1, max: 6, currencyId: null, costPerStep: null }];

  it('refreshes daily and keeps old data on failure', async () => {
    const db = await openTestDb();
    let calls = 0;
    const ok = async () => { calls++; return tracks; };
    expect((await ensureTracks({ db, fetchTracks: ok, now: 1 })).size).toBe(1);
    await ensureTracks({ db, fetchTracks: ok, now: 2 });
    expect(calls).toBe(1);
    const failing = async () => { throw new Error('down'); };
    expect((await ensureTracks({ db, fetchTracks: failing, now: 2 + DAY_MS })).size).toBe(1);
  });
});

describe('ensureItemIcons', () => {
  it('fetches only unknown icons and remembers items without one', async () => {
    const db = await openTestDb();
    const asked: number[] = [];
    const blizzard = {
      getItemIconUrl: async (_region: string, id: number) => { asked.push(id); return id === 1 ? 'https://i/1.jpg' : null; },
    } as unknown as BlizzardClient;
    const first = await ensureItemIcons({ db, blizzard, now: 1 }, 'eu', [1, 2, 1]);
    expect(first.get(1)).toBe('https://i/1.jpg');
    expect(first.get(2)).toBeNull();
    await ensureItemIcons({ db, blizzard, now: 2 }, 'eu', [1, 2]);
    expect(asked.sort()).toEqual([1, 2]);
  });

  it('skips icons that fail to load so they retry later', async () => {
    const db = await openTestDb();
    const blizzard = { getItemIconUrl: async () => { throw new Error('down'); } } as unknown as BlizzardClient;
    expect((await ensureItemIcons({ db, blizzard, now: 1 }, 'eu', [7])).has(7)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/sync/reference-sync.test.ts`
Expected: FAIL, because `./reference-sync` doesn't exist.

- [ ] **Step 3: Implement reference sync**

`src/core/sync/reference-sync.ts`:

```ts
import type { BlizzardClient } from '../blizzard/client';
import type { Db } from '../db/client';
import { getBisLists, getItemIcons, getMeta, getTrackMap, replaceBisLists, replaceTracks, setMeta, upsertItemIcons } from '../db/queries';
import { HttpError } from '../http';
import type { BisLists, BisSource, Region, Track } from '../types';

export const DAY_MS = 86_400_000;
const TRACKS_META_KEY = 'tracks.fetchedAt';

export interface BisResult {
  lists: BisLists | null;
  fetchedAt: number | null;
  error: string | null;
}

export async function ensureBisLists(deps: { db: Db; source: BisSource; now: number }, specSlug: string): Promise<BisResult> {
  const { db, source, now } = deps;
  const cached = await getBisLists(db, specSlug);
  if (cached && now - cached.fetchedAt < DAY_MS) return { lists: cached.lists, fetchedAt: cached.fetchedAt, error: null };
  try {
    const lists = await source.fetchLists(specSlug);
    if (lists.overall.length + lists.raid.length + lists.mythicPlus.length === 0) throw new Error('No BiS tables found');
    await replaceBisLists(db, specSlug, lists, now);
    return { lists, fetchedAt: now, error: null };
  } catch (err) {
    const error = err instanceof HttpError && err.status === 404 && !cached
      ? `${source.name} has no gearing page for "${specSlug}"`
      : 'BiS list couldn’t be updated';
    return { lists: cached?.lists ?? null, fetchedAt: cached?.fetchedAt ?? null, error };
  }
}

export async function ensureTracks(deps: { db: Db; fetchTracks: () => Promise<Track[]>; now: number }): Promise<Map<number, Track>> {
  const { db, fetchTracks, now } = deps;
  const fetchedAt = await getMeta(db, TRACKS_META_KEY);
  if (fetchedAt && now - fetchedAt.updatedAt < DAY_MS) return getTrackMap(db);
  try {
    const tracks = await fetchTracks();
    if (tracks.length > 0) {
      await replaceTracks(db, tracks);
      await setMeta(db, TRACKS_META_KEY, String(now), now);
    }
  } catch {
    // Keep the tracks we already have. Items without a track show their item level only.
  }
  return getTrackMap(db);
}

export async function ensureItemIcons(
  deps: { db: Db; blizzard: BlizzardClient; now: number }, region: Region, itemIds: number[],
): Promise<Map<number, string | null>> {
  const { db, blizzard, now } = deps;
  const unique = [...new Set(itemIds)];
  const known = await getItemIcons(db, unique);
  const unknown = unique.filter((id) => !known.has(id));
  const fetched = await Promise.all(unknown.map(async (itemId) => {
    try {
      return { itemId, iconUrl: await blizzard.getItemIconUrl(region, itemId) };
    } catch {
      return null;
    }
  }));
  const found = fetched.filter((entry): entry is { itemId: number; iconUrl: string | null } => entry !== null);
  if (found.length > 0) await upsertItemIcons(db, found, now);
  return getItemIcons(db, unique);
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/core/sync/reference-sync.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/sync/reference-sync.ts src/core/sync/reference-sync.test.ts
git commit -m "feat: cache BiS lists, upgrade tracks and item icons with fallbacks"
```

---

### Task 11: Character search and the add flow

**Files:**
- Create: `src/core/raiderio/search.ts`, `src/core/characters/add-character.ts`
- Test: `src/core/raiderio/search.test.ts`, `src/core/characters/add-character.test.ts`

**Interfaces:**
- Consumes: `fetchJson`, `FetchFn`, `HttpError` from `src/core/http.ts`. `UserError`. `BlizzardClient` from Task 3. `insertCharacter` from Task 8. `CharacterSyncer` from Task 9. `Region`.
- Produces:
  - `interface CharacterSearchResult { name; realmName; blizzardRealmId: number; region: Region; className; thumbnailUrl: string | null }`
  - `searchCharacters(fetchFn: FetchFn, region: Region, term: string): Promise<CharacterSearchResult[]>`
  - `type AddCharacterInput = { region: Region; name: string; realmId?: number; realmSlug?: string }`
  - `addCharacter(deps: { db; blizzard; syncer; now: () => number }, input): Promise<{ id: number; created: boolean }>`

- [ ] **Step 1: Write the failing tests**

`src/core/raiderio/search.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { searchCharacters } from './search';
import { fakeFetch, json, on } from '@/test/fake-fetch';

const response = {
  matches: [
    { type: 'character', name: 'Testbear', data: { name: 'Testbear', region: { slug: 'eu' }, realm: { name: 'Azjol-Nerub', slug: 'azjolnerub', wowRealmId: 503 }, class: { name: 'Druid' }, thumbnail_url: '//render.worldofwarcraft.com/eu/character/x.jpg' } },
    { type: 'character', name: 'Testbear', data: { name: 'Testbear', region: { slug: 'us' }, realm: { name: 'Stormrage', slug: 'stormrage', wowRealmId: 60 }, class: { name: 'Mage' } } },
    { type: 'guild', name: 'Testbear Guild', data: {} },
  ],
};

describe('searchCharacters', () => {
  it('returns characters in the region, keyed by Blizzard realm ID', async () => {
    const { fn, calls } = fakeFetch([on('raider.io/api/search', () => json(response))]);
    expect(await searchCharacters(fn, 'eu', '  Testbear ')).toEqual([
      { name: 'Testbear', realmName: 'Azjol-Nerub', blizzardRealmId: 503, region: 'eu', className: 'Druid', thumbnailUrl: 'https://render.worldofwarcraft.com/eu/character/x.jpg' },
    ]);
    expect(calls[0]!.url).toBe('https://raider.io/api/search?term=Testbear');
  });

  it('does not search for fewer than 3 characters', async () => {
    const { fn, calls } = fakeFetch([]);
    expect(await searchCharacters(fn, 'eu', 'Te ')).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});
```

`src/core/characters/add-character.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { addCharacter } from './add-character';
import { getCharacter } from '../db/queries';
import { HttpError } from '../http';
import { UserError } from '../errors';
import type { BlizzardClient, CharacterRef } from '../blizzard/client';
import type { CharacterSyncer } from '../sync/character-sync';

function deps(profileImpl?: (ref: CharacterRef) => Promise<never>) {
  const asked: CharacterRef[] = [];
  const synced: number[] = [];
  const blizzard = {
    getRealms: async () => [{ id: 503, name: 'Azjol-Nerub', slug: 'azjol-nerub' }],
    getProfile: profileImpl ?? (async (ref: CharacterRef) => {
      asked.push(ref);
      return { name: 'Testbear', realmId: 503, realmSlug: 'azjol-nerub', realmName: 'Azjol-Nerub', className: 'Druid', specName: 'Guardian' };
    }),
  } as unknown as BlizzardClient;
  const syncer: CharacterSyncer = { sync: async (id) => { synced.push(id); return 'updated'; } };
  return { blizzard, syncer, asked, synced };
}

describe('addCharacter', () => {
  it('resolves the realm ID to Blizzard’s slug, saves the character and syncs it', async () => {
    const db = await openTestDb();
    const d = deps();
    const result = await addCharacter({ db, blizzard: d.blizzard, syncer: d.syncer, now: () => 5 }, { region: 'eu', name: 'testbear', realmId: 503 });
    expect(result.created).toBe(true);
    expect(d.asked[0]).toEqual({ region: 'eu', realmSlug: 'azjol-nerub', name: 'testbear' });
    expect(await getCharacter(db, result.id)).toMatchObject({ name: 'Testbear', realmSlug: 'azjol-nerub', specName: 'Guardian' });
    expect(d.synced).toEqual([result.id]);
  });

  it('returns the existing character without syncing again', async () => {
    const db = await openTestDb();
    const d = deps();
    const context = { db, blizzard: d.blizzard, syncer: d.syncer, now: () => 5 };
    const first = await addCharacter(context, { region: 'eu', name: 'Testbear', realmSlug: 'azjol-nerub' });
    const second = await addCharacter(context, { region: 'eu', name: 'TESTBEAR', realmSlug: 'azjol-nerub' });
    expect(second).toEqual({ id: first.id, created: false });
    expect(d.synced).toHaveLength(1);
  });

  it('rejects an unknown realm ID', async () => {
    const db = await openTestDb();
    const d = deps();
    await expect(addCharacter({ db, blizzard: d.blizzard, syncer: d.syncer, now: () => 5 }, { region: 'eu', name: 'x', realmId: 1 }))
      .rejects.toThrow(UserError);
  });

  it('explains when Blizzard can’t find the character', async () => {
    const db = await openTestDb();
    const d = deps(async () => { throw new HttpError(404, 'u', ''); });
    await expect(addCharacter({ db, blizzard: d.blizzard, syncer: d.syncer, now: () => 5 }, { region: 'eu', name: 'Nobody', realmSlug: 'azjol-nerub' }))
      .rejects.toThrow('Blizzard can’t find Nobody on that realm.');
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/raiderio src/core/characters`
Expected: FAIL, because `./search` and `./add-character` don't exist.

- [ ] **Step 3: Implement search and the add flow**

`src/core/raiderio/search.ts`:

```ts
import { fetchJson, type FetchFn } from '../http';
import type { Region } from '../types';

export interface CharacterSearchResult {
  name: string;
  realmName: string;
  blizzardRealmId: number;
  region: Region;
  className: string;
  thumbnailUrl: string | null;
}

interface RawSearch {
  matches?: {
    type: string;
    data?: {
      name?: string;
      region?: { slug?: string };
      realm?: { name?: string; wowRealmId?: number };
      class?: { name?: string };
      thumbnail_url?: string;
    };
  }[];
}

/** Uses Raider.IO's undocumented site search. Only suggests characters; official APIs confirm them. */
export async function searchCharacters(fetchFn: FetchFn, region: Region, term: string): Promise<CharacterSearchResult[]> {
  const query = term.trim();
  if (query.length < 3) return [];
  const data = await fetchJson<RawSearch>(fetchFn, `https://raider.io/api/search?term=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (personal gear tracker)' },
  });
  return (data.matches ?? [])
    .filter((m) => m.type === 'character' && m.data?.region?.slug === region && typeof m.data.realm?.wowRealmId === 'number')
    .slice(0, 8)
    .map((m) => ({
      name: m.data!.name ?? '',
      realmName: m.data!.realm!.name ?? '',
      blizzardRealmId: m.data!.realm!.wowRealmId!,
      region,
      className: m.data!.class?.name ?? '',
      thumbnailUrl: m.data!.thumbnail_url ? `https:${m.data!.thumbnail_url}` : null,
    }));
}
```

`src/core/characters/add-character.ts`:

```ts
import type { BlizzardClient } from '../blizzard/client';
import type { Db } from '../db/client';
import { insertCharacter } from '../db/queries';
import { UserError } from '../errors';
import { HttpError } from '../http';
import type { CharacterSyncer } from '../sync/character-sync';
import type { Region } from '../types';

export interface AddCharacterInput {
  region: Region;
  name: string;
  realmId?: number;
  realmSlug?: string;
}

interface Deps {
  db: Db;
  blizzard: BlizzardClient;
  syncer: CharacterSyncer;
  now: () => number;
}

export async function addCharacter({ db, blizzard, syncer, now }: Deps, input: AddCharacterInput): Promise<{ id: number; created: boolean }> {
  const name = input.name.trim();
  if (!name) throw new UserError('Enter a character name.');

  let realmSlug = input.realmSlug?.trim();
  if (!realmSlug && input.realmId !== undefined) {
    const realm = (await blizzard.getRealms(input.region)).find((r) => r.id === input.realmId);
    if (!realm) throw new UserError('That realm doesn’t exist in this region.');
    realmSlug = realm.slug;
  }
  if (!realmSlug) throw new UserError('Pick a realm.');

  let profile;
  try {
    profile = await blizzard.getProfile({ region: input.region, realmSlug, name });
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) throw new UserError(`Blizzard can’t find ${name} on that realm.`);
    throw err;
  }

  const result = await insertCharacter(db, {
    region: input.region,
    realmId: profile.realmId,
    realmSlug: profile.realmSlug,
    realmName: profile.realmName,
    name: profile.name,
    className: profile.className,
    specName: profile.specName,
  }, now());
  if (result.created) await syncer.sync(result.id, { force: true });
  return result;
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/core/raiderio src/core/characters`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/raiderio src/core/characters
git commit -m "feat: search characters on Raider.IO and add them through Blizzard"
```

---

### Task 12: Server wiring, view models and API routes

**Files:**
- Create: `src/server/services.ts`, `src/server/views.ts`, `src/server/route-helpers.ts`
- Create: `src/app/api/search/route.ts`, `src/app/api/realms/route.ts`, `src/app/api/characters/route.ts`, `src/app/api/characters/[id]/route.ts`, `src/app/api/characters/[id]/sync/route.ts`
- Test: `src/server/views.test.ts`

**Interfaces:**
- Consumes: everything in `src/core` from Tasks 2 to 11.
- Produces:
  - `interface Services { db; blizzard; bisSource; fetchTracks; syncer; now: () => number; fetchFn: typeof fetch }`, `getServices(): Promise<Services>`
  - `interface ItemView { itemId; name; itemLevel: number | null; quality: Quality; bonusIds: number[]; iconUrl: string | null; trackLabel: string | null }`
  - `interface GearRowView { slotLabel: string; slot: SlotType; state: ItemState; equipped: ItemView | null; bis: ItemView & { isTier: boolean; isCatalyst: boolean; source: string } }`
  - `interface CharacterSummary { id; name; realmName; region; className; activeSpec; spec; specSlug; status; lastSyncedAt; lastSyncError; priorityList; snapshot: { source; createdAt } | null }`
  - `interface CharacterCardView extends CharacterSummary { counts: Record<ItemState, number> | null; total: number; bisError: string | null }`
  - `interface CharacterPageView extends CharacterSummary { listType: ListType; rows: GearRowView[]; vault: GearRowView[]; counts: Record<ListType, { bis: number; total: number }>; bisFetchedAt: number | null; bisError: string | null; specs: string[] }`
  - `getCharacterCards(services: Services): Promise<CharacterCardView[]>`
  - `getCharacterPage(services: Services, id: number, listType?: ListType): Promise<CharacterPageView | null>`
  - API: `GET /api/search?region&term`, `GET /api/realms?region`, `POST /api/characters`, `PATCH` and `DELETE /api/characters/[id]`, `POST /api/characters/[id]/sync?force=1` returning `{ result: SyncResult }`

- [ ] **Step 1: Write the services module**

`src/server/services.ts`:

```ts
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createBlizzardClient, type BlizzardClient } from '@/core/blizzard/client';
import { readConfig } from '@/core/config';
import { openDb, type Db } from '@/core/db/client';
import { createMethodSource } from '@/core/method/method';
import { createRaidbotsTracksFetcher } from '@/core/raidbots/tracks';
import { createCharacterSyncer, type CharacterSyncer } from '@/core/sync/character-sync';
import type { BisSource, Track } from '@/core/types';

export interface Services {
  db: Db;
  blizzard: BlizzardClient;
  bisSource: BisSource;
  fetchTracks: () => Promise<Track[]>;
  syncer: CharacterSyncer;
  now: () => number;
  fetchFn: typeof fetch;
}

async function build(): Promise<Services> {
  const config = readConfig();
  if (config.databaseUrl.startsWith('file:') && !config.databaseUrl.includes(':memory:')) {
    mkdirSync(path.dirname(path.resolve(config.databaseUrl.slice('file:'.length))), { recursive: true });
  }
  const db = await openDb(config.databaseUrl);
  const blizzard = createBlizzardClient({ clientId: config.blizzardClientId, clientSecret: config.blizzardClientSecret });
  return {
    db,
    blizzard,
    bisSource: createMethodSource(),
    fetchTracks: createRaidbotsTracksFetcher(),
    syncer: createCharacterSyncer({ db, blizzard }),
    now: Date.now,
    fetchFn: fetch,
  };
}

// Kept on globalThis so Next.js hot reloads reuse one database connection and one token cache.
const holder = globalThis as unknown as { __gearTrackerServices?: Promise<Services> };

export function getServices(): Promise<Services> {
  holder.__gearTrackerServices ??= build().catch((err) => {
    holder.__gearTrackerServices = undefined;
    throw err;
  });
  return holder.__gearTrackerServices;
}
```

- [ ] **Step 2: Write the failing view tests**

`src/server/views.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { getCharacterCards, getCharacterPage } from './views';
import type { Services } from './services';
import { gearToSnapshotItems, insertCharacter, saveSnapshotIfChanged } from '@/core/db/queries';
import type { BisLists, GearItem, Track } from '@/core/types';
import type { BlizzardClient } from '@/core/blizzard/client';

const lists: BisLists = {
  overall: [],
  raid: [],
  mythicPlus: [
    { slotLabel: 'Head', slots: ['HEAD'], itemId: 10, name: 'Tier Catalyst Helm', bonusIds: [], isTier: true, isCatalyst: true, source: 'Dungeon A' },
    { slotLabel: 'Neck', slots: ['NECK'], itemId: 20, name: 'Best Neck', bonusIds: [1], isTier: false, isCatalyst: false, source: 'Dungeon B' },
  ],
};
const tracks: Track[] = [{ bonusId: 99, name: 'Hero', step: 5, max: 6, currencyId: null, costPerStep: null }];
const gear: GearItem[] = [
  { slot: 'HEAD', itemId: 11, name: 'Worn Tier Helm', itemLevel: 321, quality: 'EPIC', bonusIds: [], isTier: true },
  { slot: 'NECK', itemId: 20, name: 'Best Neck', itemLevel: 318, quality: 'EPIC', bonusIds: [99], isTier: false },
];

async function services(): Promise<Services> {
  const db = await openTestDb();
  const blizzard = {
    getItemIconUrl: async (_r: string, id: number) => `https://i/${id}.jpg`,
    getClasses: async () => [{ id: 11, name: 'Druid', specs: ['Balance', 'Feral', 'Guardian', 'Restoration'] }],
  } as unknown as BlizzardClient;
  return {
    db, blizzard,
    bisSource: { name: 'Fake', fetchLists: async () => lists },
    fetchTracks: async () => tracks,
    syncer: { sync: async () => 'skipped' },
    now: () => 1000,
    fetchFn: fetch,
  };
}

async function seed(s: Services, withGear = true) {
  const { id } = await insertCharacter(s.db, { region: 'eu', realmId: 1, realmSlug: 'test-realm', realmName: 'Test Realm', name: 'Testbear', className: 'Druid', specName: 'Guardian' }, 1);
  if (withGear) await saveSnapshotIfChanged(s.db, id, 'blizzard', gearToSnapshotItems(gear), 500);
  return id;
}

describe('getCharacterPage', () => {
  it('builds rows with states, tracks and icons for the priority list', async () => {
    const s = await services();
    const id = await seed(s);
    const page = await getCharacterPage(s, id);
    expect(page).toMatchObject({ listType: 'mythicPlus', spec: 'Guardian', specSlug: 'guardian-druid', specs: ['Balance', 'Feral', 'Guardian', 'Restoration'] });
    expect(page!.rows.map((r) => r.state)).toEqual(['done', 'belowMyth']);
    expect(page!.rows[1]!.equipped).toMatchObject({ name: 'Best Neck', trackLabel: 'Hero 5/6', iconUrl: 'https://i/20.jpg' });
    expect(page!.rows[0]!.bis).toMatchObject({ itemId: 10, iconUrl: 'https://i/10.jpg', isTier: true });
    expect(page!.vault.map((r) => r.slot)).toEqual(['NECK']);
    expect(page!.counts.mythicPlus).toEqual({ bis: 2, total: 2 });
  });

  it('shows every row as missing before the first sync', async () => {
    const s = await services();
    const id = await seed(s, false);
    const page = await getCharacterPage(s, id);
    expect(page!.snapshot).toBeNull();
    expect(page!.rows.every((r) => r.state === 'missing' && r.equipped === null)).toBe(true);
  });

  it('returns null for an unknown character', async () => {
    expect(await getCharacterPage(await services(), 404)).toBeNull();
  });
});

describe('getCharacterCards', () => {
  it('counts states on each character’s priority list', async () => {
    const s = await services();
    await seed(s);
    const [card] = await getCharacterCards(s);
    expect(card).toMatchObject({ name: 'Testbear', total: 2, bisError: null, snapshot: { source: 'blizzard', createdAt: 500 } });
    expect(card!.counts).toMatchObject({ done: 1, belowMyth: 1, missing: 0 });
  });
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run src/server`
Expected: FAIL, because `./views` doesn't exist.

- [ ] **Step 4: Implement the views**

`src/server/views.ts`:

```ts
import { countStates, evaluateGear, type GearRow } from '@/core/gear/evaluate';
import { equippedGear, getCharacter, getLatestSnapshot, listCharacters, type CharacterRow } from '@/core/db/queries';
import { methodSpecSlug } from '@/core/method/method';
import { trackLabel } from '@/core/raidbots/tracks';
import { ensureBisLists, ensureItemIcons, ensureTracks, type BisResult } from '@/core/sync/reference-sync';
import { LIST_TYPES, type ItemState, type ListType, type Quality, type Region, type SlotType, type SnapshotSource } from '@/core/types';
import type { Services } from './services';

export interface ItemView {
  itemId: number;
  name: string;
  itemLevel: number | null;
  quality: Quality;
  bonusIds: number[];
  iconUrl: string | null;
  trackLabel: string | null;
}

export interface GearRowView {
  slotLabel: string;
  slot: SlotType;
  state: ItemState;
  equipped: ItemView | null;
  bis: ItemView & { isTier: boolean; isCatalyst: boolean; source: string };
}

export interface CharacterSummary {
  id: number;
  name: string;
  realmName: string;
  region: Region;
  className: string;
  activeSpec: string;
  spec: string;
  specSlug: string;
  status: 'ok' | 'notFound';
  lastSyncedAt: number | null;
  lastSyncError: string | null;
  priorityList: 'mythicPlus' | 'overall';
  snapshot: { source: SnapshotSource; createdAt: number } | null;
}

export interface CharacterCardView extends CharacterSummary {
  counts: Record<ItemState, number> | null;
  total: number;
  bisError: string | null;
}

export interface CharacterPageView extends CharacterSummary {
  listType: ListType;
  rows: GearRowView[];
  vault: GearRowView[];
  counts: Record<ListType, { bis: number; total: number }>;
  bisFetchedAt: number | null;
  bisError: string | null;
  specs: string[];
}

function summarize(c: CharacterRow, snapshot: { source: SnapshotSource; createdAt: number } | null): CharacterSummary {
  const spec = c.specOverride || c.specName;
  return {
    id: c.id, name: c.name, realmName: c.realmName, region: c.region, className: c.className,
    activeSpec: c.specName, spec, specSlug: methodSpecSlug(spec, c.className),
    status: c.status, lastSyncedAt: c.lastSyncedAt, lastSyncError: c.lastSyncError, priorityList: c.priorityList,
    snapshot,
  };
}

const bisCount = (rows: GearRow[]) => rows.filter((r) => r.matched).length;

export async function getCharacterCards(services: Services): Promise<CharacterCardView[]> {
  const { db, bisSource, fetchTracks, now } = services;
  const time = now();
  const tracks = await ensureTracks({ db, fetchTracks, now: time });
  const bisBySlug = new Map<string, Promise<BisResult>>();
  const characters = await listCharacters(db);
  return Promise.all(characters.map(async (c) => {
    const snapshot = await getLatestSnapshot(db, c.id);
    const summary = summarize(c, snapshot && { source: snapshot.source, createdAt: snapshot.createdAt });
    if (!bisBySlug.has(summary.specSlug)) bisBySlug.set(summary.specSlug, ensureBisLists({ db, source: bisSource, now: time }, summary.specSlug));
    const bis = await bisBySlug.get(summary.specSlug)!;
    const bisRows = bis.lists?.[c.priorityList] ?? [];
    const rows = evaluateGear({ equipped: snapshot ? equippedGear(snapshot) : [], bisRows, tracks });
    return { ...summary, counts: bis.lists ? countStates(rows) : null, total: rows.length, bisError: bis.error };
  }));
}

export async function getCharacterPage(services: Services, id: number, listType?: ListType): Promise<CharacterPageView | null> {
  const { db, blizzard, bisSource, fetchTracks, now } = services;
  const character = await getCharacter(db, id);
  if (!character) return null;
  const time = now();
  const snapshot = await getLatestSnapshot(db, id);
  const summary = summarize(character, snapshot && { source: snapshot.source, createdAt: snapshot.createdAt });
  const list = listType ?? character.priorityList;

  const [tracks, bis, specs] = await Promise.all([
    ensureTracks({ db, fetchTracks, now: time }),
    ensureBisLists({ db, source: bisSource, now: time }, summary.specSlug),
    blizzard.getClasses(character.region)
      .then((classes) => classes.find((cls) => cls.name === character.className)?.specs ?? [summary.spec])
      .catch(() => [summary.spec]),
  ]);

  const equipped = snapshot ? equippedGear(snapshot) : [];
  const evaluate = (l: ListType) => evaluateGear({ equipped, bisRows: bis.lists?.[l] ?? [], tracks });
  const gearRows = evaluate(list);

  const iconIds = [...equipped.map((g) => g.itemId), ...gearRows.map((r) => r.row.itemId)];
  const icons = await ensureItemIcons({ db, blizzard, now: time }, character.region, iconIds);

  const rows: GearRowView[] = gearRows.map((r) => ({
    slotLabel: r.row.slotLabel,
    slot: r.slot,
    state: r.state,
    equipped: r.equipped && {
      itemId: r.equipped.itemId,
      name: r.equipped.name,
      itemLevel: r.equipped.itemLevel,
      quality: r.equipped.quality,
      bonusIds: r.equipped.bonusIds,
      iconUrl: icons.get(r.equipped.itemId) ?? null,
      trackLabel: r.track ? trackLabel(r.track) : null,
    },
    bis: {
      itemId: r.row.itemId,
      name: r.row.name,
      itemLevel: null,
      // Method links the fully upgraded Myth copy, which is always Epic.
      quality: 'EPIC',
      bonusIds: r.row.bonusIds,
      iconUrl: icons.get(r.row.itemId) ?? null,
      trackLabel: null,
      isTier: r.row.isTier,
      isCatalyst: r.row.isCatalyst,
      source: r.row.source,
    },
  }));

  const counts = Object.fromEntries(LIST_TYPES.map((l) => {
    const evaluated = l === list ? gearRows : evaluate(l);
    return [l, { bis: bisCount(evaluated), total: evaluated.length }];
  })) as Record<ListType, { bis: number; total: number }>;

  return {
    ...summary,
    listType: list,
    rows,
    vault: rows.filter((r) => r.state === 'belowMyth'),
    counts,
    bisFetchedAt: bis.fetchedAt,
    bisError: bis.error,
    specs,
  };
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run src/server`
Expected: PASS, 4 tests.

- [ ] **Step 6: Write the route helpers and API routes**

`src/server/route-helpers.ts`:

```ts
import { NextResponse } from 'next/server';
import { MissingConfigError } from '@/core/config';
import { UserError } from '@/core/errors';
import { REGIONS, type Region } from '@/core/types';

export const parseRegion = (value: unknown): Region | null =>
  typeof value === 'string' && (REGIONS as readonly string[]).includes(value) ? (value as Region) : null;

export function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function errorResponse(err: unknown) {
  if (err instanceof UserError) return NextResponse.json({ error: err.message }, { status: 400 });
  if (err instanceof MissingConfigError) return NextResponse.json({ error: err.message }, { status: 503 });
  console.error(err);
  return NextResponse.json({ error: 'Something went wrong. Check the server log.' }, { status: 500 });
}
```

`src/app/api/search/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { searchCharacters } from '@/core/raiderio/search';
import { parseRegion } from '@/server/route-helpers';

export async function GET(request: NextRequest) {
  const region = parseRegion(request.nextUrl.searchParams.get('region'));
  if (!region) return NextResponse.json({ error: 'Unknown region' }, { status: 400 });
  try {
    return NextResponse.json(await searchCharacters(fetch, region, request.nextUrl.searchParams.get('term') ?? ''));
  } catch {
    return NextResponse.json({ error: 'Search is unavailable. Pick the realm yourself.' }, { status: 502 });
  }
}
```

`src/app/api/realms/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { getServices } from '@/server/services';
import { errorResponse, parseRegion } from '@/server/route-helpers';

export async function GET(request: NextRequest) {
  const region = parseRegion(request.nextUrl.searchParams.get('region'));
  if (!region) return NextResponse.json({ error: 'Unknown region' }, { status: 400 });
  try {
    const realms = await (await getServices()).blizzard.getRealms(region);
    return NextResponse.json([...realms].sort((a, b) => a.name.localeCompare(b.name)));
  } catch (err) {
    return errorResponse(err);
  }
}
```

`src/app/api/characters/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { addCharacter } from '@/core/characters/add-character';
import { getServices } from '@/server/services';
import { errorResponse, parseRegion } from '@/server/route-helpers';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { region?: unknown; name?: unknown; realmId?: unknown; realmSlug?: unknown };
    const region = parseRegion(body.region);
    if (!region || typeof body.name !== 'string') return NextResponse.json({ error: 'Region and name are required.' }, { status: 400 });
    const services = await getServices();
    const result = await addCharacter(services, {
      region,
      name: body.name,
      realmId: typeof body.realmId === 'number' ? body.realmId : undefined,
      realmSlug: typeof body.realmSlug === 'string' ? body.realmSlug : undefined,
    });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
```

`src/app/api/characters/[id]/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { deleteCharacter, getCharacter, updateCharacter } from '@/core/db/queries';
import { getServices } from '@/server/services';
import { errorResponse, parseId } from '@/server/route-helpers';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Unknown character' }, { status: 404 });
  try {
    const { db } = await getServices();
    if (!(await getCharacter(db, id))) return NextResponse.json({ error: 'Unknown character' }, { status: 404 });
    const body = (await request.json()) as { specOverride?: unknown; priorityList?: unknown };
    const patch: Parameters<typeof updateCharacter>[2] = {};
    if (body.specOverride === null || typeof body.specOverride === 'string') patch.specOverride = body.specOverride || null;
    if (body.priorityList === 'mythicPlus' || body.priorityList === 'overall') patch.priorityList = body.priorityList;
    await updateCharacter(db, id, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Unknown character' }, { status: 404 });
  try {
    await deleteCharacter((await getServices()).db, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
```

`src/app/api/characters/[id]/sync/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { getCharacter } from '@/core/db/queries';
import { getServices } from '@/server/services';
import { errorResponse, parseId } from '@/server/route-helpers';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Unknown character' }, { status: 404 });
  try {
    const { db, syncer } = await getServices();
    if (!(await getCharacter(db, id))) return NextResponse.json({ error: 'Unknown character' }, { status: 404 });
    const result = await syncer.sync(id, { force: request.nextUrl.searchParams.get('force') === '1' });
    return NextResponse.json({ result });
  } catch (err) {
    return errorResponse(err);
  }
}
```

- [ ] **Step 7: Verify types and lint**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/server src/app/api
git commit -m "feat: add server wiring, page view models and API routes"
```

---

### Task 13: App shell, item cards and the characters page

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `src/components/class-colors.ts`, `src/components/ItemCard.tsx`, `src/components/StateBadge.tsx`, `src/components/CharacterCard.tsx`, `src/components/AddCharacterBar.tsx`, `src/components/StaleSync.tsx`, `src/components/RemoveCharacterButton.tsx`, `src/components/SetupNotice.tsx`, `src/components/WowheadRefresh.tsx`
- Test: `src/components/ItemCard.test.ts`

**Interfaces:**
- Consumes: `getServices` (Task 12), `getCharacterCards`, `CharacterCardView` (Task 12), `isStale` (Task 9), `formatAge` (Task 2), `MissingConfigError`, API routes from Task 12.
- Produces:
  - `classColor(className: string): string`
  - `wowheadData(itemId, bonusIds, itemLevel): string`
  - `<ItemCard itemId name quality iconUrl bonusIds itemLevel detail? golden? />`, `<EmptySlotCard />`
  - `<StateBadge state />`
  - `<StaleSync ids />`, `<RemoveCharacterButton id name redirectTo? />`, `<SetupNotice missing />`

- [ ] **Step 1: Write the failing test for the Wowhead link data**

`src/components/ItemCard.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { wowheadData } from './ItemCard';

describe('wowheadData', () => {
  it('includes bonus IDs and item level so the tooltip matches the item', () => {
    expect(wowheadData(271528, [13440, 12850], 321)).toBe('item=271528&bonus=13440:12850&ilvl=321');
  });

  it('leaves out empty parts', () => {
    expect(wowheadData(5, [], null)).toBe('item=5');
  });
});
```

Run: `npx vitest run src/components`
Expected: FAIL, because `./ItemCard` doesn't exist.

- [ ] **Step 2: Write the shared components**

`src/components/class-colors.ts`:

```ts
const CLASS_COLORS: Record<string, string> = {
  'Death Knight': '#C41E3A', 'Demon Hunter': '#A330C9', Druid: '#FF7C0A', Evoker: '#33937F', Hunter: '#AAD372',
  Mage: '#3FC7EB', Monk: '#00FF98', Paladin: '#F48CBA', Priest: '#E8E8E8', Rogue: '#FFF468',
  Shaman: '#2F8FEF', Warlock: '#8788EE', Warrior: '#C69B6D',
};

export const classColor = (className: string) => CLASS_COLORS[className] ?? '#a79e8e';
```

`src/components/ItemCard.tsx`:

```tsx
import type { Quality } from '@/core/types';

const QUALITY_STYLES: Record<Quality, { ring: string; text: string; bg: string; border: string }> = {
  POOR: { ring: '#9d9d9d', text: '#b5b5b5', bg: '#1c1b1a', border: '#3d3b38' },
  COMMON: { ring: '#ffffff', text: '#f2f2f2', bg: '#1f1e1c', border: '#4a4744' },
  UNCOMMON: { ring: '#1eff00', text: '#6cf36c', bg: '#17200f', border: '#2f5a1f' },
  RARE: { ring: '#0070dd', text: '#5eaaff', bg: '#111b28', border: '#1f4670' },
  EPIC: { ring: '#a335ee', text: '#c58cf5', bg: '#1e1628', border: '#4f2c70' },
  LEGENDARY: { ring: '#ff8000', text: '#ffa64d', bg: '#2a1c0e', border: '#704014' },
  ARTIFACT: { ring: '#e6cc80', text: '#e6cc80', bg: '#262116', border: '#6b5d33' },
  HEIRLOOM: { ring: '#00ccff', text: '#5cdcff', bg: '#10222a', border: '#1d5566' },
};

export function wowheadData(itemId: number, bonusIds: number[], itemLevel: number | null): string {
  const parts = [`item=${itemId}`];
  if (bonusIds.length > 0) parts.push(`bonus=${bonusIds.join(':')}`);
  if (itemLevel) parts.push(`ilvl=${itemLevel}`);
  return parts.join('&');
}

interface ItemCardProps {
  itemId: number;
  name: string;
  quality: Quality;
  iconUrl: string | null;
  bonusIds: number[];
  itemLevel: number | null;
  detail?: string;
  golden?: boolean;
}

export function ItemCard({ itemId, name, quality, iconUrl, bonusIds, itemLevel, detail, golden }: ItemCardProps) {
  const q = QUALITY_STYLES[quality] ?? QUALITY_STYLES.COMMON;
  return (
    <div
      className="flex min-h-[62px] min-w-0 items-center gap-3 rounded-lg border py-1.5 pl-1.5 pr-3"
      style={{ background: q.bg, borderColor: q.border, boxShadow: golden ? '0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-gold)' : undefined }}
    >
      {iconUrl
        ? <img src={iconUrl} alt="" width={42} height={42} className="size-[42px] shrink-0 rounded-md border-2" style={{ borderColor: q.ring }} />
        : <span className="size-[42px] shrink-0 rounded-md border-2 bg-surface-2" style={{ borderColor: q.ring }} />}
      <div className="flex min-w-0 grow flex-col gap-0.5">
        <a
          href={`https://www.wowhead.com/item=${itemId}`}
          data-wowhead={wowheadData(itemId, bonusIds, itemLevel)}
          target="_blank"
          rel="noreferrer"
          className="truncate text-[15px] font-semibold no-underline hover:underline"
          style={{ color: q.text }}
        >
          {name}
        </a>
        {detail && <span className="truncate font-mono text-[13px] text-muted">{detail}</span>}
      </div>
    </div>
  );
}

export function EmptySlotCard() {
  return (
    <div className="flex min-h-[62px] items-center rounded-lg border border-dashed border-line-strong px-4 text-[15px] text-muted">
      Empty slot
    </div>
  );
}
```

`src/components/StateBadge.tsx`:

```tsx
import type { ItemState } from '@/core/types';

const LABELS: Record<ItemState, { text: string; className: string }> = {
  done: { text: 'Done', className: 'text-gold' },
  mythUpgradable: { text: 'Upgrade with crests', className: 'text-crest' },
  belowMyth: { text: 'Great Vault target', className: 'text-vault' },
  inBags: { text: 'BiS in bags', className: 'text-bags' },
  missing: { text: 'Missing', className: 'text-muted' },
};

export function StateBadge({ state }: { state: ItemState }) {
  const label = LABELS[state];
  return <span className={`text-[13px] font-bold ${label.className}`}>{label.text}</span>;
}
```

`src/components/SetupNotice.tsx`:

```tsx
export function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-16">
      <h1 className="font-display text-3xl font-bold">Finish setup</h1>
      <p className="text-muted">The app needs Battle.net API credentials before it can load characters.</p>
      <ol className="list-decimal space-y-2 pl-6">
        <li>Create a client at <a href="https://community.developer.battle.net/access/clients">community.developer.battle.net</a>.</li>
        <li>Copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env</code>.</li>
        <li>Fill in: <code className="font-mono">{missing.join(', ')}</code>.</li>
        <li>Restart <code className="font-mono">npm run dev</code>.</li>
      </ol>
      <p className="text-muted">The README has the full steps.</p>
    </main>
  );
}
```

`src/components/StaleSync.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Refreshes stale characters in the background, then re-renders the page with the new data. */
export function StaleSync({ ids }: { ids: number[] }) {
  const router = useRouter();
  const key = ids.join(',');
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    Promise.all(key.split(',').map((id) =>
      fetch(`/api/characters/${id}/sync`, { method: 'POST' })
        .then((res) => (res.ok ? (res.json() as Promise<{ result: string }>) : { result: 'error' }))
        .catch(() => ({ result: 'error' })),
    )).then((results) => {
      if (!cancelled && results.some((r) => r.result !== 'skipped')) router.refresh();
    });
    return () => { cancelled = true; };
  }, [key, router]);
  return null;
}
```

`src/components/RemoveCharacterButton.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RemoveCharacterButton({ id, name, redirectTo }: { id: number; name: string; redirectTo?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (!window.confirm(`Remove ${name} from the tracker?`)) return;
    setBusy(true);
    await fetch(`/api/characters/${id}`, { method: 'DELETE' });
    if (redirectTo) router.push(redirectTo);
    else router.refresh();
  }
  return (
    <button type="button" onClick={remove} disabled={busy} aria-label={`Remove ${name}`}
      className="flex size-11 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" />
      </svg>
    </button>
  );
}
```

`src/components/WowheadRefresh.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

declare global {
  interface Window { $WowheadPower?: { refreshLinks: () => void } }
}

/** Wowhead scans links once on load; client-side navigation needs a rescan. */
export function WowheadRefresh() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    window.$WowheadPower?.refreshLinks();
  }, [pathname, search]);
  return null;
}
```

- [ ] **Step 3: Write the character card and add bar**

`src/components/CharacterCard.tsx`:

```tsx
import Link from 'next/link';
import { formatAge } from '@/core/format';
import type { CharacterCardView } from '@/server/views';
import { classColor } from './class-colors';
import { RemoveCharacterButton } from './RemoveCharacterButton';

export function CharacterCard({ card, now }: { card: CharacterCardView; now: number }) {
  const color = classColor(card.className);
  const counts = card.counts;
  const bis = counts ? counts.done + counts.mythUpgradable + counts.belowMyth : 0;
  const source = card.snapshot
    ? `${card.snapshot.source === 'simc' ? 'SimC, pasted' : 'Blizzard, synced'} ${formatAge(card.lastSyncedAt ?? card.snapshot.createdAt, now)}`
    : 'Not synced yet';
  const listName = card.priorityList === 'mythicPlus' ? 'Mythic+ BiS' : 'Overall BiS';

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-3.5">
        <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full border-2 bg-bg text-xl font-bold" style={{ borderColor: color, color }}>
          {card.name.charAt(0)}
        </span>
        <div className="flex min-w-0 flex-col">
          <Link href={`/characters/${card.id}`} className="truncate text-xl font-bold text-ink no-underline hover:underline">{card.name}</Link>
          <span className="text-[15px] text-muted">{card.realmName}</span>
          <span className="text-[15px] font-semibold" style={{ color }}>{card.spec} {card.className}</span>
        </div>
      </div>

      {card.status === 'notFound' ? (
        <p className="rounded-lg border border-[#8a5a2b] bg-[#2e1f16] p-3 text-[15px] text-[#f3c9a2]">
          Blizzard can&rsquo;t find this character. It may have been renamed or transferred.
        </p>
      ) : counts ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold uppercase tracking-wider text-muted">{listName}</span>
            <span className="font-mono"><strong className="text-gold">{bis}</strong><span className="text-muted"> / {card.total}</span></span>
          </div>
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div className="bg-gold" style={{ flexGrow: counts.done }} />
            <div className="bg-crest" style={{ flexGrow: counts.mythUpgradable }} />
            <div className="bg-vault" style={{ flexGrow: counts.belowMyth }} />
            <div style={{ flexGrow: counts.missing + counts.inBags }} />
          </div>
          <span className="text-sm text-muted">
            {counts.done} done, {counts.mythUpgradable} need crests, {counts.belowMyth} vault targets
          </span>
        </div>
      ) : (
        <p className="text-sm text-muted">{card.bisError ?? 'Loading BiS list…'}</p>
      )}

      {card.lastSyncError && card.status === 'ok' && <p className="text-sm text-[#f3c9a2]">{card.lastSyncError}</p>}

      <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
        <span className="text-sm text-muted">{source}</span>
        <RemoveCharacterButton id={card.id} name={card.name} />
      </div>
    </article>
  );
}
```

`src/components/AddCharacterBar.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { REGIONS, type Region } from '@/core/types';
import { classColor } from './class-colors';

interface Result { name: string; realmName: string; blizzardRealmId: number; className: string }
interface Realm { id: number; name: string; slug: string }

const inputClass = 'h-12 rounded-xl border border-line-strong bg-surface-2 px-4 text-[17px] text-ink focus:border-gold focus:outline-none';
const labelClass = 'text-[13px] font-semibold uppercase tracking-wider text-muted';

export function AddCharacterBar() {
  const router = useRouter();
  const [region, setRegion] = useState<Region>('eu');
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [manual, setManual] = useState(false);
  const [realms, setRealms] = useState<Realm[]>([]);
  const [realmSlug, setRealmSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (manual || term.trim().length < 3) { setResults([]); return; }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/search?region=${region}&term=${encodeURIComponent(term.trim())}`).catch(() => null);
      if (!res?.ok) { setManual(true); setError('Search is unavailable. Pick the realm yourself.'); return; }
      setResults(await res.json());
    }, 300);
    return () => clearTimeout(timer);
  }, [term, region, manual]);

  useEffect(() => {
    if (!manual) return;
    fetch(`/api/realms?region=${region}`).then((r) => (r.ok ? r.json() : [])).then(setRealms).catch(() => setRealms([]));
  }, [manual, region]);

  async function add(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/characters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ region, ...body }) });
    const data = (await res.json().catch(() => ({}))) as { id?: number; error?: string };
    setBusy(false);
    if (!res.ok || !data.id) { setError(data.error ?? 'Couldn’t add that character.'); return; }
    setTerm('');
    setResults([]);
    router.push(`/characters/${data.id}`);
  }

  return (
    <section aria-label="Add a character" className="relative flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="region" className={labelClass}>Region</label>
        <select id="region" value={region} onChange={(e) => setRegion(e.target.value as Region)} className={`${inputClass} w-28`}>
          {REGIONS.map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}
        </select>
      </div>

      <div className="relative flex min-w-64 grow flex-col gap-1.5">
        <label htmlFor="character-name" className={labelClass}>Character name</label>
        <input id="character-name" type="search" autoComplete="off" value={term} onChange={(e) => setTerm(e.target.value)}
          placeholder="Search by name" className={inputClass} />
        {results.length > 0 && (
          <ul role="listbox" aria-label="Matching characters"
            className="absolute top-full z-10 mt-2 flex w-full flex-col gap-0.5 rounded-xl border border-line-strong bg-surface-2 p-1.5 shadow-2xl">
            {results.map((r) => (
              <li key={`${r.blizzardRealmId}-${r.name}`} role="option" aria-selected="false">
                <button type="button" disabled={busy} onClick={() => add({ name: r.name, realmId: r.blizzardRealmId })}
                  className="flex h-14 w-full items-center gap-3.5 rounded-lg px-3 text-left hover:bg-raised">
                  <span className="grow text-[17px]"><strong className="font-semibold">{r.name}</strong><span className="text-muted"> - {r.realmName}</span></span>
                  <span className="text-sm font-semibold" style={{ color: classColor(r.className) }}>{r.className}</span>
                </button>
              </li>
            ))}
            <li className="border-t border-line px-3 pb-1 pt-2.5 text-sm text-muted">
              Not listed? <button type="button" className="text-gold underline" onClick={() => setManual(true)}>Pick the realm yourself</button>
            </li>
          </ul>
        )}
      </div>

      {manual && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="realm" className={labelClass}>Realm</label>
          <select id="realm" value={realmSlug} onChange={(e) => setRealmSlug(e.target.value)} className={`${inputClass} w-56`}>
            <option value="">Choose a realm</option>
            {realms.map((r) => <option key={r.id} value={r.slug}>{r.name}</option>)}
          </select>
        </div>
      )}

      {manual && (
        <button type="button" disabled={busy || !realmSlug || !term.trim()} onClick={() => add({ name: term.trim(), realmSlug })}
          className="h-12 rounded-xl border border-line-strong bg-raised px-5 font-semibold disabled:opacity-50">
          Add character
        </button>
      )}

      {error && <p role="alert" className="w-full text-sm text-[#f3c9a2]">{error}</p>}
    </section>
  );
}
```

- [ ] **Step 4: Write the layout and characters page**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { Suspense } from 'react';
import { Barlow, Cinzel, IBM_Plex_Mono } from 'next/font/google';
import { WowheadRefresh } from '@/components/WowheadRefresh';
import './globals.css';

const cinzel = Cinzel({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-cinzel' });
const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-barlow' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['500'], variable: '--font-plex-mono' });

export const metadata: Metadata = { title: 'Gear Tracker', description: 'WoW gear versus BiS' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${barlow.variable} ${plexMono.variable}`}>
      <body className="min-h-screen">
        <header className="border-b border-line bg-[#1a1713]">
          <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-16">
            <Link href="/" className="flex items-center gap-3 font-display text-[22px] font-bold tracking-wide text-ink no-underline">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f2c14e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" />
              </svg>
              Gear Tracker
            </Link>
            <nav aria-label="Main" className="flex gap-2">
              <Link href="/" className="rounded-lg bg-raised px-4 py-2.5 text-[15px] font-semibold text-ink no-underline">Characters</Link>
            </nav>
          </div>
        </header>
        {children}
        <Script id="wowhead-config" strategy="beforeInteractive">
          {'window.whTooltips = { colorLinks: false, iconizeLinks: false, renameLinks: false };'}
        </Script>
        <Script src="https://wow.zamimg.com/js/tooltips.js" strategy="afterInteractive" />
        <Suspense fallback={null}><WowheadRefresh /></Suspense>
      </body>
    </html>
  );
}
```

Replace `src/app/page.tsx`:

```tsx
import { AddCharacterBar } from '@/components/AddCharacterBar';
import { CharacterCard } from '@/components/CharacterCard';
import { SetupNotice } from '@/components/SetupNotice';
import { StaleSync } from '@/components/StaleSync';
import { MissingConfigError } from '@/core/config';
import { isStale } from '@/core/sync/character-sync';
import { getServices, type Services } from '@/server/services';
import { getCharacterCards } from '@/server/views';

export const dynamic = 'force-dynamic';

const LEGEND = [
  ['bg-gold', 'Done: Myth max'],
  ['bg-crest', 'Upgrade with crests'],
  ['bg-vault', 'Great Vault target'],
  ['bg-line', 'Missing'],
] as const;

export default async function CharactersPage() {
  let services: Services;
  try {
    services = await getServices();
  } catch (err) {
    if (err instanceof MissingConfigError) return <SetupNotice missing={err.missing} />;
    throw err;
  }
  const cards = await getCharacterCards(services);
  const now = services.now();
  const staleIds = cards.filter((c) => c.status === 'ok' && isStale(c.lastSyncedAt, now)).map((c) => c.id);

  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-12 sm:px-16">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-4xl font-bold tracking-wide">Characters</h1>
        <p className="text-[17px] text-muted">BiS progress against Method&rsquo;s lists</p>
      </div>
      <AddCharacterBar />
      <div className="flex flex-wrap gap-6 text-sm text-muted" aria-label="Legend">
        {LEGEND.map(([swatch, label]) => (
          <span key={label} className="flex items-center gap-2"><span className={`size-3 rounded-sm ${swatch}`} />{label}</span>
        ))}
      </div>
      {cards.length === 0 ? (
        <p className="text-muted">No characters yet. Search for one above.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => <CharacterCard key={card.id} card={card} now={now} />)}
        </div>
      )}
      <StaleSync ids={staleIds} />
    </main>
  );
}
```

- [ ] **Step 5: Run the tests, types, lint and build**

Run: `npx vitest run src/components && npm run typecheck && npm run lint && npm run build`
Expected: the `wowheadData` tests pass, and typecheck, lint and build succeed.

- [ ] **Step 6: Check it in the browser**

Run: `npm run dev` and open `http://localhost:3000`.
Expected:
1. The characters page loads with the dark theme and the empty-state text.
2. Typing three or more letters of a character's name shows "Name - Realm" results.
3. Picking a result opens `/characters/<id>`, which is a 404 until Task 14. Go back to `/`.
4. The new card shows class color, realm, spec, and a BiS progress bar.
5. Temporarily renaming `.env` and restarting shows the setup notice. Restore `.env` afterwards.

- [ ] **Step 7: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx src/components
git commit -m "feat: add app shell, item cards and the characters page"
```

---

### Task 14: Character page

**Files:**
- Create: `src/app/characters/[id]/page.tsx`, `src/components/RefreshButton.tsx`, `src/components/CharacterSettings.tsx`

**Interfaces:**
- Consumes: `getCharacterPage`, `CharacterPageView`, `GearRowView` (Task 12). `ItemCard`, `EmptySlotCard`, `StateBadge`, `StaleSync`, `RemoveCharacterButton`, `SetupNotice`, `classColor` (Task 13). `isStale` (Task 9). `formatAge` (Task 2). `LIST_TYPES`, `ListType`.
- Produces: the `/characters/[id]?list=overall|raid|mythicPlus` page, `<RefreshButton id />`, `<CharacterSettings id specs spec activeSpec priorityList />`.

- [ ] **Step 1: Write the client controls**

`src/components/RefreshButton.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RefreshButton({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    await fetch(`/api/characters/${id}/sync?force=1`, { method: 'POST' }).catch(() => null);
    setBusy(false);
    router.refresh();
  }
  return (
    <button type="button" onClick={refresh} disabled={busy}
      className="h-11 rounded-xl border border-line-strong bg-raised px-4 font-semibold disabled:opacity-50">
      {busy ? 'Refreshing…' : 'Refresh'}
    </button>
  );
}
```

`src/components/CharacterSettings.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';

interface Props {
  id: number;
  specs: string[];
  spec: string;
  activeSpec: string;
  priorityList: 'mythicPlus' | 'overall';
}

export function CharacterSettings({ id, specs, spec, activeSpec, priorityList }: Props) {
  const router = useRouter();
  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/characters/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-end gap-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="spec" className="text-[13px] font-semibold uppercase tracking-wider text-muted">Compare as</label>
        <select id="spec" value={spec} onChange={(e) => patch({ specOverride: e.target.value === activeSpec ? null : e.target.value })}
          className="h-11 rounded-xl border border-line-strong bg-surface-2 px-3 text-ink">
          {specs.map((s) => <option key={s} value={s}>{s}{s === activeSpec ? ' (active)' : ''}</option>)}
        </select>
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[13px] font-semibold uppercase tracking-wider text-muted">Dungeon priority uses</legend>
        <div className="flex gap-4">
          {(['mythicPlus', 'overall'] as const).map((value) => (
            <label key={value} className="flex h-11 items-center gap-2 font-semibold">
              <input type="radio" name="priority-list" checked={priorityList === value} onChange={() => patch({ priorityList: value })}
                className="size-[18px] accent-[var(--color-gold)]" />
              {value === 'mythicPlus' ? 'Mythic+ list' : 'Overall list'}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
```

- [ ] **Step 2: Write the page**

`src/app/characters/[id]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CharacterSettings } from '@/components/CharacterSettings';
import { classColor } from '@/components/class-colors';
import { EmptySlotCard, ItemCard } from '@/components/ItemCard';
import { RefreshButton } from '@/components/RefreshButton';
import { RemoveCharacterButton } from '@/components/RemoveCharacterButton';
import { SetupNotice } from '@/components/SetupNotice';
import { StaleSync } from '@/components/StaleSync';
import { StateBadge } from '@/components/StateBadge';
import { MissingConfigError } from '@/core/config';
import { formatAge } from '@/core/format';
import { isStale } from '@/core/sync/character-sync';
import { LIST_TYPES, type ListType } from '@/core/types';
import { getServices, type Services } from '@/server/services';
import { getCharacterPage, type GearRowView } from '@/server/views';

export const dynamic = 'force-dynamic';

const LIST_NAMES: Record<ListType, string> = { overall: 'Overall', raid: 'Raid', mythicPlus: 'Mythic+' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ list?: string }> };

function BisTarget({ row }: { row: GearRowView }) {
  const name = row.bis.isTier ? `Tier piece (catalyst ${row.bis.name})` : row.bis.name;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <ItemCard itemId={row.bis.itemId} name={name} quality={row.bis.quality} iconUrl={row.bis.iconUrl}
        bonusIds={row.bis.bonusIds} itemLevel={null} detail={row.bis.source} />
    </div>
  );
}

export default async function CharacterPage({ params, searchParams }: Props) {
  const [{ id }, { list }] = await Promise.all([params, searchParams]);
  let services: Services;
  try {
    services = await getServices();
  } catch (err) {
    if (err instanceof MissingConfigError) return <SetupNotice missing={err.missing} />;
    throw err;
  }
  const listType = (LIST_TYPES as readonly string[]).includes(list ?? '') ? (list as ListType) : undefined;
  const view = await getCharacterPage(services, Number(id), listType);
  if (!view) notFound();

  const now = services.now();
  const color = classColor(view.className);
  const source = view.snapshot
    ? `${view.snapshot.source === 'simc' ? 'From SimC, pasted' : 'From Blizzard, synced'} ${formatAge(view.lastSyncedAt ?? view.snapshot.createdAt, now)}`
    : 'Not synced yet';

  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-10 sm:px-16">
      <Link href="/" className="text-sm">&larr; All characters</Link>

      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <span className="flex size-16 items-center justify-center rounded-full border-2 bg-bg text-2xl font-bold" style={{ borderColor: color, color }}>
            {view.name.charAt(0)}
          </span>
          <div className="flex flex-col">
            <h1 className="font-display text-4xl font-bold tracking-wide">{view.name}</h1>
            <span className="text-muted">{view.realmName} ({view.region.toUpperCase()})</span>
            <span className="font-semibold" style={{ color }}>{view.spec} {view.className}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">{source}</span>
          <RefreshButton id={view.id} />
          <RemoveCharacterButton id={view.id} name={view.name} redirectTo="/" />
        </div>
      </div>

      {view.status === 'notFound' && (
        <p role="alert" className="rounded-lg border border-[#8a5a2b] bg-[#2e1f16] p-3 text-[#f3c9a2]">
          Blizzard can&rsquo;t find this character. It may have been renamed or transferred. You can remove it and search again.
        </p>
      )}
      {view.status === 'ok' && view.lastSyncError && <p role="alert" className="text-[#f3c9a2]">{view.lastSyncError}</p>}
      {view.bisError && (
        <p role="alert" className="text-[#f3c9a2]">
          {view.bisError}{view.bisFetchedAt ? `. Showing the list from ${formatAge(view.bisFetchedAt, now)}.` : '.'}
        </p>
      )}

      <CharacterSettings id={view.id} specs={view.specs} spec={view.spec} activeSpec={view.activeSpec} priorityList={view.priorityList} />

      <nav aria-label="BiS lists" className="flex gap-2 border-b border-line">
        {LIST_TYPES.map((l) => (
          <Link key={l} href={`/characters/${view.id}?list=${l}`} aria-current={l === view.listType ? 'page' : undefined}
            className={`-mb-px border-b-2 px-4 py-3 font-semibold no-underline ${l === view.listType ? 'border-gold text-ink' : 'border-transparent text-muted'}`}>
            {LIST_NAMES[l]} <span className="font-mono text-sm">{view.counts[l].bis}/{view.counts[l].total}</span>
          </Link>
        ))}
      </nav>

      <section aria-label="Gear by slot" className="flex flex-col rounded-2xl border border-line bg-surface">
        <div className="hidden grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_170px] gap-3 border-b border-line px-4 py-3 text-[13px] font-semibold uppercase tracking-wider text-muted md:grid">
          <span>Slot</span><span>Equipped</span><span>BiS</span><span>State</span>
        </div>
        {view.rows.length === 0 && <p className="p-6 text-muted">No BiS list to compare against yet.</p>}
        {view.rows.map((row, index) => (
          <div key={`${row.slot}-${index}`} className="grid grid-cols-1 gap-3 border-b border-raised px-4 py-2 md:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_170px] md:items-center">
            <span className="font-semibold text-muted">{row.slotLabel}</span>
            {row.equipped ? (
              <ItemCard itemId={row.equipped.itemId} name={row.equipped.name} quality={row.equipped.quality} iconUrl={row.equipped.iconUrl}
                bonusIds={row.equipped.bonusIds} itemLevel={row.equipped.itemLevel} golden={row.state === 'done'}
                detail={[row.equipped.trackLabel ?? 'no track', row.equipped.itemLevel].filter(Boolean).join(' · ')} />
            ) : <EmptySlotCard />}
            <BisTarget row={row} />
            <StateBadge state={row.state} />
          </div>
        ))}
      </section>

      <section aria-label="Great Vault targets" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-2xl font-bold">Great Vault targets</h2>
        {view.vault.length === 0 ? (
          <p className="text-muted">No BiS items below Myth track.</p>
        ) : view.vault.map((row) => row.equipped && (
          <ItemCard key={row.slot} itemId={row.equipped.itemId} name={row.equipped.name} quality={row.equipped.quality}
            iconUrl={row.equipped.iconUrl} bonusIds={row.equipped.bonusIds} itemLevel={row.equipped.itemLevel}
            detail={row.equipped.trackLabel ?? undefined} />
        ))}
      </section>

      <StaleSync ids={view.status === 'ok' && isStale(view.lastSyncedAt, now) ? [view.id] : []} />
    </main>
  );
}
```

- [ ] **Step 3: Verify types, lint and build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all succeed.

- [ ] **Step 4: Check it in the browser**

Run: `npm run dev`, then open a character from the characters page.
Expected:
1. Rows show the equipped item with icon, rarity colors, track and item level, next to the BiS item and a state badge.
2. Fully upgraded Myth BiS items have the golden ring.
3. Hovering an item name shows a Wowhead tooltip with the right item level.
4. The Overall, Raid and Mythic+ tabs switch lists and show "BiS/total" counts.
5. Changing **Compare as** to another spec reloads the page with that spec's list.
6. **Refresh** re-syncs, and the source line updates to "just now".
7. **Great Vault targets** lists BiS items below Myth track.

- [ ] **Step 5: Commit**

```bash
git add src/app/characters src/components/RefreshButton.tsx src/components/CharacterSettings.tsx
git commit -m "feat: add the character page with BiS tabs, states and Great Vault targets"
```

---

### Task 15: Live checks, CI, README and cleanup

**Files:**
- Create: `src/core/live.live.test.ts`, `.github/workflows/ci.yml`, `README.md`
- Modify: `.env.example`
- Delete: `scripts/` (the prototype, replaced by `src/core`)

**Interfaces:**
- Consumes: `readConfig`, `createBlizzardClient`, `createMethodSource`, `createRaidbotsTracksFetcher`, `searchCharacters`.
- Produces: `npm run test:live`, the `test` CI job that branch protection requires in Task 16.

- [ ] **Step 1: Write the live checks**

`src/core/live.live.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createBlizzardClient } from './blizzard/client';
import { readConfig } from './config';
import { createMethodSource } from './method/method';
import { createRaidbotsTracksFetcher } from './raidbots/tracks';
import type { Region } from './types';

// Run with: node --env-file=.env ./node_modules/vitest/vitest.mjs run --config vitest.live.config.ts
// or: npm run test:live (after exporting the .env variables). Never runs in CI.
const env = process.env;

describe('live services', () => {
  it('Method still has all three BiS tables for Guardian Druid', async () => {
    const lists = await createMethodSource().fetchLists('guardian-druid');
    expect(lists.overall.length).toBeGreaterThan(10);
    expect(lists.raid.length).toBeGreaterThan(10);
    expect(lists.mythicPlus.length).toBeGreaterThan(10);
  });

  it('Raidbots still publishes Myth upgrade tracks', async () => {
    const tracks = await createRaidbotsTracksFetcher()();
    expect(tracks.some((t) => t.name === 'Myth')).toBe(true);
  });

  it('Blizzard accepts the credentials and returns realms', async () => {
    const config = readConfig();
    const blizzard = createBlizzardClient({ clientId: config.blizzardClientId, clientSecret: config.blizzardClientSecret });
    expect((await blizzard.getRealms((env.LIVE_TEST_REGION as Region) || 'eu')).length).toBeGreaterThan(10);
  });

  it.runIf(Boolean(env.LIVE_TEST_REALM && env.LIVE_TEST_CHARACTER))('Blizzard returns equipment for the test character', async () => {
    const config = readConfig();
    const blizzard = createBlizzardClient({ clientId: config.blizzardClientId, clientSecret: config.blizzardClientSecret });
    const gear = await blizzard.getEquipment({
      region: (env.LIVE_TEST_REGION as Region) || 'eu', realmSlug: env.LIVE_TEST_REALM!, name: env.LIVE_TEST_CHARACTER!,
    });
    expect(gear.length).toBeGreaterThan(5);
  });
});
```

Change the `test:live` script in `package.json` so it loads `.env`:

```json
"test:live": "node --env-file=.env ./node_modules/vitest/vitest.mjs run --config vitest.live.config.ts"
```

Replace `.env.example`:

```
# Battle.net API client from https://community.developer.battle.net/access/clients
BLIZZARD_CLIENT_ID=
BLIZZARD_CLIENT_SECRET=

# Optional: SQLite database location. Defaults to file:data/app.db
DATABASE_URL=

# Optional: only used by npm run test:live
LIVE_TEST_REGION=eu
LIVE_TEST_REALM=
LIVE_TEST_CHARACTER=
```

Run: `npm run test:live`
Expected: PASS, with the equipment check skipped unless `LIVE_TEST_REALM` and `LIVE_TEST_CHARACTER` are set in `.env`.

- [ ] **Step 2: Add CI**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
```

- [ ] **Step 3: Write the README**

`README.md`:

````markdown
# Gear Tracker

A local web app that compares World of Warcraft characters' gear to Method.gg's best-in-slot lists. It shows upgrade tracks, what each character still needs, and which BiS items are fully upgraded.

## Set up

1. Install Node.js 24 or later.
2. Create a Battle.net API client at https://community.developer.battle.net/access/clients. Client names are unique across all developers, so pick one with your name in it. Use `http://localhost` for both URLs.
3. Copy `.env.example` to `.env` and fill in `BLIZZARD_CLIENT_ID` and `BLIZZARD_CLIENT_SECRET`.
4. Install and start:

   ```bash
   npm install
   npm run dev
   ```

5. Open http://localhost:3000 and search for a character.

The database is a SQLite file in `data/`, created on first run. `.env` and `data/` never leave your machine.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Starts the app on localhost:3000 |
| `npm test` | Runs unit and integration tests |
| `npm run test:live` | Checks the real Blizzard, Method and Raidbots APIs with your `.env` |
| `npm run typecheck` | Type-checks the project |
| `npm run lint` | Lints the project |
| `npm run db:generate -- --name <name>` | Generates a migration after a schema change |

## How it's built

All logic lives in `src/core` as plain TypeScript with no Next.js or React imports. Pages and API routes in `src/app` stay thin and call into `src/core` through `src/server`. The design spec is in `docs/superpowers/specs/`.

## Contributing

1. Branch from `main` as `feat/<description>` or `fix/<description>`.
2. Keep tests passing: `npm run typecheck && npm run lint && npm test`.
3. Open a pull request. CI must pass and a review is required before merging.
4. Never commit `.env`, the `data/` folder, or real character names in test fixtures.
````

- [ ] **Step 4: Remove the prototype scripts**

```bash
git rm -r scripts
```

Remove `"scripts"` from the `exclude` list in `tsconfig.json` and `'scripts/**'` from the ignores in `eslint.config.mjs`.

- [ ] **Step 5: Run the full check**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: add CI, live API checks and README, remove prototype scripts"
```

---

### Task 16: Publish to GitHub and set up the backlog

This task creates public, outward-facing things. **Confirm with the user before Step 2**, and show them the repo name and visibility first.

**Files:** none in the repo.

**Interfaces:**
- Consumes: the `test` CI job from Task 15.
- Produces: the public repo `arnorgeir/wow-gear-tracker`, a protected `main`, and a GitHub Project board with the backlog.

- [ ] **Step 1: Check the git identity and the GitHub account**

Run: `git config user.email`
Expected: `arnorgeir91@gmail.com`.

Run: `gh auth status --hostname github.com`
Expected: logged in to github.com as `arnorgeir`. `gh` is also logged in to a work GitHub Enterprise host, so every command below sets `GH_HOST=github.com`.

- [ ] **Step 2: Create the repo and push**

```bash
git branch main feat/gear-tracking-foundation
GH_HOST=github.com gh repo create arnorgeir/wow-gear-tracker --public --source . --remote origin
git push -u origin main chore/initial-spec feat/gear-tracking-foundation
GH_HOST=github.com gh repo edit arnorgeir/wow-gear-tracker --default-branch main
```

`main` holds the finished plan 1 work. The two feature branches are pushed for history.

- [ ] **Step 3: Protect main**

```bash
GH_HOST=github.com gh api -X PUT repos/arnorgeir/wow-gear-tracker/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["test"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 1 },
  "restrictions": null
}
JSON
```

Expected: JSON describing the protection rules.

- [ ] **Step 4: Create the project board and backlog**

The `project` scope is needed for GitHub Projects. If the next command fails with a scope error, ask the user to run `! gh auth refresh -h github.com -s project`, then retry.

```bash
GH_HOST=github.com gh project create --owner arnorgeir --title "Gear Tracker"
GH_HOST=github.com gh label create plan-2 --repo arnorgeir/wow-gear-tracker --color 7B61FF --description "SimC paste and crests"
GH_HOST=github.com gh label create plan-3 --repo arnorgeir/wow-gear-tracker --color F2C14E --description "Dungeon priority and group page"
GH_HOST=github.com gh label create idea --repo arnorgeir/wow-gear-tracker --color 5FD6BD --description "Backlog idea, not specced yet"
```

Create one issue per backlog item and add it to the project. `<number>` is the project number printed by `gh project create`:

```bash
for title in \
  "Plan 2: SimC paste, bag and vault items, crests and upgrade flags|plan-2" \
  "Plan 3: season loot tables, dungeon priority and group page|plan-3" \
  "Mythic+ statistics from Raider.IO|idea" \
  "Dungeon loot browser page|idea" \
  "Nightly sync script|idea" \
  "In-game addon with a saved variables file watcher|idea" \
  "Hosting on Vercel with Turso, and who may edit the character list|idea" \
  "Gear timeline from snapshot history|idea"; do
  url=$(GH_HOST=github.com gh issue create --repo arnorgeir/wow-gear-tracker --title "${title%%|*}" --label "${title##*|}" --body "See the Future work section of the design spec.")
  GH_HOST=github.com gh project item-add <number> --owner arnorgeir --url "$url"
done
```

- [ ] **Step 5: Link the project to the repo**

```bash
GH_HOST=github.com gh project link <number> --owner arnorgeir --repo arnorgeir/wow-gear-tracker
```

Expected: the project appears under the repo's **Projects** tab.
