# BiS Sources per Spec Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each spec on an account picks its BiS source: Method, Icy Veins or Manual. Every view compares against that source's list.

**Architecture:**
- `bis_lists` and `bis_overrides` gain a `source` column.
- A new Icy Veins `BisSource` sits beside Method's.
- Manual lists are account-owned copies in two new tables.
- One core read, `readSpecBase`, picks the base lists and status for an account's spec. Every reader goes through it: the views, the editor, the picker and override validation.
- Reference sync fetches only the sources in use, and syncs tier stats for every list in use.

**Tech Stack:** Next.js 16 (read `node_modules/next/dist/docs/` before touching pages or routes), React 19, Tailwind v4 `@theme` tokens, Drizzle + libsql, Vitest with `openTestDb()` and `src/test/fake-fetch.ts`.

**Spec:** `docs/superpowers/specs/2026-10-12-bis-sources-design.md` (read it first). Spike: `docs/superpowers/specs/2026-10-11-bis-sources-spike.md`.

## Global Constraints

- **Writes:** every write goes through `withWriteLock` (`src/core/db/queries/write-lock.ts`). The lock is not reentrant: a locked task never calls another locked helper.
- **`src/core`:** never imports `next`, `react`, `src/app`, `src/components` or `src/server`. Clients (`src/core/icy-veins`) never touch the database.
- **Schema changes:** edit `src/core/db/schema.ts`, then run `npm run db:generate -- --name <name>`. Never edit a committed migration. New `source` columns use `.default('method')`, and the generated SQL is not hand-edited.
- **Errors:** user-facing errors throw `UserError`. Check errors with `isUserError`/`isHttpError`, never `instanceof`.
- **External requests:** go through `fetchWithRetry` (`src/core/http.ts`).
- **Tests:** write the failing test first and watch it fail. Use real in-memory SQLite (`openTestDb()`). Fixtures use made-up names (Birkibjörn, Hrafnhildur, Sólrún) and made-up item names. Third-party pages are trimmed, never full copies.
- **Components:** one directory per component. Branching logic lives in a tested `.ts` beside the `.tsx`. Use semantic tokens only, never a new hex.
- **Commits:** subjects are `type: lowercase imperative`, with terse bodies that say why. No AI attribution, no `Co-Authored-By`, no mention of AI tools.
- **Gate before done:** `npm run typecheck && npm run lint && npm test`, plus `npm run build` in a separate git worktree. Never build in the folder the owner's dev server (:3000) serves.
- **Source IDs and names:** `BisSourceId = 'method' | 'icyVeins' | 'manual'`. `SOURCE_NAMES = { method: 'Method', icyVeins: 'Icy Veins', manual: 'Manual' }`. This is the only map of source names.

## Review Focus

1. **A spec with Icy Veins chosen, but Icy Veins never fetched or failing.** The page must show the Icy Veins error or loading state and never Method's rows. Pinned in Task 7, test "never reads another source's rows".
2. **Choosing Manual while the current source has an unfetched or empty list.** Expect a `UserError`, with no half-written manual rows and no source change. Pinned in Task 6, test "refuses and changes nothing".
3. **An override written from a stale tab after the source changed.** Expect a 400, with nothing written. Pinned in Task 8, test "source mismatch answers 400".
4. **An Icy Veins page with a placeholder 2H Off Hand, Shirt or Tabard.** Expect no row for those, and no parse error. Pinned in Task 3.
5. **A single failing Blizzard lookup during the Icy Veins tier check.** Expect the whole sync to fail and be recorded, with the old cache kept. Pinned in Task 4, test "a failed tier lookup records the failure and keeps the old list".

---

## File Structure

| File | Responsibility |
|---|---|
| `src/core/types.ts` | `BisSourceId`, `FetchedSourceId`, `FETCHED_SOURCES`, `SOURCE_NAMES`; `SpecSettings.source` |
| `src/core/db/schema.ts` | `source` columns; `manual_bis_lists`, `manual_bis_items` |
| `src/core/db/queries/bis-lists.ts` | Per-source cache read and write; exported row mappers |
| `src/core/db/queries/bis-settings.ts` | Settings with `source`; per-source overrides; `sourcesInUse` |
| `src/core/db/queries/manual-lists.ts` (new) | `getManualLists`, `manualTierItemIds`, `chooseManual`, `copyManual` |
| `src/core/icy-veins/roles.ts` (new) | Static table of non-dps slugs, `icyVeinsUrl(slug)` |
| `src/core/icy-veins/icy-veins.ts` (new) | `parseIcyVeinsHtml`, `createIcyVeinsSource` |
| `src/core/sync/reference-sync.ts` | Per-source `readBisLists`/`syncBisLists`, failure key, Icy Veins tier flags |
| `src/core/sync/reference-run.ts` | Fetch sources in use; tier targets for every list in use |
| `src/core/bis/spec-base.ts` (new) | `readSpecBase`, `effectiveLists` |
| `src/core/bis/edits.ts` | Validation through `readSpecBase`; source check |
| `src/server/services.ts` | `bisSources` record |
| `src/server/views/*` | `source` fields on views |
| `src/app/api/bis/*` | Settings `source`, fetch per source, `manual/copy`, override source check |
| `src/components/*` | Source picker, header, copy-again, source-named strings |

---

### Task 1: Source types and names

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/method/method.ts:78-81`
- Test: `src/core/types.test.ts` (create)

**Interfaces:**
- Produces:
  - `type BisSourceId = 'method' | 'icyVeins' | 'manual'`
  - `type FetchedSourceId = 'method' | 'icyVeins'`
  - `FETCHED_SOURCES: readonly FetchedSourceId[]`
  - `SOURCE_NAMES: Record<BisSourceId, string>`
  - `isBisSourceId(v: unknown): v is BisSourceId`
  - `SpecSettings = { source: BisSourceId; listType: ListType; statsMatter: boolean }`

- [ ] **Step 1: Write the failing test**

```ts
// src/core/types.test.ts
import { describe, expect, it } from 'vitest';
import { FETCHED_SOURCES, SOURCE_NAMES, isBisSourceId } from './types';

