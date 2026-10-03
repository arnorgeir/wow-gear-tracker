# Plan 3a: Season Loot and Dungeon Priority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load the current season's Mythic+ loot, score the season's dungeons for a character, and show that ranking beside the gear table on the character page.

**Architecture:** "Any 334" BiS rows become a second kind of `BisRow`, handled everywhere rows are read. New Blizzard and Raider.IO client calls feed a season loader behind a background sync route, which stores one season in two new tables. A pure scoring engine in `src/core/priority/` takes a list of characters and the season's loot. The character page view runs it for one character, and a new section renders the result.

**Tech Stack:** TypeScript, Next.js 16 App Router, React 19, Drizzle over libsql, Vitest 5 in a Node environment.

**Spec:** `docs/superpowers/specs/2026-09-30-plan-3a-dungeon-priority-design.md`, whose parent `docs/superpowers/specs/2026-09-26-gear-tracker-design.md` stays the authority for the scoring rules.

## Global Constraints

- **Read `AGENTS.md` first. It is binding.** The rules this plan leans on most:
  - Logic modules never touch the network or the database.
  - Every database write goes through `withWriteLock`.
  - Schema changes go in `src/core/db/schema.ts`, then `npm run db:generate -- --name <name>`. Never edit a committed migration.
  - Check errors with `isHttpError`/`isUserError`, never `instanceof`.
  - Components stay markup; branching logic goes in plain `.ts` files with tests.
- **Tests first.** Write the failing test, watch it fail for the right reason, then implement.
- Tests are `src/**/*.test.ts` in a Node environment with no DOM. Server components are tested with `renderToStaticMarkup`; nothing using a hook is unit-tested.
- Fixtures use realistic made-up names (`Birkibjörn`, made-up dungeon names) and trimmed pages, never copies of third-party pages.
- **Never run `npm run build` while `npm run dev` serves this folder.**
- Commit subjects are Conventional Commits, lowercase and imperative, with prose bodies. **No AI attribution in any commit or PR.**
- Gate before each task's final commit: `npm run typecheck && npm run lint && npm test`, where lint prints nothing. Also run `npm run build` when pages or components changed.
- Copy on screen, from the spec: "Loading this season's loot…", "Using the Overall list: Method has no Mythic+ list for <spec> <class>", "Weights are approximate while upgrade track data is unavailable", "No season dungeon drops anything you still need.", "Nothing you need from: …", "Any item, level <N>+", "Tier via catalyst".

## Review Focus

- **No season data, and the load failed.** The spec's states table has no row for this, and without one the page would say "Loading…" forever. **Ruling:** a `failed` state reads "This season's loot couldn't be loaded. It will retry within the hour." Tested in Task 5 (`readSeason`) and Task 8 (the section).
- **An existing install's cached BiS rows surviving the `bis_items` migration.** Making `item_id` nullable rebuilds the table in SQLite. Task 1 runs the migration against a copy of a real database and compares row counts.
- **A character with no gear yet.** Every row is missing at weight 3, tier rows +2, and nothing crashes. Tested in Task 6.
- **A class the armor table doesn't know.** Armor-slot rows get no credit rather than credit from every dungeon. Tested in Task 6.
- **A season dungeon with no matching journal instance.** The whole load fails, the previous season stays, and the page marks it stale. Tested in Task 5.

---

### Task 1: "Any" BiS rows, end to end

`BisRow` becomes a union, which breaks every reader at once, so this is one task that ends green. The tests come first and fail at runtime.

**Files:**
- Modify: `src/core/types.ts` (`BisRow` becomes a union)
- Create: `src/core/method/__fixtures__/feral-gearing.html`
- Modify: `src/core/method/method.ts`, `src/core/method/method.test.ts`
- Modify: `src/core/db/schema.ts` (`bis_items`); generated: `drizzle/0005_bis-any-rows.sql`
- Modify: `src/core/db/queries/bis-lists.ts`, `src/core/db/queries/bis-lists.test.ts`
- Modify: `src/core/gear/evaluate.ts`, `src/core/gear/evaluate.test.ts`
- Modify: `src/server/views/types.ts`, `src/server/views/character-page.ts`, `src/server/views/views.test.ts`
- Create: `src/components/character-page/AnyItemCard.tsx`
- Modify: `src/components/character-page/BisTarget.tsx`
- Modify: `src/core/sync/reference-sync.test.ts` (its row literal gains `kind`)

**Interfaces:**
- Produces, in `src/core/types.ts`:

```ts
interface BisRowBase { slotLabel: string; slots: SlotType[]; source: string }
export interface BisItemRow extends BisRowBase { kind: 'item'; itemId: number; name: string; bonusIds: number[]; isTier: boolean; isCatalyst: boolean }
export interface BisAnyRow extends BisRowBase { kind: 'any'; minItemLevel: number }
export type BisRow = BisItemRow | BisAnyRow;
```

- Produces, in `src/server/views/types.ts`: `BisView`, and `GearRowView.bis: BisView`:

```ts
export type BisView =
  | (ItemView & { kind: 'item'; isTier: boolean; isCatalyst: boolean; source: string })
  | { kind: 'any'; minItemLevel: number; source: string };
```

- [ ] **Step 1: Write the fixture**

Create `src/core/method/__fixtures__/feral-gearing.html`, a trimmed version of the shape found on Feral Druid's live page. The header row uses `<td>`, so it reaches the link check:

```html
<div role="tabpanel" class="tab-pane" id="overall_table"><div class="gear-table-inner"><h3>Overall Best Gear</h3>
<table class="table table-bordered table-article"><tbody>
<tr><td><b>Slot</b></td><td><b>Item</b></td><td><b>Source</b></td></tr>
<tr><td>Head</td><td><a href="https://www.wowhead.com/item=271875/gaze-of-the-coiled-watcher" class="q4"><span>Gaze of the Coiled Watcher</span></a> (Tier Set)</td><td>Ula&rsquo;tek (Catalyst)</td></tr>
<tr><td>Shoulders</td><td>Any 334</td><td>-</td></tr>
<tr><td>Chest</td><td>Any 334</td><td>-</td></tr>
<tr><td>Gloves</td><td>Any 334</td><td>-</td></tr>
<tr><td>Boots</td><td>Any 334</td><td>-</td></tr>
</tbody></table></div></div>
```

- [ ] **Step 2: Write the failing tests**

Append to `src/core/method/method.test.ts`:

```ts
const feral = readFileSync(new URL('./__fixtures__/feral-gearing.html', import.meta.url), 'utf8');

describe('"Any" rows', () => {
  const lists = parseGearingHtml(feral);

  it('keeps an "Any <item level>" row and still skips the header', () => {
    expect(lists.overall).toHaveLength(5);
    expect(lists.overall[1]).toEqual({ kind: 'any', slotLabel: 'Shoulders', slots: ['SHOULDER'], minItemLevel: 334, source: '' });
    expect(lists.overall.filter((r) => r.kind === 'any').map((r) => r.slotLabel)).toEqual(['Shoulders', 'Chest', 'Gloves', 'Boots']);
    expect(lists.mythicPlus).toEqual([]);
  });

  it('still reads the named rows on the same page', () => {
    expect(lists.overall[0]).toMatchObject({ kind: 'item', itemId: 271875, isTier: true });
  });
});
```

Append to `src/core/db/queries/bis-lists.test.ts`, inside its file with the existing imports:

```ts
describe('any rows', () => {
  it('stores and reads back an any row beside an item row', async () => {
    const db = await openTestDb();
    const lists: BisLists = {
      overall: [
        { kind: 'item', slotLabel: 'Head', slots: ['HEAD'], itemId: 271875, name: 'Gaze of the Coiled Watcher', bonusIds: [], isTier: true, isCatalyst: true, source: 'Ula’tek' },
        { kind: 'any', slotLabel: 'Shoulders', slots: ['SHOULDER'], minItemLevel: 334, source: '' },
      ],
      raid: [],
      mythicPlus: [],
    };
    await replaceBisLists(db, 'feral-druid', lists, 1);
    expect((await getBisLists(db, 'feral-druid'))!.lists.overall).toEqual(lists.overall);
  });
});
```

Append to `src/core/gear/evaluate.test.ts`:

```ts
const anyRow = (slots: SlotType[], minItemLevel: number): BisRow => ({ kind: 'any', slotLabel: slots[0]!, slots, minItemLevel, source: '' });

describe('any rows', () => {
  it('is done when the slot holds an item at or above the item level', () => {
    const [at, below] = evaluateGear({ equipped: [item('SHOULDER', 5), item('FEET', 6)], bisRows: [anyRow(['SHOULDER'], 300), anyRow(['FEET'], 301)], tracks });
    expect(at).toMatchObject({ matched: true, state: 'done' });
    expect(below).toMatchObject({ matched: false, state: 'missing' });
  });

  it('never reports a track state, even on a Myth item below max', () => {
    const [row] = evaluateGear({ equipped: [item('SHOULDER', 5, [2])], bisRows: [anyRow(['SHOULDER'], 300)], tracks });
    expect(row!.state).toBe('done');
  });

  it('is missing when the item has no item level, and when the slot is empty', () => {
    const [noLevel, empty] = evaluateGear({
      equipped: [{ ...item('SHOULDER', 5), itemLevel: null }],
      bisRows: [anyRow(['SHOULDER'], 1), anyRow(['FEET'], 1)],
      tracks,
    });
    expect(noLevel!.state).toBe('missing');
    expect(empty).toMatchObject({ state: 'missing', equipped: null });
  });
});
```

Append to `src/server/views/views.test.ts`:

```ts
describe('any rows on the character page', () => {
  it('shows an any card, and counts a vault choice at its item level as BiS', async () => {
    const anyLists: BisLists = { overall: [], raid: [], mythicPlus: [{ kind: 'any', slotLabel: 'Shoulders', slots: ['SHOULDER'], minItemLevel: 334, source: '' }] };
    const s = await services(anyLists);
    const id = await seed(s, false);
    await saveSnapshotIfChanged(s.db, id, 'simc', [
      { location: 'equipped', slot: 'SHOULDER', itemId: 70, name: 'Worn Mantle', itemLevel: 321, quality: 'EPIC', bonusIds: [], isTier: false },
      { location: 'vault', slot: 'SHOULDER', itemId: 71, name: 'Vault Mantle', itemLevel: 334, quality: 'EPIC', bonusIds: [], isTier: false },
      { location: 'vault', slot: 'SHOULDER', itemId: 72, name: 'Low Mantle', itemLevel: 320, quality: 'EPIC', bonusIds: [], isTier: false },
    ], 500);
    const page = await getCharacterPage(s, id);
    expect(page!.rows[0]).toMatchObject({ state: 'missing', bis: { kind: 'any', minItemLevel: 334, source: '' } });
    expect(page!.vaultChoices.map((c) => [c.itemId, c.isBis])).toEqual([[71, true], [72, false]]);
  });
});
```

- [ ] **Step 3: Run them and watch them fail**

Run: `npx vitest run src/core/method src/core/db/queries/bis-lists.test.ts src/core/gear/evaluate.test.ts src/server/views`
Expected: the new tests fail. The parser still skips "Any" rows (length 1, not 5); the any row doesn't round-trip; evaluate matches by item ID (every any row reports `missing`, or throws on `itemId`); the page has no `bis.kind`.

- [ ] **Step 4: Change the type**

In `src/core/types.ts`, replace `export interface BisRow { … }` with the union from the Interfaces block above.

Then give every existing `BisRow` literal in the tests `kind: 'item'` as its first field. They are every object literal containing `isCatalyst:` in `bis-lists.test.ts`, `evaluate.test.ts` (the `row` helper), `method.test.ts` (the `toEqual` for `lists.overall[0]`), `reference-sync.test.ts` and `views.test.ts` (the `lists` constant). `npm run typecheck` names any you miss.

- [ ] **Step 5: The parser**

In `src/core/method/method.ts`, inside `parseTable`, replace everything from `const link = …` through the end of `rows.push({ … });` with:

```ts
    const link = cells[1]!.match(/href="[^"]*?item=(\d+)[^"?]*(?:\?bonus=([\d:]+))?"/);
    const itemText = decodeHtml(cells[1]!);
    // Some rows name no item, only an item level: "Any 334" means any item for the slot at that level.
    const anyLevel = link ? null : itemText.match(/^Any (\d+)$/);
    if (!link && !anyLevel) continue;
    const slotLabel = decodeHtml(cells[0]!);
    const sourceText = decodeHtml(cells[2]!);
    const slots = SLOT_MAP[slotLabel] ?? [];
    if (anyLevel) {
      rows.push({ kind: 'any', slotLabel, slots, minItemLevel: Number(anyLevel[1]), source: sourceText === '-' ? '' : sourceText });
      continue;
    }
    rows.push({
      kind: 'item',
      slotLabel,
      slots,
      itemId: Number(link![1]),
      name: itemText.replace(/\s*\(Tier Set\)\s*$/i, ''),
      bonusIds: link![2] ? link![2].split(':').map(Number) : [],
      isTier: /\(Tier Set\)/i.test(itemText),
      isCatalyst: /\(Catalyst\)/i.test(sourceText),
      source: sourceText.replace(/\s*\(Catalyst\)\s*$/i, ''),
    });
```

