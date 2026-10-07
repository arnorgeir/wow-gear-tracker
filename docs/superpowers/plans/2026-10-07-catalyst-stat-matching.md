# Catalyst Stat Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compare tier pieces and dungeon drops by secondary stat pair. Add a `wrongStats` state, and make every tier credit name the dungeon's own drop.

**Architecture:**
- **Stat pairs.** They come from Blizzard's equipment and item endpoints and are stored as comma-joined text on `snapshot_items`, `item_details` and `dungeon_loot`. They are compared by one pure function in `src/core/gear/stat-pair.ts`.
- **Engine.** `evaluateGear` and `rankDungeons` take a `targets` map of Method tier items' pairs, built by a new `ensureTierTargets`.
- **Views and components.** They carry the pairs through to labels.

**Tech Stack:** Next.js app router, TypeScript, Drizzle + libsql SQLite, Vitest, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-10-07-catalyst-stat-matching-design.md`. It is the authority; read it before starting. Issue #79.

## Global Constraints

- `src/core` never imports `next`, `react`, `src/app`, `src/components` or `src/server`.
- Logic functions take only the data they need, and never a database client.
- Every database write goes through `withWriteLock`.
- In-memory test databases have one connection: don't run reads in parallel with a write in one code path.
- Schema changes go in `src/core/db/schema.ts`, then `npm run db:generate -- --name catalyst-stat-pairs`. Never edit a committed migration.
- Bump `SEASON_META_KEY` from `season.v2` to `season.v3`.
- Stat pair encoding: `null` means unknown, `''` means no secondaries, otherwise sorted types comma-joined, such as `HASTE_RATING,MASTERY_RATING`.
- Secondary stat types are exactly `CRIT_RATING`, `HASTE_RATING`, `MASTERY_RATING` and `VERSATILITY`. Ignore stats with `is_negated: true`.
- Display words are Crit, Haste, Mastery and Vers, joined with `/` in sorted type order: "Haste/Mastery", "Mastery/Vers".
- Use semantic Tailwind tokens. Add `--color-stats: #f08fc0` and `--color-stats-bg: #2e1a26` to `@theme`; never hardcode a new hex in components.
- Color is never the only signal: every state has words, and the `stats` tone uses a dashed outline.
- Tests use `openTestDb()` and fakes. Fixture names are made-up, such as Birkibjörn; never real players.
- Tests sit beside the code as `<name>.test.ts`. Import through `@/`, except for relative imports inside a component directory.
- Commit subjects are `type: lowercase imperative summary`, terse, with no AI attribution or co-author trailers.
- Before calling work done: `npm run typecheck && npm run lint && npm test`, plus `npm run build` because pages and components change. Never build while `npm run dev` serves this folder.

## Review Focus

- **First Blizzard sync after deploy.** A stored snapshot without pairs must be backfilled in place, not re-saved, so a newer SimC paste stays current. Test in Task 4.
- **Season cached under `season.v2`.** Loot rows without pairs must render as `unverified` credits, never crash, and the next sync reloads them. Tests in Task 5 and Task 8.
- **A character whose current gear is a SimC paste.** Tier pieces have no pairs, so no `wrongStats` appears and the track states stay as today. Test in Task 7.
- **Items with no secondaries (`[]`).** `[]` against `[]` is `same`, and `[]` against a known pair is `different`, never `unknown`. Test in Task 1.
- **A target lookup that threw.** The item is missing from `targets`, so everything for that row is `unknown`, and views render no pair text without crashing. Test in Task 9.

---

### Task 1: Stat pair module and types

**Files:**
- Create: `src/core/gear/stat-pair.ts`
- Create: `src/core/gear/stat-pair.test.ts`
- Modify: `src/core/types.ts`

**Interfaces:**
- Produces:
  - `type StatMatch = 'same' | 'different' | 'unknown'`
  - `interface TierTarget { secondaryStats: string[] | null; isTier: boolean }`
  - `encodeStats(stats: readonly string[] | null | undefined): string | null`
  - `decodeStats(text: string | null): string[] | null`
  - `compareStats(target: { itemId: number; stats: readonly string[] | null | undefined }, item: same shape): StatMatch`
  - `GearItem.secondaryStats?: string[] | null`
  - `LootItem` gains `name: string` and `secondaryStats?: string[] | null`
  - (`ItemState` gains `'wrongStats'` in Task 7, together with every `Record<ItemState, …>`, so each commit typechecks.)

- [ ] **Step 1: Write the failing test**

`src/core/gear/stat-pair.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { compareStats, decodeStats, encodeStats } from './stat-pair';

const HM = ['HASTE_RATING', 'MASTERY_RATING'];
const MV = ['MASTERY_RATING', 'VERSATILITY'];

describe('encodeStats and decodeStats', () => {
  it('stores a sorted, comma-joined pair and reads it back', () => {
    expect(encodeStats(['MASTERY_RATING', 'HASTE_RATING'])).toBe('HASTE_RATING,MASTERY_RATING');
    expect(decodeStats('HASTE_RATING,MASTERY_RATING')).toEqual(HM);
  });

  it('keeps no secondaries apart from unknown', () => {
    expect(encodeStats([])).toBe('');
    expect(decodeStats('')).toEqual([]);
    expect(encodeStats(null)).toBeNull();
    expect(encodeStats(undefined)).toBeNull();
    expect(decodeStats(null)).toBeNull();
  });
});

describe('compareStats', () => {
  it('is same for equal known pairs in any order', () => {
    expect(compareStats({ itemId: 1, stats: HM }, { itemId: 2, stats: ['MASTERY_RATING', 'HASTE_RATING'] })).toBe('same');
  });

  it('is different for known pairs that differ, even with equal item IDs', () => {
    expect(compareStats({ itemId: 1, stats: HM }, { itemId: 2, stats: MV })).toBe('different');
    expect(compareStats({ itemId: 271529, stats: MV }, { itemId: 271529, stats: HM })).toBe('different');
  });

  it('falls back to item IDs only when a pair is unknown', () => {
    expect(compareStats({ itemId: 7, stats: null }, { itemId: 7, stats: HM })).toBe('same');
    expect(compareStats({ itemId: 7, stats: HM }, { itemId: 7, stats: undefined })).toBe('same');
    expect(compareStats({ itemId: 7, stats: HM }, { itemId: 8, stats: null })).toBe('unknown');
  });

  it('treats no secondaries as a known pair', () => {
    expect(compareStats({ itemId: 1, stats: [] }, { itemId: 2, stats: [] })).toBe('same');
    expect(compareStats({ itemId: 1, stats: [] }, { itemId: 2, stats: HM })).toBe('different');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/gear/stat-pair.test.ts`
Expected: FAIL, cannot resolve `./stat-pair`.

- [ ] **Step 3: Write the types and module**

In `src/core/types.ts`:
- Add `secondaryStats?: string[] | null;` to `GearItem`, after `isTier`, with the comment `/** Secondary stat types, sorted. Null or absent when unknown, as for SimC items. */`.
- After `ITEM_STATES`, add:

```ts
export type StatMatch = 'same' | 'different' | 'unknown';
/** A tier row's Method item: its secondary stat pair, and whether it is the tier piece itself (bought with a tier token). */
export interface TierTarget { secondaryStats: string[] | null; isTier: boolean }
```

- Replace `LootItem`:

```ts
export interface LootItem { itemId: number; name: string; inventoryType: string | null; armorType: ArmorType | null; secondaryStats?: string[] | null }
```

`src/core/gear/stat-pair.ts`:

```ts
import type { StatMatch } from '../types';

/** Stored form: sorted types joined by commas, '' for an item with no secondaries, null when unknown. */
export const encodeStats = (stats: readonly string[] | null | undefined): string | null =>
  (stats == null ? null : [...stats].sort().join(','));

export const decodeStats = (text: string | null): string[] | null =>
  (text === null ? null : text === '' ? [] : text.split(','));

interface Side { itemId: number; stats: readonly string[] | null | undefined }

/**
 * Whether an item carries the target's secondary stats. Known pairs win over item IDs: a catalyzed
 * tier piece can share the Method tier piece's ID and still carry another base item's stats.
 */
export function compareStats(target: Side, item: Side): StatMatch {
  if (target.stats != null && item.stats != null) return encodeStats(target.stats) === encodeStats(item.stats) ? 'same' : 'different';
  return target.itemId === item.itemId ? 'same' : 'unknown';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/gear/stat-pair.test.ts`
Expected: PASS.

`npm run typecheck` will now fail where `LootItem` literals lack `name`. Fix them now, so this commit typechecks. In `src/core/priority/priority.test.ts`, change the `loot` helper to:

```ts
const loot = (itemId: number, inventoryType: string | null = null, armorType: ArmorType | null = null, secondaryStats?: string[] | null): LootItem =>
  ({ itemId, name: `Loot ${itemId}`, inventoryType, armorType, secondaryStats });
```

In `src/core/db/queries/season.ts`, `getSeasonLoot`, map `name: l.itemName` too:

```ts
.map((l) => ({ itemId: l.itemId, name: l.itemName, inventoryType: l.inventoryType, armorType: l.armorType })),
```

Run `npm run typecheck` and fix any other `LootItem` literal by adding `name`. It must pass before committing.

- [ ] **Step 5: Commit**

```bash
git add src/core/gear/stat-pair.ts src/core/gear/stat-pair.test.ts src/core/types.ts src/core/priority/priority.test.ts src/core/db/queries/season.ts
git commit -m "feat: add secondary stat pair compare"
```

---

### Task 2: Blizzard parsers read secondary stats

**Files:**
- Modify: `src/core/blizzard/parse.ts`
- Modify: `src/core/blizzard/types.ts`
- Test: `src/core/blizzard/parse.test.ts`

**Interfaces:**
- Consumes: `GearItem.secondaryStats` (Task 1).
- Produces:
  - `secondaryStatsOf(stats: RawStat[] | undefined): string[] | null`, exported from `parse.ts`;
  - `ItemInfo.secondaryStats: string[] | null`;
  - `parseEquipment` sets `secondaryStats` on each `GearItem`.

- [ ] **Step 1: Write the failing tests**

Add to `src/core/blizzard/parse.test.ts`. Extend the import with `secondaryStatsOf`.