describe('bis sources', () => {
  it('names every source once and fetches only the web ones', () => {
    expect(SOURCE_NAMES).toEqual({ method: 'Method', icyVeins: 'Icy Veins', manual: 'Manual' });
    expect(FETCHED_SOURCES).toEqual(['method', 'icyVeins']);
  });
  it('recognizes source ids', () => {
    expect(isBisSourceId('icyVeins')).toBe(true);
    expect(isBisSourceId('wowhead')).toBe(false);
    expect(isBisSourceId(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it.** `npx vitest run src/core/types.test.ts`. Expected: FAIL, because the exports don't exist.

- [ ] **Step 3: Implement.** In `src/core/types.ts`, next to `SpecSettings`:

```ts
export type BisSourceId = 'method' | 'icyVeins' | 'manual';
export type FetchedSourceId = Exclude<BisSourceId, 'manual'>;
export const FETCHED_SOURCES: readonly FetchedSourceId[] = ['method', 'icyVeins'];
/** The one place a source's display name lives: sources, views and components all read it. */
export const SOURCE_NAMES: Record<BisSourceId, string> = { method: 'Method', icyVeins: 'Icy Veins', manual: 'Manual' };
export const isBisSourceId = (v: unknown): v is BisSourceId => typeof v === 'string' && v in SOURCE_NAMES;
export interface SpecSettings { source: BisSourceId; listType: ListType; statsMatter: boolean }
```

Replace the old `SpecSettings` line. In `method.ts`, `name: 'Method'` becomes `name: SOURCE_NAMES.method` (import it). Typecheck will now flag `DEFAULT_SPEC_SETTINGS`. Leave that for Task 2.

- [ ] **Step 4: Run it.** `npx vitest run src/core/types.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit.** Use `git add src/core/types.ts src/core/types.test.ts src/core/method/method.ts` and the message `feat: add bis source ids and names`.

### Task 2: Schema, migration and per-source queries

**Files:**
- Modify: `src/core/db/schema.ts` (`bisLists`, `bisOverrides`, `specSettings`; add `manualBisLists`, `manualBisItems`)
- Create: the migration `npm run db:generate -- --name bis-sources`
- Modify: `src/core/db/queries/bis-lists.ts`, `src/core/db/queries/bis-settings.ts`
- Modify every caller the typechecker flags: `reference-sync.ts`, `bis-lookup.ts`, `settings-spec.ts`, `settings-bis.ts`, `edits.ts`. Pass `'method'` for now; later tasks make them source-aware.
- Test: `src/core/db/queries/bis-lists.test.ts`, `src/core/db/queries/bis-settings.test.ts`, `src/core/db/migrate.test.ts` (or wherever migrations are tested: `grep -rln "migrate" src/core/db`)

**Interfaces:**
- Consumes: Task 1 types.
- Produces:
  - `replaceBisLists(db, source: FetchedSourceId, specSlug, lists, now)`
  - `getBisLists(db, source: FetchedSourceId, specSlug)`
  - `rowColumns(row: BisRow)`, which returns the `bis_items` columns without `listId`/`position`.
  - `rowFromColumns(r)`, which returns a `BisRow`.
  - `DEFAULT_SPEC_SETTINGS = { source: 'method', listType: 'mythicPlus', statsMatter: true }`
  - `listOverrides(db, accountId, specSlug, source: BisSourceId)`
  - `upsertOverride(db, accountId, specSlug, source, listType, o)`
  - `deleteOverride(db, accountId, specSlug, source, listType, slotKey)`
  - `sourcesInUse(db, specSlug): Promise<FetchedSourceId[]>`

- [ ] **Step 1: Write the failing tests.** Add to `bis-lists.test.ts`:

```ts
it('keeps each source\'s lists apart', async () => {
  const db = await openTestDb();
  await replaceBisLists(db, 'method', 'frost-mage', { overall: [row(1)], raid: [], mythicPlus: [] }, 10);
  await replaceBisLists(db, 'icyVeins', 'frost-mage', { overall: [row(2)], raid: [], mythicPlus: [] }, 20);
  expect((await getBisLists(db, 'method', 'frost-mage'))!.lists.overall.map(id)).toEqual([1]);
  expect((await getBisLists(db, 'icyVeins', 'frost-mage'))!.lists.overall.map(id)).toEqual([2]);
  await replaceBisLists(db, 'icyVeins', 'frost-mage', { overall: [row(3)], raid: [], mythicPlus: [] }, 30);
  expect((await getBisLists(db, 'method', 'frost-mage'))!.lists.overall.map(id)).toEqual([1]);
});
```

`row(n)` is a `BisItemRow` with `itemId: n`, and `id = (r) => r.kind === 'item' && r.itemId`. Reuse the file's existing row helper if it has one.

Add to `bis-settings.test.ts`, then update every existing call to pass `'method'` as the source:

```ts
it('defaults to Method', async () => {
  expect(await getSpecSettings(await openTestDb(), 1, SLUG)).toEqual({ source: 'method', listType: 'mythicPlus', statsMatter: true });
});

it('keeps overrides per source', async () => {
  const db = await openTestDb();
  await upsertOverride(db, 1, SLUG, 'method', 'raid', { slotKey: 'Head#1', itemId: 100, catalyst: false });
  expect((await listOverrides(db, 1, SLUG, 'icyVeins')).raid).toEqual([]);
  expect((await listOverrides(db, 1, SLUG, 'method')).raid).toEqual([{ slotKey: 'Head#1', itemId: 100, catalyst: false }]);
});

it('lists the fetched sources accounts use, Method when unset, none for Manual', async () => {
  const db = await twoAccounts();
  expect(await sourcesInUse(db, SLUG)).toEqual(['method']);
  await updateSpecSettings(db, 1, SLUG, { source: 'icyVeins' });
  expect((await sourcesInUse(db, SLUG)).sort()).toEqual(['icyVeins', 'method']);
  await updateSpecSettings(db, 2, SLUG, { source: 'manual' });
  expect(await sourcesInUse(db, SLUG)).toEqual(['icyVeins']);
});
```

Add a migration test that runs against a database at migration `0012`. Insert a `bis_lists` row and a `bis_overrides` row, migrate to head, and assert both read back with source `'method'`. Follow the existing migration test pattern; if none exists, open a file DB in a temp dir with `migrate()` from `drizzle-orm/libsql/migrator` and `migrationsFolder: 'drizzle'`, run the first 13 journal entries by copying them into a temp folder, then all of them.

- [ ] **Step 2: Run them.** `npx vitest run src/core/db`. Expected: FAIL (type errors and missing columns).

- [ ] **Step 3: Implement the schema.**

```ts
// bisLists
source: text('source').$type<FetchedSourceId>().notNull().default('method'),
}, (t) => [uniqueIndex('bis_lists_source_spec_type').on(t.source, t.specSlug, t.listType)]);

// specSettings
source: text('source').$type<BisSourceId>().notNull().default('method'),

// bisOverrides
source: text('source').$type<BisSourceId>().notNull().default('method'),
}, (t) => [primaryKey({ columns: [t.accountId, t.specSlug, t.source, t.listType, t.slotKey] })]);

/** An account's manual lists for a spec. A row exists exactly when the copy exists. */
export const manualBisLists = sqliteTable('manual_bis_lists', {
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  specSlug: text('spec_slug').notNull(),
  copiedFrom: text('copied_from').$type<FetchedSourceId>().notNull(),
  copiedAt: integer('copied_at').notNull(),
}, (t) => [primaryKey({ columns: [t.accountId, t.specSlug] })]);

/** The rows of an account's manual lists, in the shape of `bis_items`. `source` is the drop source, as there. */
export const manualBisItems = sqliteTable('manual_bis_items', {
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  specSlug: text('spec_slug').notNull(),
  listType: text('list_type').$type<ListType>().notNull(),
  position: integer('position').notNull(),
  slotLabel: text('slot_label').notNull(),
  slots: text('slots', { mode: 'json' }).$type<SlotType[]>().notNull(),
  itemId: integer('item_id'),
  minItemLevel: integer('min_item_level'),
  name: text('name').notNull(),
  bonusIds: text('bonus_ids', { mode: 'json' }).$type<number[]>().notNull(),
  isTier: integer('is_tier', { mode: 'boolean' }).notNull(),
  isCatalyst: integer('is_catalyst', { mode: 'boolean' }).notNull(),
  source: text('source').notNull(),
}, (t) => [primaryKey({ columns: [t.accountId, t.specSlug, t.listType, t.position] })]);
```

Then run `npm run db:generate -- --name bis-sources`. Read the generated SQL: it must copy existing rows into the rebuilt tables. If drizzle-kit drops the data instead, stop and ask the owner. Don't hand-edit it.

- [ ] **Step 4: Implement the queries.**
  - `bis-lists.ts`:
    - Rename `toColumns` to an exported `rowColumns(row)` that returns the columns without `listId`/`position`, and `fromColumns` to an exported `rowFromColumns`.
    - `replaceBisLists` deletes and inserts `where(and(eq(bisLists.source, source), eq(bisLists.specSlug, specSlug)))` and inserts `{ source, specSlug, listType, fetchedAt }`.
    - `getBisLists` filters the same way.
  - `bis-settings.ts`:
    - `getSpecSettings` returns `{ source: row.source, listType, statsMatter }`.
    - The override functions add `eq(bisOverrides.source, source)` to every `where`, and `source` to the insert values and the conflict target.
    - Add:

```ts
/** The fetched sources any account uses for a spec. An account without a settings row uses Method. */
export async function sourcesInUse(db: Db, specSlug: string): Promise<FetchedSourceId[]> {
  const rows = await db.select({ source: specSettings.source }).from(accounts)
    .leftJoin(specSettings, and(eq(specSettings.accountId, accounts.id), eq(specSettings.specSlug, specSlug)));
  const used = new Set(rows.map((r) => r.source ?? 'method'));
  return FETCHED_SOURCES.filter((s) => used.has(s));
}
```

  Fix the callers the typechecker flags by passing `'method'`. Don't add behavior yet.

- [ ] **Step 5: Run everything.** `npm run typecheck && npx vitest run`. Expected: PASS.

- [ ] **Step 6: Commit.** Use the message `feat: key bis lists and overrides by source`, with a body explaining that existing rows default to method and that the manual tables are added here.

### Task 3: Icy Veins parser and source

**Files:**
- Create: `src/core/icy-veins/roles.ts`, `src/core/icy-veins/icy-veins.ts`, `src/core/icy-veins/icy-veins.test.ts`, `src/core/icy-veins/__fixtures__/frost-mage.html`, `src/core/icy-veins/__fixtures__/guardian-druid.html`

**Interfaces:**
- Consumes: `fetchWithRetry`, `HttpError`, `FetchFn` from `src/core/http.ts`; `SOURCE_NAMES`.
- Produces:
  - `icyVeinsUrl(specSlug: string): string`
  - `parseIcyVeinsHtml(html: string): BisLists`
  - `createIcyVeinsSource(fetchFn?: FetchFn): BisSource`. The rows come back with `isTier: false` except on catalyst rows; Task 4 sets the rest.

- [ ] **Step 1: Build the fixtures.**
  - Write two trimmed pages by hand, about 60 lines each, with made-up item names. Each keeps the real structure: the three `<h3 id="overall-best-in-slot">`, `<h3 id="best-gear-from-mythic">` and `<h3 id="best-gear-from-raid">` headings, each followed by `<div class="bis_items_grid">` with `div.bis_item` cards.
  - A card looks like this:

```html
<div class="bis_item bis_q4"> <span class="spell_icon_span" data-wowhead="item=271564&amp;bonus=13846:13848&amp;original-item=271874"><span data-wowhead="item=271564&amp;bonus=13846:13848&amp;original-item=271874" class="q4">Crown of the Frostbound Seer</span></span> <span class="bis_item_slot">Helm</span> <div class="bis_item_footer"><span class="bis_item_drop"><a href="#">Catalyst</a> from <a href="#">Vexmaw</a></span></div> </div>
```

  - `frost-mage.html` needs:
    - In Overall: a catalyst Helm (above), Neck, two Rings, two Trinkets, Off Hand with the drop source "Crafted", Shirt and Tabard cards with no `data-wowhead`, and a Hands card with `original-item` whose drop text is "Coiled Altar".
    - In Mythic+: three cards, including one with an unknown-to-us extra space in the slot (`" Ring "`).
    - The Raid section is left out entirely.
  - `guardian-druid.html` needs:
    - A tier Helm with no `original-item` and drop text "Catalyst or Thornmother".
    - Weapon "Two-Hand".
    - A placeholder Off Hand card: `data-wowhead="item=271875"`, no bonus IDs, and `<span class="bis_item_drop"></span>`.
  - Also add a third tiny inline string in the test with an unknown slot `Wristlet`.

- [ ] **Step 2: Write the failing tests.**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fakeFetch } from '@/test/fake-fetch';
import { createIcyVeinsSource, parseIcyVeinsHtml } from './icy-veins';
import { icyVeinsUrl } from './roles';

const page = (n: string) => readFileSync(new URL(`./__fixtures__/${n}.html`, import.meta.url), 'utf8');

describe('icyVeinsUrl', () => {
  it('picks the role path segment', () => {
    expect(icyVeinsUrl('frost-mage')).toBe('https://www.icy-veins.com/wow/frost-mage-pve-dps-gear-best-in-slot');
    expect(icyVeinsUrl('guardian-druid')).toBe('https://www.icy-veins.com/wow/guardian-druid-pve-tank-gear-best-in-slot');
    expect(icyVeinsUrl('restoration-shaman')).toBe('https://www.icy-veins.com/wow/restoration-shaman-pve-healing-gear-best-in-slot');
  });
});

describe('parseIcyVeinsHtml', () => {
  const lists = parseIcyVeinsHtml(page('frost-mage'));
  it('maps sections to lists, a missing one to an empty list', () => {
    expect(lists.overall.length).toBeGreaterThan(0);
    expect(lists.mythicPlus.length).toBe(3);
    expect(lists.raid).toEqual([]);
  });
  it('numbers rings and trinkets and ignores shirt and tabard', () => {
    expect(lists.overall.map((r) => r.slotLabel)).not.toContain('Shirt');
    expect(lists.overall.filter((r) => r.slotLabel === 'Ring').map((r) => r.slots)).toEqual([['FINGER_1', 'FINGER_2'], ['FINGER_1', 'FINGER_2']]);
  });
  it('reads catalyst rows from original-item, whatever the drop text says', () => {
    const helm = lists.overall.find((r) => r.slotLabel === 'Head')!;
    expect(helm).toMatchObject({ kind: 'item', itemId: 271564, bonusIds: [13846, 13848], isCatalyst: true, isTier: true, source: 'Vexmaw', name: 'Crown of the Frostbound Seer' });
    expect(lists.overall.find((r) => r.slotLabel === 'Hands')).toMatchObject({ isCatalyst: true, source: 'Coiled Altar' });
  });
  it('keeps "Catalyst or X" as a plain row and drops a placeholder off hand', () => {
    const g = parseIcyVeinsHtml(page('guardian-druid'));
    expect(g.overall.find((r) => r.slotLabel === 'Head')).toMatchObject({ isCatalyst: false, isTier: false, source: 'Catalyst or Thornmother' });
    expect(g.overall.some((r) => r.slots.includes('OFF_HAND'))).toBe(false);
  });
  it('fails loudly on an unknown slot', () => {
    const html = '<h3 id="overall-best-in-slot">Overall Best in Slot</h3><div class="bis_items_grid"><div class="bis_item"><span data-wowhead="item=5">X</span><span class="bis_item_slot">Wristlet</span><span class="bis_item_drop">Here</span></div></div>';
    expect(() => parseIcyVeinsHtml(html)).toThrow('Wristlet');
  });
});

describe('createIcyVeinsSource', () => {
  it('fetches the role URL and names itself', async () => {
    const fetchFn = fakeFetch({ 'https://www.icy-veins.com/wow/frost-mage-pve-dps-gear-best-in-slot': page('frost-mage') });
    const source = createIcyVeinsSource(fetchFn);
    expect(source.name).toBe('Icy Veins');
    expect((await source.fetchLists('frost-mage')).mythicPlus).toHaveLength(3);
  });
});
```

Match `fakeFetch`'s real signature in `src/test/fake-fetch.ts`, and adjust the call if it differs.

- [ ] **Step 3: Run them.** `npx vitest run src/core/icy-veins`. Expected: FAIL, because the modules are missing.

- [ ] **Step 4: Implement `roles.ts`.**

```ts
// Icy Veins puts the role in the URL. Roles never change; a new tank or healer spec needs one line here.
// The live test catches a wrong entry: its URL 404s.
const ROLES: Record<string, 'tank' | 'healing'> = {
  'blood-death-knight': 'tank', 'vengeance-demon-hunter': 'tank', 'guardian-druid': 'tank',
  'brewmaster-monk': 'tank', 'protection-paladin': 'tank', 'protection-warrior': 'tank',
  'restoration-druid': 'healing', 'preservation-evoker': 'healing', 'mistweaver-monk': 'healing', 'holy-paladin': 'healing',
  'discipline-priest': 'healing', 'holy-priest': 'healing', 'restoration-shaman': 'healing',
};

export const icyVeinsUrl = (specSlug: string) =>
  `https://www.icy-veins.com/wow/${specSlug}-pve-${ROLES[specSlug] ?? 'dps'}-gear-best-in-slot`;
```

- [ ] **Step 5: Implement `icy-veins.ts`.**
  - Move Method's `decodeHtml` and `ENTITIES` into `src/core/html.ts`, exported, and import them in both parsers. Keep Method's tests green.

```ts
import { fetchWithRetry, HttpError, type FetchFn } from '../http';
import { decodeHtml } from '../html';
import { SOURCE_NAMES, type BisLists, type BisRow, type BisSource, type ListType, type SlotType } from '../types';
import { icyVeinsUrl } from './roles';

const SECTION_IDS: Record<ListType, string> = { overall: 'overall-best-in-slot', mythicPlus: 'best-gear-from-mythic', raid: 'best-gear-from-raid' };
// Icy Veins' slot names, mapped to Method's labels so slot keys and views read the same.
const SLOTS: Record<string, { label: string; slots: SlotType[] }> = {
  Helm: { label: 'Head', slots: ['HEAD'] }, Neck: { label: 'Neck', slots: ['NECK'] }, Shoulders: { label: 'Shoulders', slots: ['SHOULDER'] },
  Cloak: { label: 'Back', slots: ['BACK'] }, Back: { label: 'Back', slots: ['BACK'] }, Chest: { label: 'Chest', slots: ['CHEST'] },
  Bracers: { label: 'Wrist', slots: ['WRIST'] }, Wrist: { label: 'Wrist', slots: ['WRIST'] }, Hands: { label: 'Hands', slots: ['HANDS'] },
  Gloves: { label: 'Hands', slots: ['HANDS'] }, Belt: { label: 'Waist', slots: ['WAIST'] }, Waist: { label: 'Waist', slots: ['WAIST'] },
  Legs: { label: 'Legs', slots: ['LEGS'] }, Boots: { label: 'Feet', slots: ['FEET'] }, Feet: { label: 'Feet', slots: ['FEET'] },
  Ring: { label: 'Ring', slots: ['FINGER_1', 'FINGER_2'] }, Trinket: { label: 'Trinket', slots: ['TRINKET_1', 'TRINKET_2'] },
  Weapon: { label: 'Weapon', slots: ['MAIN_HAND'] }, 'Main Hand': { label: 'Main Hand', slots: ['MAIN_HAND'] },
  'Two-Hand': { label: 'Weapon', slots: ['MAIN_HAND'] }, 'Off Hand': { label: 'Off Hand', slots: ['OFF_HAND'] },
};
const IGNORED = new Set(['Shirt', 'Tabard']);

function sectionHtml(html: string, list: ListType): string {
  const start = html.indexOf(`id="${SECTION_IDS[list]}"`);
  if (start === -1) return '';
  const next = Object.values(SECTION_IDS).map((id) => html.indexOf(`id="${id}"`, start + 1)).filter((i) => i > start);
  return html.slice(start, next.length > 0 ? Math.min(...next) : undefined);
}

function parseCard(card: string): BisRow | null {
  const slotName = decodeHtml(card.match(/class="bis_item_slot">([\s\S]*?)<\/span>/)?.[1] ?? '');
  if (IGNORED.has(slotName)) return null;
  const attr = card.match(/data-wowhead="([^"]*)"/)?.[1];
  const drop = decodeHtml(card.match(/class="bis_item_drop">([\s\S]*?)<\/span>/)?.[1] ?? '');
  // 2H specs get a placeholder Off Hand with an unrelated item and no drop source.
  if (!attr || drop === '') return null;
  const slot = SLOTS[slotName];
  if (!slot) throw new Error(`Unknown Icy Veins slot "${slotName}"`);
  const params = new URLSearchParams(decodeHtml(attr));
  const itemId = Number(params.get('item'));
  const isCatalyst = params.has('original-item');
  const name = decodeHtml(card.match(/class="q\d">([\s\S]*?)<\/span>/)?.[1] ?? '');
  return {
    kind: 'item', slotLabel: slot.label, slots: slot.slots, itemId, name,
    bonusIds: params.get('bonus') ? params.get('bonus')!.split(':').map(Number) : [],
    isTier: isCatalyst, isCatalyst,
    source: isCatalyst ? drop.replace(/^Catalyst from\s+/i, '') : drop,
  };
}

export function parseIcyVeinsHtml(html: string): BisLists {
  const parse = (list: ListType) => sectionHtml(html, list).split(/<div class="bis_item[ "]/).slice(1)
    .map(parseCard).filter((r): r is BisRow => r !== null);
  return { overall: parse('overall'), mythicPlus: parse('mythicPlus'), raid: parse('raid') };
}