- [ ] **Step 6: The schema and migration**

In `src/core/db/schema.ts`, in `bisItems`, replace `itemId: integer('item_id').notNull(),` with:

```ts
  /** Null for an "Any" row, which names no item. */
  itemId: integer('item_id'),
  /** Set only for an "Any" row: the item level any item in the slot must reach. */
  minItemLevel: integer('min_item_level'),
```

Run: `npm run db:generate -- --name bis-any-rows`
Expected: `drizzle/0005_bis-any-rows.sql`. SQLite can't drop a `NOT NULL` in place, so the file rebuilds `bis_items`: it creates `__new_bis_items`, copies with `INSERT INTO … SELECT …`, drops the old table and renames. Open it and confirm the `INSERT … SELECT` lists every existing column. A rebuild without the copy would wipe cached BiS lists.

- [ ] **Step 7: Prove the migration keeps existing rows**

This is Review Focus item 2. Against a copy of a real database, never the original:

```bash
S="$(mktemp -d)"; cp data/app.db "$S/check.db"
cat > "$S/check.mjs" <<'EOF'
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
const client = createClient({ url: `file:${process.argv[2]}` });
const count = async () => (await client.execute('select count(*) as n from bis_items')).rows[0].n;
const before = await count();
await migrate(drizzle(client), { migrationsFolder: 'drizzle' });
const after = await count();
const nulls = (await client.execute('select count(*) as n from bis_items where item_id is null')).rows[0].n;
console.log({ before, after, nullItemIds: nulls });
EOF
node "$S/check.mjs" "$S/check.db"
```

Expected: `before` equals `after`, and `nullItemIds` is 0. If you have no `data/app.db`, run `npm run dev` once, add a character, stop dev, and repeat.

- [ ] **Step 8: The queries**

In `src/core/db/queries/bis-lists.ts`, add above `replaceBisLists`:

```ts
const toColumns = (row: BisRow, listId: number, position: number) => row.kind === 'item'
  ? { listId, position, slotLabel: row.slotLabel, slots: row.slots, source: row.source, itemId: row.itemId, name: row.name,
      bonusIds: row.bonusIds, isTier: row.isTier, isCatalyst: row.isCatalyst, minItemLevel: null }
  : { listId, position, slotLabel: row.slotLabel, slots: row.slots, source: row.source, itemId: null, name: `Any ${row.minItemLevel}`,
      bonusIds: [], isTier: false, isCatalyst: false, minItemLevel: row.minItemLevel };

const fromColumns = (r: typeof bisItems.$inferSelect): BisRow => r.minItemLevel !== null
  ? { kind: 'any', slotLabel: r.slotLabel, slots: r.slots, minItemLevel: r.minItemLevel, source: r.source }
  : { kind: 'item', slotLabel: r.slotLabel, slots: r.slots, itemId: r.itemId!, name: r.name, bonusIds: r.bonusIds,
      isTier: r.isTier, isCatalyst: r.isCatalyst, source: r.source };
```

Change the insert to `rows.map((row, position) => toColumns(row, list!.id, position))`. In `getBisLists`, replace the `rows.map(({ slotLabel, … }) => ({ … }))` with `rows.map(fromColumns)`. Import `type BisRow` from `'../../types'`.

- [ ] **Step 9: Evaluation**

In `src/core/gear/evaluate.ts`, replace `isMatch` and the first line of `stateFor`:

```ts
const isMatch = (row: BisRow, item: GearItem | undefined) => {
  if (!item) return false;
  if (row.kind === 'any') return item.itemLevel !== null && item.itemLevel >= row.minItemLevel;
  return row.isTier ? item.isTier : item.itemId === row.itemId;
};

function stateFor(row: BisRow, matched: boolean, track: Track | null, bagItemIds: ReadonlySet<number>): ItemState {
  // An "Any" row asks only for an item level, so track states and bags don't apply to it.
  if (row.kind === 'any') return matched ? 'done' : 'missing';
  if (!matched) return !row.isTier && bagItemIds.has(row.itemId) ? 'inBags' : 'missing';
```

The rest of `stateFor` is unchanged.

- [ ] **Step 10: The view**

In `src/server/views/types.ts`, add `BisView` from the Interfaces block and change `GearRowView.bis` to `bis: BisView;`.

In `src/server/views/character-page.ts`:
- Replace `...gearRows.map((r) => r.row.itemId)` in `iconIds` with `...gearRows.flatMap((r) => (r.row.kind === 'item' ? [r.row.itemId] : []))`.
- Replace the `bis: { … }` object in the `rows` mapping with:

```ts
    bis: r.row.kind === 'item'
      ? {
          kind: 'item' as const,
          ...itemView({ itemId: r.row.itemId, name: r.row.name, itemLevel: null, quality: 'EPIC', bonusIds: r.row.bonusIds }, icons, null),
          isTier: r.row.isTier,
          isCatalyst: r.row.isCatalyst,
          source: r.row.source,
        }
      : { kind: 'any' as const, minItemLevel: r.row.minItemLevel, source: r.row.source },
```

- Replace `isBis` with:

```ts
  const isBis = (item: SnapshotItemInput) => listRows.some((r) => r.kind === 'any'
    ? r.slots.includes(item.slot as SlotType) && (item.itemLevel ?? 0) >= r.minItemLevel
    : r.itemId === item.itemId || (r.isTier && item.isTier && r.slots.includes(item.slot as SlotType)));
```

- [ ] **Step 11: The gear table card**

Create `src/components/character-page/AnyItemCard.tsx`:

```tsx
/** The BiS cell for an "Any" row: no specific item, only the item level any item in the slot must reach. */
export function AnyItemCard({ minItemLevel }: { minItemLevel: number }) {
  return (
    <div className="flex min-h-[62px] items-center rounded-lg border border-line-strong bg-surface-2 px-4 text-[15px] font-semibold">
      Any item, level {minItemLevel}+
    </div>
  );
}
```

In `src/components/character-page/BisTarget.tsx`, import it with `import { AnyItemCard } from './AnyItemCard';`, and make the function's first line `if (row.bis.kind === 'any') return <AnyItemCard minItemLevel={row.bis.minItemLevel} />;`.

- [ ] **Step 12: Verify, and commit**

Run: `npm run typecheck && npx eslint src && npm test && npm run build`
Expected: typecheck clean, eslint prints nothing, all tests pass (the suite grows by 7), and the build succeeds.

```bash
git add -A src drizzle
git commit -m "feat: keep Method's \"Any <item level>\" rows and treat them as BiS" -m "Method lists some slots as \"Any 334\" instead of naming an item; Feral
Druid's Overall list has four. The parser dropped them, so those slots
were invisible to the gear table and would have been to priority.

BisRow is now a union of item rows and any rows, so the compiler flags
every reader. An any row is done once the slot holds an item at its
level, shows as its own card, and counts vault choices by slot and item
level. bis_items gains min_item_level and a nullable item_id; the
rebuild migration was checked against a copy of a real database.

Refs #10."
```

---

### Task 2: Blizzard client, season endpoints and item slot info

**Files:**
- Modify: `src/core/types.ts` (adds `ArmorType`)
- Modify: `src/core/blizzard/types.ts`, `src/core/blizzard/parse.ts`, `src/core/blizzard/parse.test.ts`, `src/core/blizzard/client.ts`, `src/core/blizzard/client.test.ts`
- Modify: `src/core/db/queries/media.ts` (`upsertItemDetails` maps its columns explicitly), `src/core/db/queries/reference-data.test.ts`

**Interfaces:**
- Produces, in `src/core/types.ts`: `export type ArmorType = 'cloth' | 'leather' | 'mail' | 'plate';`
- Produces, in `src/core/blizzard/types.ts`:

```ts
export interface ItemInfo extends ItemDetails { inventoryType: string | null; armorType: ArmorType | null }
export interface KeystoneDungeon { name: string; mapId: number; mapName: string }
export interface JournalInstanceRef { id: number; name: string }
export interface JournalInstance { id: number; name: string; mapId: number | null; encounterIds: number[] }
export interface JournalEncounter { id: number; name: string; items: { itemId: number; name: string }[] }
```

- Produces, on `BlizzardClient`:
  - `getKeystoneDungeon(region: Region, challengeModeId: number): Promise<KeystoneDungeon>`
  - `getJournalInstances(region: Region): Promise<JournalInstanceRef[]>`
  - `getJournalInstance(region: Region, id: number): Promise<JournalInstance>`
  - `getJournalEncounter(region: Region, id: number): Promise<JournalEncounter>`
  - `getItemDetails(region: Region, itemId: number): Promise<ItemInfo | null>`, now returning `ItemInfo`

`ItemDetails` stays the `item_details` cache's shape. `ItemInfo` is the wider thing the API returns. `upsertItemDetails` must store only its two columns, so the cache never claims fields it doesn't hold.

- [ ] **Step 1: Write the failing parser tests**

Append to `src/core/blizzard/parse.test.ts` (extend its import with the new names):

```ts
describe('parseItemInfo', () => {
  it('reads slot and armor type for armor', () => {
    expect(parseItemInfo({ quality: { type: 'EPIC' }, inventory_type: { type: 'ROBE' }, item_class: { id: 4 }, item_subclass: { id: 2 } }))
      .toEqual({ quality: 'EPIC', isTier: false, inventoryType: 'ROBE', armorType: 'leather' });
  });

  it('gives no armor type to weapons and to armor without a known subclass', () => {
    expect(parseItemInfo({ inventory_type: { type: 'WEAPON' }, item_class: { id: 2 }, item_subclass: { id: 15 } }).armorType).toBeNull();
    expect(parseItemInfo({ inventory_type: { type: 'FINGER' }, item_class: { id: 4 }, item_subclass: { id: 0 } }).armorType).toBeNull();
  });

  it('fills nulls when Blizzard omits fields', () => {
    expect(parseItemInfo({})).toEqual({ quality: null, isTier: false, inventoryType: null, armorType: null });
  });
});

describe('journal parsers', () => {
  it('maps a keystone dungeon to its map', () => {
    expect(parseKeystoneDungeon({ name: 'Alpha Hollow', map: { id: 11, name: 'Alpha Hollow' } })).toEqual({ name: 'Alpha Hollow', mapId: 11, mapName: 'Alpha Hollow' });
  });

  it('maps a journal instance to its map and encounters', () => {
    expect(parseJournalInstance({ id: 901, name: 'Alpha Hollow', map: { id: 11 }, encounters: [{ id: 1 }, { id: 2 }] }))
      .toEqual({ id: 901, name: 'Alpha Hollow', mapId: 11, encounterIds: [1, 2] });
    expect(parseJournalInstance({ id: 902, name: 'No Map' })).toEqual({ id: 902, name: 'No Map', mapId: null, encounterIds: [] });
  });

  it('maps an encounter to its items, and the index to ids and names', () => {
    expect(parseJournalEncounter({ id: 1, name: 'Hollow King', items: [{ item: { id: 100, name: 'Hollow Robe' } }] }))
      .toEqual({ id: 1, name: 'Hollow King', items: [{ itemId: 100, name: 'Hollow Robe' }] });
    expect(parseJournalInstanceIndex({ instances: [{ id: 901, name: 'Alpha Hollow' }] })).toEqual([{ id: 901, name: 'Alpha Hollow' }]);
  });
});
```

Append to `src/core/blizzard/client.test.ts`, inside `describe('Blizzard client', …)`:

```ts
  it('reads keystone dungeons from the dynamic namespace and journal data from the static one', async () => {
    const { api, calls } = client([
      on('/mythic-keystone/dungeon/501', () => json({ name: 'Alpha Hollow', map: { id: 11, name: 'Alpha Hollow' } })),
      on('/journal-encounter/1', () => json({ id: 1, name: 'Hollow King', items: [{ item: { id: 100, name: 'Hollow Robe' } }] })),
    ]);
    expect(await api.getKeystoneDungeon('eu', 501)).toEqual({ name: 'Alpha Hollow', mapId: 11, mapName: 'Alpha Hollow' });
    expect((await api.getJournalEncounter('eu', 1)).items).toEqual([{ itemId: 100, name: 'Hollow Robe' }]);
    expect(calls.find((c) => c.url.includes('/mythic-keystone/'))!.url).toContain('namespace=dynamic-eu');
    expect(calls.find((c) => c.url.includes('/journal-encounter/'))!.url).toContain('namespace=static-eu');
  });

  it('returns slot info with item details, and null for a missing item', async () => {
    const { api } = client([
      on('/data/wow/item/100', () => json({ quality: { type: 'EPIC' }, inventory_type: { type: 'ROBE' }, item_class: { id: 4 }, item_subclass: { id: 2 } })),
      on('/data/wow/item/404', () => new Response('nope', { status: 404 })),
    ]);
    expect(await api.getItemDetails('eu', 100)).toEqual({ quality: 'EPIC', isTier: false, inventoryType: 'ROBE', armorType: 'leather' });
    expect(await api.getItemDetails('eu', 404)).toBeNull();
  });
```