```ts
describe('secondaryStatsOf', () => {
  it('keeps secondary types only, sorted, skipping primaries, stamina and negated stats', () => {
    expect(secondaryStatsOf([
      { type: { type: 'INTELLECT' } }, { type: { type: 'AGILITY' }, is_negated: true }, { type: { type: 'STAMINA' } },
      { type: { type: 'VERSATILITY' } }, { type: { type: 'MASTERY_RATING' } },
    ])).toEqual(['MASTERY_RATING', 'VERSATILITY']);
  });

  it('gives [] for stats without secondaries and null when stats are absent', () => {
    expect(secondaryStatsOf([{ type: { type: 'STAMINA' } }])).toEqual([]);
    expect(secondaryStatsOf(undefined)).toBeNull();
  });
});

describe('parseEquipment stats', () => {
  it('reads each equipped item’s secondary stats', () => {
    const [head, neck] = parseEquipment({ equipped_items: [
      { slot: { type: 'HEAD' }, item: { id: 271564 }, name: 'Crown', set: {}, stats: [{ type: { type: 'HASTE_RATING' } }, { type: { type: 'MASTERY_RATING' } }] },
      { slot: { type: 'NECK' }, item: { id: 9 }, name: 'Chain' },
    ] });
    expect(head!.secondaryStats).toEqual(['HASTE_RATING', 'MASTERY_RATING']);
    expect(neck!.secondaryStats).toBeNull();
  });
});

describe('parseItemInfo stats', () => {
  it('reads preview_item.stats', () => {
    expect(parseItemInfo({ preview_item: { stats: [{ type: { type: 'HASTE_RATING' } }, { type: { type: 'MASTERY_RATING' } }] } }).secondaryStats)
      .toEqual(['HASTE_RATING', 'MASTERY_RATING']);
    expect(parseItemInfo({}).secondaryStats).toBeNull();
  });
});
```

Existing `parseItemInfo` and `parseEquipment` tests that use `toEqual` on whole objects now need `secondaryStats: null` added to their expected values. Update them.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/blizzard/parse.test.ts`
Expected: FAIL, `secondaryStatsOf` is not exported.

- [ ] **Step 3: Implement**

`src/core/blizzard/types.ts`: change `ItemInfo` to

```ts
export interface ItemInfo extends ItemDetails { inventoryType: string | null; armorType: ArmorType | null; secondaryStats: string[] | null }
```

`src/core/blizzard/parse.ts`:

```ts
export interface RawStat { type: { type: string }; is_negated?: boolean }

// The stats the catalyst carries over from its input item. Primaries, stamina and tertiaries are not part of a pair.
const SECONDARY_STATS = new Set(['CRIT_RATING', 'HASTE_RATING', 'MASTERY_RATING', 'VERSATILITY']);

/** An item's secondary stat types, sorted. Null when the response carries no stats at all. */
export function secondaryStatsOf(stats: RawStat[] | undefined): string[] | null {
  if (!stats) return null;
  return [...new Set(stats.filter((s) => !s.is_negated && SECONDARY_STATS.has(s.type.type)).map((s) => s.type.type))].sort();
}
```

- In `RawEquipment.equipped_items` entries, add `stats?: RawStat[];`. In `parseEquipment`, add `secondaryStats: secondaryStatsOf(item.stats),` after `isTier`.
- In `RawItem`, change `preview_item?: { set?: unknown }` to `preview_item?: { set?: unknown; stats?: RawStat[] }`. In `parseItemInfo`, add `secondaryStats: secondaryStatsOf(raw.preview_item?.stats),`.

Typecheck: in `src/core/sync/reference-sync.test.ts`, the `getItemDetails` fakes return objects without `secondaryStats`. They are cast `as unknown as BlizzardClient`, so they compile. Leave them.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/blizzard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/blizzard
git commit -m "feat: read secondary stats from blizzard items"
```

---

### Task 3: Method parser recognizes "/ Catalyst"

**Files:**
- Modify: `src/core/method/method.ts:56-58`
- Test: `src/core/method/method.test.ts`

**Interfaces:** none new. `isCatalyst` is used for display only.

- [ ] **Step 1: Write the failing test**