export function createIcyVeinsSource(fetchFn: FetchFn = fetch): BisSource {
  return {
    name: SOURCE_NAMES.icyVeins,
    async fetchLists(specSlug) {
      const url = icyVeinsUrl(specSlug);
      const res = await fetchWithRetry(fetchFn, url, { headers: { 'User-Agent': 'Mozilla/5.0 (personal gear tracker)' } });
      if (!res.ok) throw new HttpError(res.status, url, await res.text());
      return parseIcyVeinsHtml(await res.text());
    },
  };
}
```

  - Trim the slot name with `.trim()` (`decodeHtml` already trims), so `" Ring "` maps.
  - If a test shows `URLSearchParams` mangling `bonus` values, split on `&` by hand instead.
  - Confirm the `class="bis_item_slot">Helm</span>` labels against the fixture: `Head` must equal Method's label, so slot keys line up.

- [ ] **Step 6: Run them.** `npx vitest run src/core/icy-veins src/core/method`. Expected: PASS.

- [ ] **Step 7: Commit.** Use the message `feat: parse icy veins bis pages`.

### Task 4: Per-source BiS sync and the Icy Veins tier flags

**Files:**
- Modify: `src/core/sync/reference-sync.ts:35-90`
- Test: `src/core/sync/reference-sync.test.ts`

**Interfaces:**
- Consumes: Task 2 `getBisLists(db, source, slug)`; `ensureItemDetails`.
- Produces:
  - `readBisLists(db: Db, source: FetchedSourceId, specSlug: string, now: number): Promise<BisRead>`
  - `syncBisLists(deps: { db; source: BisSource; sourceId: FetchedSourceId; blizzard: BlizzardClient; region: Region; now }, specSlug): Promise<boolean>`

- [ ] **Step 1: Write the failing tests.**

```ts
it('records failures per source', async () => {
  const db = await openTestDb();
  const failing: BisSource = { name: 'Icy Veins', fetchLists: async () => { throw new Error('down'); } };
  await syncBisLists({ db, source: failing, sourceId: 'icyVeins', blizzard, region: 'eu', now: 1000 }, 'frost-mage');
  const method = await readBisLists(db, 'method', 'frost-mage', 1000);
  expect(method).toMatchObject({ status: 'loading', due: true, error: null });
  expect(await readBisLists(db, 'icyVeins', 'frost-mage', 1000)).toMatchObject({ status: 'failed', due: false });
});