Append to `src/core/db/queries/reference-data.test.ts` (import `getItemDetailsMap` and `upsertItemDetails` from `./media` if not already imported, and `type ItemInfo` from `../../blizzard/types`):

```ts
describe('item details cache', () => {
  it('stores only quality and tier, even when handed slot info', async () => {
    const db = await openTestDb();
    // A typed variable, not a fresh literal: this is what the loader passes, and TypeScript allows the extra fields.
    const info: ItemInfo & { itemId: number } = { itemId: 100, quality: 'EPIC', isTier: false, inventoryType: 'ROBE', armorType: 'leather' };
    await upsertItemDetails(db, [info], 1);
    expect((await getItemDetailsMap(db, [100])).get(100)).toEqual({ quality: 'EPIC', isTier: false });
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/core/blizzard src/core/db/queries/reference-data.test.ts`
Expected: FAIL. The parsers don't exist yet, `getKeystoneDungeon` is not a function, `getItemDetails` lacks slot info, and the cache test may fail at insert because of the extra fields.

- [ ] **Step 3: Types**

In `src/core/types.ts`, add `export type ArmorType = 'cloth' | 'leather' | 'mail' | 'plate';`. In `src/core/blizzard/types.ts`, add the five interfaces from the Interfaces block, and extend its import to `import type { ArmorType, Faction, Quality, Region } from '../types';`.

- [ ] **Step 4: Parsers**

Append to `src/core/blizzard/parse.ts`, extending its imports with `ArmorType`, `Quality` and the new types:

```ts
const ARMOR_CLASS_ID = 4;
const ARMOR_SUBCLASS: Record<number, ArmorType> = { 1: 'cloth', 2: 'leather', 3: 'mail', 4: 'plate' };

export interface RawItem {
  quality?: { type: string };
  preview_item?: { set?: unknown };
  inventory_type?: { type: string };
  item_class?: { id: number };
  item_subclass?: { id: number };
}

/** Item details plus slot and armor type. Only armor (item class 4) has an armor type. */
export function parseItemInfo(raw: RawItem): ItemInfo {
  return {
    quality: (raw.quality?.type as Quality | undefined) ?? null,
    isTier: Boolean(raw.preview_item?.set),
    inventoryType: raw.inventory_type?.type ?? null,
    armorType: raw.item_class?.id === ARMOR_CLASS_ID ? (ARMOR_SUBCLASS[raw.item_subclass?.id ?? -1] ?? null) : null,
  };
}

export interface RawKeystoneDungeon { name: string; map: { id: number; name: string } }
export const parseKeystoneDungeon = (raw: RawKeystoneDungeon): KeystoneDungeon =>
  ({ name: raw.name, mapId: raw.map.id, mapName: raw.map.name });

export interface RawJournalInstanceIndex { instances?: { id: number; name: string }[] }
export const parseJournalInstanceIndex = (raw: RawJournalInstanceIndex): JournalInstanceRef[] =>
  (raw.instances ?? []).map(({ id, name }) => ({ id, name }));

export interface RawJournalInstance { id: number; name: string; map?: { id: number }; encounters?: { id: number }[] }
export const parseJournalInstance = (raw: RawJournalInstance): JournalInstance =>
  ({ id: raw.id, name: raw.name, mapId: raw.map?.id ?? null, encounterIds: (raw.encounters ?? []).map((e) => e.id) });

export interface RawJournalEncounter { id: number; name: string; items?: { item: { id: number; name: string } }[] }
export const parseJournalEncounter = (raw: RawJournalEncounter): JournalEncounter =>
  ({ id: raw.id, name: raw.name, items: (raw.items ?? []).map((i) => ({ itemId: i.item.id, name: i.item.name })) });
```

- [ ] **Step 5: Client methods**

In `src/core/blizzard/client.ts`:
- Add the four new methods to the `BlizzardClient` interface, and change `getItemDetails` to return `Promise<ItemInfo | null>`.
- Import the new raw types and parsers from `./parse`, and the new types from `./types`.
- Replace the body of `getItemDetails` with:

```ts
    async getItemDetails(region, itemId) {
      try {
        return parseItemInfo(await api<RawItem>(region, `/data/wow/item/${itemId}`, 'static'));
      } catch (err) {
        if (isHttpError(err) && err.status === 404) return null;
        throw err;
      }
    },

    async getKeystoneDungeon(region, challengeModeId) {
      return parseKeystoneDungeon(await api<RawKeystoneDungeon>(region, `/data/wow/mythic-keystone/dungeon/${challengeModeId}`, 'dynamic'));
    },

    async getJournalInstances(region) {
      return parseJournalInstanceIndex(await api<RawJournalInstanceIndex>(region, '/data/wow/journal-instance/index', 'static'));
    },

    async getJournalInstance(region, id) {
      return parseJournalInstance(await api<RawJournalInstance>(region, `/data/wow/journal-instance/${id}`, 'static'));
    },

    async getJournalEncounter(region, id) {
      return parseJournalEncounter(await api<RawJournalEncounter>(region, `/data/wow/journal-encounter/${id}`, 'static'));
    },
```

- Remove `Quality` from the client's `../types` import if eslint reports it unused.

- [ ] **Step 6: Keep the cache to its two columns**

In `src/core/db/queries/media.ts`, in `upsertItemDetails`, replace `.values({ ...entry, fetchedAt: now })` with `.values({ itemId: entry.itemId, quality: entry.quality, isTier: entry.isTier, fetchedAt: now })`.

- [ ] **Step 7: Verify, and commit**

Run: `npm run typecheck && npx eslint src && npm test`
Expected: all clean, and every new test passes.

```bash
git add -A src
git commit -m "feat: read keystone dungeons, journal loot and item slots from Blizzard" -m "Season loot comes from the Encounter Journal, joined to each Mythic+
dungeon through its keystone dungeon's map. The client gains those four
calls, and item details now carry inventory and armor type, which the
scoring engine needs to credit tier and Any rows.

The item details cache keeps its two columns: its upsert now names them
rather than spreading whatever it is handed."
```

---

### Task 3: Raider.IO, the current main season

**Files:**
- Create: `src/core/raiderio/season.ts`, `src/core/raiderio/season.test.ts`

**Interfaces:**
- Produces:

```ts
export const CURRENT_EXPANSION_ID = 11;
export interface MainSeason { slug: string; name: string; dungeons: { challengeModeId: number; name: string; shortName: string }[] }
export function pickMainSeason(seasons: RawSeason[], now: number): MainSeason | null;
export function fetchMainSeason(fetchFn: FetchFn, now: number): Promise<MainSeason>;
```

- [ ] **Step 1: Write the failing test**

Create `src/core/raiderio/season.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fakeFetch, json, on } from '@/test/fake-fetch';
import { fetchMainSeason, pickMainSeason, type RawSeason } from './season';

const now = Date.parse('2026-09-30T12:00:00Z');
const season = (slug: string, isMain: boolean, starts: Record<string, string | null>, dungeons: RawSeason['dungeons'] = []): RawSeason =>
  ({ slug, name: slug, is_main_season: isMain, starts, dungeons });
const dungeons: RawSeason['dungeons'] = [{ challenge_mode_id: 501, name: 'Alpha Hollow', short_name: 'AH' }];

describe('pickMainSeason', () => {
  it('takes the newest main season that has started in any region', () => {
    const picked = pickMainSeason([
      season('season-test-1', true, { eu: '2026-03-25T04:00:00Z' }),
      season('season-test-2', true, { us: '2026-08-18T15:00:00Z', eu: '2026-08-19T04:00:00Z' }, dungeons),
      season('season-test-2-remix', false, { eu: '2026-09-01T04:00:00Z' }),
      season('season-test-3', true, { eu: '2026-12-01T04:00:00Z' }),
      season('season-test-4', true, { eu: null }),
    ], now);
    expect(picked).toEqual({ slug: 'season-test-2', name: 'season-test-2', dungeons: [{ challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH' }] });
  });

  it('returns null when no main season has started', () => {
    expect(pickMainSeason([season('season-test-3', true, { eu: '2026-12-01T04:00:00Z' })], now)).toBeNull();
  });
});

describe('fetchMainSeason', () => {
  it('checks this expansion and the next, tolerating a next expansion Raider.IO rejects', async () => {
    const { fn, calls } = fakeFetch([
      on('expansion_id=11', () => json({ seasons: [season('season-test-2', true, { eu: '2026-08-19T04:00:00Z' }, dungeons)] })),
      on('expansion_id=12', () => new Response('bad expansion', { status: 400 })),
    ]);
    expect((await fetchMainSeason(fn, now)).slug).toBe('season-test-2');
    expect(calls.map((c) => c.url)).toEqual(expect.arrayContaining([
      'https://raider.io/api/v1/mythic-plus/static-data?expansion_id=11',
      'https://raider.io/api/v1/mythic-plus/static-data?expansion_id=12',
    ]));
  });

  it('prefers a started season from the next expansion', async () => {
    const { fn } = fakeFetch([
      on('expansion_id=11', () => json({ seasons: [season('season-test-2', true, { eu: '2026-08-19T04:00:00Z' })] })),
      on('expansion_id=12', () => json({ seasons: [season('season-next-1', true, { eu: '2026-09-29T04:00:00Z' })] })),
    ]);
    expect((await fetchMainSeason(fn, now)).slug).toBe('season-next-1');
  });

  it('fails when Raider.IO lists no started main season', async () => {
    const { fn } = fakeFetch([on('static-data', () => json({ seasons: [] }))]);
    await expect(fetchMainSeason(fn, now)).rejects.toThrow('no started main Mythic+ season');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/core/raiderio/season.test.ts`
Expected: FAIL, `Cannot find module './season'`.

- [ ] **Step 3: Implement**

Create `src/core/raiderio/season.ts`:

```ts
import { fetchJson, type FetchFn } from '../http';

/** Midnight. The next expansion's ID is checked too, so a new expansion is found without a code change. */
export const CURRENT_EXPANSION_ID = 11;

export interface RawSeason {
  slug: string;
  name: string;
  is_main_season: boolean;
  starts: Record<string, string | null>;
  dungeons: { challenge_mode_id: number; name: string; short_name: string }[];
}

export interface MainSeason {
  slug: string;
  name: string;
  dungeons: { challengeModeId: number; name: string; shortName: string }[];
}

const staticDataUrl = (expansionId: number) => `https://raider.io/api/v1/mythic-plus/static-data?expansion_id=${expansionId}`;

const earliestStart = (starts: Record<string, string | null>): number | null => {
  const times = Object.values(starts ?? {}).filter((s): s is string => Boolean(s)).map(Date.parse).filter(Number.isFinite);
  return times.length > 0 ? Math.min(...times) : null;
};

/**
 * The newest main season that has started in any region. Variants like "Break the Meta" repeat a
 * main season's dungeons and are not main seasons, so they never win.
 */
export function pickMainSeason(seasons: RawSeason[], now: number): MainSeason | null {
  const started = seasons
    .filter((s) => s.is_main_season)
    .map((s) => ({ season: s, start: earliestStart(s.starts) }))
    .filter((s): s is { season: RawSeason; start: number } => s.start !== null && s.start <= now)
    .sort((a, b) => b.start - a.start);
  const best = started[0]?.season;
  if (!best) return null;
  return {
    slug: best.slug,
    name: best.name,
    dungeons: best.dungeons.map((d) => ({ challengeModeId: d.challenge_mode_id, name: d.name, shortName: d.short_name })),
  };
}