Add to `src/core/method/method.test.ts` (import `parseGearingHtml` if it isn't already):

```ts
describe('catalyst sources', () => {
  const table = (item: string, source: string) =>
    `<table id="dungeon_table"><tr><td>Head</td><td><a href="https://www.wowhead.com/item=271875">${item}</a></td><td>${source}</td></tr></table>`;

  it('reads "X / Catalyst" as a catalyst source and strips the suffix', () => {
    const [row] = parseGearingHtml(table('Gaze of the Coiled Watcher (Tier Set)', 'Ula&#39;tek / Catalyst')).mythicPlus;
    expect(row).toMatchObject({ kind: 'item', isTier: true, isCatalyst: true, source: "Ula'tek" });
  });

  it('keeps a Tier Set row with a plain source as tier but not catalyst', () => {
    const [row] = parseGearingHtml(table('Primordial Robe of Rites (Tier Set)', 'Altar of Fangs')).mythicPlus;
    expect(row).toMatchObject({ isTier: true, isCatalyst: false, source: 'Altar of Fangs' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/method/method.test.ts`
Expected: FAIL on the first case, with `isCatalyst: false` and source `Ula'tek / Catalyst`.

- [ ] **Step 3: Implement**

In `parseTable`, replace the two lines:

```ts
      isCatalyst: /\(Catalyst\)|\/\s*Catalyst\s*$/i.test(sourceText),
      source: sourceText.replace(/\s*(?:\(Catalyst\)|\/\s*Catalyst)\s*$/i, ''),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/method`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/method
git commit -m "fix: read slash catalyst sources as catalyst"
```

---

### Task 4: Store stat pairs on snapshots, backfill old ones

**Files:**
- Modify: `src/core/db/schema.ts`
- Create: `drizzle/<NNNN>_catalyst-stat-pairs.sql` and its meta files, from `npm run db:generate -- --name catalyst-stat-pairs`
- Modify: `src/core/db/queries/snapshots.ts`
- Modify: `src/core/simc/import-simc.ts:56-65`
- Test: `src/core/db/queries/snapshots.test.ts`

**Interfaces:**
- Consumes: `encodeStats` and `decodeStats` (Task 1); `GearItem.secondaryStats` (Task 1).
- Produces:
  - `SnapshotItemInput.secondaryStats: string[] | null`, required;
  - `equippedGear` returns `GearItem`s with `secondaryStats`;
  - schema columns `snapshotItems.secondaryStats`, `itemDetails.secondaryStats`, `itemDetails.statsFetchedAt` and `dungeonLoot.secondaryStats`, all nullable.

- [ ] **Step 1: Write the failing tests**

Add to `src/core/db/queries/snapshots.test.ts`. Import `snapshotItems` from `'../schema'` and `eq` from `'drizzle-orm'`.

```ts
const HM = ['HASTE_RATING', 'MASTERY_RATING'];
const statGear: GearItem[] = gear.map((g) => (g.slot === 'HEAD' ? { ...g, secondaryStats: HM } : { ...g, secondaryStats: [] }));

describe('snapshot stat pairs', () => {
  it('stores and reads back pairs, keeping unknown apart from no secondaries', async () => {
    const db = await openTestDb();
    const { id } = await insertCharacter(db, newCharacter, 1);
    await saveSnapshotIfChanged(db, id, 'blizzard', gearToSnapshotItems(statGear), 10);
    const [head, neck] = equippedGear((await getLatestSnapshot(db, id))!);
    expect(head!.secondaryStats).toEqual(HM);
    expect(neck!.secondaryStats).toEqual([]);
    const { id: other } = await insertCharacter(db, { ...newCharacter, realmId: 1307 }, 1);
    await saveSnapshotIfChanged(db, other, 'blizzard', gearToSnapshotItems(gear), 10);
    expect(equippedGear((await getLatestSnapshot(db, other))!)[0]!.secondaryStats).toBeNull();
  });

  it('saves a new snapshot when only a stat pair changed', async () => {
    const db = await openTestDb();
    const { id } = await insertCharacter(db, newCharacter, 1);
    const first = await saveSnapshotIfChanged(db, id, 'blizzard', gearToSnapshotItems(statGear), 10);
    const recatalyzed = statGear.map((g) => (g.slot === 'HEAD' ? { ...g, secondaryStats: ['CRIT_RATING', 'VERSATILITY'] } : g));
    const second = await saveSnapshotIfChanged(db, id, 'blizzard', gearToSnapshotItems(recatalyzed), 20);
    expect(second.changed).toBe(true);
    expect(second.snapshotId).not.toBe(first.snapshotId);
    expect(await saveSnapshotIfChanged(db, id, 'blizzard', gearToSnapshotItems(recatalyzed), 30)).toEqual({ snapshotId: second.snapshotId, changed: false });
  });

  it('backfills pairs onto a snapshot saved before pairs existed, and a newer paste stays current', async () => {
    const db = await openTestDb();
    const { id } = await insertCharacter(db, newCharacter, 1);
    const old = await saveSnapshotIfChanged(db, id, 'blizzard', gearToSnapshotItems(gear), 10);
    const paste = await saveSnapshotIfChanged(db, id, 'simc', gearToSnapshotItems(gear).map((i) => ({ ...i, itemLevel: 330 })), 20);
    const sync = await saveSnapshotIfChanged(db, id, 'blizzard', gearToSnapshotItems(statGear), 30);
    expect(sync).toEqual({ snapshotId: old.snapshotId, changed: false });
    expect((await getLatestSnapshot(db, id))!.id).toBe(paste.snapshotId);
    const rows = await db.select().from(snapshotItems).where(eq(snapshotItems.snapshotId, old.snapshotId));
    expect(rows.find((r) => r.slot === 'HEAD')!.secondaryStats).toBe('HASTE_RATING,MASTERY_RATING');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/db/queries/snapshots.test.ts`
Expected: FAIL. There is no `secondaryStats` column, and `secondaryStats` is undefined on read.

- [ ] **Step 3: Schema and migration**

In `src/core/db/schema.ts`:
- `snapshotItems`: add `secondaryStats: text('secondary_stats'),` after `isTier`, with the comment `/** Sorted secondary stat types joined by commas, '' for none, null when unknown. */`.
- `itemDetails`: add `secondaryStats: text('secondary_stats'),` and `statsFetchedAt: integer('stats_fetched_at'),` with the comment `/** Set by the tier target lookup; null until it ran for this item. */`.
- `dungeonLoot`: add `secondaryStats: text('secondary_stats'),`.

Run `npm run db:generate -- --name catalyst-stat-pairs`. Open the generated SQL and confirm it is four `ALTER TABLE … ADD COLUMN` statements with nullable columns. Commit the SQL and the snapshot/journal files drizzle wrote.

- [ ] **Step 4: Implement snapshot queries**

In `src/core/db/queries/snapshots.ts`, import `encodeStats, decodeStats` from `'../../gear/stat-pair'`:

```ts
export interface SnapshotItemInput {
  location: ItemLocation;
  slot: string;
  itemId: number;
  name: string;
  itemLevel: number | null;
  quality: Quality;
  bonusIds: number[];
  isTier: boolean;
  /** Null when unknown: SimC items carry no stats. */
  secondaryStats: string[] | null;
}

export const gearToSnapshotItems = (gear: GearItem[]): SnapshotItemInput[] =>
  gear.map((g) => ({ location: 'equipped', slot: g.slot, itemId: g.itemId, name: g.name, itemLevel: g.itemLevel, quality: g.quality, bonusIds: g.bonusIds, isTier: g.isTier, secondaryStats: g.secondaryStats ?? null }));

// Stats stay out of the content hash: adding them would change every stored hash, and the first sync after that would save
// a Blizzard snapshot that displaces a newer SimC paste. saveSnapshotIfChanged compares stats separately.
const statsKey = (list: { location: string; slot: string; itemId: number; secondaryStats: string | null }[]) =>
  list.map((i) => [i.location, i.slot, i.itemId, i.secondaryStats ?? '?'].join('|')).sort().join('\n');
```

Replace the early return in `saveSnapshotIfChanged` with:

```ts
    if (previous && previous.contentHash === contentHash && previous.source === source) {
      const stored = await db.select().from(snapshotItems).where(eq(snapshotItems.snapshotId, previous.id));
      const incoming = list.map((i) => ({ ...i, secondaryStats: encodeStats(i.secondaryStats) }));
      if (statsKey(stored) === statsKey(incoming)) return { snapshotId: previous.id, changed: false };
      if (stored.every((r) => r.secondaryStats === null)) {
        // Saved before stat pairs existed: fill them in rather than saving the same gear again.
        await db.transaction(async (tx) => {
          for (const i of incoming) {
            await tx.update(snapshotItems).set({ secondaryStats: i.secondaryStats }).where(and(
              eq(snapshotItems.snapshotId, previous.id), eq(snapshotItems.location, i.location),
              eq(snapshotItems.slot, i.slot), eq(snapshotItems.itemId, i.itemId)));
          }
        });
        return { snapshotId: previous.id, changed: false };
      }
    }
```

In the insert, encode:

```ts
      if (list.length > 0) await tx.insert(snapshotItems).values(list.map((i) => ({ ...i, secondaryStats: encodeStats(i.secondaryStats), snapshotId: snapshot!.id })));
```

In `getLatestSnapshot`, destructure `secondaryStats` and return `secondaryStats: decodeStats(secondaryStats)`. In `equippedGear`, add `secondaryStats: i.secondaryStats`.

In `src/core/simc/import-simc.ts`, add `secondaryStats: null,` to each built item. The comment: `// SimC exports carry no item stats.`

Run `npm run typecheck`. Every other `SnapshotItemInput` literal, mostly in tests, needs `secondaryStats: null`. Add it.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/core/db src/core/simc src/core/sync`
Expected: PASS, including the existing hash tests.

- [ ] **Step 6: Commit**

```bash
git add src/core/db src/core/simc drizzle
git commit -m "feat: store stat pairs on snapshots" -m "Hash format unchanged: stats would re-save every Blizzard snapshot
and bury newer SimC pastes. Pre-change snapshots backfill in place."
```
---

### Task 5: Season loot carries names and stat pairs

**Files:**
- Modify: `src/core/db/queries/season.ts`
- Modify: `src/core/sync/season-sync.ts:13,57-65`
- Test: `src/core/db/queries/season.test.ts`, `src/core/sync/season-sync.test.ts`

**Interfaces:**
- Consumes: `ItemInfo.secondaryStats` (Task 2), `encodeStats` and `decodeStats` (Task 1), the `dungeonLoot.secondaryStats` column (Task 4).
- Produces:
  - `DungeonLootRow.secondaryStats?: string | null`, the encoded text;
  - `getSeasonLoot` returns `LootItem`s with `name` and decoded `secondaryStats`;
  - `SEASON_META_KEY === 'season.v3'`.

- [ ] **Step 1: Write the failing tests**

In `src/core/db/queries/season.test.ts`, add:

```ts
  it('reads back loot names and stat pairs, unknown when not stored', async () => {
    const db = await openTestDb();
    await replaceSeason(db, { ...data, loot: data.loot.map((l) => (l.itemId === 100 ? { ...l, secondaryStats: 'HASTE_RATING,MASTERY_RATING' } : l)) });
    const alpha = (await getSeasonLoot(db)).find((d) => d.challengeModeId === 501)!;
    expect(alpha.loot[0]).toEqual({ itemId: 100, name: 'Hollow Robe', inventoryType: 'ROBE', armorType: 'leather', secondaryStats: ['HASTE_RATING', 'MASTERY_RATING'] });
    expect(alpha.loot[1]!.secondaryStats).toBeNull();
  });
```

Update the existing read-back expectations in that file to include `name` and `secondaryStats: null`.

In `src/core/sync/season-sync.test.ts`, find the test that checks `loadSeasonLoot`'s rows. Make its fake `getItemDetails` return `secondaryStats: ['CRIT_RATING', 'VERSATILITY']` for one item and `null` for another, and expect `secondaryStats: 'CRIT_RATING,VERSATILITY'` and `secondaryStats: null` on those loot rows. Add:

```ts
  it('stores the season under season.v3', () => {
    expect(SEASON_META_KEY).toBe('season.v3');
  });
```

(Import `SEASON_META_KEY` if needed.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/db/queries/season.test.ts src/core/sync/season-sync.test.ts`
Expected: FAIL on the pair assertions and the key.

- [ ] **Step 3: Implement**

`season.ts`:
- Add `secondaryStats?: string | null;` to `DungeonLootRow`, with the comment `/** Encoded as in snapshot_items; absent or null when unknown. */`.
- Import `decodeStats` from `'../../gear/stat-pair'`.
- Change the loot map in `getSeasonLoot` to:

```ts
      .map((l) => ({ itemId: l.itemId, name: l.itemName, inventoryType: l.inventoryType, armorType: l.armorType, secondaryStats: decodeStats(l.secondaryStats) })),
```

`season-sync.ts`:
- Set `export const SEASON_META_KEY = 'season.v3';`.
- Import `encodeStats` from `'../gear/stat-pair'`.
- In the loot row, add `secondaryStats: encodeStats(infos.get(item.itemId)?.secondaryStats),`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/db src/core/sync`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/db/queries/season.ts src/core/db/queries/season.test.ts src/core/sync/season-sync.ts src/core/sync/season-sync.test.ts
git commit -m "feat: keep stat pairs on season loot" -m "Bump season.v3: dungeon_loot gained secondary_stats."
```

---

### Task 6: `ensureTierTargets`

**Files:**
- Modify: `src/core/db/queries/media.ts`
- Modify: `src/core/sync/reference-sync.ts`
- Test: `src/core/sync/reference-sync.test.ts`

**Interfaces:**
- Consumes: `ItemInfo` with `secondaryStats` (Task 2), `TierTarget` (Task 1), the item details columns (Task 4).
- Produces:
  - `ensureTierTargets(deps: { db: Db; blizzard: BlizzardClient; now: number }, region: Region, lists: BisLists | null): Promise<Map<number, TierTarget>>`;
  - `getTierTargetRows(db, ids)` and `upsertTierTargets(db, entries, now)` in `media.ts`.

- [ ] **Step 1: Write the failing tests**

Add to `src/core/sync/reference-sync.test.ts`. Import `ensureTierTargets` and `ensureItemDetails`.

```ts
describe('ensureTierTargets', () => {
  const tierRow = (itemId: number, isTier = true) =>
    ({ kind: 'item' as const, slotLabel: 'Chest', slots: ['CHEST' as const], itemId, name: `BiS ${itemId}`, bonusIds: [], isTier, isCatalyst: false, source: '' });
  const lists = (rows: ReturnType<typeof tierRow>[]): BisLists => ({ overall: rows, raid: [], mythicPlus: rows });
  const HM = ['HASTE_RATING', 'MASTERY_RATING'];

  function blizzardWith(answer: (id: number) => unknown) {
    const asked: number[] = [];
    const blizzard = { getItemDetails: async (_r: string, id: number) => { asked.push(id); return answer(id); } } as unknown as BlizzardClient;
    return { blizzard, asked };
  }

  it('fetches only tier rows’ items, once, and returns their pairs', async () => {
    const db = await openTestDb();
    const { blizzard, asked } = blizzardWith(() => ({ quality: 'EPIC', isTier: false, inventoryType: 'ROBE', armorType: 'cloth', secondaryStats: HM }));
    const targets = await ensureTierTargets({ db, blizzard, now: 1 }, 'eu', lists([tierRow(10), tierRow(11, false)]));
    expect(targets.get(10)).toEqual({ secondaryStats: HM, isTier: false });
    expect(targets.has(11)).toBe(false);
    await ensureTierTargets({ db, blizzard, now: 2 }, 'eu', lists([tierRow(10)]));
    expect(asked).toEqual([10]);
  });

  it('stores no secondaries as [] and marks a tier-token piece', async () => {
    const db = await openTestDb();
    const { blizzard } = blizzardWith(() => ({ quality: 'EPIC', isTier: true, inventoryType: 'HAND', armorType: 'leather', secondaryStats: [] }));
    expect((await ensureTierTargets({ db, blizzard, now: 1 }, 'eu', lists([tierRow(20)]))).get(20)).toEqual({ secondaryStats: [], isTier: true });
  });

  it('retries a 404 only after a day, and skips a thrown error', async () => {
    const db = await openTestDb();
    const { blizzard, asked } = blizzardWith((id) => { if (id === 31) throw new Error('down'); return null; });
    const first = await ensureTierTargets({ db, blizzard, now: 1 }, 'eu', lists([tierRow(30), tierRow(31)]));
    expect(first.get(30)).toEqual({ secondaryStats: null, isTier: false });
    expect(first.has(31)).toBe(false);
    await ensureTierTargets({ db, blizzard, now: 2 }, 'eu', lists([tierRow(30)]));
    await ensureTierTargets({ db, blizzard, now: 1 + DAY_MS }, 'eu', lists([tierRow(30)]));
    expect(asked.filter((id) => id === 30)).toEqual([30, 30]);
  });

  it('fills in rows that ensureItemDetails wrote without stats', async () => {
    const db = await openTestDb();
    const simc = { getItemDetails: async () => ({ quality: 'EPIC', isTier: true }) } as unknown as BlizzardClient;
    await ensureItemDetails({ db, blizzard: simc, now: 1 }, 'eu', [40]);
    const { blizzard, asked } = blizzardWith(() => ({ quality: 'EPIC', isTier: true, inventoryType: 'HEAD', armorType: 'plate', secondaryStats: HM }));
    expect((await ensureTierTargets({ db, blizzard, now: 2 }, 'eu', lists([tierRow(40)]))).get(40)).toEqual({ secondaryStats: HM, isTier: true });
    expect(asked).toEqual([40]);
  });

  it('returns an empty map without lists', async () => {
    const db = await openTestDb();
    const { blizzard } = blizzardWith(() => null);
    expect((await ensureTierTargets({ db, blizzard, now: 1 }, 'eu', null)).size).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/sync/reference-sync.test.ts`
Expected: FAIL, `ensureTierTargets` is not exported.

- [ ] **Step 3: Implement queries**

In `src/core/db/queries/media.ts`, import `ItemInfo` from `'../../blizzard/types'`, `TierTarget` from `'../../types'` and `encodeStats, decodeStats` from `'../../gear/stat-pair'`.

```ts
export interface TierTargetRow extends TierTarget { statsFetchedAt: number | null }

export async function getTierTargetRows(db: Db, ids: number[]): Promise<Map<number, TierTargetRow>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(itemDetails).where(inArray(itemDetails.itemId, [...new Set(ids)]));
  return new Map(rows.map((r) => [r.itemId, { secondaryStats: decodeStats(r.secondaryStats), isTier: r.isTier, statsFetchedAt: r.statsFetchedAt }]));
}

/** A null info is a 404: it records the attempt, keeping any details already stored. */
export async function upsertTierTargets(db: Db, entries: { itemId: number; info: ItemInfo | null }[], now: number) {
  await withWriteLock(db, async () => {
    for (const { itemId, info } of entries) {
      const stats = { secondaryStats: encodeStats(info?.secondaryStats), statsFetchedAt: now };
      const details = info ? { quality: info.quality, isTier: info.isTier, fetchedAt: now } : null;
      await db.insert(itemDetails).values({ itemId, quality: null, isTier: false, fetchedAt: now, ...details, ...stats })
        .onConflictDoUpdate({ target: itemDetails.itemId, set: { ...details, ...stats } });
    }
  });
}
```

- [ ] **Step 4: Implement `ensureTierTargets`**

In `src/core/sync/reference-sync.ts`, import `getTierTargetRows, upsertTierTargets` from the media queries, `LIST_TYPES, type TierTarget` from `'../types'`, and `type ItemInfo` from `'../blizzard/types'`.

```ts
/**
 * Stat pairs for the Method items of a spec's tier rows. Each item is fetched once; a lookup that found
 * no stats (a 404, or no stats in the response) retries after a day, and a failed request stores nothing.
 */
export async function ensureTierTargets(
  deps: { db: Db; blizzard: BlizzardClient; now: number }, region: Region, lists: BisLists | null,
): Promise<Map<number, TierTarget>> {
  const { db, blizzard, now } = deps;
  const ids = lists ? [...new Set(LIST_TYPES.flatMap((l) => lists[l]).flatMap((r) => (r.kind === 'item' && r.isTier ? [r.itemId] : [])))] : [];
  const known = await getTierTargetRows(db, ids);
  const due = ids.filter((id) => {
    const row = known.get(id);
    return !row || row.statsFetchedAt === null || (row.secondaryStats === null && now - row.statsFetchedAt >= DAY_MS);
  });
  const fetched = await Promise.all(due.map(async (itemId) => {
    try {
      return { itemId, info: await blizzard.getItemDetails(region, itemId) };
    } catch {
      return null;
    }
  }));
  const found = fetched.filter((entry): entry is { itemId: number; info: ItemInfo | null } => entry !== null);
  if (found.length > 0) await upsertTierTargets(db, found, now);
  const rows = found.length > 0 ? await getTierTargetRows(db, ids) : known;
  return new Map([...rows].map(([id, r]) => [id, { secondaryStats: r.secondaryStats, isTier: r.isTier }]));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/core/sync src/core/db`
Expected: PASS, including the unchanged `ensureItemDetails` tests.

- [ ] **Step 6: Commit**

```bash
git add src/core/db/queries/media.ts src/core/sync/reference-sync.ts src/core/sync/reference-sync.test.ts
git commit -m "feat: look up stat pairs for method tier items" -m "Tier rows only, ~15 items per spec. Null stats retry daily, so a
404 never refetches on every page load."
```

---

### Task 7: The `wrongStats` state, end to end

**Files:**
- Modify: `src/core/gear/evaluate.ts`
- Modify: `src/server/views/summarize.ts:50-51`
- Modify: `src/components/state-badge/state-labels.ts`
- Modify: `src/components/group-grid/state-word.ts`
- Modify: `src/components/shared/row-tone.ts`
- Modify: `src/app/globals.css` (`@theme`)
- Test: `src/core/gear/evaluate.test.ts`, `src/components/shared/row-tone.test.ts`, `src/components/group-grid/state-word.test.ts`, `src/server/views/views.test.ts` (`upgradeFor`)

**Interfaces:**
- Consumes: `compareStats` and `TierTarget` (Task 1).
- Produces:
  - `evaluateGear({ equipped, bisRows, tracks, bagItemIds?, targets? })`, where `targets?: ReadonlyMap<number, TierTarget>` defaults to an empty map;
  - `GearRow.stats: StatMatch | null`;
  - `RowTone` includes `'stats'`.

- [ ] **Step 1: Write the failing tests**

In `src/core/gear/evaluate.test.ts`, add:

```ts
describe('tier stat pairs', () => {
  const HM = ['HASTE_RATING', 'MASTERY_RATING'];
  const CM = ['CRIT_RATING', 'MASTERY_RATING'];
  const target = (secondaryStats: string[] | null, isTier = false) => new Map([[777, { secondaryStats, isTier }]]);
  const tierHead = (bonus: number, secondaryStats?: string[] | null) => ({ ...item('HEAD', 555, [bonus], true), secondaryStats });

  it('flags a tier piece with other stats as wrongStats, over Myth 6/6 and over Hero', () => {
    for (const bonus of [1, 3]) {
      const [head] = evaluateGear({ equipped: [tierHead(bonus, CM)], bisRows: [row(['HEAD'], 777, true)], tracks, targets: target(HM) });
      expect(head).toMatchObject({ matched: true, state: 'wrongStats', stats: 'different' });
    }
  });

  it('flags a same-ID tier piece with other stats for a tier-token row', () => {
    const [head] = evaluateGear({ equipped: [{ ...item('HEAD', 777, [1], true), secondaryStats: CM }], bisRows: [row(['HEAD'], 777, true)], tracks, targets: target(HM, true) });
    expect(head).toMatchObject({ state: 'wrongStats', stats: 'different' });
  });

  it('keeps track states for the same pair and for unknown pairs (SimC items have none)', () => {
    const same = evaluateGear({ equipped: [tierHead(2, HM)], bisRows: [row(['HEAD'], 777, true)], tracks, targets: target(HM) })[0];
    expect(same).toMatchObject({ state: 'mythUpgradable', stats: 'same' });
    const simc = evaluateGear({ equipped: [item('HEAD', 555, [1], true)], bisRows: [row(['HEAD'], 777, true)], tracks, targets: target(HM) })[0];
    expect(simc).toMatchObject({ state: 'done', stats: 'unknown' });
    const noTarget = evaluateGear({ equipped: [tierHead(1, CM)], bisRows: [row(['HEAD'], 777, true)], tracks })[0];
    expect(noTarget).toMatchObject({ state: 'done', stats: 'unknown' });
  });

  it('sets stats only on matched tier rows', () => {
    const [neck, head] = evaluateGear({ equipped: [item('NECK', 10, [1])], bisRows: [row(['NECK'], 10), row(['HEAD'], 777, true)], tracks, targets: target(HM) });
    expect(neck!.stats).toBeNull();
    expect(head).toMatchObject({ state: 'missing', stats: null });
  });

  it('counts wrongStats rows in countStates', () => {
    const rows = evaluateGear({ equipped: [tierHead(1, CM)], bisRows: [row(['HEAD'], 777, true)], tracks, targets: target(HM) });
    expect(countStates(rows).wrongStats).toBe(1);
  });
});
```

In `src/components/shared/row-tone.test.ts`, add:

```ts
  it('marks a tier piece with the wrong stats with the stats tone', () => {
    expect(rowTone('wrongStats', true)).toBe('stats');
    expect(rowTone('wrongStats', false)).toBeNull();
  });
```

In `src/components/group-grid/state-word.test.ts`, add:

```ts
  it('says Stats for a tier piece with the wrong stats', () => {
    expect(stateWord('wrongStats', true)).toEqual({ word: 'Stats', className: 'text-stats' });
  });
```

In `src/server/views/views.test.ts`, find the `upgradeFor` tests. If there are none, add a `describe('upgradeFor')`, building a `GearRow` by hand with the existing fixtures' `Track` and costs. Assert that a `matched: true, state: 'wrongStats'` row with an affordable track returns the same `UpgradeOption` as the identical row with `state: 'belowMyth'`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/gear src/components/shared/row-tone.test.ts src/components/group-grid/state-word.test.ts src/server/views/views.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/core/types.ts`: replace `ItemState` and `ITEM_STATES`:

```ts
export type ItemState = 'missing' | 'inBags' | 'wrongStats' | 'belowMyth' | 'mythUpgradable' | 'done';
export const ITEM_STATES: readonly ItemState[] = ['done', 'mythUpgradable', 'wrongStats', 'belowMyth', 'inBags', 'missing'];
```

`src/core/gear/evaluate.ts`:
- Import `compareStats` from `'./stat-pair'` and `StatMatch, TierTarget` from `'../types'`.
- Add `stats: StatMatch | null;` to `GearRow`, with the comment `/** For a matched tier row: whether the piece carries Method's secondary stats. Null otherwise. */`.
- Add `targets?: ReadonlyMap<number, TierTarget>;` to `Input`.

```ts
function stateFor(row: BisRow, matched: boolean, track: Track | null, bagItemIds: ReadonlySet<number>, stats: StatMatch | null): ItemState {
  // An "Any" row asks only for an item level, so track states and bags don't apply to it.
  if (row.kind === 'any') return matched ? 'done' : 'missing';
  if (!matched) return !row.isTier && bagItemIds.has(row.itemId) ? 'inBags' : 'missing';
  // The catalyst keeps the base item's stats: a tier piece with other stats fills the set but is not Method's piece.
  if (stats === 'different') return 'wrongStats';
  if (!track) return 'done';
  if (track.name === 'Myth') return track.step >= track.max ? 'done' : 'mythUpgradable';
  return 'belowMyth';
}
```

In `evaluateGear`, destructure `targets = new Map()`. In the second pass, after `track`:

```ts
    const stats = matched && row.kind === 'item' && row.isTier && item
      ? compareStats({ itemId: row.itemId, stats: targets.get(row.itemId)?.secondaryStats }, { itemId: item.itemId, stats: item.secondaryStats })
      : null;
    return { row, slot, equipped: item, track, matched, stats, state: stateFor(row, matched, track, bagItemIds, stats) };
```

`src/server/views/summarize.ts`, `upgradeFor`:

```ts
  row.matched && (row.state === 'mythUpgradable' || row.state === 'belowMyth' || row.state === 'wrongStats') ? affordableUpgrade(row.track, costs, balances) : null;
```

`src/components/state-badge/state-labels.ts`: add `wrongStats: { text: 'Wrong stats', className: 'text-stats' },` after `mythUpgradable`.

`src/components/group-grid/state-word.ts`: add `wrongStats: 'Stats'` to `WORDS`.

`src/app/globals.css`: in `@theme`, after `--color-missing`, add:

```css
  --color-stats: #f08fc0;
  --color-stats-bg: #2e1a26;
```

`src/components/shared/row-tone.ts`:

```ts
export type RowTone = 'gold' | 'green' | 'stats';

/**
 * Gold marks a fully upgraded BiS item; green marks a Myth-track BiS item that only needs crests; a dashed
 * pink outline marks a tier piece whose stats differ from Method's. No highlight while track data is
 * unavailable, since states can't be trusted then.
 */
export function rowTone(state: ItemState, tracksKnown: boolean): RowTone | null {
  if (!tracksKnown) return null;
  if (state === 'done') return 'gold';
  if (state === 'mythUpgradable') return 'green';
  if (state === 'wrongStats') return 'stats';
  return null;
}

// Bright gold and dark green differ in lightness as well as hue; the stats tone differs in shape, a dashed outline.
export const ROW_TONE_STYLES: Record<RowTone, CSSProperties> = {
  gold: { background: '#2e2513', boxShadow: '0 0 0 2px var(--color-gold)' },
  green: { background: '#1a2e20', boxShadow: '0 0 0 2px #3e8a4d' },
  stats: { background: 'var(--color-stats-bg)', outline: '2px dashed var(--color-stats)', outlineOffset: '-2px' },
};
```

Run `npm run typecheck`. Any remaining `Record<ItemState, …>` needs a `wrongStats` entry. `CharacterCard` reads named fields and compiles; Task 10 changes it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS. Existing `evaluateGear` `toEqual` assertions on whole rows may need `stats: null`, or `stats: 'unknown'` for matched tier rows. Update them.

- [ ] **Step 5: Commit**

```bash
git add src/core/types.ts src/core/gear src/server/views/summarize.ts src/server/views/views.test.ts src/components/state-badge src/components/group-grid/state-word.ts src/components/group-grid/state-word.test.ts src/components/shared/row-tone.ts src/components/shared/row-tone.test.ts src/app/globals.css
git commit -m "feat: flag tier pieces with the wrong stats" -m "Catalyst keeps base secondaries: any tier piece fills the set,
only Method's stats make it BiS. Track and crest upgrade still shown."
```

---

### Task 8: Tier credits name the dungeon's own drop

**Files:**
- Modify: `src/core/priority/rank.ts`
- Test: `src/core/priority/priority.test.ts`

**Interfaces:**
- Consumes: `compareStats`, `TierTarget`, `StatMatch` (Task 1); `GearRow.state === 'wrongStats'` (Task 7); `LootItem.name` and `secondaryStats` (Tasks 1 and 5).
- Produces:
  - `PriorityCharacter.targets: ReadonlyMap<number, TierTarget>`;
  - `type TierFit = 'bis' | 'unverified' | 'alternative'`;
  - the tier `Credit`: `{ kind: 'tier'; slotLabel: string; weight: number; fit: TierFit; itemId: number; name: string; bonusIds: number[]; dropStats: string[] | null; targetName: string; targetStats: string[] | null }`.

- [ ] **Step 1: Write the failing tests**

In `src/core/priority/priority.test.ts`:
- Change the `character` helper to take targets:

```ts
const character = (rows: BisRow[], equipped: GearItem[], className = 'Druid', id = 1, name = 'Birkibjörn', targets: ReadonlyMap<number, TierTarget> = new Map()): PriorityCharacter =>
  ({ id, name, className, rows: evaluateGear({ equipped, bisRows: rows, tracks, targets }), equipped, tracks, targets });
```

- Import `TierTarget`.
- In the existing test "credits a tier row to slot drops in the armor type, with +2 below four tier pieces", change the expected credit to the local drop:

```ts
    expect(ranks[0]!.characters[0]!.credits).toEqual([{
      kind: 'tier', slotLabel: 'CHEST', weight: 4, fit: 'unverified',
      itemId: 900, name: 'Loot 900', bonusIds: [], dropStats: null, targetName: 'BiS 80', targetStats: null,
    }]);
```

Add:

```ts
describe('tier credits by stat pair', () => {
  const HM = ['HASTE_RATING', 'MASTERY_RATING'];
  const MV = ['MASTERY_RATING', 'VERSATILITY'];
  const chestRow = named(['CHEST'], 273785, true);
  const mage = (equipped: GearItem[] = [], stats: string[] | null = HM) =>
    character([chestRow], equipped, 'Mage', 1, 'Birkibjörn', new Map([[273785, { secondaryStats: stats, isTier: false }]]));
  const credit = (ranks: ReturnType<typeof rankDungeons>, dungeonName: string) =>
    ranks.find((d) => d.name === dungeonName)!.characters[0]?.credits[0];

  it('credits each dungeon with its own drop, never Method’s item from elsewhere', () => {
    const ranks = rankDungeons([mage()], [
      dungeon(501, 'Altar of Fangs', [loot(273785, 'ROBE', 'cloth', HM)]),
      dungeon(502, 'Den of Nalorakk', [loot(251147, 'CHEST', 'cloth', MV)]),
      dungeon(503, 'Murder Row', [loot(251139, 'ROBE', 'cloth', HM)]),
    ]);
    expect(credit(ranks, 'Altar of Fangs')).toMatchObject({ fit: 'bis', itemId: 273785, weight: 5, targetName: 'BiS 273785', targetStats: HM });
    expect(credit(ranks, 'Murder Row')).toMatchObject({ fit: 'bis', itemId: 251139, weight: 5 });
    expect(credit(ranks, 'Den of Nalorakk')).toMatchObject({ fit: 'alternative', itemId: 251147, weight: 4, dropStats: MV });
  });

  it('floors an alternative at weight 1', () => {
    const fourPieces = ['HEAD', 'SHOULDER', 'HANDS', 'LEGS'].map((s, i) => gear(s as SlotType, 90 + i, undefined, true));
    // Hero chest: weight 1, no tier bonus at four pieces.
    const c = mage([gear('CHEST', 81, 2), ...fourPieces]);
    expect(credit(rankDungeons([c], [dungeon(502, 'Den of Nalorakk', [loot(251147, 'CHEST', 'cloth', MV)])]), 'Den of Nalorakk')).toMatchObject({ fit: 'alternative', weight: 1 });
  });

  it('credits unknown pairs as unverified at full weight', () => {
    expect(credit(rankDungeons([mage()], [dungeon(504, 'Temple of Sethraliss', [loot(159257, 'ROBE', 'cloth', null)])]), 'Temple of Sethraliss'))
      .toMatchObject({ fit: 'unverified', weight: 5, dropStats: null });
    expect(credit(rankDungeons([mage([], null)], [dungeon(502, 'Den of Nalorakk', [loot(251147, 'CHEST', 'cloth', MV)])]), 'Den of Nalorakk'))
      .toMatchObject({ fit: 'unverified', weight: 5 });
  });

  it('picks the best of several drops: exact, then same pair, unknown, different, then lowest ID', () => {
    const many = [loot(300, 'CHEST', 'cloth', MV), loot(301, 'CHEST', 'cloth', null), loot(299, 'ROBE', 'cloth', HM), loot(298, 'ROBE', 'cloth', HM)];
    expect(credit(rankDungeons([mage()], [dungeon(505, 'Alpha Hollow', many)]), 'Alpha Hollow')).toMatchObject({ itemId: 298, fit: 'bis' });
    expect(credit(rankDungeons([mage()], [dungeon(505, 'Alpha Hollow', [...many, loot(273785, 'ROBE', 'cloth', HM)])]), 'Alpha Hollow')).toMatchObject({ itemId: 273785 });
    expect(credit(rankDungeons([mage()], [dungeon(505, 'Alpha Hollow', many.slice(0, 2))]), 'Alpha Hollow')).toMatchObject({ itemId: 301, fit: 'unverified' });
  });

  it('gives no credit without a compatible drop', () => {
    const ranks = rankDungeons([mage()], [dungeon(506, 'Beta Spire', [loot(400, 'CHEST', 'plate', HM), loot(401, 'HEAD', 'cloth', HM)])]);
    expect(ranks[0]!.score).toBe(0);
  });

  it('credits a wrongStats piece only from drops with Method’s stats, at weight 1', () => {
    const c = mage([{ ...gear('CHEST', 271531, 1, true), secondaryStats: MV }]);
    const ranks = rankDungeons([c], [
      dungeon(501, 'Altar of Fangs', [loot(273785, 'ROBE', 'cloth', HM)]),
      dungeon(502, 'Den of Nalorakk', [loot(251147, 'CHEST', 'cloth', MV)]),
      dungeon(504, 'Temple of Sethraliss', [loot(159257, 'ROBE', 'cloth', null)]),
    ]);
    expect(scores(ranks)).toEqual([['Altar of Fangs', 1], ['Den of Nalorakk', 0], ['Temple of Sethraliss', 0]]);
  });

  it('keeps the split flag on a split dungeon’s tier credit', () => {
    const [half] = rankDungeons([mage()], [dungeon(507, 'Streets of Beta', [loot(251139, 'ROBE', 'cloth', HM)], true)]);
    expect(half).toMatchObject({ split: true, score: 5 });
  });
});
```

Check the weights in these tests:
- An empty chest is track weight 3, plus 2 tier bonus while under 4 pieces, so 5. The alternative is 4.
- The floor test uses a Hero chest (`gear('CHEST', 81, 2)`, bonus 2 = Hero) with four other tier pieces: weight 1, no bonus, so the alternative is `max(1, 0) = 1`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/priority`
Expected: FAIL, because credits still carry `itemId: 273785` everywhere and have no `fit`.

- [ ] **Step 3: Implement**

`src/core/priority/rank.ts`:
- Import `compareStats` from `'../gear/stat-pair'`.
- Import `BisItemRow, LootItem, StatMatch, TierTarget` from `'../types'`.
- Add `targets: ReadonlyMap<number, TierTarget>;` to `PriorityCharacter`.

```ts
export type TierFit = 'bis' | 'unverified' | 'alternative';

export type Credit =
  | { kind: 'item'; slotLabel: string; weight: number; itemId: number; name: string; bonusIds: number[] }
  /** The dungeon's own drop, to catalyze; the target fields describe Method's row. */
  | { kind: 'tier'; slotLabel: string; weight: number; fit: TierFit; itemId: number; name: string; bonusIds: number[];
      dropStats: string[] | null; targetName: string; targetStats: string[] | null }
  | { kind: 'any'; slotLabel: string; weight: number; minItemLevel: number };

interface Need { row: BisRow; weight: number; wrongStats: boolean }

const FIT: Record<StatMatch, TierFit> = { same: 'bis', unknown: 'unverified', different: 'alternative' };
const MATCH_RANK: Record<StatMatch, number> = { same: 1, unknown: 2, different: 3 };

/** A drop for one of the row's slots, in the character's armor type where the slot has one. */
function fitsSlot(row: BisRow, armor: ArmorType | null, l: LootItem): boolean {
  const armorSlot = row.slots.some((s) => ARMOR_SLOTS.has(s));
  return slotsForInventoryType(l.inventoryType).some((s) => row.slots.includes(s)) && (!armorSlot || (armor !== null && l.armorType === armor));
}

/** Whether a dungeon's loot can fill a named or Any row: the exact item, or for Any rows a slot drop. */
function dropsFor(row: BisRow, armor: ArmorType | null, dungeon: SeasonLoot): boolean {
  if (row.kind === 'item') return dungeon.loot.some((l) => l.itemId === row.itemId);
  return dungeon.loot.some((l) => fitsSlot(row, armor, l));
}

/**
 * A tier row's credit from one dungeon: its best compatible drop by stat pair, never another dungeon's item.
 * A tier piece with the wrong stats only wants drops with Method's stats, at weight 1.
 */
function tierCredit(row: BisItemRow, need: Need, armor: ArmorType | null, dungeon: SeasonLoot, targets: ReadonlyMap<number, TierTarget>): Credit | null {
  const targetStats = targets.get(row.itemId)?.secondaryStats ?? null;
  const best = dungeon.loot
    .filter((l) => fitsSlot(row, armor, l))
    .map((l) => {
      const match = compareStats({ itemId: row.itemId, stats: targetStats }, { itemId: l.itemId, stats: l.secondaryStats });
      return { l, match, rank: match === 'same' && l.itemId === row.itemId ? 0 : MATCH_RANK[match] };
    })
    .sort((a, b) => a.rank - b.rank || a.l.itemId - b.l.itemId)[0];
  if (!best || (need.wrongStats && best.match !== 'same')) return null;
  const fit = FIT[best.match];
  const weight = fit === 'alternative' ? Math.max(1, need.weight - 1) : need.weight;
  return { kind: 'tier', slotLabel: row.slotLabel, weight, fit, itemId: best.l.itemId, name: best.l.name, bonusIds: [],
    dropStats: best.l.secondaryStats ?? null, targetName: row.name, targetStats };
}

function creditFor(row: BisRow, weight: number): Credit {
  if (row.kind === 'any') return { kind: 'any', slotLabel: row.slotLabel, weight, minItemLevel: row.minItemLevel };
  return { kind: 'item', slotLabel: row.slotLabel, weight, itemId: row.itemId, name: row.name, bonusIds: row.bonusIds };
}
```

In `rankDungeons`, build needs from `missing` and `wrongStats` rows:

```ts
      missing: character.rows.filter((r) => r.state === 'missing' || r.state === 'wrongStats')
        .map((r): Need => r.state === 'wrongStats'
          ? { row: r.row, weight: 1, wrongStats: true }
          : { row: r.row, weight: weightOf(r, bySlot, matchedSlots, tierCount, character.tracks), wrongStats: false }),
```

Credits per character:

```ts
        credits: missing.flatMap((m) => {
          if (m.row.kind === 'item' && m.row.isTier) return tierCredit(m.row, m, armor, dungeon, character.targets) ?? [];
          return dropsFor(m.row, armor, dungeon) ? [creditFor(m.row, m.weight)] : [];
        }),
```

The `wrongStats` row is matched, so `matchedSlots` already contains its slot. That only affects ring and trinket weighting, which tier rows never use.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/priority`
Expected: PASS. Then run `npm run typecheck`: the server views now fail on `PriorityCharacter.targets` and the tier credit shape. Task 9 fixes them, so don't commit a broken typecheck. Do Task 9's Step 3 type changes before committing, or commit Tasks 8 and 9 together.

- [ ] **Step 5: Commit** (together with Task 9)

---

### Task 9: Server views carry targets and pairs

**Files:**
- Create: `src/server/views/bis-lookup.ts`
- Modify: `src/server/views/member.ts`
- Modify: `src/server/views/types.ts`
- Modify: `src/server/views/character-cards.ts`
- Modify: `src/server/views/character-page.ts`
- Modify: `src/server/views/group-page.ts`
- Test: `src/server/views/views.test.ts`, `src/server/views/group-page.test.ts`

**Interfaces:**
- Consumes: `ensureTierTargets` (Task 6), `evaluateGear` `targets` (Task 7), `PriorityCharacter.targets` and the tier `Credit` (Task 8).
- Produces:
  - `SpecBis = BisResult & { targets: ReadonlyMap<number, TierTarget> }`;
  - `createBisLookup(deps: { db; blizzard; bisSource }, time): (slug: string, region: Region) => Promise<SpecBis>`;
  - `MemberContext.bisFor: (specSlug: string, region: Region) => Promise<SpecBis>`;
  - `rowView(r, icons, costs, balances, targets)`;
  - `GearRowView.equippedStats: string[] | null`;
  - the item `BisView` gains `targetStats: string[] | null` and `targetIsTierPiece: boolean`;
  - the tier `PriorityCreditView`: `{ kind: 'tier'; slotLabel: string; weight: number; fit: TierFit; item: ItemView; dropStats: string[] | null; targetName: string; targetStats: string[] | null }`.

- [ ] **Step 1: Write the failing tests**

In `src/server/views/views.test.ts`:
- Update the tier credit expectation near line 217 to

  `{ kind: 'tier', slotLabel: 'Chest', weight: expect.any(Number), fit: expect.any(String), item: expect.objectContaining({ itemId: <the loot drop's ID in that fixture>, iconUrl: <its icon> }), targetName: 'Tier Catalyst Robe' }`.

  Read the fixture: the drop is the season loot item in the chest slot, not 12. If the fixture's loot is item 12 itself, the expectation keeps `itemId: 12`. Then add a second cloth chest loot item with another ID to another dungeon in that fixture, and assert that dungeon's credit uses that ID.
- Add `rowView` tests:

```ts
describe('rowView stat pairs', () => {
  const HM = ['HASTE_RATING', 'MASTERY_RATING'];
  const tierRow: GearRow = {
    row: { kind: 'item', slotLabel: 'Chest', slots: ['CHEST'], itemId: 273785, name: 'Primordial Robe of Rites', bonusIds: [], isTier: true, isCatalyst: false, source: 'Altar of Fangs' },
    slot: 'CHEST', equipped: { slot: 'CHEST', itemId: 271531, name: 'Lunar Raiment', itemLevel: 321, quality: 'EPIC', bonusIds: [], isTier: true, secondaryStats: ['CRIT_RATING', 'MASTERY_RATING'] },
    track: null, matched: true, stats: 'different', state: 'wrongStats',
  };

  it('carries the equipped and target pairs and the tier-token flag', () => {
    const view = rowView(tierRow, new Map(), new Map(), new Map(), new Map([[273785, { secondaryStats: HM, isTier: false }]]));
    expect(view.equippedStats).toEqual(['CRIT_RATING', 'MASTERY_RATING']);
    expect(view.bis).toMatchObject({ kind: 'item', targetStats: HM, targetIsTierPiece: false });
  });

  it('renders without pairs when the target lookup failed', () => {
    const view = rowView({ ...tierRow, stats: 'unknown', state: 'done', equipped: { ...tierRow.equipped!, secondaryStats: null } }, new Map(), new Map(), new Map(), new Map());
    expect(view.equippedStats).toBeNull();
    expect(view.bis).toMatchObject({ targetStats: null, targetIsTierPiece: false });
  });
});
```

- Add a `creditView` test: a tier `Credit` with `itemId: 251147, name: 'Hoarded Harvest Wrap', fit: 'alternative'` and `targetName: 'Primordial Robe of Rites'`, with icons `new Map([[251147, 'https://i/251147.jpg']])`, gives `item.itemId === 251147`, `item.iconUrl === 'https://i/251147.jpg'` and `targetName: 'Primordial Robe of Rites'`.
- In the character page loader test, if one exists in `views.test.ts`, add: a Myth 6/6 tier chest with a pair different from the stubbed target makes `counts[list].bis` exclude it. Stub `getItemDetails` in that test's fake Blizzard to return `secondaryStats` for the tier row's item.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/server`
Expected: FAIL.

- [ ] **Step 3: Implement types**

`src/server/views/types.ts`:
- Import `type TierFit` from `'@/core/priority/rank'`.
- Change `BisView`'s item variant to `(ItemView & { kind: 'item'; isTier: boolean; isCatalyst: boolean; source: string; targetStats: string[] | null; targetIsTierPiece: boolean })`.
- Add `/** The equipped item's secondary stat types; null when unknown. */ equippedStats: string[] | null;` to `GearRowView`.
- Change the tier `PriorityCreditView` to `| { kind: 'tier'; slotLabel: string; weight: number; fit: TierFit; item: ItemView; dropStats: string[] | null; targetName: string; targetStats: string[] | null }`.

`src/server/views/bis-lookup.ts`:

```ts
import { ensureBisLists, ensureTierTargets, type BisResult } from '@/core/sync/reference-sync';
import type { Region, TierTarget } from '@/core/types';
import type { Services } from '../services';

export interface SpecBis extends BisResult { targets: ReadonlyMap<number, TierTarget> }

/** One BiS lookup per spec and region per page: Method's lists plus their tier items' stat pairs. */
export function createBisLookup({ db, blizzard, bisSource }: Pick<Services, 'db' | 'blizzard' | 'bisSource'>, time: number) {
  const cache = new Map<string, Promise<SpecBis>>();
  return (slug: string, region: Region): Promise<SpecBis> => {
    const key = `${region}:${slug}`;
    if (!cache.has(key)) {
      cache.set(key, (async () => {
        const bis = await ensureBisLists({ db, source: bisSource, now: time }, slug);
        return { ...bis, targets: await ensureTierTargets({ db, blizzard, now: time }, region, bis.lists) };
      })());
    }
    return cache.get(key)!;
  };
}
```

`src/server/views/member.ts`:
- `MemberContext.bisFor: (specSlug: string, region: Region) => Promise<SpecBis>;` and `MemberData.bis: SpecBis;`. Import `SpecBis` from `'./bis-lookup'` and `Region, TierTarget` from `@/core/types`.
- In `loadMember`: `const bis = await ctx.bisFor(summary.specSlug, character.region);`. `evaluate` passes `targets: bis.targets`.
- `rowView` takes `targets: ReadonlyMap<number, TierTarget>` as the last parameter:

```ts
    equippedStats: r.equipped?.secondaryStats ?? null,
    bis: r.row.kind === 'item'
      ? {
          kind: 'item' as const,
          ...itemView({ itemId: r.row.itemId, name: r.row.name, itemLevel: null, quality: 'EPIC', bonusIds: r.row.bonusIds }, icons, null),
          isTier: r.row.isTier,
          isCatalyst: r.row.isCatalyst,
          source: r.row.source,
          targetStats: r.row.isTier ? targets.get(r.row.itemId)?.secondaryStats ?? null : null,
          targetIsTierPiece: r.row.isTier && (targets.get(r.row.itemId)?.isTier ?? false),
        }
      : { kind: 'any' as const, minItemLevel: r.row.minItemLevel, source: r.row.source },
```

- `creditView`:

```ts
export function creditView(cr: Credit, icons: ReadonlyMap<number, string | null>): PriorityCreditView {
  if (cr.kind === 'any') return cr;
  const item = itemView({ itemId: cr.itemId, name: cr.name, itemLevel: null, quality: 'EPIC', bonusIds: cr.bonusIds }, icons, null);
  if (cr.kind === 'item') return { kind: 'item', slotLabel: cr.slotLabel, weight: cr.weight, item };
  return { kind: 'tier', slotLabel: cr.slotLabel, weight: cr.weight, fit: cr.fit, item, dropStats: cr.dropStats, targetName: cr.targetName, targetStats: cr.targetStats };
}
```

- `priorityCharacter`: add `targets: m.bis.targets`.

- [ ] **Step 4: Implement loaders**

`character-cards.ts`:
- Replace `bisBySlug` with `const bisFor = createBisLookup(services, time);` and `const bis = await bisFor(summary.specSlug, c.region);`.
- Pass `targets: bis.targets` to `evaluateGear`.
- Drop the unused `ensureBisLists` and `BisResult` imports.

`character-page.ts`:
- `loadMember({ db, tracks, bisFor: createBisLookup(services, time) }, character)`.
- `rowView(r, icons, costs, gear.balances, bis.targets)`.
- `const bisCount = (rows: GearRow[]) => rows.filter((r) => r.matched && r.state !== 'wrongStats').length;`, with the comment `// A tier piece with the wrong stats fills the set but isn't BiS, as on the character card.`

`group-page.ts`:
- Replace `bisBySlug` and `bisFor` with `const bisFor = createBisLookup(services, time);`. Keep the `ponytail:` comment and reword it: `// ponytail: one Method request per distinct spec; members load in sequence, so reads stay apart from the cache writes.`
- `rowView(r, icons, costs, data.gear.balances, data.bis.targets)`.
- `creditIds` stays as is: tier credit `itemId` is now the drop, which is exactly what the icon lookup needs.

Every fake Blizzard client in `src/server/views/*.test.ts` and `src/test/*` must answer `getItemDetails`. If a fake lacks it, `ensureTierTargets` catches the thrown `TypeError` per item and stores nothing, so pages still render. Add `getItemDetails: async () => null` to shared fakes to keep logs clean.

- [ ] **Step 5: Run everything**

Run: `npm run typecheck && npm test`
Expected: PASS. Component tests that build tier `PriorityCreditView` or `GearRowView` literals (`chip-label.test.ts`, `DungeonPriority.test.ts`, `GroupPriority.test.ts`, `GroupGrid.test.ts`, `cell-note.test.ts`) fail typecheck until their literals gain the new fields. Add them with these defaults:
- `fit: 'unverified'`, `dropStats: null`, `targetName: 'BiS'` and `targetStats: null` on tier credits;
- `equippedStats: null` on rows;
- `targetStats: null` and `targetIsTierPiece: false` on item `BisView`s.

Task 10 changes their wording assertions.

- [ ] **Step 6: Commit Tasks 8 and 9**

```bash
git add src/core/priority src/server src/components
git commit -m "fix: credit each dungeon with its own catalyst drop" -m "Tier credits copied Method's item onto every dungeon with a slot drop.
Best local drop by stat pair; alternatives rank 1 lower, floor 1.
Closes the misattribution in #79."
```

---

### Task 10: Labels and components

**Files:**
- Create: `src/components/shared/stat-pair.ts`, `src/components/shared/stat-pair.test.ts`
- Create: `src/components/shared/tier-target.ts`, `src/components/shared/tier-target.test.ts`
- Create: `src/components/character-page/credit-detail.ts`, `src/components/character-page/credit-detail.test.ts`
- Modify: `src/components/group-priority/chip-label.ts`, `chip-label.test.ts`
- Modify: `src/components/group-priority/CreditChip.tsx`
- Modify: `src/components/character-page/DungeonPriority.tsx`, `DungeonPriority.test.ts`
- Modify: `src/components/group-grid/cell-note.ts`, `cell-note.test.ts`
- Modify: `src/components/bis-target/BisTarget.tsx`
- Modify: `src/components/character-card/CharacterCard.tsx`

**Interfaces:**
- Consumes: the view types from Task 9.
- Produces:
  - `statPairLabel(stats: readonly string[]): string`;
  - `tierTargetText(bis: { name: string; targetStats: string[] | null; targetIsTierPiece: boolean }): string`;
  - `creditDetail(credit: Exclude<PriorityCreditView, { kind: 'any' }>): string`.

- [ ] **Step 1: Write the failing tests**

`src/components/shared/stat-pair.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { statPairLabel } from './stat-pair';

describe('statPairLabel', () => {
  it('names a pair in stored order with short words', () => {
    expect(statPairLabel(['HASTE_RATING', 'MASTERY_RATING'])).toBe('Haste/Mastery');
    expect(statPairLabel(['MASTERY_RATING', 'VERSATILITY'])).toBe('Mastery/Vers');
    expect(statPairLabel(['CRIT_RATING'])).toBe('Crit');
  });

  it('says so for an item without secondaries', () => {
    expect(statPairLabel([])).toBe('no secondary stats');
  });
});
```

`src/components/shared/tier-target.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { tierTargetText } from './tier-target';

const HM = ['HASTE_RATING', 'MASTERY_RATING'];

describe('tierTargetText', () => {
  it('names the pair and the base to catalyze', () => {
    expect(tierTargetText({ name: 'Primordial Robe of Rites', targetStats: HM, targetIsTierPiece: false })).toBe('tier, Haste/Mastery (catalyst Primordial Robe of Rites)');
    expect(tierTargetText({ name: 'Primordial Robe of Rites', targetStats: null, targetIsTierPiece: false })).toBe('tier (catalyst Primordial Robe of Rites)');
  });

  it('names the tier piece itself for a tier-token row', () => {
    const MV = ['MASTERY_RATING', 'VERSATILITY'];
    expect(tierTargetText({ name: 'Enigmatic Dreamwatcher’s Gauntlets', targetStats: MV, targetIsTierPiece: true })).toBe('Enigmatic Dreamwatcher’s Gauntlets (tier, Mastery/Vers)');
    expect(tierTargetText({ name: 'Enigmatic Dreamwatcher’s Gauntlets', targetStats: null, targetIsTierPiece: true })).toBe('Enigmatic Dreamwatcher’s Gauntlets (tier)');
  });
});
```

`src/components/character-page/credit-detail.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { PriorityCreditView } from '@/server/views/types';
import { creditDetail } from './credit-detail';

const item = { itemId: 1, name: 'Hoarded Harvest Wrap', itemLevel: null, quality: 'EPIC' as const, bonusIds: [], iconUrl: null, trackLabel: null };
const HM = ['HASTE_RATING', 'MASTERY_RATING'];
const MV = ['MASTERY_RATING', 'VERSATILITY'];
const tier = (fit: 'bis' | 'unverified' | 'alternative', weight: number, targetStats: string[] | null = HM, dropStats: string[] | null = HM): PriorityCreditView =>
  ({ kind: 'tier', slotLabel: 'Chest', weight, fit, item, dropStats, targetName: 'Primordial Robe of Rites', targetStats });

describe('creditDetail', () => {
  it('describes each tier fit', () => {
    expect(creditDetail(tier('bis', 5) as never)).toBe('Chest · Method BiS stats · weight 5');
    expect(creditDetail(tier('bis', 5, null, null) as never)).toBe('Chest · Method BiS item · weight 5');
    expect(creditDetail(tier('alternative', 4, HM, MV) as never)).toBe('Chest · catalyst alternative (Mastery/Vers, BiS Haste/Mastery) · weight 4');
    expect(creditDetail(tier('unverified', 5, HM, null) as never)).toBe('Chest · stats unverified · weight 5');
  });

  it('keeps named items as they were', () => {
    expect(creditDetail({ kind: 'item', slotLabel: 'Neck', weight: 2, item })).toBe('Neck · weight 2');
  });
});
```

In `src/components/group-priority/chip-label.test.ts`, replace the tier test with:

```ts
  const tier = (fit: 'bis' | 'unverified' | 'alternative', name: string, targetStats: string[] | null, dropStats: string[] | null) =>
    ({ kind: 'tier' as const, slotLabel: 'Chest', weight: 5, fit, item: item(name), dropStats, targetName: 'Primordial Robe of Rites', targetStats });
  const HM = ['HASTE_RATING', 'MASTERY_RATING'];
  const MV = ['MASTERY_RATING', 'VERSATILITY'];

  it('labels each tier fit by the drop’s own name', () => {
    expect(chipLabel(tier('bis', 'Primordial Robe of Rites', HM, HM))).toBe('Primordial Robe of Rites (Chest), Method BiS stats Haste/Mastery: catalyst into tier');
    expect(chipLabel(tier('bis', 'Primordial Robe of Rites', null, null))).toBe('Primordial Robe of Rites (Chest), Method BiS item: catalyst into tier');
    expect(chipLabel(tier('alternative', 'Hoarded Harvest Wrap', HM, MV))).toBe('Hoarded Harvest Wrap (Chest), catalyst alternative: Mastery/Vers, Method BiS wants Haste/Mastery');
    expect(chipLabel(tier('unverified', 'Hoarded Harvest Wrap', HM, null))).toBe('Hoarded Harvest Wrap (Chest), catalyst into tier, stats unverified');
  });
```

In `src/components/group-grid/cell-note.test.ts`, add `needText` cases. Build a `GearRowView` with an item `BisView` (`isTier: true`, `name: 'Primordial Robe of Rites'`):
- `state: 'missing'`, `targetStats: HM`, `targetIsTierPiece: false` gives `'Need: tier, Haste/Mastery (catalyst Primordial Robe of Rites)'`;
- `state: 'wrongStats'`, `equippedStats: ['CRIT_RATING', 'MASTERY_RATING']`, `targetStats: HM` gives `'Tier, Crit/Mastery; Method BiS wants Haste/Mastery'`;
- `state: 'done'` gives `null`.

Update the existing tier `needText` expectation from `'Need: X (tier, via catalyst)'` to the new form.

In `src/components/character-page/DungeonPriority.test.ts`, change the tier credit literal to include `fit: 'alternative', dropStats: MV, targetName: 'Primordial Robe of Rites', targetStats: HM`, with the item named `'Hoarded Harvest Wrap'`. Expect `'Chest · catalyst alternative (Mastery/Vers, BiS Haste/Mastery) · weight 4'` instead of `'Chest · tier via catalyst · weight 4'`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components`
Expected: FAIL.

- [ ] **Step 3: Implement helpers**

`src/components/shared/stat-pair.ts`:

```ts
const WORDS: Record<string, string> = { CRIT_RATING: 'Crit', HASTE_RATING: 'Haste', MASTERY_RATING: 'Mastery', VERSATILITY: 'Vers' };

/** A stat pair in words, in stored order: "Haste/Mastery". */
export const statPairLabel = (stats: readonly string[]): string =>
  (stats.length === 0 ? 'no secondary stats' : stats.map((s) => WORDS[s] ?? s).join('/'));
```

`src/components/shared/tier-target.ts`:

```ts
import { statPairLabel } from './stat-pair';

/**
 * What a tier row asks for, starting lowercase so it follows "Need: ". Method names either a base item to
 * catalyze, or the tier piece itself when a tier token buys it.
 */
export function tierTargetText(bis: { name: string; targetStats: string[] | null; targetIsTierPiece: boolean }): string {
  const pair = bis.targetStats ? `, ${statPairLabel(bis.targetStats)}` : '';
  return bis.targetIsTierPiece ? `${bis.name} (tier${pair})` : `tier${pair} (catalyst ${bis.name})`;
}
```

`src/components/character-page/credit-detail.ts`:

```ts
import { statPairLabel } from '@/components/shared/stat-pair';
import type { PriorityCreditView } from '@/server/views/types';

/** The detail line under a credit's item card on the character page. */
export function creditDetail(credit: Exclude<PriorityCreditView, { kind: 'any' }>): string {
  if (credit.kind === 'item') return `${credit.slotLabel} · weight ${credit.weight}`;
  const fit = credit.fit === 'alternative'
    ? `catalyst alternative (${statPairLabel(credit.dropStats ?? [])}, BiS ${statPairLabel(credit.targetStats ?? [])})`
    : credit.fit === 'unverified' ? 'stats unverified' : credit.targetStats ? 'Method BiS stats' : 'Method BiS item';
  return `${credit.slotLabel} · ${fit} · weight ${credit.weight}`;
}
```

`src/components/group-priority/chip-label.ts`: import `statPairLabel` from `'@/components/shared/stat-pair'`. Replace the `tier` case:

```ts
    case 'tier': {
      const head = `${credit.item.name} (${credit.slotLabel})`;
      if (credit.fit === 'alternative') return `${head}, catalyst alternative: ${statPairLabel(credit.dropStats ?? [])}, Method BiS wants ${statPairLabel(credit.targetStats ?? [])}`;
      if (credit.fit === 'unverified') return `${head}, catalyst into tier, stats unverified`;
      return credit.targetStats ? `${head}, Method BiS stats ${statPairLabel(credit.targetStats)}: catalyst into tier` : `${head}, Method BiS item: catalyst into tier`;
    }
```

`src/components/group-grid/cell-note.ts`: import `statPairLabel` and `tierTargetText` from `@/components/shared/…`. Change `needText`:

```ts
/** The line under a cell: what to hunt for a missing BiS item, or which stats a tier piece lacks. */
export function needText(cell: GearRowView): string | null {
  if (cell.state === 'wrongStats' && cell.bis.kind === 'item') {
    return `Tier, ${statPairLabel(cell.equippedStats ?? [])}; Method BiS wants ${statPairLabel(cell.bis.targetStats ?? [])}`;
  }
  if (cell.state !== 'missing' && cell.state !== 'inBags') return null;
  if (cell.bis.kind === 'any') return `Need: any item, level ${cell.bis.minItemLevel}+`;
  if (cell.bis.isTier) return `Need: ${tierTargetText(cell.bis)}`;
  return cell.state === 'inBags' ? `Need: ${cell.bis.name}, in your bags` : `Need: ${cell.bis.name}`;
}
```

- [ ] **Step 4: Wire components**

`src/components/bis-target/BisTarget.tsx`, importing `tierTargetText` from `@/components/shared/tier-target`:

```tsx
  const text = row.bis.isTier ? tierTargetText(row.bis) : row.bis.name;
  const name = text.charAt(0).toUpperCase() + text.slice(1);
```

`src/components/character-page/DungeonPriority.tsx`, importing `creditDetail` from `'./credit-detail'`. In `Credit`, replace the `detail` line with `const detail = creditDetail(credit);`.

`src/components/group-priority/CreditChip.tsx`:
- Before the return: `const alternative = credit.kind === 'tier' && credit.fit === 'alternative';`.
- On the icon tile span, use `className={alternative ? `${TILE} border-dashed` : TILE}`.
- The slot line becomes `{alternative ? 'alt' : creditSlot(credit.slotLabel)}`.
- Update the doc comment: `/** One need: a 32 px tile with its slot under it. Items and tier drops link to Wowhead; a catalyst alternative is dashed and says "alt". */`.

`src/components/character-card/CharacterCard.tsx`:
- Bar: insert `<div className="bg-stats" style={{ flexGrow: counts.wrongStats }} />` after the `bg-vault` segment.
- Words: after `{counts.belowMyth} vault targets`, add `{counts.wrongStats > 0 ? `, ${counts.wrongStats} wrong stats` : ''}`, before the bags line.
- The `bis` total stays `counts.done + counts.mythUpgradable + counts.belowMyth`. Add the comment `{/* A tier piece with the wrong stats isn't BiS: it gets its own segment. */}` above the bar.

- [ ] **Step 5: Run everything**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components
git commit -m "feat: label catalyst fits and wrong stats" -m "Chips and cards name the local drop and say Method BiS stats,
catalyst alternative or stats unverified. Words beside every tone."
```

---

### Task 11: Verify, build, hand check

- [ ] **Step 1: Full checks**

Stop `npm run dev` if it's running. Then run `npm run typecheck && npm run lint && npm test && npm run build`.
Expected: all clean. Note the test count for the pull request.

- [ ] **Step 2: Hand checks**

Run `npm run dev`. Open the group page with a group that includes a cloth or leather character missing a tier chest.

1. Hover the tier chips in two different dungeons. The tooltips name different items, and each one drops in its dungeon.
2. A chip labeled "alt" has a dashed tile, and its tooltip names both pairs.
3. Find a character whose equipped tier piece has stats other than Method's. The grid cell says "Stats" with a dashed pink outline, and the note reads "Tier, X/Y; Method BiS wants A/B". The character page badge says "Wrong stats". The home card shows the segment and ", 1 wrong stats", and the BiS total excludes it.
4. Paste a SimC export for a character: no "Wrong stats" appears for that character's tier pieces.

Record what was checked and what wasn't for the pull request's `## Testing`.

- [ ] **Step 3: Open the pull request**

Branch `docs/catalyst-stat-matching` holds the spec, plan and code. Rebase onto `origin/main` if it moved. The pull request body:
- opens with `Closes #79.`;
- has `## What changes`;
- has `## Data`: migration `catalyst-stat-pairs`, `season.v3`, the snapshot backfill;
- has `## Testing`;
- ends with `Spec: docs/superpowers/specs/2026-10-07-catalyst-stat-matching-design.md`.