it('marks Icy Veins tier rows from item details', async () => {
  const db = await openTestDb();
  const lists = { overall: [itemRow({ slotLabel: 'Head', slots: ['HEAD'], itemId: 300 }), itemRow({ slotLabel: 'Neck', slots: ['NECK'], itemId: 301 })], raid: [], mythicPlus: [] };
  const blizzard = fakeBlizzard({ itemDetails: { 300: { quality: 'EPIC', isTier: true } } });
  await syncBisLists({ db, source: { name: 'Icy Veins', fetchLists: async () => lists }, sourceId: 'icyVeins', blizzard, region: 'eu', now: 1 }, 'guardian-druid');
  const stored = (await getBisLists(db, 'icyVeins', 'guardian-druid'))!.lists.overall;
  expect(stored.map((r) => r.kind === 'item' && r.isTier)).toEqual([true, false]);
  expect(blizzard.itemDetailCalls).toEqual([300]); // Neck is not a tier slot.
});

it('a failed tier lookup records the failure and keeps the old list', async () => {
  // Seed an older icyVeins list, then sync with a blizzard whose getItemDetails throws for 300.
  // Expect readBisLists('icyVeins') to keep the old rows with status 'stale', and an error.
});
```

Build `fakeBlizzard` and `itemRow` from the helpers the file already uses (`grep -n "getItemDetails" src/core/sync/reference-sync.test.ts`). Write the third test fully in the file's style; its assertions are as in the comment.

- [ ] **Step 2: Run them.** `npx vitest run src/core/sync/reference-sync.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.**