export async function fetchMainSeason(fetchFn: FetchFn, now: number): Promise<MainSeason> {
  const [current, next] = await Promise.all([
    fetchJson<{ seasons?: RawSeason[] }>(fetchFn, staticDataUrl(CURRENT_EXPANSION_ID)),
    fetchJson<{ seasons?: RawSeason[] }>(fetchFn, staticDataUrl(CURRENT_EXPANSION_ID + 1)).catch(() => ({ seasons: [] })),
  ]);
  const season = pickMainSeason([...(current.seasons ?? []), ...(next.seasons ?? [])], now);
  if (!season) throw new Error('Raider.IO lists no started main Mythic+ season');
  return season;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/core/raiderio/season.test.ts`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/raiderio
git commit -m "feat: find the current main Mythic+ season on Raider.IO" -m "Raider.IO's static data lists each season's dungeons by challenge mode ID.
The newest main season that has started in any region wins; variants such
as Break the Meta repeat a main season's dungeons and never do. The next
expansion is checked too, so a new one needs no code change."
```

---

### Task 4: Season storage

**Files:**
- Modify: `src/core/types.ts` (adds `LootItem`, `SeasonLoot`)
- Modify: `src/core/db/schema.ts`; generated: `drizzle/0006_season-loot.sql`
- Create: `src/core/db/queries/season.ts`, `src/core/db/queries/season.test.ts`

**Interfaces:**
- Produces, in `src/core/types.ts`:

```ts
export interface LootItem { itemId: number; inventoryType: string | null; armorType: ArmorType | null }
/** One season dungeon and what it drops. `split` marks half of a dungeon credited with the whole instance's loot. */
export interface SeasonLoot { challengeModeId: number; name: string; split: boolean; loot: LootItem[] }
```

- Produces, in `src/core/db/queries/season.ts`:

```ts
export interface SeasonDungeonRow { challengeModeId: number; name: string; shortName: string; journalInstanceId: number; mapId: number }
export interface DungeonLootRow { challengeModeId: number; encounterId: number; encounterName: string; itemId: number; itemName: string; inventoryType: string | null; armorType: ArmorType | null }
export interface SeasonData { slug: string; dungeons: SeasonDungeonRow[]; loot: DungeonLootRow[] }
export function replaceSeason(db: Db, data: SeasonData): Promise<void>;
export function getSeasonLoot(db: Db): Promise<SeasonLoot[]>;   // ordered by dungeon name
```

- [ ] **Step 1: Write the failing test**

Create `src/core/db/queries/season.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { getSeasonLoot, replaceSeason, type SeasonData } from './season';

const data: SeasonData = {
  slug: 'season-test-2',
  dungeons: [
    { challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', journalInstanceId: 901, mapId: 11 },
    { challengeModeId: 502, name: 'Streets of Beta', shortName: 'STRT', journalInstanceId: 902, mapId: 22 },
    { challengeModeId: 503, name: 'Beta Gambit', shortName: 'GMBT', journalInstanceId: 902, mapId: 22 },
  ],
  loot: [
    { challengeModeId: 501, encounterId: 1, encounterName: 'Hollow King', itemId: 100, itemName: 'Hollow Robe', inventoryType: 'ROBE', armorType: 'leather' },
    { challengeModeId: 501, encounterId: 1, encounterName: 'Hollow King', itemId: 101, itemName: 'Vanished Band', inventoryType: null, armorType: null },
    { challengeModeId: 502, encounterId: 2, encounterName: 'Market Warden', itemId: 200, itemName: 'Warden Helm', inventoryType: 'HEAD', armorType: 'plate' },
    { challengeModeId: 503, encounterId: 2, encounterName: 'Market Warden', itemId: 200, itemName: 'Warden Helm', inventoryType: 'HEAD', armorType: 'plate' },
  ],
};

describe('season storage', () => {
  it('reads back each dungeon with its loot, ordered by name, marking split dungeons', async () => {
    const db = await openTestDb();
    await replaceSeason(db, data);
    expect(await getSeasonLoot(db)).toEqual([
      { challengeModeId: 501, name: 'Alpha Hollow', split: false, loot: [
        { itemId: 100, inventoryType: 'ROBE', armorType: 'leather' },
        { itemId: 101, inventoryType: null, armorType: null },
      ] },
      { challengeModeId: 503, name: 'Beta Gambit', split: true, loot: [{ itemId: 200, inventoryType: 'HEAD', armorType: 'plate' }] },
      { challengeModeId: 502, name: 'Streets of Beta', split: true, loot: [{ itemId: 200, inventoryType: 'HEAD', armorType: 'plate' }] },
    ]);
  });

  it('replaces the previous season entirely', async () => {
    const db = await openTestDb();
    await replaceSeason(db, data);
    await replaceSeason(db, { slug: 'season-test-3', dungeons: [data.dungeons[0]!], loot: [data.loot[0]!] });
    const season = await getSeasonLoot(db);
    expect(season.map((d) => d.name)).toEqual(['Alpha Hollow']);
    expect(season[0]!.loot).toHaveLength(1);
  });

  it('is empty before any season is stored', async () => {
    expect(await getSeasonLoot(await openTestDb())).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/core/db/queries/season.test.ts`
Expected: FAIL, `Cannot find module './season'`.

- [ ] **Step 3: Types and schema**

Add `LootItem` and `SeasonLoot` to `src/core/types.ts`, as in the Interfaces block.

In `src/core/db/schema.ts`, add `primaryKey` to the `drizzle-orm/sqlite-core` import and `ArmorType` to the `../types` import, then append:

```ts
/** The current season's Mythic+ dungeons. Exactly one season is stored; a new one replaces it. */
export const seasonDungeons = sqliteTable('season_dungeons', {
  challengeModeId: integer('challenge_mode_id').primaryKey(),
  seasonSlug: text('season_slug').notNull(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull(),
  journalInstanceId: integer('journal_instance_id').notNull(),
  mapId: integer('map_id').notNull(),
});

/** What each season dungeon drops, with slot and armor type for crediting tier and Any rows. */
export const dungeonLoot = sqliteTable('dungeon_loot', {
  challengeModeId: integer('challenge_mode_id').notNull().references(() => seasonDungeons.challengeModeId, { onDelete: 'cascade' }),
  encounterId: integer('encounter_id').notNull(),
  encounterName: text('encounter_name').notNull(),
  itemId: integer('item_id').notNull(),
  itemName: text('item_name').notNull(),
  inventoryType: text('inventory_type'),
  armorType: text('armor_type').$type<ArmorType>(),
}, (t) => [primaryKey({ columns: [t.challengeModeId, t.encounterId, t.itemId] })]);
```

Run: `npm run db:generate -- --name season-loot`
Expected: `drizzle/0006_season-loot.sql`, creating both tables.

- [ ] **Step 4: Queries**

Create `src/core/db/queries/season.ts`:

```ts
import { asc } from 'drizzle-orm';
import type { Db } from '../client';
import { dungeonLoot, seasonDungeons } from '../schema';
import type { ArmorType, SeasonLoot } from '../../types';
import { withWriteLock } from './write-lock';

export interface SeasonDungeonRow { challengeModeId: number; name: string; shortName: string; journalInstanceId: number; mapId: number }
export interface DungeonLootRow {
  challengeModeId: number;
  encounterId: number;
  encounterName: string;
  itemId: number;
  itemName: string;
  inventoryType: string | null;
  armorType: ArmorType | null;
}
export interface SeasonData { slug: string; dungeons: SeasonDungeonRow[]; loot: DungeonLootRow[] }

/** Replaces the stored season in one transaction, so a reader never sees half of one. */
export async function replaceSeason(db: Db, data: SeasonData): Promise<void> {
  await withWriteLock(db, () => db.transaction(async (tx) => {
    await tx.delete(dungeonLoot);
    await tx.delete(seasonDungeons);
    if (data.dungeons.length > 0) await tx.insert(seasonDungeons).values(data.dungeons.map((d) => ({ ...d, seasonSlug: data.slug })));
    if (data.loot.length > 0) await tx.insert(dungeonLoot).values(data.loot);
  }));
}

/** The stored season's dungeons with their loot. Dungeons sharing one journal instance are halves of one: split. */
export async function getSeasonLoot(db: Db): Promise<SeasonLoot[]> {
  const dungeons = await db.select().from(seasonDungeons).orderBy(asc(seasonDungeons.name));
  const loot = await db.select().from(dungeonLoot).orderBy(asc(dungeonLoot.encounterId), asc(dungeonLoot.itemId));
  const perInstance = new Map<number, number>();
  for (const d of dungeons) perInstance.set(d.journalInstanceId, (perInstance.get(d.journalInstanceId) ?? 0) + 1);
  return dungeons.map((d) => ({
    challengeModeId: d.challengeModeId,
    name: d.name,
    split: (perInstance.get(d.journalInstanceId) ?? 0) > 1,
    loot: loot.filter((l) => l.challengeModeId === d.challengeModeId)
      .map((l) => ({ itemId: l.itemId, inventoryType: l.inventoryType, armorType: l.armorType })),
  }));
}
```

- [ ] **Step 5: Verify, and commit**

Run: `npx vitest run src/core/db/queries/season.test.ts && npm run typecheck && npx eslint src && npm test`
Expected: 3 new tests pass; everything else stays clean.

```bash
git add -A src drizzle
git commit -m "feat: store the season's dungeons and their loot" -m "Two tables hold exactly one season: its dungeons, joined to their journal
instance and map, and what each drops with slot and armor type. A new
season replaces the old in one transaction, so a page never sees half of
one. Dungeons that share a journal instance read back as split."
```

---

### Task 5: The season loader

**Files:**
- Create: `src/core/sync/season-sync.ts`, `src/core/sync/season-sync.test.ts`
- Modify: `AGENTS.md` (versioned season cache, and the map-ID join)

**Interfaces:**
- Consumes: the Task 2 client methods, `fetchMainSeason` (Task 3), `replaceSeason`/`getSeasonLoot` (Task 4), `getMeta`/`setMeta`, and `DAY_MS` from `reference-sync`.
- Produces:

```ts
export const SEASON_META_KEY = 'season.v1';     // value: the loaded season's slug; updatedAt: the last successful check
export type SeasonSyncResult = 'skipped' | 'current' | 'loaded' | 'failed';
export interface SeasonSyncDeps { db: Db; blizzard: BlizzardClient; fetchFn: FetchFn; now: number; region: Region }
export function syncSeason(deps: SeasonSyncDeps): Promise<SeasonSyncResult>;
export function loadSeasonLoot(blizzard: BlizzardClient, region: Region, season: MainSeason): Promise<SeasonData>;
export interface SeasonState { status: 'loading' | 'failed' | 'ready' | 'stale'; needsSync: boolean; dungeons: SeasonLoot[] }
export function readSeason(db: Db, now: number): Promise<SeasonState>;
```

- [ ] **Step 1: Write the failing test**

Create `src/core/sync/season-sync.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { fakeFetch, json, on } from '@/test/fake-fetch';
import type { BlizzardClient } from '../blizzard/client';
import { DAY_MS } from './reference-sync';
import { readSeason, syncSeason } from './season-sync';

const T = Date.parse('2026-09-30T12:00:00Z');

const raiderIo = () => fakeFetch([
  on('expansion_id=11', () => json({ seasons: [{
    slug: 'season-test-2', name: 'Test Season 2', is_main_season: true, starts: { eu: '2026-08-19T04:00:00Z' },
    dungeons: [
      { challenge_mode_id: 501, name: 'Alpha Hollow', short_name: 'AH' },
      { challenge_mode_id: 502, name: 'Streets of Beta', short_name: 'STRT' },
      { challenge_mode_id: 503, name: 'Beta Gambit', short_name: 'GMBT' },
    ],
  }] })),
  on('expansion_id=12', () => new Response('bad expansion', { status: 400 })),
]);

const KEYSTONES: Record<number, { name: string; mapId: number; mapName: string }> = {
  501: { name: 'Alpha Hollow', mapId: 11, mapName: 'Alpha Hollow' },
  502: { name: 'Streets of Beta', mapId: 22, mapName: 'Beta Market' },
  503: { name: 'Beta Gambit', mapId: 22, mapName: 'Beta Market' },
};
// 900 shares Alpha Hollow's name but not its map, so the join must reject it.
const INSTANCES: Record<number, { id: number; name: string; mapId: number; encounterIds: number[] }> = {
  900: { id: 900, name: 'Alpha Hollow', mapId: 99, encounterIds: [] },
  901: { id: 901, name: 'Alpha Hollow', mapId: 11, encounterIds: [1] },
  902: { id: 902, name: 'Beta Market', mapId: 22, encounterIds: [2, 3] },
};
const ENCOUNTERS: Record<number, { id: number; name: string; items: { itemId: number; name: string }[] }> = {
  1: { id: 1, name: 'Hollow King', items: [{ itemId: 100, name: 'Hollow Robe' }, { itemId: 101, name: 'Vanished Band' }] },
  2: { id: 2, name: 'Market Warden', items: [{ itemId: 200, name: 'Warden Helm' }] },
  3: { id: 3, name: 'Gambit Queen', items: [{ itemId: 300, name: 'Queen’s Charm' }] },
};
const ITEMS: Record<number, { inventoryType: string; armorType: 'leather' | 'plate' | null } | null> = {
  100: { inventoryType: 'ROBE', armorType: 'leather' },
  101: null,
  200: { inventoryType: 'HEAD', armorType: 'plate' },
  300: { inventoryType: 'TRINKET', armorType: null },
};

function fakeBlizzard(overrides: Partial<Record<string, unknown>> = {}) {
  const calls = { index: 0, encounters: [] as number[], items: [] as number[] };
  const blizzard = {
    getKeystoneDungeon: async (_r: string, cm: number) => KEYSTONES[cm]!,
    getJournalInstances: async () => { calls.index++; return Object.values(INSTANCES).map(({ id, name }) => ({ id, name })); },
    getJournalInstance: async (_r: string, id: number) => INSTANCES[id]!,
    getJournalEncounter: async (_r: string, id: number) => { calls.encounters.push(id); return ENCOUNTERS[id]!; },
    getItemDetails: async (_r: string, id: number) => {
      calls.items.push(id);
      const info = ITEMS[id];
      return info ? { quality: 'EPIC', isTier: false, ...info } : null;
    },
    ...overrides,
  } as unknown as BlizzardClient;
  return { blizzard, calls };
}

const deps = async (blizzard: BlizzardClient, fetchFn = raiderIo().fn) => ({ db: await openTestDb(), blizzard, fetchFn, now: T, region: 'eu' as const });

describe('syncSeason', () => {
  it('joins each dungeon to its journal instance by map ID and stores the loot with slots', async () => {
    const { blizzard, calls } = fakeBlizzard();
    const d = await deps(blizzard);
    expect(await syncSeason(d)).toBe('loaded');
    const state = await readSeason(d.db, T);
    expect(state).toMatchObject({ status: 'ready', needsSync: false });
    expect(state.dungeons.map((x) => [x.name, x.split])).toEqual([['Alpha Hollow', false], ['Beta Gambit', true], ['Streets of Beta', true]]);
    expect(state.dungeons[0]!.loot).toEqual([
      { itemId: 100, inventoryType: 'ROBE', armorType: 'leather' },
      { itemId: 101, inventoryType: null, armorType: null },
    ]);
    // Both Beta halves share instance 902: its encounters and items are fetched once.
    expect([...calls.encounters].sort()).toEqual([1, 2, 3]);
    expect([...calls.items].sort()).toEqual([100, 101, 200, 300]);
  });

  it('shares one load between two requests arriving together', async () => {
    const { blizzard, calls } = fakeBlizzard();
    const d = await deps(blizzard);
    expect(await Promise.all([syncSeason(d), syncSeason(d)])).toEqual(['loaded', 'loaded']);
    expect(calls.index).toBe(1);
  });

  it('skips within a day, and only rechecks the slug after one', async () => {
    const { blizzard, calls } = fakeBlizzard();
    const raider = raiderIo();
    const d = await deps(blizzard, raider.fn);
    await syncSeason(d);
    const raiderCalls = raider.calls.length;
    expect(await syncSeason({ ...d, now: T + 60_000 })).toBe('skipped');
    expect(raider.calls.length).toBe(raiderCalls);
    expect(await syncSeason({ ...d, now: T + DAY_MS + 1 })).toBe('current');
    expect(calls.index).toBe(1);
  });

  it('keeps the previous season when a later load fails, and marks it stale', async () => {
    const good = fakeBlizzard();
    const d = await deps(good.blizzard);
    await syncSeason(d);
    // Next season: a dungeon whose map no journal instance has.
    const next = fakeFetch([on('static-data', () => json({ seasons: [{
      slug: 'season-test-3', name: 'Test Season 3', is_main_season: true, starts: { eu: '2026-09-29T04:00:00Z' },
      dungeons: [{ challenge_mode_id: 777, name: 'Lost Vault', short_name: 'LV' }],
    }] }))]);
    const bad = fakeBlizzard({ getKeystoneDungeon: async () => ({ name: 'Lost Vault', mapId: 77, mapName: 'Lost Vault' }) });
    const later = T + DAY_MS + 1;
    expect(await syncSeason({ ...d, blizzard: bad.blizzard, fetchFn: next.fn, now: later })).toBe('failed');
    const state = await readSeason(d.db, later);
    expect(state.status).toBe('stale');
    expect(state.dungeons.map((x) => x.name)).toEqual(['Alpha Hollow', 'Beta Gambit', 'Streets of Beta']);
  });
});

describe('readSeason', () => {
  it('asks for a sync and says loading before any season is stored', async () => {
    expect(await readSeason(await openTestDb(), T)).toEqual({ status: 'loading', needsSync: true, dungeons: [] });
  });

  it('says failed, and waits before retrying, when the first load fails', async () => {
    const { blizzard } = fakeBlizzard({ getJournalInstances: async () => { throw new Error('Blizzard is down'); } });
    const d = await deps(blizzard);
    expect(await syncSeason(d)).toBe('failed');
    expect(await readSeason(d.db, T + 60_000)).toEqual({ status: 'failed', needsSync: false, dungeons: [] });
    expect((await readSeason(d.db, T + 2 * 60 * 60 * 1000)).needsSync).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/core/sync/season-sync.test.ts`
Expected: FAIL, `Cannot find module './season-sync'`.

- [ ] **Step 3: Implement**

Create `src/core/sync/season-sync.ts`:

```ts
import type { BlizzardClient } from '../blizzard/client';
import type { JournalInstance } from '../blizzard/types';
import type { Db } from '../db/client';
import { getMeta, setMeta } from '../db/queries/meta';
import { getSeasonLoot, replaceSeason, type DungeonLootRow, type SeasonData, type SeasonDungeonRow } from '../db/queries/season';
import type { FetchFn } from '../http';
import { fetchMainSeason, type MainSeason } from '../raiderio/season';
import type { Region, SeasonLoot } from '../types';
import { DAY_MS } from './reference-sync';

// The version in the key marks the stored tables' format. Bump it when season_dungeons or
// dungeon_loot gain columns, so installs reload the season instead of trusting old rows.
export const SEASON_META_KEY = 'season.v1';
const SEASON_FAILED_META_KEY = 'season.failedAt';
const SEASON_RETRY_MS = 60 * 60 * 1000;

export type SeasonSyncResult = 'skipped' | 'current' | 'loaded' | 'failed';
export interface SeasonSyncDeps { db: Db; blizzard: BlizzardClient; fetchFn: FetchFn; now: number; region: Region }
export interface SeasonState { status: 'loading' | 'failed' | 'ready' | 'stale'; needsSync: boolean; dungeons: SeasonLoot[] }

/**
 * Loads one season's loot: each dungeon's challenge mode → keystone dungeon → map → the journal
 * instance with that map → its encounters → their items, then each item's slot and armor type.
 * Two halves of a split dungeon share an instance, so encounters and items are fetched once.
 */
export async function loadSeasonLoot(blizzard: BlizzardClient, region: Region, season: MainSeason): Promise<SeasonData> {
  const index = await blizzard.getJournalInstances(region);
  const dungeons: (SeasonDungeonRow & { encounterIds: number[] })[] = [];
  for (const d of season.dungeons) {
    const keystone = await blizzard.getKeystoneDungeon(region, d.challengeModeId);
    let instance: JournalInstance | null = null;
    for (const candidate of index.filter((i) => i.name === keystone.mapName || i.name === keystone.name)) {
      const loaded = await blizzard.getJournalInstance(region, candidate.id);
      if (loaded.mapId === keystone.mapId) { instance = loaded; break; }
    }
    if (!instance) throw new Error(`No Encounter Journal instance has the map of ${d.name}`);
    dungeons.push({ challengeModeId: d.challengeModeId, name: d.name, shortName: d.shortName, journalInstanceId: instance.id, mapId: keystone.mapId, encounterIds: instance.encounterIds });
  }

  const encounterIds = [...new Set(dungeons.flatMap((d) => d.encounterIds))];
  const encounters = new Map(await Promise.all(encounterIds.map(async (id) => [id, await blizzard.getJournalEncounter(region, id)] as const)));
  const itemIds = [...new Set([...encounters.values()].flatMap((e) => e.items.map((i) => i.itemId)))];
  const infos = new Map(await Promise.all(itemIds.map(async (id) => [id, await blizzard.getItemDetails(region, id)] as const)));

  const loot: DungeonLootRow[] = dungeons.flatMap((d) => d.encounterIds.flatMap((encounterId) => {
    const encounter = encounters.get(encounterId)!;
    return encounter.items.map((item) => ({
      challengeModeId: d.challengeModeId,
      encounterId,
      encounterName: encounter.name,
      itemId: item.itemId,
      itemName: item.name,
      inventoryType: infos.get(item.itemId)?.inventoryType ?? null,
      armorType: infos.get(item.itemId)?.armorType ?? null,
    }));
  }));
  const rows: SeasonDungeonRow[] = dungeons.map((d) => ({
    challengeModeId: d.challengeModeId, name: d.name, shortName: d.shortName, journalInstanceId: d.journalInstanceId, mapId: d.mapId,
  }));
  return { slug: season.slug, dungeons: rows, loot };
}

async function runSync({ db, blizzard, fetchFn, now, region }: SeasonSyncDeps): Promise<SeasonSyncResult> {
  const loaded = await getMeta(db, SEASON_META_KEY);
  const failed = await getMeta(db, SEASON_FAILED_META_KEY);
  const fresh = loaded !== null && now - loaded.updatedAt < DAY_MS;
  const backingOff = failed !== null && now - failed.updatedAt < SEASON_RETRY_MS && (loaded === null || failed.updatedAt > loaded.updatedAt);
  if (fresh || backingOff) return 'skipped';
  try {
    const season = await fetchMainSeason(fetchFn, now);
    if (loaded?.value === season.slug) {
      await setMeta(db, SEASON_META_KEY, season.slug, now);
      return 'current';
    }
    await replaceSeason(db, await loadSeasonLoot(blizzard, region, season));
    await setMeta(db, SEASON_META_KEY, season.slug, now);
    return 'loaded';
  } catch (err) {
    console.error('The season’s loot couldn’t be loaded', err);
    await setMeta(db, SEASON_FAILED_META_KEY, String(now), now);
    return 'failed';
  }
}

const inFlight = new WeakMap<Db, Promise<SeasonSyncResult>>();

/** Checks for a new season at most daily and loads its loot. Requests arriving together share one load. */
export function syncSeason(deps: SeasonSyncDeps): Promise<SeasonSyncResult> {
  const running = inFlight.get(deps.db);
  if (running) return running;
  const run = runSync(deps).finally(() => inFlight.delete(deps.db));
  inFlight.set(deps.db, run);
  return run;
}

/** The stored season and what the page should say about it. */
export async function readSeason(db: Db, now: number): Promise<SeasonState> {
  const loaded = await getMeta(db, SEASON_META_KEY);
  const failed = await getMeta(db, SEASON_FAILED_META_KEY);
  const dungeons = await getSeasonLoot(db);
  const lastFailed = failed !== null && (loaded === null || failed.updatedAt > loaded.updatedAt);
  const fresh = loaded !== null && now - loaded.updatedAt < DAY_MS;
  const backingOff = lastFailed && now - failed!.updatedAt < SEASON_RETRY_MS;
  const status = dungeons.length === 0 ? (lastFailed ? 'failed' : 'loading') : (lastFailed ? 'stale' : 'ready');
  return { status, needsSync: !fresh && !backingOff, dungeons };
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/core/sync/season-sync.test.ts`
Expected: 6 tests pass. The "failed" tests print one `console.error` line each, which is expected.

- [ ] **Step 5: Record the rules in `AGENTS.md`**

Under **Database rules**, after the "Cached Raidbots data is versioned" bullet, add:

```markdown
- **Cached season loot is versioned the same way.** When `season_dungeons` or `dungeon_loot` gain columns, bump the version in `SEASON_META_KEY` in `src/core/sync/season-sync.ts`.
```

Under **External data facts**, add:

```markdown
- **Season loot joins by map ID.** Raider.IO gives each season dungeon a challenge mode ID only. Blizzard's keystone dungeon names its map, and the Encounter Journal instance with that map holds the loot. The two halves of a split dungeon, such as Tazavesh, share one journal instance, and the API doesn't say which boss belongs to which half.
```

- [ ] **Step 6: Verify, and commit**

Run: `npm run typecheck && npx eslint src && npm test`
Expected: all clean.

```bash
git add -A src AGENTS.md
git commit -m "feat: load the season's loot behind a daily check" -m "The loader finds Raider.IO's main season, joins each dungeon to its
Encounter Journal instance by map ID, and stores every item it drops with
slot and armor type in one transaction. The daily check is one call; the
full load runs only when the season changes.

A failed load keeps the previous season and marks it stale, retrying
within the hour. With no season stored, the page says the load failed
rather than loading forever, a state the spec left open."
```

---

### Task 6: The scoring engine

**Files:**
- Create: `src/core/priority/slots.ts`, `src/core/priority/list.ts`, `src/core/priority/rank.ts`, `src/core/priority/priority.test.ts`
- Modify: `AGENTS.md` (`priority` joins the logic modules)

**Interfaces:**
- Consumes: `GearRow` and `evaluateGear` from `src/core/gear/evaluate.ts`; `decodeTrack` from `src/core/raidbots/tracks.ts`; `BisRow`, `SeasonLoot`, `LootItem` and `ArmorType` from `src/core/types.ts`.
- Produces:

```ts
// slots.ts
export const ARMOR_SLOTS: ReadonlySet<SlotType>;
export function slotsForInventoryType(inventoryType: string | null): SlotType[];
export function armorTypeForClass(className: string): ArmorType | null;
// list.ts
export type PriorityListType = 'mythicPlus' | 'overall';
export function choosePriorityList(lists: BisLists | null, chosen: PriorityListType): { listType: PriorityListType; fellBack: boolean };
// rank.ts
export interface PriorityCharacter { id: number; name: string; className: string; rows: GearRow[]; equipped: GearItem[]; tracks: ReadonlyMap<number, Track> }
export type Credit =
  | { kind: 'item'; slotLabel: string; weight: number; itemId: number; name: string; bonusIds: number[] }
  | { kind: 'tier'; slotLabel: string; weight: number }
  | { kind: 'any'; slotLabel: string; weight: number; minItemLevel: number };
export interface CharacterCredits { characterId: number; characterName: string; credits: Credit[] }
export interface DungeonRank { challengeModeId: number; name: string; split: boolean; score: number; characters: CharacterCredits[] }
export function trackWeight(item: GearItem | null, tracks: ReadonlyMap<number, Track>): number;
export function rankDungeons(characters: PriorityCharacter[], dungeons: SeasonLoot[]): DungeonRank[];
```

- [ ] **Step 1: Write the failing test**

Create `src/core/priority/priority.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { evaluateGear } from '../gear/evaluate';
import type { ArmorType, BisLists, BisRow, GearItem, LootItem, SeasonLoot, SlotType, Track } from '../types';
import { choosePriorityList } from './list';
import { rankDungeons, type PriorityCharacter } from './rank';

const track = (bonusId: number, name: string): Track => ({ bonusId, name, step: 1, max: 6, group: null, currencyId: null, currencyName: null, costPerStep: null });
const tracks = new Map<number, Track>([[1, track(1, 'Myth')], [2, track(2, 'Hero')], [3, track(3, 'Champion')], [4, track(4, 'Veteran')]]);

const gear = (slot: SlotType, itemId: number, bonus?: number, isTier = false, itemLevel = 300): GearItem =>
  ({ slot, itemId, name: `Item ${itemId}`, itemLevel, quality: 'EPIC', bonusIds: bonus ? [bonus] : [], isTier });
const named = (slots: SlotType[], itemId: number, isTier = false): BisRow =>
  ({ kind: 'item', slotLabel: slots[0]!, slots, itemId, name: `BiS ${itemId}`, bonusIds: [], isTier, isCatalyst: isTier, source: '' });
const anyRow = (slots: SlotType[], minItemLevel: number): BisRow => ({ kind: 'any', slotLabel: slots[0]!, slots, minItemLevel, source: '' });
const loot = (itemId: number, inventoryType: string | null = null, armorType: ArmorType | null = null): LootItem => ({ itemId, inventoryType, armorType });
const dungeon = (challengeModeId: number, name: string, items: LootItem[], split = false): SeasonLoot => ({ challengeModeId, name, split, loot: items });

const character = (rows: BisRow[], equipped: GearItem[], className = 'Druid', id = 1, name = 'Birkibjörn'): PriorityCharacter =>
  ({ id, name, className, rows: evaluateGear({ equipped, bisRows: rows, tracks }), equipped, tracks });
const scores = (ranks: ReturnType<typeof rankDungeons>) => ranks.map((r) => [r.name, r.score]);

describe('rankDungeons', () => {
  it('credits a named item only to the dungeon that drops it, weighted by the current item', () => {
    const c = character(
      [named(['NECK'], 10), named(['BACK'], 20), named(['WRIST'], 30), named(['WAIST'], 40), named(['FEET'], 50)],
      [gear('NECK', 11, 2), gear('BACK', 21, 3), gear('WRIST', 31, 4), gear('FEET', 51)],
    );
    // Hero 1, Champion 2, Veteran 3, empty 3, no track 2.
    const ranks = rankDungeons([c], [
      dungeon(501, 'Alpha Hollow', [loot(10), loot(20)]),
      dungeon(502, 'Beta Spire', [loot(30), loot(40), loot(50)]),
      dungeon(503, 'Gamma Deep', [loot(999)]),
    ]);
    expect(scores(ranks)).toEqual([['Beta Spire', 8], ['Alpha Hollow', 3], ['Gamma Deep', 0]]);
    expect(ranks[1]!.characters[0]!.credits).toEqual([
      { kind: 'item', slotLabel: 'NECK', weight: 1, itemId: 10, name: 'BiS 10', bonusIds: [] },
      { kind: 'item', slotLabel: 'BACK', weight: 2, itemId: 20, name: 'BiS 20', bonusIds: [] },
    ]);
  });

  it('counts only missing rows', () => {
    const c = character([named(['NECK'], 10)], [gear('NECK', 10, 2)]);
    expect(scores(rankDungeons([c], [dungeon(501, 'Alpha Hollow', [loot(10)])]))).toEqual([['Alpha Hollow', 0]]);
  });

  it('weights a ring by the weaker of the two rings not already BiS', () => {
    const bothMissing = character([named(['FINGER_1', 'FINGER_2'], 60), named(['FINGER_1', 'FINGER_2'], 61)], [gear('FINGER_1', 70, 1), gear('FINGER_2', 71, 3)]);
    expect(rankDungeons([bothMissing], [dungeon(501, 'Alpha Hollow', [loot(60)])])[0]!.score).toBe(2);
    const oneMatched = character([named(['FINGER_1', 'FINGER_2'], 60), named(['FINGER_1', 'FINGER_2'], 61)], [gear('FINGER_1', 60, 1), gear('FINGER_2', 71, 3)]);
    expect(rankDungeons([oneMatched], [dungeon(501, 'Alpha Hollow', [loot(61)])])[0]!.score).toBe(2);
  });

  it('credits a tier row to slot drops in the armor type, with +2 below four tier pieces', () => {
    const tierPieces = [gear('HEAD', 90, undefined, true), gear('SHOULDER', 91, undefined, true), gear('HANDS', 92, undefined, true)];
    const three = character([named(['CHEST'], 80, true)], [gear('CHEST', 81, 3), ...tierPieces]);
    const dungeons = [
      dungeon(501, 'Alpha Hollow', [loot(900, 'ROBE', 'leather')]),
      dungeon(502, 'Beta Spire', [loot(901, 'CHEST', 'plate')]),
      dungeon(503, 'Gamma Deep', [loot(902, 'HEAD', 'leather')]),
    ];
    const ranks = rankDungeons([three], dungeons);
    expect(scores(ranks)).toEqual([['Alpha Hollow', 4], ['Beta Spire', 0], ['Gamma Deep', 0]]);
    expect(ranks[0]!.characters[0]!.credits).toEqual([{ kind: 'tier', slotLabel: 'CHEST', weight: 4 }]);
    const four = character([named(['CHEST'], 80, true)], [gear('CHEST', 81, 3), ...tierPieces, gear('LEGS', 93, undefined, true)]);
    expect(rankDungeons([four], dungeons)[0]!.score).toBe(2);
  });

  it('credits an any row to slot drops, filtering armor slots by armor type but not cloaks', () => {
    const c = character([anyRow(['SHOULDER'], 334), anyRow(['BACK'], 334)], [gear('SHOULDER', 5, undefined, false, 321)]);
    const ranks = rankDungeons([c], [
      dungeon(501, 'Alpha Hollow', [loot(1, 'SHOULDER', 'leather')]),
      dungeon(502, 'Beta Spire', [loot(2, 'SHOULDER', 'cloth'), loot(3, 'CLOAK', 'cloth')]),
    ]);
    expect(scores(ranks)).toEqual([['Beta Spire', 3], ['Alpha Hollow', 2]]);
    expect(ranks[1]!.characters[0]!.credits).toEqual([{ kind: 'any', slotLabel: 'SHOULDER', weight: 2, minItemLevel: 334 }]);
  });

  it('gives an unknown class no armor-slot credit, but still credits named items', () => {
    const c = character([named(['CHEST'], 80, true), anyRow(['SHOULDER'], 334), named(['NECK'], 10)], [], 'Tinkerer');
    const ranks = rankDungeons([c], [dungeon(501, 'Alpha Hollow', [loot(900, 'CHEST', 'leather'), loot(1, 'SHOULDER', 'leather'), loot(10)])]);
    expect(ranks[0]!.characters[0]!.credits.map((cr) => cr.kind)).toEqual(['item']);
  });

  it('scores a character with no gear yet: every slot empty at 3, tier +2', () => {
    const c = character([named(['NECK'], 10), named(['CHEST'], 80, true)], []);
    expect(rankDungeons([c], [dungeon(501, 'Alpha Hollow', [loot(10), loot(900, 'CHEST', 'leather')])])[0]!.score).toBe(3 + 5);
  });

  it('credits only named items from loot whose slot is unknown', () => {
    const c = character([named(['NECK'], 10), anyRow(['SHOULDER'], 334)], []);
    const ranks = rankDungeons([c], [dungeon(501, 'Alpha Hollow', [loot(10), loot(11)])]);
    expect(ranks[0]!.characters[0]!.credits.map((cr) => cr.kind)).toEqual(['item']);
  });

  it('carries the split flag, crediting both halves of a split dungeon', () => {
    const c = character([named(['NECK'], 10)], []);
    const ranks = rankDungeons([c], [dungeon(502, 'Streets of Beta', [loot(10)], true), dungeon(503, 'Beta Gambit', [loot(10)], true)]);
    expect(ranks.map((r) => [r.name, r.score, r.split])).toEqual([['Beta Gambit', 3, true], ['Streets of Beta', 3, true]]);
  });

  it('breaks ties by how many characters benefit, then by name', () => {
    const first = character([named(['NECK'], 10), named(['BACK'], 20), named(['WRIST'], 30)], [], 'Druid', 1, 'Birkibjörn');
    const second = character([named(['NECK'], 10)], [], 'Druid', 2, 'Grenibjörn');
    const ranks = rankDungeons([first, second], [
      dungeon(502, 'Beta Spire', [loot(20), loot(30)]),
      dungeon(501, 'Alpha Hollow', [loot(10)]),
      dungeon(504, 'Zeta Crypt', []),
      dungeon(503, 'Delta Mire', []),
    ]);
    expect(ranks.map((r) => [r.name, r.score, r.characters.length])).toEqual([
      ['Alpha Hollow', 6, 2], ['Beta Spire', 6, 1], ['Delta Mire', 0, 0], ['Zeta Crypt', 0, 0],
    ]);
  });
});

describe('choosePriorityList', () => {
  const lists = (overall: number, mythicPlus: number): BisLists =>
    ({ overall: Array.from({ length: overall }, (_, i) => named(['NECK'], i)), raid: [], mythicPlus: Array.from({ length: mythicPlus }, (_, i) => named(['NECK'], i)) });

  it('uses the chosen list when it has rows', () => {
    expect(choosePriorityList(lists(2, 2), 'mythicPlus')).toEqual({ listType: 'mythicPlus', fellBack: false });
    expect(choosePriorityList(lists(2, 2), 'overall')).toEqual({ listType: 'overall', fellBack: false });
  });

  it('falls back to Overall when the spec has no Mythic+ list', () => {
    expect(choosePriorityList(lists(2, 0), 'mythicPlus')).toEqual({ listType: 'overall', fellBack: true });
  });

  it('keeps the choice when there is nothing to fall back to', () => {
    expect(choosePriorityList(null, 'mythicPlus')).toEqual({ listType: 'mythicPlus', fellBack: false });
    expect(choosePriorityList(lists(0, 0), 'mythicPlus')).toEqual({ listType: 'mythicPlus', fellBack: false });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/core/priority`
Expected: FAIL, `Cannot find module './list'`.

- [ ] **Step 3: Implement `slots.ts`**

```ts
import type { ArmorType, SlotType } from '../types';

/** Slots where armor type decides who can wear an item. Cloaks are cloth for everyone, so BACK is not one. */
export const ARMOR_SLOTS: ReadonlySet<SlotType> = new Set<SlotType>(['HEAD', 'SHOULDER', 'CHEST', 'WRIST', 'HANDS', 'WAIST', 'LEGS', 'FEET']);

const BY_INVENTORY_TYPE: Record<string, SlotType[]> = {
  HEAD: ['HEAD'], NECK: ['NECK'], SHOULDER: ['SHOULDER'], CLOAK: ['BACK'], CHEST: ['CHEST'], ROBE: ['CHEST'],
  WRIST: ['WRIST'], HAND: ['HANDS'], WAIST: ['WAIST'], LEGS: ['LEGS'], FEET: ['FEET'],
  FINGER: ['FINGER_1', 'FINGER_2'], TRINKET: ['TRINKET_1', 'TRINKET_2'],
  WEAPON: ['MAIN_HAND', 'OFF_HAND'], WEAPONMAINHAND: ['MAIN_HAND'], TWOHWEAPON: ['MAIN_HAND'], RANGED: ['MAIN_HAND'], RANGEDRIGHT: ['MAIN_HAND'],
  WEAPONOFFHAND: ['OFF_HAND'], SHIELD: ['OFF_HAND'], HOLDABLE: ['OFF_HAND'],
};

/** The slots an item of this Blizzard inventory type fits. Shirts, tabards and unknown types fit none. */
export const slotsForInventoryType = (inventoryType: string | null): SlotType[] =>
  (inventoryType && BY_INVENTORY_TYPE[inventoryType]) || [];

const ARMOR_BY_CLASS: Record<string, ArmorType> = {
  Mage: 'cloth', Priest: 'cloth', Warlock: 'cloth',
  'Demon Hunter': 'leather', Druid: 'leather', Monk: 'leather', Rogue: 'leather',
  Evoker: 'mail', Hunter: 'mail', Shaman: 'mail',
  'Death Knight': 'plate', Paladin: 'plate', Warrior: 'plate',
};

export const armorTypeForClass = (className: string): ArmorType | null => ARMOR_BY_CLASS[className] ?? null;
```

- [ ] **Step 4: Implement `list.ts`**

```ts
import type { BisLists } from '../types';

export type PriorityListType = 'mythicPlus' | 'overall';

/** The list that drives priority: the character's choice, or Overall when Method has no rows for the Mythic+ list. */
export function choosePriorityList(lists: BisLists | null, chosen: PriorityListType): { listType: PriorityListType; fellBack: boolean } {
  if (chosen === 'mythicPlus' && lists && lists.mythicPlus.length === 0 && lists.overall.length > 0) {
    return { listType: 'overall', fellBack: true };
  }
  return { listType: chosen, fellBack: false };
}
```

- [ ] **Step 5: Implement `rank.ts`**

```ts
import type { GearRow } from '../gear/evaluate';
import { decodeTrack } from '../raidbots/tracks';
import type { ArmorType, BisRow, GearItem, SeasonLoot, SlotType, Track } from '../types';
import { ARMOR_SLOTS, armorTypeForClass, slotsForInventoryType } from './slots';

export interface PriorityCharacter {
  id: number;
  name: string;
  className: string;
  /** Rows evaluated for the character's priority list. */
  rows: GearRow[];
  equipped: GearItem[];
  tracks: ReadonlyMap<number, Track>;
}

export type Credit =
  | { kind: 'item'; slotLabel: string; weight: number; itemId: number; name: string; bonusIds: number[] }
  | { kind: 'tier'; slotLabel: string; weight: number }
  | { kind: 'any'; slotLabel: string; weight: number; minItemLevel: number };

export interface CharacterCredits { characterId: number; characterName: string; credits: Credit[] }
export interface DungeonRank { challengeModeId: number; name: string; split: boolean; score: number; characters: CharacterCredits[] }

/** From the design spec: 3 for an empty slot or Veteran and below, 2 for Champion or no track, 1 for Hero or Myth. */
export function trackWeight(item: GearItem | null, tracks: ReadonlyMap<number, Track>): number {
  if (!item) return 3;
  const track = decodeTrack(item.bonusIds, tracks);
  if (!track) return 2;
  if (track.name === 'Hero' || track.name === 'Myth') return 1;
  if (track.name === 'Champion') return 2;
  return 3;
}

function weightOf(row: GearRow, bySlot: ReadonlyMap<SlotType, GearItem>, matchedSlots: ReadonlySet<SlotType>, tierCount: number, tracks: ReadonlyMap<number, Track>): number {
  // Rings and trinkets: the weaker of the two items not already BiS sets the weight.
  const open = row.row.slots.length > 1 ? row.row.slots.filter((s) => !matchedSlots.has(s)) : [];
  const base = open.length > 0 ? Math.max(...open.map((s) => trackWeight(bySlot.get(s) ?? null, tracks))) : trackWeight(row.equipped, tracks);
  const tierBonus = row.row.kind === 'item' && row.row.isTier && tierCount < 4 ? 2 : 0;
  return base + tierBonus;
}

/** Whether a dungeon's loot can fill this row: the exact item, or for tier and Any rows, a slot drop in the right armor type. */
function dropsFor(row: BisRow, armor: ArmorType | null, dungeon: SeasonLoot): boolean {
  if (row.kind === 'item' && !row.isTier) return dungeon.loot.some((l) => l.itemId === row.itemId);
  const armorSlot = row.slots.some((s) => ARMOR_SLOTS.has(s));
  if (armorSlot && !armor) return false;
  return dungeon.loot.some((l) =>
    slotsForInventoryType(l.inventoryType).some((s) => row.slots.includes(s)) && (!armorSlot || l.armorType === armor));
}

function creditFor(row: BisRow, weight: number): Credit {
  if (row.kind === 'any') return { kind: 'any', slotLabel: row.slotLabel, weight, minItemLevel: row.minItemLevel };
  if (row.isTier) return { kind: 'tier', slotLabel: row.slotLabel, weight };
  return { kind: 'item', slotLabel: row.slotLabel, weight, itemId: row.itemId, name: row.name, bonusIds: row.bonusIds };
}

/** Ranks the season's dungeons by how much the characters need from each; ties go to more characters, then name. */
export function rankDungeons(characters: PriorityCharacter[], dungeons: SeasonLoot[]): DungeonRank[] {
  const needs = characters.map((character) => {
    const bySlot = new Map(character.equipped.map((item) => [item.slot, item]));
    const matchedSlots = new Set(character.rows.filter((r) => r.matched).map((r) => r.slot));
    const tierCount = character.equipped.filter((item) => item.isTier).length;
    return {
      character,
      armor: armorTypeForClass(character.className),
      missing: character.rows.filter((r) => r.state === 'missing')
        .map((r) => ({ row: r.row, weight: weightOf(r, bySlot, matchedSlots, tierCount, character.tracks) })),
    };
  });
  return dungeons.map((dungeon) => {
    const perCharacter = needs
      .map(({ character, armor, missing }) => ({
        characterId: character.id,
        characterName: character.name,
        credits: missing.filter((m) => dropsFor(m.row, armor, dungeon)).map((m) => creditFor(m.row, m.weight)),
      }))
      .filter((c) => c.credits.length > 0);
    const score = perCharacter.reduce((sum, c) => sum + c.credits.reduce((s, credit) => s + credit.weight, 0), 0);
    return { challengeModeId: dungeon.challengeModeId, name: dungeon.name, split: dungeon.split, score, characters: perCharacter };
  }).sort((a, b) => b.score - a.score || b.characters.length - a.characters.length || a.name.localeCompare(b.name));
}
```

- [ ] **Step 6: Run it and watch it pass**

Run: `npx vitest run src/core/priority`
Expected: 13 tests pass. If a weight assertion fails, recompute it by hand from the table in `trackWeight` before touching code. The tests encode the design spec's numbers.

- [ ] **Step 7: Record the module in `AGENTS.md`**

In **Architecture rules**, change `- Logic (\`gear\`, \`simc/parse\`) is pure functions, with no network or database access.` to `- Logic (\`gear\`, \`priority\`, \`simc/parse\`) is pure functions, with no network or database access.`

- [ ] **Step 8: Verify, and commit**

Run: `npm run typecheck && npx eslint src && npm test`
Expected: all clean.

```bash
git add -A src AGENTS.md
git commit -m "feat: rank the season's dungeons by what characters still need" -m "A pure engine scores each season dungeon from the characters' missing BiS
rows, weighted by the item each would replace, with +2 for tier slots
while a character has fewer than four tier pieces. Named items credit the
dungeon that drops them; tier and Any rows credit any drop for the slot in
the character's armor type. It takes a list of characters, so the group
page will add no scoring code."
```

---

### Task 7: The character page view, priority

**Files:**
- Modify: `src/server/views/types.ts` (adds `PriorityView`)
- Modify: `src/server/views/character-page.ts`, `src/server/views/views.test.ts`

**Interfaces:**
- Consumes: `readSeason` and `SEASON_META_KEY` (Task 5), `choosePriorityList` and `rankDungeons` (Task 6), `replaceSeason` (Task 4).
- Produces, in `src/server/views/types.ts`, plus `priority: PriorityView` on `CharacterPageView`:

```ts
export type PriorityCreditView =
  | { kind: 'item'; slotLabel: string; weight: number; item: ItemView }
  | { kind: 'tier'; slotLabel: string; weight: number }
  | { kind: 'any'; slotLabel: string; weight: number; minItemLevel: number };
export interface DungeonPriorityView { challengeModeId: number; name: string; score: number; split: boolean; credits: PriorityCreditView[] }
export interface PriorityView {
  listType: 'mythicPlus' | 'overall';
  fellBack: boolean;
  season: 'loading' | 'failed' | 'ready' | 'stale';
  needsSync: boolean;
  approximate: boolean;
  dungeons: DungeonPriorityView[];
  nothingFrom: string[];
}
```

- [ ] **Step 1: Write the failing test**

Append to `src/server/views/views.test.ts`, adding imports for `replaceSeason` from `@/core/db/queries/season`, `setMeta` from `@/core/db/queries/meta`, and `SEASON_META_KEY` from `@/core/sync/season-sync`:

```ts
describe('dungeon priority', () => {
  const needs: BisLists = {
    overall: [],
    raid: [],
    mythicPlus: [{ kind: 'item', slotLabel: 'Cloak', slots: ['BACK'], itemId: 30, name: 'Cloak of the Hollow', bonusIds: [], isTier: false, isCatalyst: false, source: 'Alpha Hollow' }],
  };

  async function withSeason(s: Services) {
    await replaceSeason(s.db, {
      slug: 'season-test-2',
      dungeons: [
        { challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', journalInstanceId: 901, mapId: 11 },
        { challengeModeId: 502, name: 'Beta Spire', shortName: 'BS', journalInstanceId: 902, mapId: 22 },
      ],
      loot: [{ challengeModeId: 501, encounterId: 1, encounterName: 'Hollow King', itemId: 30, itemName: 'Cloak of the Hollow', inventoryType: 'CLOAK', armorType: 'cloth' }],
    });
    await setMeta(s.db, SEASON_META_KEY, 'season-test-2', 1000);
  }

  it('ranks the season for the priority list, with credited items and the rest listed apart', async () => {
    const s = await services(needs);
    const id = await seed(s);
    await withSeason(s);
    const page = await getCharacterPage(s, id);
    expect(page!.priority).toMatchObject({ listType: 'mythicPlus', fellBack: false, season: 'ready', needsSync: false, approximate: false, nothingFrom: ['Beta Spire'] });
    expect(page!.priority.dungeons).toEqual([{
      challengeModeId: 501, name: 'Alpha Hollow', score: 3, split: false,
      credits: [{ kind: 'item', slotLabel: 'Cloak', weight: 3, item: expect.objectContaining({ itemId: 30, iconUrl: 'https://i/30.jpg' }) }],
    }]);
  });

  it('asks for a sync and says loading before any season is stored', async () => {
    const s = await services(needs);
    const id = await seed(s);
    const page = await getCharacterPage(s, id);
    expect(page!.priority).toMatchObject({ season: 'loading', needsSync: true, dungeons: [], nothingFrom: [] });
  });

  it('falls back to Overall when the spec has no Mythic+ list', async () => {
    const s = await services({ overall: needs.mythicPlus, raid: [], mythicPlus: [] });
    const id = await seed(s);
    await withSeason(s);
    const page = await getCharacterPage(s, id);
    expect(page!.priority).toMatchObject({ listType: 'overall', fellBack: true });
    expect(page!.priority.dungeons.map((d) => d.name)).toEqual(['Alpha Hollow']);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/server/views`
Expected: FAIL, `page.priority` is undefined.

- [ ] **Step 3: Types**

Add the three types from the Interfaces block to `src/server/views/types.ts`, and `priority: PriorityView;` to `CharacterPageView`.

- [ ] **Step 4: Compute priority in the loader**

In `src/server/views/character-page.ts`, add the imports:

```ts
import { choosePriorityList } from '@/core/priority/list';
import { rankDungeons } from '@/core/priority/rank';
import { readSeason } from '@/core/sync/season-sync';
```

After `const vaultItems = …` and **before** `const iconIds = …`, add:

```ts
  const season = await readSeason(db, time);
  const choice = choosePriorityList(bis.lists, character.priorityList);
  const priorityRows = choice.listType === list ? gearRows : evaluate(choice.listType);
  const ranks = rankDungeons(
    [{ id, name: character.name, className: character.className, rows: priorityRows, equipped: gear.equipped, tracks }],
    season.dungeons,
  );
  const creditItemIds = ranks.flatMap((d) => d.characters.flatMap((c) => c.credits.flatMap((cr) => (cr.kind === 'item' ? [cr.itemId] : []))));
```

Add `...creditItemIds` to the end of the `iconIds` array. Then add to the returned object:

```ts
    priority: {
      listType: choice.listType,
      fellBack: choice.fellBack,
      season: season.status,
      needsSync: season.needsSync,
      approximate: tracksError !== null,
      dungeons: ranks.filter((d) => d.score > 0).map((d) => ({
        challengeModeId: d.challengeModeId,
        name: d.name,
        score: d.score,
        split: d.split,
        credits: d.characters.flatMap((c) => c.credits).map((cr) => (cr.kind === 'item'
          ? { kind: 'item' as const, slotLabel: cr.slotLabel, weight: cr.weight,
              item: itemView({ itemId: cr.itemId, name: cr.name, itemLevel: null, quality: 'EPIC', bonusIds: cr.bonusIds }, icons, null) }
          : cr)),
      })),
      nothingFrom: ranks.filter((d) => d.score === 0).map((d) => d.name),
    },
```

- [ ] **Step 5: Verify, and commit**

Run: `npx vitest run src/server/views && npm run typecheck && npx eslint src && npm test`
Expected: 3 new tests pass; everything else clean.

```bash
git add -A src
git commit -m "feat: add dungeon priority to the character page view" -m "The view reads the stored season, picks the priority list (falling back
to Overall when a spec has no Mythic+ list), and ranks the season's
dungeons for the character. Credited items carry icons, dungeons scoring
nothing are listed apart, and the season's state tells the page whether
to show loading, failure or older data, and whether to start a sync."
```

---

### Task 8: The sync route, the trigger, the section and the layout

**Files:**
- Create: `src/app/api/season/sync/route.ts`
- Create: `src/components/season-sync/SeasonSync.tsx`
- Create: `src/components/character-page/DungeonPriority.tsx`, `src/components/character-page/DungeonPriority.test.ts`
- Modify: `src/app/characters/[id]/page.tsx`

**Interfaces:**
- Consumes: `PriorityView` (Task 7), `syncSeason` (Task 5).
- Produces: `POST /api/season/sync?region=<region>` → `{ result: SeasonSyncResult }`; `<SeasonSync region needed />`; `<DungeonPriority priority specLabel />`.

- [ ] **Step 1: Write the failing test**

Create `src/components/character-page/DungeonPriority.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PriorityView } from '@/server/views/types';
import { DungeonPriority } from './DungeonPriority';

// React 19 hoists <link rel="preload"> tags for images ahead of the markup.
const render = (priority: PriorityView) =>
  renderToStaticMarkup(createElement(DungeonPriority, { priority, specLabel: 'Feral Druid' })).replace(/<link[^>]*\/>/g, '');
const base: PriorityView = { listType: 'mythicPlus', fellBack: false, season: 'ready', needsSync: false, approximate: false, dungeons: [], nothingFrom: [] };

describe('DungeonPriority', () => {
  it('ranks dungeons with their credits and lists the rest apart', () => {
    const html = render({
      ...base,
      dungeons: [{ challengeModeId: 501, name: 'Alpha Hollow', score: 7, split: false, credits: [
        { kind: 'tier', slotLabel: 'Chest', weight: 4 },
        { kind: 'any', slotLabel: 'Shoulders', weight: 3, minItemLevel: 334 },
      ] }],
      nothingFrom: ['Beta Spire', 'Gamma Deep'],
    });
    expect(html).toContain('Mythic+ list');
    expect(html).toContain('Alpha Hollow');
    expect(html).toContain('Tier via catalyst');
    expect(html).toContain('Any item, level 334+');
    expect(html).toContain('Nothing you need from: Beta Spire, Gamma Deep.');
  });

  it('says so while the season loads, and when it could not load', () => {
    expect(render({ ...base, season: 'loading' })).toContain('Loading this season’s loot…');
    const failed = render({ ...base, season: 'failed' });
    expect(failed).toContain('couldn’t be loaded. It will retry within the hour.');
    expect(failed).not.toContain('Nothing you need from');
  });

  it('explains the fallback, approximate weights, older data and an empty ranking', () => {
    const html = render({ ...base, listType: 'overall', fellBack: true, approximate: true, season: 'stale', nothingFrom: ['Alpha Hollow'] });
    expect(html).toContain('Using the Overall list: Method has no Mythic+ list for Feral Druid.');
    expect(html).toContain('Weights are approximate while upgrade track data is unavailable.');
    expect(html).toContain('Showing older loot data');
    expect(html).toContain('No season dungeon drops anything you still need.');
    expect(html).not.toContain('Nothing you need from');
  });

  it('marks a split dungeon', () => {
    const html = render({ ...base, dungeons: [{ challengeModeId: 502, name: 'Streets of Beta', score: 3, split: true, credits: [] }] });
    expect(html).toContain('Split dungeon');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/character-page/DungeonPriority.test.ts`
Expected: FAIL, `Cannot find module './DungeonPriority'`.

- [ ] **Step 3: The section**

Create `src/components/character-page/DungeonPriority.tsx`:

```tsx
import { ItemCard } from '@/components/item-card/ItemCard';
import type { PriorityCreditView, PriorityView } from '@/server/views/types';

const LIST_NAMES = { mythicPlus: 'Mythic+ list', overall: 'Overall list' } as const;

function Credit({ credit }: { credit: PriorityCreditView }) {
  if (credit.kind === 'item') {
    return (
      <ItemCard itemId={credit.item.itemId} name={credit.item.name} quality={credit.item.quality} iconUrl={credit.item.iconUrl}
        bonusIds={credit.item.bonusIds} itemLevel={null} detail={`${credit.slotLabel} · weight ${credit.weight}`} />
    );
  }
  const what = credit.kind === 'tier' ? 'Tier via catalyst' : `Any item, level ${credit.minItemLevel}+`;
  return (
    <p className="text-[15px]">
      <span className="font-semibold">{credit.slotLabel}</span>
      <span className="text-muted"> · {what} · weight {credit.weight}</span>
    </p>
  );
}

function Ranking({ priority }: { priority: PriorityView }) {
  if (priority.season === 'loading') return <p role="status" className="text-muted">Loading this season&rsquo;s loot&hellip;</p>;
  if (priority.season === 'failed') {
    return <p role="alert" className="text-[#f3c9a2]">This season&rsquo;s loot couldn&rsquo;t be loaded. It will retry within the hour.</p>;
  }
  if (priority.dungeons.length === 0) return <p className="text-muted">No season dungeon drops anything you still need.</p>;
  return (
    <>
      <ol className="flex flex-col gap-4">
        {priority.dungeons.map((d) => (
          <li key={d.challengeModeId} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{d.name}</span>
              <span className="font-mono text-gold">{d.score}</span>
            </div>
            {d.split && <span className="text-xs text-muted">Split dungeon: loot shown for the whole instance.</span>}
            {d.credits.map((credit, i) => <Credit key={i} credit={credit} />)}
          </li>
        ))}
      </ol>
      {priority.nothingFrom.length > 0 && <p className="text-sm text-muted">Nothing you need from: {priority.nothingFrom.join(', ')}.</p>}
    </>
  );
}

/** The season's Mythic+ dungeons, ranked by what this character still needs from each. */
export function DungeonPriority({ priority, specLabel }: { priority: PriorityView; specLabel: string }) {
  return (
    <section aria-label="Dungeon priority" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">Dungeon priority</h2>
        <span className="text-sm text-muted">{LIST_NAMES[priority.listType]}</span>
      </div>
      {priority.fellBack && <p className="text-sm text-muted">Using the Overall list: Method has no Mythic+ list for {specLabel}.</p>}
      {priority.approximate && <p className="text-sm text-muted">Weights are approximate while upgrade track data is unavailable.</p>}
      {priority.season === 'stale' && <p className="text-sm text-muted">Showing older loot data: the latest update couldn&rsquo;t be loaded.</p>}
      <Ranking priority={priority} />
    </section>
  );
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/components/character-page/DungeonPriority.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: The route and the trigger**

Create `src/app/api/season/sync/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { syncSeason } from '@/core/sync/season-sync';
import { getServices } from '@/server/services';
import { errorResponse, parseRegion } from '@/server/route-helpers';

export async function POST(request: NextRequest) {
  const region = parseRegion(request.nextUrl.searchParams.get('region'));
  if (!region) return NextResponse.json({ error: 'Unknown region' }, { status: 400 });
  try {
    const { db, blizzard, fetchFn, now } = await getServices();
    return NextResponse.json({ result: await syncSeason({ db, blizzard, fetchFn, now: now(), region }) });
  } catch (err) {
    return errorResponse(err);
  }
}
```

Create `src/components/season-sync/SeasonSync.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Region } from '@/core/types';

