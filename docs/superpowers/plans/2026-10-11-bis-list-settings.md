# BiS List Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, inline, as `docs/workflow.md` step 4 says (or superpowers:subagent-driven-development if the owner picks it). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Settings section where an account, per spec, picks the compared BiS list, overrides single slots of Method's lists (including catalyst overrides on tier slots), and decides whether tier stats matter; the character page shows the source and edit count.

**Architecture:** User choices live in account-scoped tables (`spec_settings`, `bis_overrides`) on top of the unchanged global Method cache. Pure functions in `src/core/bis/` overlay overrides onto Method rows; `createBisLookup` applies the overlay once per page, so every loader sees effective lists. One local account (id 1) is seeded; `Services.currentAccountId()` resolves it until login exists.

**Tech Stack:** Next.js (read `node_modules/next/dist/docs/` before writing pages or routes), React 19, Tailwind v4, Drizzle + libsql, Vitest with in-memory SQLite and `renderToStaticMarkup`.

**Spec:** `docs/superpowers/specs/2026-10-11-bis-list-settings-design.md`. Spec review: `docs/reviews/2026-10-11-bis-list-settings-design.md`, findings resolved in the spec. The spec wins over this plan.

## Global Constraints

- Branch: implement on `feat/bis-list-settings`, cut from fetched `origin/main` after the `docs/bis-list-settings` pull request merges; if it hasn't merged, branch from `docs/bis-list-settings` and say so in the pull request.
- Account: every account-scoped read and write takes `accountId` as a parameter in core code. Only loaders and route handlers call `services.currentAccountId()`.
- Writes: every database write goes through `withWriteLock`. Nothing writes on `GET`.
- Database reads in one code path run in sequence, never `Promise.all` alongside a write.
- Schema changes only in `src/core/db/schema.ts`, then `npm run db:generate -- --name <name>`. Never edit a committed migration.
- Bump `SEASON_META_KEY` from `season.v3` to `season.v4`.
- Default spec settings: `listType: 'mythicPlus'`, `statsMatter: true`.
- Slot keys: `<slotLabel>#<n>`, `n` counting rows with the same label from 1.
- `TIER_SLOTS`: HEAD, SHOULDER, CHEST, HANDS, LEGS. `ARMOR_SLOTS` (existing) decides armor-type checks; BACK is never armor-checked.
- Copy, verbatim: placeholder "Search by name, ID or Wowhead link"; checkbox "Tier pieces must have the list's stats" with "Uncheck if the set bonus is all that matters for this spec."; switch "Catalyst into tier"; badge "Method" / "Method · <n> edited"; orphans heading "No longer in Method's list"; errors as listed in the spec's Errors section.
- `UserError` for user-fixable failures; check errors with `isUserError`, `isHttpError`, `isMissingConfigError`, never `instanceof`.
- Components: one kebab-case directory each, PascalCase `.tsx`, branching logic in a `.ts` beside it with tests. Server components unless state or handlers need `'use client'`. Semantic Tailwind tokens only.
- Wowhead tooltips via `data-wowhead` on links, never on buttons.
- Fixture names made up (Birkibjörn, a Frost Mage). No real player names.
- Commits: `type: lowercase imperative summary`, through the `commit` skill. No AI attribution.
- Gate before done: `npm run typecheck && npm run lint && npm test`, then `npm run build` (stop `npm run dev` first).

## Review Focus

1. **Override saved, then Method refetches and renames a slot label** ("Ring" → "Rings"): the override shows under "No longer in Method's list", the gear row shows Method's pick, nothing crashes. Task 4 tests the orphan path through `applyOverrides`; Task 9 tests it through `bisFor`.
2. **Two characters of the same spec in a group, one override:** both members' rows and the dungeon ranking use the override; the shared `bisFor` lookup applies the overlay once. Task 9 adds a group-page test.
3. **Pasted Wowhead link with locale path and slug** (`https://www.wowhead.com/de/item=212401/some-name?bonus=1`): parses to 212401. Task 4 pins it.
4. **Settings URL with a slug that is not a spec** (`/settings/bis/../../etc` or `foo`): 404, and `POST /api/bis/fetch` with it returns 400 without a request to Method. Task 10 tests `knownSpecSlug`; Task 12 calls `notFound()`.
5. **Name search with non-ASCII** ("björn", "Æ"): matches case-insensitively. SQLite `LIKE` folds ASCII only, so search folds in TypeScript. Task 3 pins it.

---

### Task 1: Schema, migrations seed and account resolver

**Files:**
- Modify: `src/core/db/schema.ts`
- Create: `drizzle/0010_bis-settings.sql` (generated, then the seed line appended)
- Modify: `src/core/types.ts`
- Modify: `src/server/services.ts`
- Modify: `src/server/views/views.test.ts`, `src/server/views/group-page.test.ts`, `src/core/sync/season-sync.test.ts` (fake `Services` gain `currentAccountId`)
- Test: `src/core/db/queries/accounts.test.ts`

**Interfaces:**
- Produces: tables `accounts`, `specs`, `specSettings`, `bisOverrides`, `itemCatalog`; `dungeonLoot.quality`, `dungeonLoot.isTier`.
- Produces in `src/core/types.ts`:
  ```ts
  export interface BisOverride { slotKey: string; itemId: number; catalyst: boolean }
  export interface CatalogItem { itemId: number; name: string; inventoryType: string | null; armorType: ArmorType | null; quality: Quality | null; isTier: boolean }
  export interface SpecSettings { listType: ListType; statsMatter: boolean }
  export const LOCAL_ACCOUNT_ID = 1;
  ```
- Produces: `Services.currentAccountId: () => number`.

- [ ] **Step 1: Write the failing test**

`src/core/db/queries/accounts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { accounts } from '../schema';
import { LOCAL_ACCOUNT_ID } from '../../types';

describe('accounts', () => {
  it('seeds the local account', async () => {
    const db = await openTestDb();
    expect(await db.select().from(accounts)).toEqual([{ id: LOCAL_ACCOUNT_ID, name: 'Local' }]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/core/db/queries/accounts.test.ts`
Expected: FAIL, `accounts` is not exported from schema.

- [ ] **Step 3: Add the tables**

In `src/core/db/schema.ts` (`ListType`, `Quality` and `ArmorType` are already imported), add:

```ts
export const accounts = sqliteTable('accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
});

/** Every class and spec, from Blizzard's playable classes. Keyed by the Method slug the views use. */
export const specs = sqliteTable('specs', {
  methodSlug: text('method_slug').primaryKey(),
  classId: integer('class_id').notNull(),
  className: text('class_name').notNull(),
  specName: text('spec_name').notNull(),
  fetchedAt: integer('fetched_at').notNull(),
});

/** An account's choices for one spec. A missing row means the defaults. */
export const specSettings = sqliteTable('spec_settings', {
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  specSlug: text('spec_slug').notNull(),
  listType: text('list_type').$type<ListType>().notNull().default('mythicPlus'),
  statsMatter: integer('stats_matter', { mode: 'boolean' }).notNull().default(true),
}, (t) => [primaryKey({ columns: [t.accountId, t.specSlug] })]);

/** One slot of a Method list replaced by an account. `slot_key` is `<slotLabel>#<n>`. */
export const bisOverrides = sqliteTable('bis_overrides', {
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  specSlug: text('spec_slug').notNull(),
  listType: text('list_type').$type<ListType>().notNull(),
  slotKey: text('slot_key').notNull(),
  itemId: integer('item_id').notNull(),
  catalyst: integer('catalyst', { mode: 'boolean' }).notNull().default(false),
}, (t) => [primaryKey({ columns: [t.accountId, t.specSlug, t.listType, t.slotKey] })]);

/** Every item an override names: complete, factual metadata from Blizzard or the season sync. */
export const itemCatalog = sqliteTable('item_catalog', {
  itemId: integer('item_id').primaryKey(),
  name: text('name').notNull(),
  inventoryType: text('inventory_type'),
  armorType: text('armor_type').$type<ArmorType>(),
  quality: text('quality').$type<Quality>(),
  isTier: integer('is_tier', { mode: 'boolean' }).notNull(),
  fetchedAt: integer('fetched_at').notNull(),
});
```

In `dungeonLoot`, after `secondaryStats`:

```ts
  quality: text('quality').$type<Quality>(),
  isTier: integer('is_tier', { mode: 'boolean' }).notNull().default(false),
```

In `src/core/types.ts`, after `BisLists`, add the four exports from the Interfaces block above.

- [ ] **Step 4: Generate the migration and seed the account**

Run: `npm run db:generate -- --name bis-settings`
Then append to the end of the generated `drizzle/0010_bis-settings.sql` (it isn't committed yet, so editing it is allowed):

```sql
--> statement-breakpoint
INSERT INTO `accounts` (`id`, `name`) VALUES (1, 'Local');
```

- [ ] **Step 5: Add the resolver to Services**

In `src/server/services.ts`: import `LOCAL_ACCOUNT_ID` from `@/core/types`, add `currentAccountId: () => number;` to `Services` with the comment `/** The account a request acts for. Always the local account until login exists. */`, and `currentAccountId: () => LOCAL_ACCOUNT_ID,` in `build()`.

Add `currentAccountId: () => 1,` to every fake `Services` object in `views.test.ts`, `group-page.test.ts` and `season-sync.test.ts` (search for `fetchFn:`).

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/core/db/queries/accounts.test.ts && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/core/db/schema.ts src/core/types.ts src/server/services.ts drizzle src/core/db/queries/accounts.test.ts src/server/views/views.test.ts src/server/views/group-page.test.ts src/core/sync/season-sync.test.ts
git commit -m "feat: add account-scoped bis settings tables"
```

---

### Task 2: Settings and override queries

**Files:**
- Create: `src/core/db/queries/bis-settings.ts`
- Test: `src/core/db/queries/bis-settings.test.ts`

**Interfaces:**
- Consumes: Task 1 tables and types.
- Produces:
  ```ts
  export const DEFAULT_SPEC_SETTINGS: SpecSettings;
  export function getSpecSettings(db: Db, accountId: number, specSlug: string): Promise<SpecSettings>;
  export function updateSpecSettings(db: Db, accountId: number, specSlug: string, patch: Partial<SpecSettings>): Promise<void>;
  export function listOverrides(db: Db, accountId: number, specSlug: string): Promise<Record<ListType, BisOverride[]>>;
  export function upsertOverride(db: Db, accountId: number, specSlug: string, listType: ListType, override: BisOverride): Promise<void>;
  export function deleteOverride(db: Db, accountId: number, specSlug: string, listType: ListType, slotKey: string): Promise<void>;
  /** Tier targets every account's overrides add for a spec: catalyst overrides, and overrides naming a tier item. */
  export function overrideTierItemIds(db: Db, specSlug: string): Promise<number[]>;
  ```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { accounts, itemCatalog } from '../schema';
import { DEFAULT_SPEC_SETTINGS, deleteOverride, getSpecSettings, listOverrides, overrideTierItemIds, updateSpecSettings, upsertOverride } from './bis-settings';

const SLUG = 'frost-mage';

async function twoAccounts() {
  const db = await openTestDb();
  await db.insert(accounts).values({ id: 2, name: 'Other' });
  return db;
}

describe('spec settings', () => {
  it('defaults to Mythic+ with stats mattering', async () => {
    const db = await openTestDb();
    expect(await getSpecSettings(db, 1, SLUG)).toEqual(DEFAULT_SPEC_SETTINGS);
    expect(DEFAULT_SPEC_SETTINGS).toEqual({ listType: 'mythicPlus', statsMatter: true });
  });

  it('patches one field without resetting the other', async () => {
    const db = await openTestDb();
    await updateSpecSettings(db, 1, SLUG, { statsMatter: false });
    await updateSpecSettings(db, 1, SLUG, { listType: 'raid' });
    expect(await getSpecSettings(db, 1, SLUG)).toEqual({ listType: 'raid', statsMatter: false });
  });

  it('keeps accounts apart', async () => {
    const db = await twoAccounts();
    await updateSpecSettings(db, 1, SLUG, { listType: 'overall' });
    expect(await getSpecSettings(db, 2, SLUG)).toEqual(DEFAULT_SPEC_SETTINGS);
  });
});