```ts
const bisFailedKey = (source: FetchedSourceId, specSlug: string) => `bis.${source}.${specSlug}.failed`;
const TIER_SLOTS_FOR_FLAGS = new Set<SlotType>(['HEAD', 'SHOULDER', 'CHEST', 'HANDS', 'LEGS']);

/** Icy Veins names tier pieces without saying so: look up non-catalyst tier-slot rows. Throws when a lookup fails. */
async function withTierFlags(deps: { db: Db; blizzard: BlizzardClient; now: number }, region: Region, lists: BisLists): Promise<BisLists> {
  const ids = LIST_TYPES.flatMap((l) => lists[l]).flatMap((r) =>
    r.kind === 'item' && !r.isCatalyst && r.slots.some((s) => TIER_SLOTS_FOR_FLAGS.has(s)) ? [r.itemId] : []);
  const details = await ensureItemDetails(deps, region, ids);
  const missing = ids.filter((id) => !details.has(id));
  if (missing.length > 0) throw new Error(`No item details for ${missing.join(', ')}`);
  const mark = (r: BisRow): BisRow => (r.kind === 'item' && details.get(r.itemId)?.isTier ? { ...r, isTier: true } : r);
  return { overall: lists.overall.map(mark), raid: lists.raid.map(mark), mythicPlus: lists.mythicPlus.map(mark) };
}
```

  - `readBisLists` gains `source`, and passes it to `getBisLists` and `bisFailedKey`.
  - `syncBisLists` reads and writes under `sourceId`. After `fetchLists`, when `sourceId === 'icyVeins'`, it runs `lists = await withTierFlags({ db, blizzard, now }, region, lists)` before `replaceBisLists`. Everything stays inside the existing `try`, so a throw records the failure and keeps the cache.
  - Use `TIER_SLOTS` from `src/core/priority/slots` if it holds exactly these five slots. Check it, and only declare the local set if it doesn't.

- [ ] **Step 4: Fix the callers.** In `reference-run.ts`, `bis-lookup.ts`, `settings-spec.ts`, `settings-bis.ts` and the fetch route, pass `'method'` and the region for now. In the fetch route, the region is the spec's first tracked character's, else `'eu'`, as `edits.ts`'s `ensureItem` uses. Run `npm run typecheck && npx vitest run`. Expected: PASS.

- [ ] **Step 5: Commit.** Use the message `feat: sync bis lists per source with icy veins tier flags`.

### Task 5: Services and reference sync for the sources in use

**Files:**
- Modify: `src/server/services.ts`, `src/core/sync/reference-run.ts`, `src/app/api/reference/sync/route.ts`, `src/app/api/bis/fetch/route.ts`
- Modify the test builders that set `bisSource`: `src/core/sync/reference-run.test.ts`, `src/server/views/views.test.ts`, `src/server/views/group-page.test.ts`
- Test: `src/core/sync/reference-run.test.ts`

**Interfaces:**
- Consumes: `sourcesInUse` (Task 2), `manualTierItemIds` (defined here in `manual-lists.ts`; Task 6 adds the rest of that file).
- Produces:
  - `Services.bisSources: Record<FetchedSourceId, BisSource>`
  - `ReferenceSyncDeps.bisSources: Record<FetchedSourceId, BisSource>`

- [ ] **Step 1: Write the failing tests** in `reference-run.test.ts`:

```ts
it('fetches only the sources in use', async () => {
  const d = await deps();            // existing builder; give it bisSources: { method: fakeMethod, icyVeins: fakeIcy }
  await track(d.db, 'Birkibjörn', 'Mage', 'Frost');
  await updateSpecSettings(d.db, 1, 'frost-mage', { source: 'icyVeins' });
  await syncReference(d);
  expect(calls.icy).toEqual(['frost-mage']);
  expect(calls.method).toEqual([]);
});

it('syncs tier stats for an Icy Veins spec and a Manual spec', async () => {
  // Icy Veins spec: the fake list has a catalyst Head row (isTier true) with itemId 500.
  // Manual spec: insert manual_bis_items with is_tier for itemId 600 directly.
  // After syncReference, blizzard.getItemDetails was called for 500 and 600, and getTierTargetRows has both.
});
```

Write the second test fully in the file's style.

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement.** `src/core/db/queries/manual-lists.ts` starts with:

```ts
export async function manualTierItemIds(db: Db, specSlug: string): Promise<number[]> {
  const rows = await db.selectDistinct({ itemId: manualBisItems.itemId }).from(manualBisItems)
    .where(and(eq(manualBisItems.specSlug, specSlug), eq(manualBisItems.isTier, true)));
  return rows.flatMap((r) => (r.itemId === null ? [] : [r.itemId]));
}
```

The `runPass` loop body becomes:

```ts
for (const [specSlug, regions] of specs) {
  const region = [...regions][0]!;
  const tierIds = new Set<number>([...await overrideTierItemIds(db, specSlug), ...await manualTierItemIds(db, specSlug)]);
  for (const sourceId of await sourcesInUse(db, specSlug)) {
    if (await syncBisLists({ db, source: bisSources[sourceId], sourceId, blizzard, region, now }, specSlug)) requested = true;
    const { lists } = await readBisLists(db, sourceId, specSlug, now);
    for (const l of LIST_TYPES) for (const r of lists?.[l] ?? []) if (r.kind === 'item' && r.isTier) tierIds.add(r.itemId);
  }
  for (const r of regions) {
    if (await syncTierTargets({ db, blizzard, now }, { region: r, specSlug, lists: null, extraItemIds: [...tierIds] })) requested = true;
  }
}
```

  - `services.ts`: `bisSources: { method: createMethodSource(), icyVeins: createIcyVeinsSource() }`. Delete the `bisSource` field.
  - Fetch route: `const { source } = await getSpecSettings(db, s.currentAccountId(), slug)`. If it's `'manual'`, throw `UserError('Manual lists aren\'t fetched.')`. Otherwise sync `bisSources[source]` with that source ID.

  The view side calls `readTierTargets` with the effective list for one source. Its item set is a subset of the sync's, so `targetsDue` clears once the sync runs.

- [ ] **Step 4: Run it.** `npm run typecheck && npx vitest run`. Expected: PASS.

- [ ] **Step 5: Commit.** Use the message `feat: sync the bis sources each spec uses`.

### Task 6: Manual lists: read, choose and copy again

**Files:**
- Modify: `src/core/db/queries/manual-lists.ts`
- Create: `src/core/bis/spec-base.ts` (only `effectiveLists` here; Task 7 adds `readSpecBase`)
- Test: `src/core/db/queries/manual-lists.test.ts`

**Interfaces:**
- Consumes: `rowColumns`, `rowFromColumns`, `getBisLists`, `listOverrides`, `applyOverrides`, `getCatalogItems`.
- Produces:
  - `getManualLists(db, accountId, specSlug): Promise<{ lists: BisLists; copiedFrom: FetchedSourceId; copiedAt: number } | null>`
  - `effectiveLists(db, accountId, specSlug, source: FetchedSourceId): Promise<BisLists | null>`. This is null when the source has no cached rows; `edited` markers are stripped.
  - `chooseManual(db, accountId, specSlug, now): Promise<void>`. It throws `UserError('Fetch a list first, then copy it.')`.
  - `copyManual(db, accountId, specSlug, from: FetchedSourceId, now): Promise<void>`. It throws the same `UserError` when `from` has no rows.

- [ ] **Step 1: Write the failing tests.**

```ts
describe('manual lists', () => {
  it('copies the effective list of the current source, with edits applied', async () => {
    const db = await seededDb();   // method lists for frost-mage cached; catalog item 900 for the override
    await upsertOverride(db, 1, SLUG, 'method', 'mythicPlus', { slotKey: 'Head#1', itemId: 900, catalyst: false });
    await chooseManual(db, 1, SLUG, 50);
    expect(await getSpecSettings(db, 1, SLUG)).toMatchObject({ source: 'manual' });
    const manual = (await getManualLists(db, 1, SLUG))!;
    expect(manual).toMatchObject({ copiedFrom: 'method', copiedAt: 50 });
    expect(manual.lists.mythicPlus.find((r) => r.slotLabel === 'Head')).toMatchObject({ itemId: 900 });
    expect(manual.lists.mythicPlus.every((r) => r.kind !== 'item' || r.edited === undefined)).toBe(true);
  });

  it('keeps the copy when Manual is chosen again', async () => {
    // chooseManual, set source back to method, change the method override, chooseManual again:
    // the manual Head row is still the first copy's item.
  });

  it('refuses and changes nothing when the current source has no rows', async () => {
    const db = await openTestDb();
    await updateSpecSettings(db, 1, SLUG, { source: 'icyVeins' });
    await expect(chooseManual(db, 1, SLUG, 1)).rejects.toThrow('Fetch a list first, then copy it.');
    expect(await getSpecSettings(db, 1, SLUG)).toMatchObject({ source: 'icyVeins' });
    expect(await getManualLists(db, 1, SLUG)).toBeNull();
  });

  it('copy again replaces the rows and clears manual overrides', async () => {
    // chooseManual from method; upsertOverride(..., 'manual', ...); cache icyVeins lists;
    // copyManual(db, 1, SLUG, 'icyVeins', 99): rows are icyVeins', copiedFrom 'icyVeins', listOverrides(..., 'manual') all empty.
  });

  it('never shows one account another account\'s manual lists', async () => {
    // chooseManual for account 1; getManualLists(db, 2, SLUG) is null.
  });
});
```

Write the commented tests fully.

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement.**

```ts
// spec-base.ts
/** A fetched source's lists with the account's overrides for it applied. Null when the source has no cached rows. */
export async function effectiveLists(db: Db, accountId: number, specSlug: string, source: FetchedSourceId): Promise<BisLists | null> {
  const cached = await getBisLists(db, source, specSlug);
  if (!cached) return null;
  const overrides = await listOverrides(db, accountId, specSlug, source);
  const catalog = await getCatalogItems(db, LIST_TYPES.flatMap((l) => overrides[l].map((o) => o.itemId)));
  const strip = (r: BisRow): BisRow => (r.kind === 'item' ? (({ edited: _, ...rest }) => rest)(r) : r);
  const out = { overall: [], raid: [], mythicPlus: [] } as BisLists;
  for (const l of LIST_TYPES) out[l] = applyOverrides(cached.lists[l], overrides[l], catalog).rows.map(strip);
  return out;
}
```

```ts
// manual-lists.ts
// withWriteLock isn't reentrant: these tasks read first, then write in one transaction, and call no locked helper.
async function writeCopy(db: Db, accountId: number, specSlug: string, from: FetchedSourceId, lists: BisLists, now: number, setSource: boolean) {
  await db.transaction(async (tx) => {
    await tx.delete(manualBisItems).where(and(eq(manualBisItems.accountId, accountId), eq(manualBisItems.specSlug, specSlug)));
    await tx.delete(bisOverrides).where(and(eq(bisOverrides.accountId, accountId), eq(bisOverrides.specSlug, specSlug), eq(bisOverrides.source, 'manual')));
    const rows = LIST_TYPES.flatMap((listType) => lists[listType].map((row, position) => ({ accountId, specSlug, listType, position, ...rowColumns(row) })));
    if (rows.length > 0) await tx.insert(manualBisItems).values(rows);
    await tx.insert(manualBisLists).values({ accountId, specSlug, copiedFrom: from, copiedAt: now })
      .onConflictDoUpdate({ target: [manualBisLists.accountId, manualBisLists.specSlug], set: { copiedFrom: from, copiedAt: now } });
    if (setSource) await tx.insert(specSettings).values({ accountId, specSlug, source: 'manual' })
      .onConflictDoUpdate({ target: [specSettings.accountId, specSettings.specSlug], set: { source: 'manual' } });
  });
}

export async function chooseManual(db: Db, accountId: number, specSlug: string, now: number) {
  await withWriteLock(db, async () => {
    const current = await getSpecSettings(db, accountId, specSlug);
    if (current.source === 'manual') return;
    if (await getManualLists(db, accountId, specSlug)) {
      await db.insert(specSettings).values({ accountId, specSlug, source: 'manual' })
        .onConflictDoUpdate({ target: [specSettings.accountId, specSettings.specSlug], set: { source: 'manual' } });
      return;
    }
    const lists = await effectiveLists(db, accountId, specSlug, current.source);
    if (!lists) throw new UserError('Fetch a list first, then copy it.');
    await writeCopy(db, accountId, specSlug, current.source, lists, now, true);
  });
}

export async function copyManual(db: Db, accountId: number, specSlug: string, from: FetchedSourceId, now: number) {
  await withWriteLock(db, async () => {
    const lists = await effectiveLists(db, accountId, specSlug, from);
    if (!lists) throw new UserError('Fetch a list first, then copy it.');
    await writeCopy(db, accountId, specSlug, from, lists, now, false);
  });
}
```

  - `getManualLists` reads `manualBisLists`, then the rows ordered by `listType` and `position`, mapped through `rowFromColumns`.
  - `rowColumns` must accept a row without `listId`/`position` (see Task 2).
  - `getSpecSettings` and `effectiveLists` are plain reads with no lock, so calling them inside the task is safe.
  - Reads run before `db.transaction` opens, because the in-memory DB has one connection.

- [ ] **Step 4: Run them.** `npx vitest run src/core/db/queries/manual-lists.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit.** Use the message `feat: copy bis lists into manual lists`.

### Task 7: One source-aware read for every reader

**Files:**
- Modify: `src/core/bis/spec-base.ts`, `src/server/views/bis-lookup.ts`, `src/server/views/settings-spec.ts`, `src/server/views/settings-bis.ts`, `src/core/bis/edits.ts`
- Test: `src/core/bis/spec-base.test.ts`; update `src/server/views/views.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 4 and 6.
- Produces:
  - `readSpecBase(db, accountId, specSlug, now): Promise<SpecBase>`, where `SpecBase = BisRead & { source: BisSourceId; copiedFrom: FetchedSourceId | null }`
  - `SpecBis` (in `bis-lookup.ts`) gains `source` and `copiedFrom`.

- [ ] **Step 1: Write the failing tests.**

```ts
describe('readSpecBase', () => {
  it('reads the chosen fetched source and never reads another source\'s rows', async () => {
    const db = await openTestDb();
    await replaceBisLists(db, 'method', SLUG, someLists, 1);
    await updateSpecSettings(db, 1, SLUG, { source: 'icyVeins' });
    expect(await readSpecBase(db, 1, SLUG, 2)).toMatchObject({ source: 'icyVeins', lists: null, status: 'loading', due: true });
  });
  it('reads Manual as ready, not due, without errors, aged by its copy', async () => {
    // cache method lists, record a method failure (setMeta 'bis.method.<slug>.failed'), chooseManual at 40:
    // readSpecBase(..., 10_000) → { source: 'manual', copiedFrom: 'method', status: 'ready', due: false, error: null, fetchedAt: 40 }
  });
});
```

In `views.test.ts`, add one test per page: with the source set to Icy Veins and only Method cached, the character page shows `bisLoading`, not Method's rows.

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement.**

```ts
export interface SpecBase extends BisRead { source: BisSourceId; copiedFrom: FetchedSourceId | null }