/** Loads the season's loot in the background when the page says it's missing or a day old, then re-renders. */
export function SeasonSync({ region, needed }: { region: Region; needed: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!needed) return;
    let cancelled = false;
    fetch(`/api/season/sync?region=${region}`, { method: 'POST' })
      .then((res) => (res.ok ? (res.json() as Promise<{ result: string }>) : { result: 'failed' }))
      .catch(() => ({ result: 'failed' }))
      .then(({ result }) => { if (!cancelled && result !== 'skipped') router.refresh(); });
    return () => { cancelled = true; };
  }, [needed, region, router]);
  return null;
}
```

- [ ] **Step 6: The layout**

In `src/app/characters/[id]/page.tsx`, import `DungeonPriority` from `@/components/character-page/DungeonPriority` and `SeasonSync` from `@/components/season-sync/SeasonSync`. Replace the two lines rendering `<GearTable … />` and `<VaultSection … />` with:

```tsx
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[860px_minmax(0,1fr)] lg:items-start">
        <GearTable rows={view.rows} tracksKnown={!view.tracksError} />
        <div className="flex flex-col gap-8">
          <DungeonPriority priority={view.priority} specLabel={`${view.spec} ${view.className}`} />
          <VaultSection vault={view.vault} vaultChoices={view.vaultChoices} vaultChoicesAt={view.vaultChoicesAt} now={now} />
        </div>
      </div>