describe('overrides', () => {
  it('upserts by slot key and deletes', async () => {
    const db = await openTestDb();
    await upsertOverride(db, 1, SLUG, 'mythicPlus', { slotKey: 'Ring#2', itemId: 100, catalyst: false });
    await upsertOverride(db, 1, SLUG, 'mythicPlus', { slotKey: 'Ring#2', itemId: 101, catalyst: false });
    await upsertOverride(db, 1, SLUG, 'raid', { slotKey: 'Head#1', itemId: 200, catalyst: true });
    expect(await listOverrides(db, 1, SLUG)).toEqual({
      overall: [],
      raid: [{ slotKey: 'Head#1', itemId: 200, catalyst: true }],
      mythicPlus: [{ slotKey: 'Ring#2', itemId: 101, catalyst: false }],
    });
    await deleteOverride(db, 1, SLUG, 'mythicPlus', 'Ring#2');
    expect((await listOverrides(db, 1, SLUG)).mythicPlus).toEqual([]);
  });

  it('never shows one account another account\'s overrides', async () => {
    const db = await twoAccounts();
    await upsertOverride(db, 1, SLUG, 'mythicPlus', { slotKey: 'Neck#1', itemId: 100, catalyst: false });
    expect(await listOverrides(db, 2, SLUG)).toEqual({ overall: [], raid: [], mythicPlus: [] });
  });

  it('collects tier targets from every account: catalyst bases and tier items', async () => {
    const db = await twoAccounts();
    await db.insert(itemCatalog).values([
      { itemId: 300, name: 'Frostbound Crown', inventoryType: 'HEAD', armorType: 'cloth', quality: 'EPIC', isTier: true, fetchedAt: 1 },
      { itemId: 301, name: 'Woven Hood', inventoryType: 'HEAD', armorType: 'cloth', quality: 'EPIC', isTier: false, fetchedAt: 1 },
      { itemId: 302, name: 'Plain Band', inventoryType: 'FINGER', armorType: null, quality: 'EPIC', isTier: false, fetchedAt: 1 },
    ]);
    await upsertOverride(db, 1, SLUG, 'mythicPlus', { slotKey: 'Head#1', itemId: 300, catalyst: false });
    await upsertOverride(db, 2, SLUG, 'raid', { slotKey: 'Head#1', itemId: 301, catalyst: true });
    await upsertOverride(db, 1, SLUG, 'mythicPlus', { slotKey: 'Ring#1', itemId: 302, catalyst: false });
    expect((await overrideTierItemIds(db, SLUG)).sort()).toEqual([300, 301]);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/core/db/queries/bis-settings.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
import { and, eq, or } from 'drizzle-orm';
import type { Db } from '../client';
import { bisOverrides, itemCatalog, specSettings } from '../schema';
import type { BisOverride, ListType, SpecSettings } from '../../types';
import { withWriteLock } from './write-lock';

export const DEFAULT_SPEC_SETTINGS: SpecSettings = { listType: 'mythicPlus', statsMatter: true };

export async function getSpecSettings(db: Db, accountId: number, specSlug: string): Promise<SpecSettings> {
  const row = await db.select().from(specSettings)
    .where(and(eq(specSettings.accountId, accountId), eq(specSettings.specSlug, specSlug))).get();
  return row ? { listType: row.listType, statsMatter: row.statsMatter } : DEFAULT_SPEC_SETTINGS;
}

export async function updateSpecSettings(db: Db, accountId: number, specSlug: string, patch: Partial<SpecSettings>) {
  const next = { ...(await getSpecSettings(db, accountId, specSlug)), ...patch };
  await withWriteLock(db, () => db.insert(specSettings).values({ accountId, specSlug, ...next })
    .onConflictDoUpdate({ target: [specSettings.accountId, specSettings.specSlug], set: next }));
}

export async function listOverrides(db: Db, accountId: number, specSlug: string): Promise<Record<ListType, BisOverride[]>> {
  const rows = await db.select().from(bisOverrides)
    .where(and(eq(bisOverrides.accountId, accountId), eq(bisOverrides.specSlug, specSlug)));
  const result: Record<ListType, BisOverride[]> = { overall: [], raid: [], mythicPlus: [] };
  for (const r of rows) result[r.listType].push({ slotKey: r.slotKey, itemId: r.itemId, catalyst: r.catalyst });
  return result;
}

export async function upsertOverride(db: Db, accountId: number, specSlug: string, listType: ListType, o: BisOverride) {
  await withWriteLock(db, () => db.insert(bisOverrides).values({ accountId, specSlug, listType, ...o })
    .onConflictDoUpdate({
      target: [bisOverrides.accountId, bisOverrides.specSlug, bisOverrides.listType, bisOverrides.slotKey],
      set: { itemId: o.itemId, catalyst: o.catalyst },
    }));
}

export async function deleteOverride(db: Db, accountId: number, specSlug: string, listType: ListType, slotKey: string) {
  await withWriteLock(db, () => db.delete(bisOverrides).where(and(
    eq(bisOverrides.accountId, accountId), eq(bisOverrides.specSlug, specSlug),
    eq(bisOverrides.listType, listType), eq(bisOverrides.slotKey, slotKey),
  )));
}

export async function overrideTierItemIds(db: Db, specSlug: string): Promise<number[]> {
  const rows = await db.selectDistinct({ itemId: bisOverrides.itemId }).from(bisOverrides)
    .leftJoin(itemCatalog, eq(itemCatalog.itemId, bisOverrides.itemId))
    .where(and(eq(bisOverrides.specSlug, specSlug), or(eq(bisOverrides.catalyst, true), eq(itemCatalog.isTier, true))));
  return rows.map((r) => r.itemId);
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/core/db/queries/bis-settings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/db/queries/bis-settings.ts src/core/db/queries/bis-settings.test.ts
git commit -m "feat: store per-account spec settings and overrides"
```

---

### Task 3: Item catalog and spec catalog queries

**Files:**
- Create: `src/core/db/queries/item-catalog.ts`, `src/core/db/queries/specs.ts`
- Test: `src/core/db/queries/item-catalog.test.ts`, `src/core/db/queries/specs.test.ts`

**Interfaces:**
- Consumes: Task 1 tables; `dungeonLoot` with `quality` and `isTier`.
- Produces:
  ```ts
  // item-catalog.ts
  export function getCatalogItems(db: Db, ids: number[]): Promise<Map<number, CatalogItem>>;
  export function upsertCatalogItem(db: Db, item: CatalogItem, now: number): Promise<void>;
  /** The catalog's row, else a complete dungeon_loot row (one written under season.v4), else null. */
  export function findLocalItem(db: Db, itemId: number): Promise<CatalogItem | null>;
  /** Catalog and season loot matching a name substring or an exact ID, catalog rows first per ID. */
  export function searchLocalItems(db: Db, query: string): Promise<CatalogItem[]>;
  // specs.ts
  export interface SpecRow { methodSlug: string; classId: number; className: string; specName: string }
  export function replaceSpecs(db: Db, rows: SpecRow[], now: number): Promise<void>;
  export function listSpecs(db: Db): Promise<SpecRow[]>;
  export function getSpec(db: Db, methodSlug: string): Promise<SpecRow | null>;
  ```

- [ ] **Step 1: Write the failing tests**

`item-catalog.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { replaceSeason } from './season';
import { findLocalItem, getCatalogItems, searchLocalItems, upsertCatalogItem } from './item-catalog';
import type { CatalogItem } from '../../types';

const ROBE: CatalogItem = { itemId: 500, name: 'Björnsdóttir Robe', inventoryType: 'ROBE', armorType: 'cloth', quality: 'EPIC', isTier: false };

async function withLoot() {
  const db = await openTestDb();
  await replaceSeason(db, {
    slug: 's2',
    dungeons: [{ challengeModeId: 1, name: 'Alpha Hollow', shortName: 'AH', journalInstanceId: 9, mapId: 7, imageUrl: null }],
    loot: [
      { challengeModeId: 1, encounterId: 3, encounterName: 'Boss', itemId: 600, itemName: 'Æther Band', inventoryType: 'FINGER', armorType: null, quality: 'EPIC', isTier: false },
      { challengeModeId: 1, encounterId: 3, encounterName: 'Boss', itemId: 601, itemName: 'Old Cloak', inventoryType: null, armorType: null, quality: null, isTier: false },
    ],
  });
  return db;
}

describe('item catalog', () => {
  it('stores and reads items', async () => {
    const db = await openTestDb();
    await upsertCatalogItem(db, ROBE, 1);
    expect(await getCatalogItems(db, [500, 999])).toEqual(new Map([[500, ROBE]]));
  });

  it('finds a local item in the catalog, then in complete season loot', async () => {
    const db = await withLoot();
    await upsertCatalogItem(db, ROBE, 1);
    expect(await findLocalItem(db, 500)).toEqual(ROBE);
    expect(await findLocalItem(db, 600)).toEqual({ itemId: 600, name: 'Æther Band', inventoryType: 'FINGER', armorType: null, quality: 'EPIC', isTier: false });
  });

  it('treats a loot row without a slot as unknown', async () => {
    const db = await withLoot();
    expect(await findLocalItem(db, 601)).toBeNull();
  });

  it('searches names case-insensitively beyond ASCII, and exact IDs', async () => {
    const db = await withLoot();
    await upsertCatalogItem(db, ROBE, 1);
    expect((await searchLocalItems(db, 'BJÖRN')).map((i) => i.itemId)).toEqual([500]);
    expect((await searchLocalItems(db, 'æther')).map((i) => i.itemId)).toEqual([600]);
    expect((await searchLocalItems(db, '600')).map((i) => i.itemId)).toEqual([600]);
    expect(await searchLocalItems(db, '  ')).toEqual([]);
  });
});
```

`specs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { getSpec, listSpecs, replaceSpecs } from './specs';

const FROST = { methodSlug: 'frost-mage', classId: 8, className: 'Mage', specName: 'Frost' };

describe('specs', () => {
  it('replaces the catalog', async () => {
    const db = await openTestDb();
    await replaceSpecs(db, [FROST, { methodSlug: 'fire-mage', classId: 8, className: 'Mage', specName: 'Fire' }], 1);
    await replaceSpecs(db, [FROST], 2);
    expect(await listSpecs(db)).toEqual([FROST]);
    expect(await getSpec(db, 'frost-mage')).toEqual(FROST);
    expect(await getSpec(db, 'nope')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/core/db/queries/item-catalog.test.ts src/core/db/queries/specs.test.ts`
Expected: FAIL. The loot fixture also fails to typecheck until `DungeonLootRow` gains `quality` and `isTier` (Step 3).

- [ ] **Step 3: Implement**

In `src/core/db/queries/season.ts`, add to `DungeonLootRow`:

```ts
  quality?: Quality | null;
  isTier?: boolean;
```

(import `Quality`). `replaceSeason` inserts the rows as they are, so the new columns fill.

`item-catalog.ts`:

```ts
import { eq, inArray } from 'drizzle-orm';
import type { Db } from '../client';
import { dungeonLoot, itemCatalog } from '../schema';
import type { CatalogItem } from '../../types';
import { withWriteLock } from './write-lock';

const fromCatalog = (r: typeof itemCatalog.$inferSelect): CatalogItem =>
  ({ itemId: r.itemId, name: r.name, inventoryType: r.inventoryType, armorType: r.armorType, quality: r.quality, isTier: r.isTier });

const fromLoot = (r: typeof dungeonLoot.$inferSelect): CatalogItem =>
  ({ itemId: r.itemId, name: r.itemName, inventoryType: r.inventoryType, armorType: r.armorType, quality: r.quality, isTier: r.isTier });

export async function getCatalogItems(db: Db, ids: number[]): Promise<Map<number, CatalogItem>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(itemCatalog).where(inArray(itemCatalog.itemId, ids));
  return new Map(rows.map((r) => [r.itemId, fromCatalog(r)]));
}

export async function upsertCatalogItem(db: Db, item: CatalogItem, now: number) {
  const values = { ...item, fetchedAt: now };
  await withWriteLock(db, () => db.insert(itemCatalog).values(values)
    .onConflictDoUpdate({ target: itemCatalog.itemId, set: values }));
}

export async function findLocalItem(db: Db, itemId: number): Promise<CatalogItem | null> {
  const cataloged = await db.select().from(itemCatalog).where(eq(itemCatalog.itemId, itemId)).get();
  if (cataloged) return fromCatalog(cataloged);
  // A row without an inventory type predates season.v4 or lost its details: not complete enough to trust.
  const loot = await db.select().from(dungeonLoot).where(eq(dungeonLoot.itemId, itemId)).get();
  return loot && loot.inventoryType !== null ? fromLoot(loot) : null;
}

// ponytail: loads the whole catalog and season loot per search (a few hundred rows); index by name if it grows.
export async function searchLocalItems(db: Db, query: string): Promise<CatalogItem[]> {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return [];
  const byId = new Map<number, CatalogItem>();
  for (const r of await db.select().from(itemCatalog)) byId.set(r.itemId, fromCatalog(r));
  for (const r of await db.select().from(dungeonLoot)) if (!byId.has(r.itemId)) byId.set(r.itemId, fromLoot(r));
  return [...byId.values()]
    .filter((i) => String(i.itemId) === q || i.name.toLocaleLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
}
```

`specs.ts`:

```ts
import { asc, eq } from 'drizzle-orm';
import type { Db } from '../client';
import { specs } from '../schema';
import { withWriteLock } from './write-lock';

export interface SpecRow { methodSlug: string; classId: number; className: string; specName: string }

const toRow = (r: typeof specs.$inferSelect): SpecRow => ({ methodSlug: r.methodSlug, classId: r.classId, className: r.className, specName: r.specName });

export async function replaceSpecs(db: Db, rows: SpecRow[], now: number) {
  await withWriteLock(db, () => db.transaction(async (tx) => {
    await tx.delete(specs);
    if (rows.length > 0) await tx.insert(specs).values(rows.map((r) => ({ ...r, fetchedAt: now })));
  }));
}

export async function listSpecs(db: Db): Promise<SpecRow[]> {
  return (await db.select().from(specs).orderBy(asc(specs.className), asc(specs.specName))).map(toRow);
}

export async function getSpec(db: Db, methodSlug: string): Promise<SpecRow | null> {
  const row = await db.select().from(specs).where(eq(specs.methodSlug, methodSlug)).get();
  return row ? toRow(row) : null;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/core/db/queries/item-catalog.test.ts src/core/db/queries/specs.test.ts src/core/db/queries/season.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/db/queries/item-catalog.ts src/core/db/queries/item-catalog.test.ts src/core/db/queries/specs.ts src/core/db/queries/specs.test.ts src/core/db/queries/season.ts
git commit -m "feat: add item and spec catalog queries"
```

---

### Task 4: Overlay logic in src/core/bis

**Files:**
- Create: `src/core/bis/slot-keys.ts`, `src/core/bis/overlay.ts`, `src/core/bis/class-can-use.ts`, `src/core/bis/item-input.ts`
- Modify: `src/core/priority/slots.ts` (add `TIER_SLOTS`), `src/core/types.ts` (`BisItemRow.edited`)
- Test: `src/core/bis/slot-keys.test.ts`, `src/core/bis/overlay.test.ts`, `src/core/bis/class-can-use.test.ts`, `src/core/bis/item-input.test.ts`

**Interfaces:**
- Consumes: `BisOverride`, `CatalogItem` (Task 1); `ARMOR_SLOTS`, `armorTypeForClass`, `slotsForInventoryType`.
- Produces:
  ```ts
  export function slotKeys(rows: BisRow[]): string[];
  export interface Overlaid { rows: BisRow[]; editedCount: number; orphans: BisOverride[] }
  export function applyOverrides(rows: BisRow[], overrides: BisOverride[], catalog: ReadonlyMap<number, CatalogItem>): Overlaid;
  export type CanUse = { ok: true } | { ok: false; reason: string };
  export function classCanUse(item: Pick<CatalogItem, 'inventoryType' | 'armorType'>, className: string, row: Pick<BisRow, 'slotLabel' | 'slots'>): CanUse;
  export function canCatalyst(item: Pick<CatalogItem, 'isTier'>, slots: readonly SlotType[]): boolean;
  export function parseItemInput(input: string): number | null;
  export const TIER_SLOTS: ReadonlySet<SlotType>; // in priority/slots.ts
  ```
- `BisItemRow` gains `edited?: { methodPick: BisRow }`.

- [ ] **Step 1: Write the failing tests**

`slot-keys.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { BisRow } from '../types';
import { slotKeys } from './slot-keys';

const row = (slotLabel: string): BisRow => ({ kind: 'any', slotLabel, slots: [], minItemLevel: 1, source: '' });

describe('slotKeys', () => {
  it('numbers repeated labels in list order', () => {
    expect(slotKeys([row('Head'), row('Ring'), row('Trinket'), row('Ring')])).toEqual(['Head#1', 'Ring#1', 'Trinket#1', 'Ring#2']);
  });
});
```

`overlay.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { BisRow, CatalogItem } from '../types';
import { applyOverrides } from './overlay';

const head: BisRow = { kind: 'item', slotLabel: 'Head', slots: ['HEAD'], itemId: 10, name: 'Method Crown', bonusIds: [1], isTier: true, isCatalyst: false, source: 'Raid' };
const ring1: BisRow = { kind: 'item', slotLabel: 'Ring', slots: ['FINGER_1', 'FINGER_2'], itemId: 20, name: 'Band A', bonusIds: [], isTier: false, isCatalyst: false, source: 'Alpha Hollow' };
const ring2: BisRow = { ...ring1, itemId: 21, name: 'Band B' };
const catalog = new Map<number, CatalogItem>([
  [30, { itemId: 30, name: 'Birkibjörn Band', inventoryType: 'FINGER', armorType: null, quality: 'EPIC', isTier: false }],
  [31, { itemId: 31, name: 'Woven Hood', inventoryType: 'HEAD', armorType: 'cloth', quality: 'EPIC', isTier: false }],
  [32, { itemId: 32, name: 'Frostbound Crown', inventoryType: 'HEAD', armorType: 'cloth', quality: 'EPIC', isTier: true }],
]);

describe('applyOverrides', () => {
  it('replaces the keyed row and keeps the rest', () => {
    const out = applyOverrides([head, ring1, ring2], [{ slotKey: 'Ring#2', itemId: 30, catalyst: false }], catalog);
    expect(out.editedCount).toBe(1);
    expect(out.orphans).toEqual([]);
    expect(out.rows[0]).toBe(head);
    expect(out.rows[1]).toBe(ring1);
    expect(out.rows[2]).toEqual({ kind: 'item', slotLabel: 'Ring', slots: ['FINGER_1', 'FINGER_2'], itemId: 30, name: 'Birkibjörn Band',
      bonusIds: [], isTier: false, isCatalyst: false, source: 'Alpha Hollow', edited: { methodPick: ring2 } });
  });

  it('takes tier identity from the catalog', () => {
    const out = applyOverrides([head], [{ slotKey: 'Head#1', itemId: 32, catalyst: false }], catalog);
    expect(out.rows[0]).toMatchObject({ itemId: 32, isTier: true, isCatalyst: false });
  });

  it('makes a catalyst override a tier row on its base item', () => {
    const out = applyOverrides([head], [{ slotKey: 'Head#1', itemId: 31, catalyst: true }], catalog);
    expect(out.rows[0]).toMatchObject({ itemId: 31, name: 'Woven Hood', isTier: true, isCatalyst: true });
  });

  it('returns overrides for missing slots or uncataloged items as orphans', () => {
    const gone = { slotKey: 'Rings#1', itemId: 30, catalyst: false };
    const uncataloged = { slotKey: 'Head#1', itemId: 999, catalyst: false };
    const out = applyOverrides([head], [gone, uncataloged], catalog);
    expect(out.rows).toEqual([head]);
    expect(out.editedCount).toBe(0);
    expect(out.orphans).toEqual([gone, uncataloged]);
  });
});
```

`class-can-use.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { canCatalyst, classCanUse } from './class-can-use';

const chestRow = { slotLabel: 'Chest', slots: ['CHEST' as const] };
const backRow = { slotLabel: 'Back', slots: ['BACK' as const] };
const ringRow = { slotLabel: 'Ring', slots: ['FINGER_1' as const, 'FINGER_2' as const] };

describe('classCanUse', () => {
  it('rejects a cloth chest for a Warrior', () => {
    expect(classCanUse({ inventoryType: 'ROBE', armorType: 'cloth' }, 'Warrior', chestRow)).toEqual({ ok: false, reason: "Warrior can't wear cloth." });
  });

  it('accepts a cloth cloak for a Warrior', () => {
    expect(classCanUse({ inventoryType: 'CLOAK', armorType: 'cloth' }, 'Warrior', backRow)).toEqual({ ok: true });
  });

  it('rejects an item for another slot', () => {
    expect(classCanUse({ inventoryType: 'FINGER', armorType: null }, 'Mage', chestRow)).toEqual({ ok: false, reason: "That item doesn't fit the Chest slot." });
  });

  it('accepts non-armor items in their slot', () => {
    expect(classCanUse({ inventoryType: 'FINGER', armorType: null }, 'Mage', ringRow)).toEqual({ ok: true });
  });
});

describe('canCatalyst', () => {
  it('allows a regular item in a tier slot only', () => {
    expect(canCatalyst({ isTier: false }, ['CHEST'])).toBe(true);
    expect(canCatalyst({ isTier: true }, ['CHEST'])).toBe(false);
    expect(canCatalyst({ isTier: false }, ['FINGER_1', 'FINGER_2'])).toBe(false);
  });
});
```

`item-input.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseItemInput } from './item-input';

describe('parseItemInput', () => {
  it('reads bare IDs and Wowhead links', () => {
    expect(parseItemInput(' 212401 ')).toBe(212401);
    expect(parseItemInput('https://www.wowhead.com/item=212401/some-name')).toBe(212401);
    expect(parseItemInput('https://www.wowhead.com/de/item=212401/some-name?bonus=1')).toBe(212401);
  });

  it('rejects anything else', () => {
    expect(parseItemInput('Frost crown')).toBeNull();
    expect(parseItemInput('0')).toBeNull();
    expect(parseItemInput('https://www.wowhead.com/spell=1')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/core/bis`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/core/priority/slots.ts`, after `ARMOR_SLOTS`:

```ts
/** Slots the catalyst turns into set pieces. */
export const TIER_SLOTS: ReadonlySet<SlotType> = new Set<SlotType>(['HEAD', 'SHOULDER', 'CHEST', 'HANDS', 'LEGS']);
```

`src/core/types.ts`: change `BisItemRow` to

```ts
export interface BisItemRow extends BisRowBase {
  kind: 'item'; itemId: number; name: string; bonusIds: number[]; isTier: boolean; isCatalyst: boolean;
  /** Set when an account override replaced Method's row; holds Method's row for display. */
  edited?: { methodPick: BisRow };
}
```

`slot-keys.ts`:

```ts
import type { BisRow } from '../types';

/** Names each row `<slotLabel>#<n>`, counting rows with the same label in list order. Overrides key on it. */
export function slotKeys(rows: BisRow[]): string[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const n = (seen.get(r.slotLabel) ?? 0) + 1;
    seen.set(r.slotLabel, n);
    return `${r.slotLabel}#${n}`;
  });
}
```

`overlay.ts`:

```ts
import type { BisOverride, BisRow, CatalogItem } from '../types';
import { slotKeys } from './slot-keys';

export interface Overlaid { rows: BisRow[]; editedCount: number; orphans: BisOverride[] }

/** Method's rows with an account's overrides applied. Overrides that no longer fit a row are returned, not applied. */
export function applyOverrides(rows: BisRow[], overrides: BisOverride[], catalog: ReadonlyMap<number, CatalogItem>): Overlaid {
  const keys = slotKeys(rows);
  const usable = new Map(overrides.filter((o) => keys.includes(o.slotKey) && catalog.has(o.itemId)).map((o) => [o.slotKey, o]));
  const out = rows.map((row, i): BisRow => {
    const o = usable.get(keys[i]!);
    if (!o) return row;
    const item = catalog.get(o.itemId)!;
    return {
      kind: 'item', slotLabel: row.slotLabel, slots: row.slots, source: row.source,
      itemId: item.itemId, name: item.name, bonusIds: [],
      // A catalyst override reads like Method's catalyst base: any tier piece fills it, stats from the base.
      isTier: o.catalyst || item.isTier, isCatalyst: o.catalyst,
      edited: { methodPick: row },
    };
  });
  return { rows: out, editedCount: usable.size, orphans: overrides.filter((o) => usable.get(o.slotKey) !== o) };
}
```

`class-can-use.ts`:

```ts
import { ARMOR_SLOTS, TIER_SLOTS, armorTypeForClass, slotsForInventoryType } from '../priority/slots';
import type { BisRow, CatalogItem, SlotType } from '../types';

export type CanUse = { ok: true } | { ok: false; reason: string };

/** Whether a class can use an item in a row's slots. Armor type counts only in armor slots, so cloaks fit everyone. */
export function classCanUse(item: Pick<CatalogItem, 'inventoryType' | 'armorType'>, className: string, row: Pick<BisRow, 'slotLabel' | 'slots'>): CanUse {
  if (!slotsForInventoryType(item.inventoryType).some((s) => row.slots.includes(s))) {
    return { ok: false, reason: `That item doesn't fit the ${row.slotLabel} slot.` };
  }
  const armorSlot = row.slots.some((s) => ARMOR_SLOTS.has(s));
  if (armorSlot && item.armorType !== null && item.armorType !== armorTypeForClass(className)) {
    return { ok: false, reason: `${className} can't wear ${item.armorType}.` };
  }
  return { ok: true };
}

export const canCatalyst = (item: Pick<CatalogItem, 'isTier'>, slots: readonly SlotType[]): boolean =>
  !item.isTier && slots.some((s) => TIER_SLOTS.has(s));
```

`item-input.ts`:

```ts
/** An item ID from a bare number or a Wowhead item link, or null. */
export function parseItemInput(input: string): number | null {
  const text = input.trim();
  const match = /^(\d+)$/.exec(text) ?? /wowhead\.com\/(?:[a-z-]+\/)?item=(\d+)/i.exec(text);
  const id = match ? Number(match[1]) : NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/core/bis && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/bis src/core/priority/slots.ts src/core/types.ts
git commit -m "feat: overlay account overrides on method rows"
```

---

### Task 5: Item names from Blizzard, quality and tier in season loot

**Files:**
- Modify: `src/core/blizzard/parse.ts` (`RawItem`, `parseItemInfo`), `src/core/blizzard/types.ts` (`ItemInfo`)
- Modify: `src/core/sync/season-sync.ts` (store quality and tier; `SEASON_META_KEY = 'season.v4'`)
- Test: `src/core/blizzard/parse.test.ts`, `src/core/sync/season-sync.test.ts`

**Interfaces:**
- Produces: `ItemInfo.name: string | null`; season loot rows with `quality` and `isTier`.

- [ ] **Step 1: Write the failing tests**

In `parse.test.ts`, `describe('parseItemInfo')`, add:

```ts
  it('keeps the item name', () => {
    expect(parseItemInfo({ name: 'Björnsdóttir Robe', quality: { type: 'EPIC' } }).name).toBe('Björnsdóttir Robe');
    expect(parseItemInfo({}).name).toBeNull();
  });
```

Update the existing `toEqual` expectations in that describe block to include `name: null` (or the fixture's name where it has one).

In `season-sync.test.ts`, find the test that checks stored loot (search `secondaryStats`), make its fake `getItemDetails` return `quality: 'EPIC', isTier: true` for one item, and add:

```ts
    expect(loot[0]).toMatchObject({ quality: 'EPIC', isTier: true });
```

Also assert `SEASON_META_KEY` is `'season.v4'` where the file already uses it, so a stale key fails.

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/core/blizzard/parse.test.ts src/core/sync/season-sync.test.ts`
Expected: FAIL on `name` and on `quality`.

- [ ] **Step 3: Implement**

`types.ts`: `export interface ItemInfo extends ItemDetails { name: string | null; inventoryType: string | null; armorType: ArmorType | null; secondaryStats: string[] | null }`.

`parse.ts`: add `name?: string;` to `RawItem` and `name: raw.name ?? null,` to `parseItemInfo`'s result.

`season-sync.ts`: set `export const SEASON_META_KEY = 'season.v4';` and in `loadSeasonLoot`'s loot mapping add:

```ts
      quality: infos.get(item.itemId)?.quality ?? null,
      isTier: infos.get(item.itemId)?.isTier ?? false,
```

Fix any other `ItemInfo` literals the compiler flags (fakes in tests) by adding `name: null`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/core/blizzard src/core/sync && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/blizzard src/core/sync/season-sync.ts src/core/sync/season-sync.test.ts
git commit -m "feat: keep item names and loot quality for search"
```

---

### Task 6: Compared list for any list type, and the stats switch in gear and ranking

**Files:**
- Modify: `src/core/priority/list.ts`, `src/core/gear/evaluate.ts`, `src/core/priority/rank.ts`
- Modify: `src/components/character-page/credit-detail.ts`, `src/components/group-priority/chip-label.ts` (new fit `any`)
- Test: `src/core/priority/priority.test.ts`, `src/core/gear/evaluate.test.ts`, the two label helpers' tests

**Interfaces:**
- Produces:
  ```ts
  export function choosePriorityList(lists: BisLists | null, chosen: ListType): { listType: ListType; fellBack: boolean };
  // evaluateGear Input gains: statsMatter?: boolean  (default true)
  // PriorityCharacter gains: statsMatter: boolean
  export type TierFit = 'bis' | 'unverified' | 'alternative' | 'any';
  ```
- `PriorityListType` is removed; callers use `ListType`.

- [ ] **Step 1: Write the failing tests**

`priority.test.ts` (or the file that already tests `choosePriorityList`; search for it):

```ts
describe('choosePriorityList', () => {
  const row = { kind: 'any', slotLabel: 'Neck', slots: ['NECK'], minItemLevel: 1, source: '' } as const;
  const lists = { overall: [row], raid: [], mythicPlus: [] };
  it('falls back to Overall from an empty Raid or Mythic+ list', () => {
    expect(choosePriorityList(lists, 'raid')).toEqual({ listType: 'overall', fellBack: true });
    expect(choosePriorityList(lists, 'mythicPlus')).toEqual({ listType: 'overall', fellBack: true });
  });
  it('never falls back from Overall', () => {
    expect(choosePriorityList({ overall: [], raid: [row], mythicPlus: [] }, 'overall')).toEqual({ listType: 'overall', fellBack: false });
  });
});
```

`evaluate.test.ts`:

```ts
describe('statsMatter', () => {
  const crown = { kind: 'item', slotLabel: 'Head', slots: ['HEAD'], itemId: 10, name: 'Crown', bonusIds: [], isTier: true, isCatalyst: false, source: '' } as const;
  const targets = new Map([[10, { secondaryStats: ['haste', 'mastery'], isTier: true }]]);
  const tracks = new Map([
    [7, { bonusId: 7, name: 'Myth', step: 3, max: 6, group: 1, currencyId: null, currencyName: null, costPerStep: null }],
    [8, { bonusId: 8, name: 'Myth', step: 6, max: 6, group: 1, currencyId: null, currencyName: null, costPerStep: null }],
  ]);
  const piece = (bonus: number) => ({ slot: 'HEAD' as const, itemId: 11, name: 'Crown', itemLevel: 700, quality: 'EPIC' as const, bonusIds: [bonus], isTier: true, secondaryStats: ['crit', 'versatility'] });

  it('keeps Wrong stats by default', () => {
    expect(evaluateGear({ equipped: [piece(8)], bisRows: [crown], tracks, targets })[0]!.state).toBe('wrongStats');
  });
  it('falls through to the track state when stats do not matter', () => {
    expect(evaluateGear({ equipped: [piece(7)], bisRows: [crown], tracks, targets, statsMatter: false })[0]!.state).toBe('mythUpgradable');
    expect(evaluateGear({ equipped: [piece(8)], bisRows: [crown], tracks, targets, statsMatter: false })[0]!.state).toBe('done');
  });
});
```

`priority.test.ts`, near the existing tier credit tests (search `alternative`): copy the test that produces an `alternative` credit, set the character's `statsMatter: false`, and expect the credit `fit: 'any'` with the full need weight (not `need.weight - 1`). Set `statsMatter: true` in the file's existing character fixtures.

Label helpers: in the tests for `credit-detail.ts` and `chip-label.ts`, add a credit with `fit: 'any'` and expect the detail `catalyst into tier` and the chip `<head>, catalyst into tier`, matching how the file builds `head`.

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/core/priority src/core/gear src/components/character-page src/components/group-priority`
Expected: FAIL.

- [ ] **Step 3: Implement**

`list.ts`:

```ts
import type { BisLists, ListType } from '../types';

/** The list that drives priority: the spec's choice, or Overall when Method has no rows for the chosen list. */
export function choosePriorityList(lists: BisLists | null, chosen: ListType): { listType: ListType; fellBack: boolean } {
  if (chosen !== 'overall' && lists && lists[chosen].length === 0 && lists.overall.length > 0) {
    return { listType: 'overall', fellBack: true };
  }
  return { listType: chosen, fellBack: false };
}
```

Replace `PriorityListType` imports with `ListType` from `@/core/types` wherever the compiler flags them.

`evaluate.ts`: add `statsMatter?: boolean;` to `Input`, destructure `statsMatter = true`, and pass it to `stateFor`. In `stateFor`, change the wrong-stats line to:

```ts
  if (statsMatter && stats === 'different') return 'wrongStats';
```

`rank.ts`:
- `PriorityCharacter` gains `/** False when the spec ignores tier stats: any tier piece in the slot will do. */ statsMatter: boolean;`
- `TierFit` gains `'any'`.
- `tierCredit` takes `statsMatter: boolean` as a last parameter. At its start:

```ts
  if (!statsMatter) {
    const drop = dungeon.loot.filter((l) => fitsSlot(row, armor, l)).sort((a, b) => Number(b.itemId === row.itemId) - Number(a.itemId === row.itemId) || a.itemId - b.itemId)[0];
    return drop ? { kind: 'tier', slotLabel: row.slotLabel, weight: need.weight, fit: 'any', itemId: drop.itemId, name: drop.name, bonusIds: [],
      dropStats: drop.secondaryStats ?? null, targetName: row.name, targetStats: null } : null;
  }
```

- The call in `rankDungeons` passes `character.statsMatter`.

`credit-detail.ts`: before the existing `unverified` branch, `credit.fit === 'any' ? 'catalyst into tier' :`. `chip-label.ts`: `if (credit.fit === 'any') return \`${head}, catalyst into tier\`;` before the `unverified` line. Read both files first and keep their existing shape.

`member.ts` `priorityCharacter`: add `statsMatter: m.bis.statsMatter` — `SpecBis.statsMatter` arrives in Task 8; until then pass `statsMatter: true` and leave a note in the commit body. Fix other `PriorityCharacter` literals in tests with `statsMatter: true`.

- [ ] **Step 4: Run the tests**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src/core src/components src/server
git commit -m "feat: let any list drive priority and switch off stat checks"
```

---

### Task 7: Tier targets for override items, and the spec catalog sync

**Files:**
- Modify: `src/core/sync/reference-sync.ts` (`TierScope.extraItemIds`, new `syncSpecs`)
- Modify: `src/core/sync/reference-run.ts`
- Test: `src/core/sync/reference-sync.test.ts`, `src/core/sync/reference-run.test.ts`

**Interfaces:**
- Consumes: `overrideTierItemIds` (Task 2), `replaceSpecs`, `listSpecs` (Task 3), `methodSpecSlug`.
- Produces:
  ```ts
  export interface TierScope { region: Region; specSlug: string; lists: BisLists | null; extraItemIds?: number[] }
  /** Refreshes the spec catalog when a day old. Keeps old rows on failure; never throws for an upstream failure. */
  export function syncSpecs(deps: { db: Db; blizzard: BlizzardClient; now: number }, region: Region): Promise<boolean>;
  ```

- [ ] **Step 1: Write the failing tests**

`reference-sync.test.ts`, in `describe('readTierTargets and syncTierTargets')`, add (reuse the file's `blizzard` fake and `scope` helper; read them first):

```ts
  it('covers extra item IDs beside the lists', async () => {
    const db = await openTestDb();
    const extra = { ...scope([]), extraItemIds: [77] };
    expect((await readTierTargets(db, extra, 1)).due).toBe(true);
    expect(await syncTierTargets({ db, blizzard, now: 1 }, extra)).toBe(true);
    expect([...(await readTierTargets(db, extra, 2)).targets.keys()]).toEqual([77]);
  });
```

Add `describe('syncSpecs')`:

```ts
describe('syncSpecs', () => {
  const classes = async () => [{ id: 8, name: 'Mage', specs: ['Arcane', 'Fire', 'Frost'] }];
  it('stores one row per spec with its Method slug, then waits a day', async () => {
    const db = await openTestDb();
    const blizzard = { getClasses: classes } as unknown as BlizzardClient;
    expect(await syncSpecs({ db, blizzard, now: 1 }, 'eu')).toBe(true);
    expect((await listSpecs(db)).map((s) => s.methodSlug)).toEqual(['arcane-mage', 'fire-mage', 'frost-mage']);
    expect(await syncSpecs({ db, blizzard, now: 2 }, 'eu')).toBe(false);
  });
  it('keeps old rows when Blizzard fails', async () => {
    const db = await openTestDb();
    await syncSpecs({ db, blizzard: { getClasses: classes } as unknown as BlizzardClient, now: 1 }, 'eu');
    const failing = { getClasses: async () => { throw new Error('down'); } } as unknown as BlizzardClient;
    expect(await syncSpecs({ db, blizzard: failing, now: 1 + DAY_MS }, 'eu')).toBe(true);
    expect(await listSpecs(db)).toHaveLength(3);
  });
});
```

`reference-run.test.ts`: add a test that seeds a tracked Frost Mage (Birkibjörn), Method lists with no tier rows, a catalog row for item 301 and a catalyst override `{ slotKey: 'Head#1', itemId: 301, catalyst: true }` for `frost-mage`, runs `syncReference`, and expects the fake `getItemDetails` to have been asked for 301 and `readTierTargets(db, { region: 'eu', specSlug: 'frost-mage', lists, extraItemIds: [301] }, now)` to return a target for 301. Also expect `listSpecs(db)` non-empty after the pass (give the fake `getClasses`).

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/core/sync`
Expected: FAIL.

- [ ] **Step 3: Implement**

`reference-sync.ts`:

```ts
export interface TierScope { region: Region; specSlug: string; lists: BisLists | null; extraItemIds?: number[] }
```

In `tierState`: `const ids = [...new Set([...tierItemIds(scope.lists), ...(scope.extraItemIds ?? [])])];`

Add, near the other sync helpers:

```ts
const SPECS_META_KEY = 'specs.fetchedAt';
const SPECS_FAILED_META_KEY = 'specs.failedAt';

export async function syncSpecs(deps: { db: Db; blizzard: BlizzardClient; now: number }, region: Region): Promise<boolean> {
  const { db, blizzard, now } = deps;
  const fetchedAt = await getMeta(db, SPECS_META_KEY);
  const failed = await getMeta(db, SPECS_FAILED_META_KEY);
  if (!timing(fetchedAt?.updatedAt ?? null, failed, now).due) return false;
  try {
    const classes = await blizzard.getClasses(region);
    const rows = classes.flatMap((c) => c.specs.map((specName) => ({ methodSlug: methodSpecSlug(specName, c.name), classId: c.id, className: c.name, specName })));
    if (rows.length === 0) throw new Error('No specs in the class index');
    await replaceSpecs(db, rows, now);
    await setMeta(db, SPECS_META_KEY, String(now), now);
  } catch {
    await setMeta(db, SPECS_FAILED_META_KEY, String(now), now);
  }
  return true;
}
```

(import `replaceSpecs` from `../db/queries/specs` and `methodSpecSlug` from `../method/method`.)

`reference-run.ts` `runPass`, after `syncTracks`:

```ts
  const characters = await listCharacters(db);
  if (characters[0] && await syncSpecs({ db, blizzard, now }, characters[0].region)) requested = true;
```

and reuse `characters` in the spec loop instead of calling `listCharacters` again. In the region loop:

```ts
    const extraItemIds = await overrideTierItemIds(db, specSlug);
    for (const region of regions) {
      if (await syncTierTargets({ db, blizzard, now }, { region, specSlug, lists, extraItemIds })) requested = true;
    }
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/core/sync && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/sync
git commit -m "feat: sync spec catalog and stats for override tier items"
```

---

### Task 8: Effective lists through bisFor

**Files:**
- Modify: `src/server/views/bis-lookup.ts`
- Test: `src/server/views/bis-lookup.test.ts`

**Interfaces:**
- Consumes: `getSpecSettings`, `listOverrides` (Task 2), `getCatalogItems` (Task 3), `applyOverrides` (Task 4), `TierScope` (Task 7).
- Produces:
  ```ts
  export interface SpecBis extends BisRead {
    targets: ReadonlyMap<number, TierTarget>;
    targetsDue: boolean;
    dueKeys: string[];
    listType: ListType;
    statsMatter: boolean;
    editedCount: number;
    orphans: Record<ListType, BisOverride[]>;
  }
  export function createBisLookup(db: Db, time: number, accountId: number): (slug: string, region: Region) => Promise<SpecBis>;
  ```
  `SpecBis.lists` holds the overlaid lists.

- [ ] **Step 1: Write the failing tests**

In `bis-lookup.test.ts` (read its setup first; reuse its lists seeding):

```ts
describe('overrides', () => {
  it('returns overlaid lists, settings, counts and orphans for the account', async () => {
    const db = await openTestDb();
    await replaceBisLists(db, 'frost-mage', lists, 1);
    await upsertCatalogItem(db, { itemId: 30, name: 'Birkibjörn Band', inventoryType: 'FINGER', armorType: null, quality: 'EPIC', isTier: false }, 1);
    await upsertOverride(db, 1, 'frost-mage', 'mythicPlus', { slotKey: 'Neck#1', itemId: 30, catalyst: false });
    await upsertOverride(db, 1, 'frost-mage', 'mythicPlus', { slotKey: 'Gone#1', itemId: 30, catalyst: false });
    await updateSpecSettings(db, 1, 'frost-mage', { listType: 'raid', statsMatter: false });
    const bis = await createBisLookup(db, 2, 1)('frost-mage', 'eu');
    expect(bis).toMatchObject({ listType: 'raid', statsMatter: false, editedCount: 1 });
    expect(bis.orphans.mythicPlus).toEqual([{ slotKey: 'Gone#1', itemId: 30, catalyst: false }]);
    expect(bis.lists!.mythicPlus.find((r) => r.slotLabel === 'Neck')).toMatchObject({ itemId: 30, edited: expect.anything() });
    expect((await createBisLookup(db, 2, 2)('frost-mage', 'eu')).editedCount).toBe(0);
  });

  it('reports tier targets due for a catalyst override with no stats', async () => {
    const db = await openTestDb();
    await replaceBisLists(db, 'frost-mage', lists, 1);
    await upsertCatalogItem(db, { itemId: 31, name: 'Woven Hood', inventoryType: 'HEAD', armorType: 'cloth', quality: 'EPIC', isTier: false }, 1);
    await upsertOverride(db, 1, 'frost-mage', 'mythicPlus', { slotKey: 'Head#1', itemId: 31, catalyst: true });
    const bis = await createBisLookup(db, 2, 1)('frost-mage', 'eu');
    expect(bis.targetsDue).toBe(true);
  });
});
```

Make `lists` in the test contain a Head row and a Neck row in `mythicPlus` (adapt the existing fixture). For the second account, insert `accounts` id 2 first.

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/server/views/bis-lookup.test.ts`
Expected: FAIL on the new signature.

- [ ] **Step 3: Implement**

```ts
export function createBisLookup(db: Db, time: number, accountId: number) {
  const lists = new Map<string, Promise<BisRead & Overlay>>();
  const lookups = new Map<string, Promise<SpecBis>>();
  return (slug: string, region: Region): Promise<SpecBis> => {
    if (!lists.has(slug)) lists.set(slug, readEffective(db, slug, time, accountId));
    const key = `${region}:${slug}`;
    if (!lookups.has(key)) {
      lookups.set(key, (async () => {
        const bis = await lists.get(slug)!;
        const { targets, due: targetsDue } = await readTierTargets(db, { region, specSlug: slug, lists: bis.lists }, time);
        const dueKeys = [...(bis.due ? [`bis:${slug}`] : []), ...(targetsDue ? [`tiers:${key}`] : [])];
        return { ...bis, targets, targetsDue, dueKeys };
      })());
    }
    return lookups.get(key)!;
  };
}

interface Overlay { listType: ListType; statsMatter: boolean; editedCount: number; orphans: Record<ListType, BisOverride[]> }

/** Method's cached lists with the account's overrides and settings. Database reads only, in sequence. */
async function readEffective(db: Db, slug: string, time: number, accountId: number): Promise<BisRead & Overlay> {
  const read = await readBisLists(db, slug, time);
  const settings = await getSpecSettings(db, accountId, slug);
  const overrides = await listOverrides(db, accountId, slug);
  const catalog = await getCatalogItems(db, LIST_TYPES.flatMap((l) => overrides[l].map((o) => o.itemId)));
  const orphans: Record<ListType, BisOverride[]> = { overall: [], raid: [], mythicPlus: [] };
  if (!read.lists) return { ...read, ...settings, editedCount: 0, orphans };
  const effective = { ...read.lists };
  let editedCount = 0;
  for (const l of LIST_TYPES) {
    const out = applyOverrides(read.lists[l], overrides[l], catalog);
    effective[l] = out.rows;
    editedCount += out.editedCount;
    orphans[l] = out.orphans;
  }
  return { ...read, lists: effective, ...settings, editedCount, orphans };
}
```

Extend `SpecBis` with `Overlay`'s fields as in the Interfaces block.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/server/views/bis-lookup.test.ts`
Expected: PASS. The three loaders fail to compile until Task 9; that is expected inside this task only if you run `typecheck` now — don't commit yet.

- [ ] **Step 5: Pass the account at the three call sites**

`character-cards.ts`, `character-page.ts`, `group-page.ts`: `createBisLookup(db, time, services.currentAccountId())`. In `member.ts` `priorityCharacter`, replace the Task 6 placeholder with `statsMatter: m.bis.statsMatter`, and pass `statsMatter: bis.statsMatter` into `evaluateGear` in `loadMember`'s `evaluate`.

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/views
git commit -m "feat: apply account overrides wherever bis lists load"
```

---

### Task 9: Compared list from settings; remove per-character list choice

**Files:**
- Modify: `src/core/db/schema.ts` (drop `characters.priorityList`), new migration `drop-priority-list`
- Modify: `src/server/views/member.ts`, `character-page.ts`, `character-cards.ts`, `group-page.ts`, `summarize.ts`, `types.ts`
- Modify: `src/app/characters/[region]/[realm]/[name]/page.tsx`, `src/app/api/characters/[id]/route.ts`
- Modify: `src/components/character-settings/CharacterSettings.tsx`, `src/components/character-card/CharacterCard.tsx`, `src/components/group-grid/MemberHeader.tsx`
- Delete: `src/components/character-page/ListTabs.tsx`, `src/components/list-switch/` (whole directory), and `LIST_LOADING` from `src/components/shared/loading-copy.ts` if nothing else uses it
- Test: `src/server/views/views.test.ts`, `src/server/views/group-page.test.ts`, `src/components/group-grid/member-notices.test.ts`, `src/components/character-card/CharacterCard.test.ts`

**Interfaces:**
- Consumes: `SpecBis.listType` (Task 8).
- Produces: `getCharacterPage(services, key)` (no `listType` argument); `CharacterPageView.listType: ListType` from settings, `counts` removed; `CharacterCardView.listType: ListType`; `GroupMemberView.listType: ListType`; `CharacterSummary.priorityList` removed.

- [ ] **Step 1: Write the failing tests**

`views.test.ts`:

```ts
  it('compares against the spec\'s list from settings', async () => {
    const s = await services({ ...lists, overall: lists.mythicPlus.slice(1) });
    await seed(s);
    await prime(s);
    await updateSpecSettings(s.db, 1, 'guardian-druid', { listType: 'overall' });
    const page = await birkiPage(s);
    expect(page.listType).toBe('overall');
    expect(page.rows).toHaveLength(1);
    const { cards } = await getCharacterCards(s);
    expect(cards[0]).toMatchObject({ listType: 'overall' });
  });

  it('applies an override for every character of the spec', async () => {
    const s = await services();
    await seed(s);
    await prime(s);
    await upsertCatalogItem(s.db, { itemId: 21, name: 'Other Neck', inventoryType: 'NECK', armorType: null, quality: 'EPIC', isTier: false }, 1);
    await upsertOverride(s.db, 1, 'guardian-druid', 'mythicPlus', { slotKey: 'Neck#1', itemId: 21, catalyst: false });
    const page = await birkiPage(s);
    expect(page.rows[1]!.bis).toMatchObject({ itemId: 21 });
    expect(page.rows[1]!.state).toBe('missing');
  });
```

Delete or rewrite tests that pass a `listType` argument to `getCharacterPage` or call `updateCharacter(..., { priorityList })`.

`group-page.test.ts`: seed two Guardian Druids (Birkibjörn and Hrafnhildur), one override as above, and expect both members' rows for Neck to show item 21 and the dungeon ranking to credit item 21 where a dungeon drops it (add it to the season loot fixture). This is Review Focus 2. Also a member with `listType: 'raid'` falling back: `fellBack: true`, `listType: 'overall'`.

`member-notices.test.ts` / MemberHeader: a member with `listType: 'raid'` shows "Raid list"; `overall` shows "Overall list"; `mythicPlus` shows nothing.

`CharacterCard.test.ts`: the list label reads from `card.listType` ('Raid BiS' for raid).

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/server src/components`
Expected: FAIL.

- [ ] **Step 3: Implement**

- `schema.ts`: delete the `priorityList` column from `characters`. Run `npm run db:generate -- --name drop-priority-list` and check the SQL rebuilds `characters` without losing rows (Drizzle's SQLite table rebuild copies them).
- `member.ts` `loadMember`: `const choice = choosePriorityList(bis.lists, bis.listType);`.
- `character-page.ts`: drop the `listType` parameter, `list` becomes `choice.listType`, `gearRows = member.priorityRows`, delete `counts` and `bisCount`, `listType: choice.listType`, `vaultChoicesFor(..., bis.lists?.[choice.listType] ?? [] ...)`. Add `editedCount: bis.editedCount` to the view (used in Task 13).
- `character-cards.ts`: `const { listType } = choosePriorityList(bis.lists, bis.listType); const bisRows = bis.lists?.[listType] ?? [];` pass `statsMatter: bis.statsMatter` to `evaluateGear`, and return `listType` on the card.
- `summarize.ts` and `types.ts`: remove `priorityList` from `CharacterSummary`; add `listType: ListType` to `CharacterCardView`; change `GroupMemberView.listType` to `ListType`; remove `counts` from `CharacterPageView`, add `editedCount: number`.
- `CharacterCard.tsx`: `const listName = \`${LIST_NAMES[card.listType]} BiS\`;` with `const LIST_NAMES: Record<ListType, string> = { overall: 'Overall', raid: 'Raid', mythicPlus: 'Mythic+' };` — put `LIST_NAMES` in `src/components/shared/list-names.ts` because the editor (Task 12) uses it too.
- `MemberHeader.tsx`: `{member.listType !== 'mythicPlus' && (<span ... title={member.fellBack ? 'Method has no list of that kind for this spec' : undefined}>{LIST_NAMES[member.listType]} list</span>)}`.
- `CharacterSettings.tsx`: remove the `priorityList` prop and the fieldset.
- `route.ts` (`PATCH /api/characters/[id]`): remove `priorityList` from the body type and the patch line.
- `page.tsx` (character): remove `searchParams`, `LIST_TYPES`/`ListType` imports, `ListSwitchProvider`, `ListTabs`, every `WhileListSettled` wrapper (render the children directly), and the `priorityList` prop.
- Delete `ListTabs.tsx` and `src/components/list-switch/`. Run `npx tsc --noEmit` and `grep -rn "LIST_LOADING\|list-switch\|ListTabs" src` to confirm nothing else uses them; remove `LIST_LOADING` if unused.

- [ ] **Step 4: Run the gate**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src drizzle
git commit -m "feat: take the compared list from spec settings"
```

Body: per-character choice not carried over; every spec starts on Mythic+.

---

### Task 10: Override actions

**Files:**
- Create: `src/core/bis/edits.ts`
- Test: `src/core/bis/edits.test.ts`

This is a sync-kind module: it combines the Blizzard client and the database, both passed in.

**Interfaces:**
- Consumes: Tasks 2–5.
- Produces:
  ```ts
  export interface EditDeps { db: Db; blizzard: BlizzardClient; now: number; accountId: number }
  export interface RowRef { specSlug: string; listType: ListType; slotKey: string }
  export interface ItemChoice extends CatalogItem { canUse: CanUse; canCatalyst: boolean }
  /** A spec's class, from the catalog or a tracked character; null when the slug is unknown. */
  export function classForSpec(db: Db, specSlug: string): Promise<string | null>;
  export function knownSpecSlug(db: Db, specSlug: string): Promise<boolean>;
  export function searchItems(db: Db, ref: RowRef, query: string): Promise<{ results: ItemChoice[]; unusable: ItemChoice | null }>;
  export function lookupItem(deps: EditDeps, ref: RowRef, input: string): Promise<ItemChoice>;
  export function saveOverride(deps: EditDeps, ref: RowRef, itemId: number, catalyst: boolean): Promise<void>;
  export function removeOverride(deps: EditDeps, ref: RowRef): Promise<void>;
  ```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { isUserError } from '../errors';
import type { BlizzardClient } from '../blizzard/client';
import type { ItemInfo } from '../blizzard/types';
import { replaceBisLists } from '../db/queries/bis-lists';
import { replaceSpecs } from '../db/queries/specs';
import { getCatalogItems } from '../db/queries/item-catalog';
import { listOverrides } from '../db/queries/bis-settings';
import { replaceSeason } from '../db/queries/season';
import type { BisLists } from '../types';
import { knownSpecSlug, lookupItem, removeOverride, saveOverride, searchItems } from './edits';

const lists: BisLists = {
  overall: [],
  raid: [],
  mythicPlus: [
    { kind: 'item', slotLabel: 'Chest', slots: ['CHEST'], itemId: 10, name: 'Method Robe', bonusIds: [], isTier: true, isCatalyst: false, source: 'Raid' },
    { kind: 'item', slotLabel: 'Ring', slots: ['FINGER_1', 'FINGER_2'], itemId: 20, name: 'Band', bonusIds: [], isTier: false, isCatalyst: false, source: 'AH' },
  ],
};
const chest = { specSlug: 'frost-mage', listType: 'mythicPlus' as const, slotKey: 'Chest#1' };
const ring = { ...chest, slotKey: 'Ring#1' };

const info = (over: Partial<ItemInfo>): ItemInfo => ({ name: 'Woven Robe', quality: 'EPIC', isTier: false, inventoryType: 'ROBE', armorType: 'cloth', secondaryStats: null, ...over });

async function setup(getItemDetails: BlizzardClient['getItemDetails'] = async () => info({})) {
  const db = await openTestDb();
  await replaceSpecs(db, [{ methodSlug: 'frost-mage', classId: 8, className: 'Mage', specName: 'Frost' }], 1);
  await replaceBisLists(db, 'frost-mage', lists, 1);
  const blizzard = { getItemDetails } as unknown as BlizzardClient;
  return { db, deps: { db, blizzard, now: 5, accountId: 1 } };
}

const userError = async (p: Promise<unknown>) => {
  const err = await p.catch((e: unknown) => e);
  expect(isUserError(err)).toBe(true);
  return (err as Error).message;
};

describe('knownSpecSlug', () => {
  it('accepts catalog slugs only', async () => {
    const { db } = await setup();
    expect(await knownSpecSlug(db, 'frost-mage')).toBe(true);
    expect(await knownSpecSlug(db, '../etc')).toBe(false);
  });
});

describe('saveOverride', () => {
  it('fills the catalog from Blizzard and saves', async () => {
    const { db, deps } = await setup();
    await saveOverride(deps, chest, 50, false);
    expect((await getCatalogItems(db, [50])).get(50)).toMatchObject({ name: 'Woven Robe', quality: 'EPIC', isTier: false });
    expect((await listOverrides(db, 1, 'frost-mage')).mythicPlus).toEqual([{ slotKey: 'Chest#1', itemId: 50, catalyst: false }]);
  });

  it('fills the catalog from season loot without calling Blizzard', async () => {
    const calls: number[] = [];
    const { db, deps } = await setup(async (_r, id) => { calls.push(id); return null; });
    await replaceSeason(db, { slug: 's', dungeons: [{ challengeModeId: 1, name: 'AH', shortName: 'AH', journalInstanceId: 1, mapId: 1, imageUrl: null }],
      loot: [{ challengeModeId: 1, encounterId: 1, encounterName: 'B', itemId: 60, itemName: 'Loot Band', inventoryType: 'FINGER', armorType: null, quality: 'EPIC', isTier: false }] });
    await saveOverride(deps, ring, 60, false);
    expect(calls).toEqual([]);
    expect((await getCatalogItems(db, [60])).get(60)).toMatchObject({ name: 'Loot Band' });
  });

  it('saves a catalyst override on a tier slot', async () => {
    const { db, deps } = await setup();
    await saveOverride(deps, chest, 50, true);
    expect((await listOverrides(db, 1, 'frost-mage')).mythicPlus[0]).toMatchObject({ catalyst: true });
  });

  it('rejects what the class or slot cannot use, and bad catalysts', async () => {
    const { deps } = await setup(async () => info({ armorType: 'plate' }));
    expect(await userError(saveOverride(deps, chest, 50, false))).toBe("Mage can't wear plate.");
    const ringDeps = (await setup(async () => info({ inventoryType: 'FINGER', armorType: null }))).deps;
    expect(await userError(saveOverride(ringDeps, ring, 51, true))).toBe('Only regular items in tier slots can be catalyzed.');
    expect(await userError(saveOverride(ringDeps, { ...ring, slotKey: 'Gone#1' }, 51, false))).toBe("That slot isn't in Method's list.");
  });

  it('writes nothing when Blizzard fails or has no such item', async () => {
    const down = await setup(async () => { throw new Error('socket hang up'); });
    expect(await userError(saveOverride(down.deps, chest, 50, false))).toBe("Couldn't reach Blizzard. Try again.");
    expect(await getCatalogItems(down.db, [50])).toEqual(new Map());
    expect((await listOverrides(down.db, 1, 'frost-mage')).mythicPlus).toEqual([]);
    const missing = await setup(async () => null);
    expect(await userError(saveOverride(missing.deps, chest, 50, false))).toBe('No item with ID 50.');
    const nameless = await setup(async () => info({ name: null }));
    expect(await userError(saveOverride(nameless.deps, chest, 50, false))).toBe("Couldn't read that item from Blizzard.");
  });

  it('asks for a fetch when the spec has no list', async () => {
    const { deps } = await setup();
    expect(await userError(saveOverride(deps, { ...chest, specSlug: 'fire-mage' }, 50, false))).toBe('Method has no list for this spec yet. Fetch it first.');
  });
});

describe('searchItems and lookupItem', () => {
  it('returns usable local matches and an unusable exact ID with its reason', async () => {
    const { db, deps } = await setup(async () => info({ armorType: 'plate', name: 'Plate Robe' }));
    await lookupItem(deps, chest, 'https://www.wowhead.com/item=70/plate-robe');
    const out = await searchItems(db, chest, '70');
    expect(out.results).toEqual([]);
    expect(out.unusable).toMatchObject({ itemId: 70, canUse: { ok: false, reason: "Mage can't wear plate." } });
  });

  it('rejects input that is not an ID or link', async () => {
    const { deps } = await setup();
    expect(await userError(lookupItem(deps, chest, 'robe'))).toBe('Not a Wowhead item link or ID.');
  });
});

describe('removeOverride', () => {
  it('removes even an orphan', async () => {
    const { db, deps } = await setup();
    await saveOverride(deps, chest, 50, false);
    await removeOverride(deps, chest);
    expect((await listOverrides(db, 1, 'frost-mage')).mythicPlus).toEqual([]);
  });
});
```

Check `getItemDetails` in `src/core/blizzard/client.ts` first: it returns `null` for a 404, so the "No item" case fakes `null`.

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/core/bis/edits.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
import type { BlizzardClient } from '../blizzard/client';
import type { Db } from '../db/client';
import { getBisLists } from '../db/queries/bis-lists';
import { deleteOverride, upsertOverride } from '../db/queries/bis-settings';
import { listCharacters } from '../db/queries/characters';
import { findLocalItem, searchLocalItems, upsertCatalogItem } from '../db/queries/item-catalog';
import { getSpec } from '../db/queries/specs';
import { UserError, isUserError } from '../errors';
import { methodSpecSlug } from '../method/method';
import type { BisRow, CatalogItem, ListType } from '../types';
import { canCatalyst, classCanUse, type CanUse } from './class-can-use';
import { parseItemInput } from './item-input';
import { slotKeys } from './slot-keys';

export interface EditDeps { db: Db; blizzard: BlizzardClient; now: number; accountId: number }
export interface RowRef { specSlug: string; listType: ListType; slotKey: string }
export interface ItemChoice extends CatalogItem { canUse: CanUse; canCatalyst: boolean }

const SEARCH_LIMIT = 20;

export async function classForSpec(db: Db, specSlug: string): Promise<string | null> {
  const spec = await getSpec(db, specSlug);
  if (spec) return spec.className;
  const tracked = (await listCharacters(db)).find((c) => methodSpecSlug(c.specOverride || c.specName, c.className) === specSlug);
  return tracked?.className ?? null;
}

export const knownSpecSlug = async (db: Db, specSlug: string) => (await classForSpec(db, specSlug)) !== null;

/** The Method row a ref points at, with the spec's class. Throws the user-facing reason when either is missing. */
async function resolveRow(db: Db, ref: RowRef): Promise<{ row: BisRow; className: string }> {
  const className = await classForSpec(db, ref.specSlug);
  if (!className) throw new UserError('Unknown spec.');
  const cached = await getBisLists(db, ref.specSlug);
  if (!cached) throw new UserError('Method has no list for this spec yet. Fetch it first.');
  const rows = cached.lists[ref.listType];
  const index = slotKeys(rows).indexOf(ref.slotKey);
  if (index === -1) throw new UserError("That slot isn't in Method's list.");
  return { row: rows[index]!, className };
}

const choice = (item: CatalogItem, className: string, row: BisRow): ItemChoice =>
  ({ ...item, canUse: classCanUse(item, className, row), canCatalyst: canCatalyst(item, row.slots) });

/** The item from local data, else one Blizzard request, cached. Writes nothing when Blizzard fails. */
async function ensureItem(deps: EditDeps, itemId: number): Promise<CatalogItem> {
  const local = await findLocalItem(deps.db, itemId);
  if (local) return local;
  let info;
  try {
    info = await deps.blizzard.getItemDetails('eu', itemId);
  } catch (err) {
    if (isUserError(err)) throw err;
    throw new UserError("Couldn't reach Blizzard. Try again.");
  }
  if (!info) throw new UserError(`No item with ID ${itemId}.`);
  if (!info.name || !info.inventoryType) throw new UserError("Couldn't read that item from Blizzard.");
  const item: CatalogItem = { itemId, name: info.name, inventoryType: info.inventoryType, armorType: info.armorType, quality: info.quality, isTier: info.isTier };
  await upsertCatalogItem(deps.db, item, deps.now);
  return item;
}

export async function searchItems(db: Db, ref: RowRef, query: string) {
  const { row, className } = await resolveRow(db, ref);
  const all = (await searchLocalItems(db, query)).map((i) => choice(i, className, row));
  const exactId = parseItemInput(query);
  return {
    results: all.filter((i) => i.canUse.ok).slice(0, SEARCH_LIMIT),
    unusable: all.find((i) => i.itemId === exactId && !i.canUse.ok) ?? null,
  };
}

export async function lookupItem(deps: EditDeps, ref: RowRef, input: string): Promise<ItemChoice> {
  const itemId = parseItemInput(input);
  if (itemId === null) throw new UserError('Not a Wowhead item link or ID.');
  const { row, className } = await resolveRow(deps.db, ref);
  return choice(await ensureItem(deps, itemId), className, row);
}

export async function saveOverride(deps: EditDeps, ref: RowRef, itemId: number, catalyst: boolean) {
  const { row, className } = await resolveRow(deps.db, ref);
  const item = await ensureItem(deps, itemId);
  const canUse = classCanUse(item, className, row);
  if (!canUse.ok) throw new UserError(canUse.reason);
  if (catalyst && !canCatalyst(item, row.slots)) throw new UserError('Only regular items in tier slots can be catalyzed.');
  await upsertOverride(deps.db, deps.accountId, ref.specSlug, ref.listType, { slotKey: ref.slotKey, itemId, catalyst });
}

export async function removeOverride(deps: EditDeps, ref: RowRef) {
  await deleteOverride(deps.db, deps.accountId, ref.specSlug, ref.listType, ref.slotKey);
}
```

Region: item data is the same in every region; `'eu'` matches the fallback the views already use. If `ensureItem`'s ordering in `saveOverride` writes a catalog row before a class rejection, that's fine: the row is factual and search uses it.

Note the order in "writes nothing when Blizzard fails": `resolveRow` runs first (spec known, list cached), then `ensureItem` throws before any write.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/core/bis && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/bis/edits.ts src/core/bis/edits.test.ts
git commit -m "feat: search, look up and save bis overrides"
```

---

### Task 11: Routes

**Files:**
- Create: `src/app/api/items/search/route.ts`, `src/app/api/items/lookup/route.ts`, `src/app/api/bis/overrides/route.ts`, `src/app/api/bis/settings/route.ts`, `src/app/api/bis/fetch/route.ts`
- Modify: `src/server/route-helpers.ts` (`parseRowRef`, `parseListType`)
- Test: `src/server/route-helpers.test.ts`

Read `node_modules/next/dist/docs/` on route handlers before writing them. Route handlers stay thin: parse, call Task 10 or the queries, `errorResponse` on throw.

**Interfaces:**
- Produces in `route-helpers.ts`:
  ```ts
  export function parseListType(value: unknown): ListType;               // throws UserError('Unknown list.')
  export function parseRowRef(body: Record<string, unknown>): RowRef;    // throws UserError for a missing specSlug or slotKey
  ```

- [ ] **Step 1: Write the failing tests**

```ts
describe('parseRowRef', () => {
  it('reads a row reference', () => {
    expect(parseRowRef({ specSlug: 'frost-mage', listType: 'raid', slotKey: 'Head#1' })).toEqual({ specSlug: 'frost-mage', listType: 'raid', slotKey: 'Head#1' });
  });
  it('rejects bad input with a safe message', () => {
    expect(() => parseRowRef({ specSlug: 'frost-mage', listType: 'pvp', slotKey: 'Head#1' })).toThrow('Unknown list.');
    expect(() => parseRowRef({ listType: 'raid', slotKey: 'Head#1' })).toThrow('Unknown spec.');
    expect(() => parseRowRef({ specSlug: 'frost-mage', listType: 'raid', slotKey: '' })).toThrow('Unknown slot.');
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/server/route-helpers.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the helpers**

```ts
export function parseListType(value: unknown): ListType {
  if (typeof value === 'string' && (LIST_TYPES as readonly string[]).includes(value)) return value as ListType;
  throw new UserError('Unknown list.');
}

export function parseRowRef(body: Record<string, unknown>): RowRef {
  if (typeof body.specSlug !== 'string' || !body.specSlug) throw new UserError('Unknown spec.');
  if (typeof body.slotKey !== 'string' || !body.slotKey) throw new UserError('Unknown slot.');
  return { specSlug: body.specSlug, listType: parseListType(body.listType), slotKey: body.slotKey };
}
```

(import `LIST_TYPES`, `ListType` from `@/core/types`, `RowRef` from `@/core/bis/edits`.)

- [ ] **Step 4: Write the routes**

`items/search/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { searchItems } from '@/core/bis/edits';
import { getServices } from '@/server/services';
import { errorResponse, parseRowRef } from '@/server/route-helpers';

// Reads only: local season loot and the item catalog. Lookups that call Blizzard go through POST /api/items/lookup.
export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const { db } = await getServices();
    return NextResponse.json(await searchItems(db, parseRowRef(params), params.q ?? ''));
  } catch (err) {
    return errorResponse(err);
  }
}
```

`items/lookup/route.ts`:

```ts
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const s = await getServices();
    const deps = { db: s.db, blizzard: s.blizzard, now: s.now(), accountId: s.currentAccountId() };
    return NextResponse.json(await lookupItem(deps, parseRowRef(body), typeof body.input === 'string' ? body.input : ''));
  } catch (err) {
    return errorResponse(err);
  }
}
```

`bis/overrides/route.ts`: `PUT` reads `itemId` (positive integer, else `UserError('Unknown item.')`) and `catalyst` (`body.catalyst === true`), calls `saveOverride`; `DELETE` calls `removeOverride`. Both return `{ ok: true }`. Same `deps` construction as lookup.

`bis/settings/route.ts` `PATCH`: `specSlug` must pass `knownSpecSlug` (else `UserError('Unknown spec.')`); `listType` optional via `parseListType`; `statsMatter` optional boolean; at least one present, else `UserError('Nothing to change.')`. Calls `updateSpecSettings(db, s.currentAccountId(), specSlug, patch)`.

`bis/fetch/route.ts` `POST`:

```ts
// The slug must name a known spec, so a client can't aim the fetch at an arbitrary Method page.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { specSlug?: unknown };
    const { db, bisSource, now } = await getServices();
    if (typeof body.specSlug !== 'string' || !(await knownSpecSlug(db, body.specSlug))) throw new UserError('Unknown spec.');
    await syncBisLists({ db, source: bisSource, now: now() }, body.specSlug);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
```

Note `syncBisLists` only fetches when due; Refresh on a list fetched within the day is a no-op until the day passes. Keep that: it matches the reference sync's rule and avoids hammering Method. The picker shows "Fetched <age>" so the user sees why.

- [ ] **Step 5: Run the gate**

Run: `npm run typecheck && npm run lint && npx vitest run src/server`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/items src/app/api/bis src/server/route-helpers.ts src/server/route-helpers.test.ts
git commit -m "feat: add routes for bis overrides, settings and fetch"
```

---

### Task 12: Settings loaders, pages, nav and spec picker

**Files:**
- Create: `src/server/views/settings-bis.ts`, `src/server/views/settings-spec.ts` (+ tests `settings.test.ts`)
- Modify: `src/server/views/types.ts`
- Create: `src/app/settings/page.tsx` (redirect), `src/app/settings/layout.tsx`, `src/app/settings/bis/page.tsx`, `src/app/settings/bis/[spec]/page.tsx`
- Create: `src/components/settings-nav/SettingsNav.tsx`, `src/components/spec-picker/SpecPicker.tsx`, `src/components/spec-picker/FetchButton.tsx`, `src/components/spec-picker/fetch-state.ts` (+ test)
- Modify: `src/components/main-nav/MainNav.tsx` (Settings link), `src/components/brand-icon/BrandIcon.tsx` (a `settings` path)

**Interfaces:**
- Consumes: `listSpecs`, `getBisLists`, `readBisLists`, `listCharacters`, `methodSpecSlug`, `getClassIconMap`, `knownSpecSlug`, `classForSpec`, `getSpecSettings`, `listOverrides`, `getCatalogItems`, `applyOverrides`, `slotKeys`.
- Produces in `views/types.ts`:
  ```ts
  export type SpecFetchState = { kind: 'tracked' } | { kind: 'notFetched' } | { kind: 'fetched'; at: number } | { kind: 'failed' };
  export interface SpecPickerView { classes: { className: string; iconUrl: string | null; specs: { slug: string; specName: string; tracked: boolean; state: SpecFetchState }[] }[] }
  export interface SettingsSlotView { slotKey: string; slotLabel: string; method: GearRowView['bis']; override: (ItemView & { catalyst: boolean }) | null; tierSlot: boolean }
  export interface SettingsSpecView {
    slug: string; className: string; specName: string; listType: ListType; statsMatter: boolean;
    editing: ListType; hasLists: boolean; fetchState: SpecFetchState;
    lists: Record<ListType, { slots: SettingsSlotView[]; orphans: (ItemView & { slotKey: string })[] }>;
  }
  export function getSpecPicker(services: Services): Promise<SpecPickerView>;
  export function getSettingsSpec(services: Services, slug: string, editing: ListType): Promise<SettingsSpecView | null>; // null for an unknown slug
  ```
  `ItemView` and `GearRowView['bis']` come from the existing `item-view.ts` / `types.ts`; read them and use the same shapes so `ItemCard` renders Method's pick and the override.

- [ ] **Step 1: Write the failing tests**

`settings.test.ts`, with the fake `Services` pattern from `views.test.ts`:

```ts
describe('getSpecPicker', () => {
  it('marks tracked, not fetched, fetched and failed specs, grouped by class', async () => {
    // seed: specs catalog with Guardian, Feral and Balance Druid and Frost Mage;
    // Birkibjörn tracked as Guardian; Method lists cached for feral-druid at time 500;
    // a failure meta for balance-druid via syncBisLists with a throwing bisSource.
    const view = await getSpecPicker(s);
    const druid = view.classes.find((c) => c.className === 'Druid')!;
    expect(druid.specs.map((x) => [x.slug, x.state.kind])).toEqual([
      ['balance-druid', 'failed'], ['feral-druid', 'fetched'], ['guardian-druid', 'tracked'], ['restoration-druid', 'notFetched'],
    ]);
  });

  it('falls back to tracked specs when the catalog is empty', async () => {
    // no specs rows; Birkibjörn tracked
    expect((await getSpecPicker(s)).classes).toEqual([expect.objectContaining({ className: 'Druid', specs: [expect.objectContaining({ slug: 'guardian-druid' })] })]);
  });
});

describe('getSettingsSpec', () => {
  it('pairs each Method slot with its override and lists orphans', async () => {
    // lists cached for guardian-druid; catalog item 21; overrides Neck#1 → 21 and Gone#1 → 21
    const view = await getSettingsSpec(s, 'guardian-druid', 'mythicPlus');
    expect(view!.lists.mythicPlus.slots.map((x) => [x.slotKey, x.override?.itemId ?? null, x.tierSlot])).toEqual([['Head#1', null, true], ['Neck#1', 21, false]]);
    expect(view!.lists.mythicPlus.orphans.map((o) => o.slotKey)).toEqual(['Gone#1']);
  });

  it('returns null for an unknown slug', async () => {
    expect(await getSettingsSpec(s, '../etc', 'mythicPlus')).toBeNull();
  });
});
```

Write the seeding concretely with `replaceSpecs`, `insertCharacter`, `replaceBisLists`, `upsertCatalogItem`, `upsertOverride`, `syncBisLists` as earlier tasks do.

`fetch-state.test.ts` for the label helper:

```ts
expect(fetchStateLabel({ kind: 'tracked' }, 0)).toBe('Tracked');
expect(fetchStateLabel({ kind: 'notFetched' }, 0)).toBe('Not fetched');
expect(fetchStateLabel({ kind: 'failed' }, 0)).toBe('Fetch failed, try again');
expect(fetchStateLabel({ kind: 'fetched', at: 0 }, 3 * DAY_MS)).toBe('Fetched 3 days ago');
```

Use the existing relative-time helper in `src/core/format.ts` for the age (read it; match its wording).

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/server/views/settings.test.ts src/components/spec-picker`
Expected: FAIL.

- [ ] **Step 3: Implement the loaders**

`settings-bis.ts`: build `tracked = new Set(characters.map((c) => methodSpecSlug(c.specOverride || c.specName, c.className)))`; specs from `listSpecs`, or when empty, from tracked characters' class and spec; for each untracked spec `readBisLists(db, slug, time)` in sequence: `fetchedAt` set → `fetched`, `status === 'failed'` → `failed`, else `notFetched`. Group by class name, specs sorted by name, icons from `getClassIconMap`.

`settings-spec.ts`: `null` unless `knownSpecSlug`. Read `readBisLists`, `getSpecSettings`, `listOverrides`, `getCatalogItems`, then per list `slotKeys(rows)` and `applyOverrides`. A slot's `method` is the Method row as a `bis` view (reuse `rowView`'s bis shape: extract the `bis` builder from `member.ts` `rowView` into an exported `bisView(row, icons, targets)` in `member.ts` and use it in both places); `override` comes from the overlaid row when `edited` is set; `tierSlot` is `row.slots.some((s) => TIER_SLOTS.has(s))`. Icons via `getItemIcons` (database only; don't fetch on this page). `fetchState` as in the picker.

- [ ] **Step 4: Implement pages and components**

- `src/app/settings/page.tsx`: `redirect('/settings/bis')` from `next/navigation`.
- `layout.tsx`: page shell matching `main` in the character page (`mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-10 sm:px-16`), an `h1` "Settings" in `font-display`, `SettingsNav`, then children. Missing config: same `SetupNotice` pattern as the character page.
- `SettingsNav.tsx` (server component): a `nav aria-label="Settings sections"` with a `Link` "BiS lists" (`aria-current="page"` when active; pass `active` as a prop from the layout's child page — or make it client and use `usePathname` with `isActiveLink` from `main-nav/active-link.ts`, which then moves to `src/components/shared/active-link.ts` because two components use it) and a disabled `<span aria-disabled="true">General <span className="text-muted">coming soon</span></span>`.
- `bis/page.tsx`: `getSpecPicker`, render `SpecPicker`.
- `SpecPicker.tsx`: per class a section with the class icon (keep the existing fallback used by the character header when `iconUrl` is null) and `h2` class name; per spec a row: a `Link` to `/settings/bis/<slug>` with the spec name, the state label from `fetchStateLabel` in words, and `FetchButton` for `notFetched`, `fetched`, `failed`. Tracked rows are highlighted with `bg-surface-2` and the word "Tracked".
- `FetchButton.tsx` (`'use client'`): `useApiAction().run('/api/bis/fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ specSlug }) })`, label "Fetch Method list" or "Refresh", busy text "Fetching…", error shown beside it.
- `MainNav.tsx`: add `{ href: '/settings', label: 'Settings', icon: 'settings' }`; add a `settings` path (a simple gear outline in the same 64-unit stroke style) to `BrandIcon`'s `PATHS`.

- [ ] **Step 5: Run the gate**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "feat: add settings section with spec picker"
```

---

### Task 13: BiS editor, item search and source badge

**Files:**
- Modify: `src/app/settings/bis/[spec]/page.tsx`
- Create: `src/components/bis-editor/BisEditor.tsx`, `src/components/bis-editor/SlotRow.tsx`, `src/components/bis-editor/OrphanList.tsx`, `src/components/bis-editor/CompareAgainst.tsx`, `src/components/bis-editor/StatsMatter.tsx`, `src/components/bis-editor/slot-row.ts` (+ test)
- Create: `src/components/item-search/ItemSearch.tsx`, `src/components/item-search/use-item-search.ts`, `src/components/item-search/search-plan.ts` (+ test)
- Create: `src/components/bis-source-badge/BisSourceBadge.tsx`, `src/components/bis-source-badge/badge-text.ts` (+ test)
- Modify: `src/components/character-page/GearTableHeader.tsx` or the BiS heading on the character page (read it; the badge sits beside the "BiS" column title), `src/app/characters/[region]/[realm]/[name]/page.tsx`

**Interfaces:**
- Consumes: `SettingsSpecView` (Task 12), routes (Task 11), `LIST_NAMES` (Task 9), `CharacterPageView.editedCount`, `listType`, `specSlug`.
- Produces:
  ```ts
  // badge-text.ts
  export const badgeText = (source: string, editedCount: number) => editedCount > 0 ? `${source} · ${editedCount} edited` : source;
  // search-plan.ts: what the search box does with its input
  export type SearchPlan = { kind: 'idle' } | { kind: 'search'; q: string } | { kind: 'lookup'; input: string };
  export function searchPlan(input: string, localResults: number | null): SearchPlan;
  // slot-row.ts
  export function overrideLabel(override: { name: string; catalyst: boolean }): string; // "<name> → catalyst into tier" or "<name>"
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// badge-text.test.ts
expect(badgeText('Method', 0)).toBe('Method');
expect(badgeText('Method', 2)).toBe('Method · 2 edited');

// search-plan.test.ts
expect(searchPlan('  ', null)).toEqual({ kind: 'idle' });
expect(searchPlan('robe', null)).toEqual({ kind: 'search', q: 'robe' });
// An ID or link with no local result goes to lookup; a name never does.
expect(searchPlan('212401', 0)).toEqual({ kind: 'lookup', input: '212401' });
expect(searchPlan('https://www.wowhead.com/item=212401', 0)).toEqual({ kind: 'lookup', input: 'https://www.wowhead.com/item=212401' });
expect(searchPlan('robe', 0)).toEqual({ kind: 'search', q: 'robe' });
expect(searchPlan('212401', 1)).toEqual({ kind: 'search', q: '212401' });

// slot-row.test.ts
expect(overrideLabel({ name: 'Woven Robe', catalyst: true })).toBe('Woven Robe → catalyst into tier');
expect(overrideLabel({ name: 'Woven Robe', catalyst: false })).toBe('Woven Robe');
```

And a `renderToStaticMarkup` test for `BisSourceBadge`: renders a link to `/settings/bis/guardian-druid` with text `Method · 2 edited`.

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/components/bis-editor src/components/item-search src/components/bis-source-badge`
Expected: FAIL.

- [ ] **Step 3: Implement the helpers**, exactly as the Interfaces block says. `searchPlan` uses `parseItemInput` from `@/core/bis/item-input`.

- [ ] **Step 4: Implement the components**

- `[spec]/page.tsx`: `searchParams.list` picks `editing` (default: the spec's `listType`); `getSettingsSpec`; `notFound()` for `null`. When `!hasLists`, render the spec name and `FetchButton` with "Method has no list for this spec yet." Otherwise `BisEditor`.
- `BisEditor.tsx` (server): `h2` "<Spec> <Class>", then `CompareAgainst`, `StatsMatter`, a `nav aria-label="Lists to edit"` of three `Link`s to `?list=<l>` (`aria-current` on the active one; the compared one gets a "Compared" tag in words), then the active list's `SlotRow`s and `OrphanList`. An empty list shows "Method has no <List name> list for this spec."
- `CompareAgainst.tsx` (`'use client'`): a `fieldset` with legend "Compare against" and three radios (Overall, Raid, Mythic+ from `LIST_NAMES`), `PATCH /api/bis/settings { specSlug, listType }` on change, `after: 'refresh-always'`. Same radio classes as the removed `CharacterSettings` fieldset.
- `StatsMatter.tsx` (`'use client'`): `<label><input type="checkbox" checked={statsMatter} onChange=…/> Tier pieces must have the list's stats</label>` with the help line "Uncheck if the set bonus is all that matters for this spec." beneath; `PATCH { specSlug, statsMatter }`.
- `SlotRow.tsx` (`'use client'`, it opens search): grid row like `GearTable`'s. Slot label; Method's pick as `ItemCard` (or "Any <ilvl>"); when overridden, Method's pick wrapped in `<s>` with "Method's pick" in an `sr-only` span, the override as `ItemCard` with `overrideLabel`, an "Edited" tag, and a "Reset" button (`DELETE /api/bis/overrides`). Otherwise an "Override" button toggling `ItemSearch` below the row.
- `ItemSearch.tsx` (`'use client'`): `<input type="search" placeholder="Search by name, ID or Wowhead link" aria-label="Search items for <slot>">`; `use-item-search.ts` debounces 250 ms (use a shared debounce hook if `src/components/hooks/` has one by then; else inside this hook), runs `GET /api/items/search?…` for `search` plans and `POST /api/items/lookup` for `lookup` plans, and exposes `{ results, unusable, busy, error }`. Results render as a `ul` of rarity-colored Wowhead links (reuse `ItemCard` or the shared rarity class helper; `data-wowhead` on the link, the pick action on a separate button "Choose"). The unusable exact match renders greyed with its reason and no Choose button. Choosing an item with `canCatalyst` shows a "Catalyst into tier" checkbox and a "Save" button; otherwise Choose saves at once. Save: `PUT /api/bis/overrides { …ref, itemId, catalyst }`, `after: 'refresh'`. Errors from the route show beside the input. Keyboard: input then the result buttons in tab order; Escape on the input closes the search (`onKeyDown`).
- `OrphanList.tsx` (`'use client'`): heading "No longer in Method's list", each orphan as an item link plus "Remove" (`DELETE`).
- `BisSourceBadge.tsx` (server): `<Link href={\`/settings/bis/${specSlug}\`} className="rounded-full border border-line px-2 py-0.5 text-xs …">{badgeText('Method', editedCount)}</Link>`.
- Character page: render the badge beside the BiS column title in `GearTableHeader` (pass `specSlug`, `editedCount`) and name the compared list there: "BiS · <List name>".

- [ ] **Step 5: Run the gate**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "feat: edit bis overrides and show the list source"
```

---

### Task 14: Build, hand checks, pull request

- [ ] **Step 1: Full gate**

Stop `npm run dev` if it serves this folder. Run: `npm run typecheck && npm run lint && npm test && npm run build`. Expected: all clean. Record the test count.

- [ ] **Step 2: Hand checks** (`npm run dev`, then http://localhost:3000)

1. Main nav shows Settings; `/settings` lands on `/settings/bis`.
2. Picker: tracked specs say "Tracked"; an untracked spec fetches with "Fetch Method list", then reads "Fetched …"; an unknown `/settings/bis/foo` is a 404.
3. Editor: switch Compare against to Overall; the character page and the group page both follow, and the card label reads "Overall BiS". Pick Raid on a spec without a Raid table: the group header reads "Overall list" with the fallback title.
4. Override a ring by name, by ID and by Wowhead link (with a locale path). A plate item on a Mage shows greyed with "Mage can't wear plate." A cloth cloak on a Warrior is offered.
5. Override a tier slot with a regular chest and "Catalyst into tier": the row reads "… → catalyst into tier"; after the background sync, the character page shows "Wrong stats" for a mismatched tier piece and dungeon priority prefers matching drops.
6. Uncheck "Tier pieces must have the list's stats": "Wrong stats" disappears, an upgradable piece still reads upgradable, dungeon chips read "catalyst into tier".
7. Character page badge: "Method · 1 edited", links to the spec's editor. No list tabs remain.
8. Reset and Remove work; Escape closes search; tab order reaches every result's Choose button.
9. All of the above at 375 px wide: no horizontal scroll.

- [ ] **Step 3: Tidy history and open the pull request**

`git fetch origin && git rebase origin/main`, then push and open the pull request with the caveman style, opening with `Closes #103, closes #14.` and `Part of #15.` (only the shell), `## What changes`, `## Data` (two migrations: `bis-settings`, `drop-priority-list`; `SEASON_META_KEY` → `season.v4`; per-character list choice not carried over), `## Testing` (count, gates, hand checks, gaps: no browser tests for debounce, keyboard, tabs, radio group — #35), and `Spec: docs/superpowers/specs/2026-10-11-bis-list-settings-design.md`.