/** The spec's base lists for an account: its chosen source's cache, or its manual copy. Database reads only. */
export async function readSpecBase(db: Db, accountId: number, specSlug: string, now: number): Promise<SpecBase> {
  const { source } = await getSpecSettings(db, accountId, specSlug);
  if (source !== 'manual') return { ...(await readBisLists(db, source, specSlug, now)), source, copiedFrom: null };
  const manual = await getManualLists(db, accountId, specSlug);
  return { lists: manual?.lists ?? null, fetchedAt: manual?.copiedAt ?? null, error: null, status: 'ready', due: false, source, copiedFrom: manual?.copiedFrom ?? null };
}
```

  - `readEffective`: `const read = await readSpecBase(...)`, then `listOverrides(db, accountId, slug, read.source)`. Return `source` and `copiedFrom` as well.
  - `settings-spec.ts`: use `readSpecBase` and source-specific overrides. Add `source`, `copiedFrom` and `copiedAt` (`read.source === 'manual' ? read.fetchedAt : null`) to the view. `fetchedAt` keeps meaning "Method or Icy Veins cache age".
  - `settings-bis.ts`: the same read per spec. `PickerSpecView` gains `source`.
  - `edits.ts`:
    - `RowRef` gains `source: BisSourceId`.
    - `resolveRow(db, accountId, ref)` calls `readSpecBase`. If `base.source !== ref.source`, it throws `UserError('The BiS source changed. Reload the page.')`.
    - The missing-list message becomes `` `${SOURCE_NAMES[base.source]} has no list for this spec yet. Fetch it first.` `` and the bad-slot message becomes `` `That slot isn't in ${SOURCE_NAMES[base.source]}'s list.` ``.
    - `searchItems(db, accountId, ref, query)`, `lookupItem` and `saveOverride` thread `accountId` through; `EditDeps` already has it.
    - `saveOverride` and `removeOverride` write under `ref.source`, after `resolveRow` has confirmed it matches.
  - `route-helpers.ts`: `parseRowRef` reads `body.source` with `isBisSourceId`. If it's invalid, throw `UserError('Unknown source.')`.
  - Update the item search and lookup routes to the new signatures.

- [ ] **Step 4: Run everything.** `npm run typecheck && npx vitest run`. Expected: PASS.

- [ ] **Step 5: Commit.** Use the message `feat: read each spec's chosen bis source everywhere`.

### Task 8: Routes: choose a source, copy again, and the source check

**Files:**
- Modify: `src/app/api/bis/settings/route.ts`
- Create: `src/app/api/bis/manual/copy/route.ts`
- Test: route tests beside the routes, following the existing pattern (`grep -rln "PATCH" src/app/api --include=*.test.ts`). If there are none, test through the core functions and add one route test file for the source check.

**Interfaces:**
- Consumes: `chooseManual`, `copyManual`, `updateSpecSettings`, `isBisSourceId`.
- Produces: `PATCH /api/bis/settings { specSlug, source?, listType?, statsMatter? }`; `POST /api/bis/manual/copy { specSlug, from }`.

- [ ] **Step 1: Write the failing tests.**
  - The settings PATCH with `source: 'icyVeins'` saves it.
  - `source: 'manual'` runs `chooseManual`, so the manual lists exist.
  - `source: 'wowhead'` is a 400 "Unknown source."
  - The copy route with `from: 'manual'` is a 400.
  - A copy with nothing cached is a 400 "Fetch a list first, then copy it."
  - **Source mismatch answers 400:** the spec's source is Icy Veins, and `PUT /api/bis/overrides` sends `source: 'method'`. Expect a 400 "The BiS source changed. Reload the page.", and no override row under either source.

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement.** In the settings route:

```ts
if (body.source !== undefined) {
  if (!isBisSourceId(body.source)) throw new UserError('Unknown source.');
  if (body.source === 'manual') await chooseManual(s.db, s.currentAccountId(), body.specSlug, s.now());
  else patch.source = body.source;
}
```

  - Run `chooseManual` before `updateSpecSettings`, and run `updateSpecSettings` only when `patch` has keys. The "Nothing to change." check counts the `source` too.
  - The copy route validates `specSlug` with `knownSpecSlug`, and `from` with `(FETCHED_SOURCES as readonly string[]).includes(...)`. Then it calls `copyManual`.

- [ ] **Step 4: Run everything.** `npm run typecheck && npx vitest run`. Expected: PASS.

- [ ] **Step 5: Commit.** Use the message `feat: add bis source and manual copy routes`.

### Task 9: Source names in views and text helpers

**Files:**
- Modify: `src/server/views/types.ts`, `character-page.ts`, `group-page.ts`, `member.ts`
- Modify: `src/components/bis-source-badge/badge-text.ts` (+ test)
- Modify: `src/components/bis-editor/editor-text.ts` (+ test)
- Modify: `GearTable.tsx`, `DungeonPriority.tsx`, `GroupPriority.tsx`, `MemberHeader.tsx`, `BisEditor.tsx`, `SlotRow.tsx`, `OrphanList.tsx`, `ItemSearch.tsx`, `SpecPicker.tsx`, `TrackedCard.tsx`, `(home)/page.tsx`, `(home)/loading.tsx`, `credit-detail.ts`, `cell-note.ts`, `chip-label.ts`, and the `settings/bis/[spec]/page.tsx` empty state
- Test: the `.test.ts` beside each changed helper and component, plus `views.test.ts` and `group-page.test.ts`

**Interfaces:**
- Consumes: `SpecBis.source`; `SOURCE_NAMES`.
- Produces:
  - `CharacterPageView.bisSource: BisSourceId`
  - `PriorityView.source: BisSourceId`
  - `GroupMemberView.source: BisSourceId`
  - `GroupPriorityView.fellBack: { name: string; from: ListType; source: BisSourceId }[]`
  - `badgeText(source: BisSourceId, editedCount)`
  - `fetchedLine(view: { source; fetchedAt; copiedFrom; copiedAt }, now)`
  - `pickColumn(source)`
  - `followsText(source)`
  - `orphanText(source)`
  - `fallbackText(source, from: ListType)`

- [ ] **Step 1: Write the failing helper tests.**

```ts
// badge-text.test.ts
expect(badgeText('icyVeins', 2)).toEqual({ source: 'From Icy Veins', edited: '2 edited' });
expect(badgeText('manual', 0)).toEqual({ source: 'Manual', edited: null });

// editor-text.test.ts
expect(fetchedLine({ source: 'icyVeins', fetchedAt: null, copiedFrom: null, copiedAt: null }, NOW)).toBe('Icy Veins list not fetched');
expect(fetchedLine({ source: 'manual', fetchedAt: null, copiedFrom: 'method', copiedAt: NOW - 2 * DAY }, NOW)).toBe('Manual · copied from Method 2 days ago');
expect(pickColumn('icyVeins')).toBe('Icy Veins’s pick');
expect(pickColumn('manual')).toBe('Copied pick');
expect(followsText('manual')).toBe('Follows your copy');
expect(followsText('method')).toBe('Follows Method');
expect(fallbackText('icyVeins', 'raid')).toBe('Icy Veins has no Raid list for this spec. Showing Overall.');
```

  - Match the age wording that `formatAge` produces. Check it and copy its exact output into the test.
  - For the apostrophe, use the one the current UI uses: `Method&apos;s` renders `'`. Keep `'`, and write the test as `"Icy Veins's pick"`.

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement the helpers.**
  - `badgeText(source, n)`: `source === 'manual' ? 'Manual' : \`From ${SOURCE_NAMES[source]}\``.
  - `pickColumn`: `source === 'manual' ? 'Copied pick' : \`${SOURCE_NAMES[source]}'s pick\``.
  - `followsText`: `source === 'manual' ? 'Follows your copy' : \`Follows ${SOURCE_NAMES[source]}\``.
  - `orphanText(source)`: `{ heading: \`No longer in ${owner} list\`, body: \`${who} dropped these slots. Your picks for them aren't applied.\` }`. Here `owner` is `"Method's"` or `"your copy's"`, and `who` is the source name or "Copy again".
  - `fallbackText(source, from)`: `` `${SOURCE_NAMES[source]} has no ${LIST_NAMES[from]} list for this spec. Showing Overall.` ``
  - `fetchedLine`:
    - Manual: `` `Manual · copied from ${SOURCE_NAMES[copiedFrom]} ${formatAge(copiedAt, now)}` ``
    - Not fetched: `` `${name} list not fetched` ``
    - Otherwise: `` `${name} list fetched ${formatAge(...)}` ``

  Put `fallbackText` in `src/components/shared/fallback-text.ts`, because three components use it.