```

and add `<SeasonSync region={view.region} needed={view.priority.needsSync} />` after the existing `<StaleSync … />`.

- [ ] **Step 7: Verify, and commit**

Stop any `npm run dev` first. Then run: `npm run typecheck && npx eslint src && npm test && npm run build`
Expected: all clean, and the build lists `/api/season/sync`.

```bash
git add -A src
git commit -m "feat: show dungeon priority beside the gear table" -m "The character page gains a Dungeon priority section above the Great Vault,
in a column to the right of the gear table as on the Group artboard,
stacking below it on narrow screens. It names the list it ranks from,
shows each dungeon's score and what earns it, and says when the season is
loading, failed, older, or when the spec fell back to Overall.

A background trigger calls the new season sync route when the page says
the loot is missing or a day old, then refreshes the page."
```

---

### Task 9: The live check, hand checks, and the pull request

**Files:**
- Modify: `src/core/live.live.test.ts`

- [ ] **Step 1: The live join check**

Append to `src/core/live.live.test.ts`, adding imports for `fetchMainSeason` from `./raiderio/season` and `loadSeasonLoot` from `./sync/season-sync`:

```ts
  it('this season’s dungeons still join to Encounter Journal loot by map ID', async () => {
    const config = readConfig();
    const blizzard = createBlizzardClient({ clientId: config.blizzardClientId, clientSecret: config.blizzardClientSecret });
    const season = await fetchMainSeason(fetch, Date.now());
    const data = await loadSeasonLoot(blizzard, (env.LIVE_TEST_REGION as Region) || 'eu', season);
    expect(data.dungeons).toHaveLength(season.dungeons.length);
    expect(data.loot.length).toBeGreaterThan(50);
    expect(data.loot.some((l) => l.armorType !== null)).toBe(true);
  }, 180_000);
