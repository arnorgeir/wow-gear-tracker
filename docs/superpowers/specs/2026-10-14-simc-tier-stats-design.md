# Tier piece stats from a SimC paste

Status: unattended spec, 2026-10-14. Replaces the manual marks of PR #144 (closed).
Date: 2026-10-14
Issue: #97. Confirm a tier piece has the right stats by hand

## Goal

A SimC paste carries no item stats, so every tier piece from a paste shows "Stats unverified" (#138) until Blizzard's profile catches up after a logout. #97 asked for buttons to mark those pieces right or wrong by hand. PR #144 built that, then a live check showed the marks aren't needed:

- The SimC export names where a catalysed piece's stats come from: `redirected_base_stats=<item id>` on its line. The catalyst keeps the input item's stats, and that item's stats are in Blizzard's item API.
- A tier piece without the option (a dropped piece) has the tier item's own stats.
- Checked live for one character: three catalysed pieces and one dropped piece, all four matched the stats Blizzard's profile showed once it updated. The catalyst rule held 3 of 3; the dropped-piece rule rests on one sample.

So the app reads the stats itself when the paste is imported. "Stats unverified" stays only for a piece whose stats couldn't be fetched.

## What success looks like

- Pasting a SimC export with a catalysed tier piece shows the redirected item's stat pair on that row (character page item card, group cell details), and the row's state follows the stat comparison: Done when the pair matches the BiS target, Wrong stats when it doesn't.
- A dropped tier piece shows the tier item's own pair.
- A row shows "Stats unverified" only when Blizzard had no stats for the item, or the request failed.
- Pasting the same export again after a failed fetch fills the stats in, without saving a new snapshot.
- No new table, column, route or button.

## Scope

In scope: the SimC parser, `importSimc`, and one stats helper beside the tier target sync.

Out of scope:

- Schema changes. Stats are resolved at import and stored in the existing `snapshot_items.secondary_stats`.
- An automatic retry of a failed fetch. That would need the redirect ID stored per item (a new column) and a background sync for it. Re-pasting retries, and a Blizzard sync after logout replaces the stats anyway. Add the column if failed fetches turn out to be common.
- Bag and vault items' stats beyond what the same pass fetches. Only equipped rows compare stats today.
- Any change to `evaluateGear`, `compareStats`, `borrowStats`, states or wording. Known stats already flow through them.

## Design

### Parser

`src/core/simc/parse.ts`: `SimcItem` gains `statsItemId: number | null`, read from the `redirected_base_stats` option in `parseItem`. A missing, empty, zero or non-integer value gives `null`. Equipped, bag and vault lines all use `parseItem`, so all three get it.

### Fetching stats

`src/core/sync/reference-sync.ts` gains:

```ts
/** Secondary stats for items, from the item_details cache, requesting the ones that need it. Never throws for an upstream failure. */
export async function ensureItemStats(
  deps: { db: Db; blizzard: BlizzardClient; now: number }, region: Region, itemIds: number[],
): Promise<Map<number, string[] | null>>
```

- Reads the cached rows with `getTierTargetRows`.
- Requests the IDs that `needsStats` picks (never fetched, or no stats found a day or more ago), with `blizzard.getItemDetails`, in parallel like `syncTierTargets`.
- Stores the answers with `upsertTierTargets`: a 404 records the attempt with no stats; a thrown request stores nothing.
- Returns each ID's stats after the writes, `null` when unknown.

It shares the cache and the one-day rule with the tier target sync, but not its per-scope hourly back-off: an import is one user action, so it always asks for what's missing.

### Import

`src/core/simc/import-simc.ts`, after `ensureItemDetails`:

- The stats source of an item is `statsItemId ?? itemId`.
- Collect the stats sources of items whose `details.get(itemId)?.isTier` is true, and call `ensureItemStats` once.
- Each tier item's `secondaryStats` is its source's stats from that map, else `null`. Non-tier items stay `null`, as today.
- The "SimC exports carry no item stats" comment goes.

A failed stats request doesn't fail the import: the piece keeps `null` and shows "Stats unverified", as before this change. Item details (tier membership) still fail the import as today.

Pasting the same text again: `saveSnapshotIfChanged` already fills stats into a snapshot whose rows have none and whose content hash is unchanged. A paste where some pieces got stats the first time and one didn't doesn't qualify for that fill-in (not every stored row is null), so it saves a new snapshot with the same gear. That is acceptable: the gear reads the same, and history gains one row.

## Testing

- **`parse.test.ts`** (write first, watch it fail): a line with `redirected_base_stats=251223` gives `statsItemId: 251223`; a line without it gives `null`; `redirected_base_stats=0` gives `null`; a bag line carries it too.
- **`reference-sync.test.ts`**, `ensureItemStats`: cached stats return without a request; an uncached ID is requested and stored; a 404 stores the attempt and returns `null`, and isn't requested again within a day but is after one; a thrown request returns `null` and stores nothing.
- **`import-simc.test.ts`** with the fake fetch: a catalysed tier piece gets the redirected item's stats, not its own; a dropped tier piece gets its own; a non-tier item stays `null`; a failed stats request still imports, with `null` stats. The fixture `export.txt` gains a `redirected_base_stats` line.
- **By hand**, on local dev with a paste holding a catalysed tier piece: the character page row shows the base item's pair and Done or Wrong stats, not "Stats unverified"; the group cell shows no "?".
- **Live check** (`npm run test:live`, if it fits the existing live test): Blizzard's item API returns secondary stats for a catalyst input item.