- [ ] **Step 4: Thread `source` through the views, then the components.**
  - `GearTable`, `DungeonPriority` and `GroupPriority` notices use `fallbackText`. Dungeon priority keeps its own lead-in: "Using the Overall list: " + the source sentence, with the spec label.
  - `MemberHeader` title: `` `${SOURCE_NAMES[member.source]} has no list of that kind for this spec` ``.
  - The editor uses `pickColumn`, `followsText`, `orphanText`, and "Replace <pickColumn-owner> <slot> pick".
  - Credit labels (`credit-detail.ts`, `cell-note.ts`, `chip-label.ts`) drop the word "Method": "BiS stats", "BiS item", "BiS wants". Update their tests' expected strings.
  - The home subtitle reads "BiS progress against your BiS lists".
  - `SpecPicker` intro: "Pick each spec's BiS source and which list it compares against, and swap single slots for your own picks. A change applies to every character of that spec." Untracked hint: "Untracked specs need their list fetched before you can edit them."
  - `TrackedCard` shows `SOURCE_NAMES[spec.source]` beside "Compares <list>".
  - The settings page empty state reads `` `${SOURCE_NAMES[view.source]} has no list for this spec yet. Fetch it first.` ``. Don't show Fetch on Manual, which always has lists.

  Run `grep -rn "Method" src --include=*.tsx --include=*.ts | grep -v "test\|methodSpecSlug\|methodSlug\|method/method\|methodPick\|SOURCE_NAMES"`. Only code comments may remain.

- [ ] **Step 5: Run everything.** `npm run typecheck && npm run lint && npx vitest run`. Expected: PASS.

- [ ] **Step 6: Commit.** Use the message `feat: name the chosen bis source in views`.

### Task 10: Source picker and Copy again in the editor

**Files:**
- Create: `src/components/bis-editor/SourcePicker.tsx`, `src/components/bis-editor/CopyAgain.tsx`, `src/components/bis-editor/source-picker.ts` (+ `source-picker.test.ts`)
- Modify: `BisEditor.tsx`, `EditorHeader.tsx`, `FetchButton` usage (hidden on Manual), and every client call that writes overrides or searches (`SlotRow`, `ItemSearch`, `OrphanList` and their hooks). These now send `source: view.source`.
- Test: `source-picker.test.ts`, `BisEditor.test.ts`

**Interfaces:**
- Consumes: `SettingsSpecView.source`, `copiedFrom`, `copiedAt`; `useApiAction`; `SOURCE_NAMES`.
- Produces:
  - `sourceOptions(): { value: BisSourceId; label: string }[]`, in the order Method, Icy Veins, Manual.
  - `copyChoices(copiedFrom: FetchedSourceId | null): FetchedSourceId[]`, which returns both fetched sources, the one copied from first.

- [ ] **Step 1: Write the failing tests.**

```ts
expect(sourceOptions().map((o) => o.label)).toEqual(['Method', 'Icy Veins', 'Manual']);
expect(copyChoices('icyVeins')).toEqual(['icyVeins', 'method']);
expect(copyChoices(null)).toEqual(['method', 'icyVeins']);
```

In `BisEditor.test.ts`:
  - Rendered with `source: 'manual'`, the markup contains `Copied pick`, `Copy again`, and no `Refresh`.
  - Rendered with `source: 'icyVeins'`, the markup contains `Icy Veins's pick` and a checked radio `value="icyVeins"`.

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement.**
  - **`SourcePicker`:** a copy of `CompareAgainst.tsx`'s markup and classes, with the legend "BiS source", `name="bis-source"`, options from `sourceOptions()`, and `body: JSON.stringify({ specSlug, source: value })`. Helper text: "Where this spec's list comes from. Manual copies the current list for you to edit." It sits first inside the comparison `<section>`, which becomes `xl:grid-cols-3`; stacked below `xl`.
  - **`CopyAgain`** (client):
    - A `<details>` with the summary "Copy again".
    - For each `copyChoices(view.copiedFrom)` source, a button "From <name>".
    - Clicking a button reveals an inline confirm: "Replace your manual list with <name>'s? Your edits on it are lost." with "Replace" and "Cancel" buttons.
    - "Replace" runs `POST /api/bis/manual/copy`, then refreshes. No `window.confirm`: browser dialogs are avoided in this app.
  - **`EditorHeader`:** use `fetchedLine(view, now)`. When `view.source === 'manual'`, render `CopyAgain` in place of `FetchButton`, on both phone and desktop.
  - **Override and search calls:** add `source` to every JSON body and query string that builds a `RowRef`.

- [ ] **Step 4: Run everything.** `npm run typecheck && npm run lint && npx vitest run`. Expected: PASS.

- [ ] **Step 5: Commit.** Use the message `feat: pick a bis source and copy manual lists in the editor`.

### Task 11: Live test and final gate

**Files:**
- Create: `src/core/icy-veins/icy-veins.live.test.ts`

- [ ] **Step 1: Write the live test.** It runs only under `npm run test:live`.

```ts
import { describe, expect, it } from 'vitest';
import { createIcyVeinsSource } from './icy-veins';

// All 40 specs, as the spike's sitemap listed them. Kept here, not derived, so a wrong role table entry fails.
const SLUGS = ['affliction-warlock', 'arcane-mage', 'arms-warrior', 'assassination-rogue', 'augmentation-evoker', 'balance-druid', 'beast-mastery-hunter', 'blood-death-knight', 'brewmaster-monk', 'demonology-warlock', 'destruction-warlock', 'devastation-evoker', 'devourer-demon-hunter', 'discipline-priest', 'elemental-shaman', 'enhancement-shaman', 'feral-druid', 'fire-mage', 'frost-death-knight', 'frost-mage', 'fury-warrior', 'guardian-druid', 'havoc-demon-hunter', 'holy-paladin', 'holy-priest', 'marksmanship-hunter', 'mistweaver-monk', 'outlaw-rogue', 'preservation-evoker', 'protection-paladin', 'protection-warrior', 'restoration-druid', 'restoration-shaman', 'retribution-paladin', 'shadow-priest', 'subtlety-rogue', 'survival-hunter', 'unholy-death-knight', 'vengeance-demon-hunter', 'windwalker-monk'];

describe('Icy Veins live', () => {
  const source = createIcyVeinsSource();
  it.each(SLUGS)('%s parses three lists', async (slug) => {
    const lists = await source.fetchLists(slug);
    expect(lists.overall.length).toBeGreaterThan(10);
    expect(lists.mythicPlus.length).toBeGreaterThan(10);
    expect(lists.raid.length).toBeGreaterThan(10);
  }, 30_000);
  it('gives a two-handed spec no off hand', async () => {
    const lists = await source.fetchLists('beast-mastery-hunter');
    expect(lists.overall.some((r) => r.slots.includes('OFF_HAND'))).toBe(false);
  }, 30_000);
});
```


- [ ] **Step 2: Run it.** `npm run test:live -- src/core/icy-veins`. Expected: PASS. If a spec fails on an unknown slot name, add the name to `SLOTS` with a unit test, then rerun.

- [ ] **Step 3: Run the full gate.** `npm run typecheck && npm run lint && npm test`. Then build in a separate worktree:

```sh
git worktree add ../wgt-bis-sources HEAD && cd ../wgt-bis-sources && npm ci && npm run build; cd - && git worktree remove --force ../wgt-bis-sources
```

- [ ] **Step 4: Hand-check on a production start against a copy of `data/app.db`.** Copy `.env` and `data/` into the worktree, run `npx next start -p 3001`, and delete both afterwards.
  - The migration runs, and existing overrides still show under Method.
  - Switching Frost Mage to Icy Veins fetches and shows its lists, and the badge reads "From Icy Veins".
  - Switching back brings the Method edits back.
  - Manual copies the list, and "Copy again" replaces it after the confirm.
  - Check 390 px and 1280 px widths.

- [ ] **Step 5: Commit.** Use the message `chore: add icy veins live test`. Push, and open the PR with `Closes #125.`.