```

Run: `npm run test:live`
Expected: every live check passes, including this one, which takes up to a minute. It needs `.env`, and never runs in CI.

- [ ] **Step 2: The full gate**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all clean.

- [ ] **Step 3: Hand checks on a production server**

Stop any dev server. Serve the build against a **copy** of the database so nothing touches real data:

```bash
cp data/app.db /tmp/priority-check.db
DATABASE_URL=file:/tmp/priority-check.db npx next start -p 3001
```

Check and record:

- [ ] A character page first shows "Loading this season's loot…". Within about a minute it re-renders with a ranked list.
- [ ] A reload doesn't call `/api/season/sync` again: `needsSync` is false for a day.
- [ ] A plate character (for example a Death Knight) is never credited cloth, leather or mail tier drops.
- [ ] At full width, priority and the Great Vault sit right of the gear table. At a narrow width, they stack below it.
- [ ] Changing "Dungeon priority uses" to Overall changes the section's heading and ranking.

Stop the server afterwards.

- [ ] **Step 4: Commit and open the pull request**

```bash
git add src/core/live.live.test.ts
git commit -m "test: check live that season loot still joins by map ID"
git push -u origin feat/dungeon-priority
```

The description follows `AGENTS.md`:
- `Closes #10.` and `Refs #3.`
- A framing sentence.
- `## What changes`, covering the four parts.
- `## Data`: two migrations (`0005_bis-any-rows` rebuilds `bis_items`; `0006_season-loot` adds two tables), and the new `season.v1` meta key.
- `## Testing`: the test count, the migration check against a real database copy, the live join check and each hand check.
- `Spec:` and `Plan:` lines.

Ask for a commit-by-commit review.
