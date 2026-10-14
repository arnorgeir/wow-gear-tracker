# Tier piece stats from a SimC paste

Status: unattended spec, 2026-10-14. Replaces the manual marks of PR #144 (closed). Spec review round 1 (Codex, at e84c0c8) folded in: S1.1 stats only for equipped pieces, so the in-place backfill key stays unique; S1.2 success criteria follow the unchanged evaluator; S1.3 exact re-paste contract.
Date: 2026-10-14
Issue: #97. Confirm a tier piece has the right stats by hand

## Goal

A SimC paste carries no item stats, so every tier piece from a paste shows "Stats unverified" (#138) until Blizzard's profile catches up after a logout. #97 asked for buttons to mark those pieces right or wrong by hand. PR #144 built that, then a live check showed the marks aren't needed:

- The SimC export names where a catalysed piece's stats come from: `redirected_base_stats=<item id>` on its line. The catalyst keeps the input item's stats, and that item's stats are in Blizzard's item API.
- A tier piece without the option (a dropped piece) has the tier item's own stats.
- Checked live for one character: three catalysed pieces and one dropped piece, all four matched the stats Blizzard's profile showed once it updated. The catalyst rule held 3 of 3; the dropped-piece rule rests on one sample.

So the app reads the stats itself when the paste is imported. "Stats unverified" stays only for a piece whose stats couldn't be fetched.

## What success looks like

- Pasting a SimC export with an equipped catalysed tier piece shows the redirected item's stat pair on that row (character page item card, group cell details).
- An equipped dropped tier piece shows the tier item's own pair.
- With the equipped pair known, the row's state follows `evaluateGear`'s existing rules, unchanged: a pair that differs from a known target pair gives Wrong stats when "Tier pieces must have the list's stats" is checked; a matching pair keeps the track's state (Done, Upgrade or Below Myth); unchecked, the pair shows but doesn't change the state.
- "Stats unverified" still shows when the BiS target's pair is unknown, and when the equipped pair couldn't be fetched (Blizzard had no stats, or the request failed). `borrowStats` can still fill a failed piece from the Blizzard snapshot of the same item and bonus IDs.
- No new table, column, route or button.

## Scope

In scope: the SimC parser, `importSimc`, and one stats helper beside the tier target sync.

Out of scope:

- Schema changes. Stats are resolved at import and stored in the existing `snapshot_items.secondary_stats`.
- An automatic retry of a failed fetch. That would need the redirect ID stored per item (a new column) and a background sync for it. Re-pasting retries, and a Blizzard sync after logout replaces the stats anyway. Add the column if failed fetches turn out to be common.
- Bag and vault items' stats. Only equipped rows compare stats, and bags can hold two copies of one item with different redirects, which the in-place backfill in `saveSnapshotIfChanged` (keyed by location, slot and item ID) can't tell apart. Equipped slots are unique, so equipped pieces are safe.
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
- Collect the stats sources of equipped items whose `details.get(itemId)?.isTier` is true, and call `ensureItemStats` once.
- Each equipped tier item's `secondaryStats` is its source's stats from that map, else `null`. Every other item stays `null`, as today.
- The "SimC exports carry no item stats" comment goes.

A failed stats request doesn't fail the import: the piece keeps `null` and shows "Stats unverified", as before this change. Item details (tier membership) still fail the import as today.

Pasting the same text again (the content hash ignores stats):

- A request that threw is asked again on the next paste. A cached 404 or empty answer is asked again only once it is a day old (`needsStats`).
- When the stored snapshot has no stats on any row (a paste from before this change, or one where every fetch failed), the new stats are written into it in place: no new snapshot.
- When the stored rows' stats equal the new ones, nothing changes.
- When some stored rows have stats and the new paste adds or changes others, a new snapshot is saved with the same gear. The gear reads the same, and history gains one row. Accepted.

## Testing

- **`parse.test.ts`** (write first, watch it fail): a line with `redirected_base_stats=251223` gives `statsItemId: 251223`; a line without it gives `null`; `redirected_base_stats=0` gives `null`; a bag line carries it too.
- **`reference-sync.test.ts`**, `ensureItemStats`: cached stats return without a request; an uncached ID is requested and stored; a 404 stores the attempt and returns `null`, and isn't requested again within a day but is after one; a thrown request returns `null` and stores nothing.
- **`import-simc.test.ts`** with the fake fetch: a catalysed tier piece gets the redirected item's stats, not its own; a dropped tier piece gets its own; a non-tier item stays `null`; bag and vault tier items stay `null`; a failed stats request still imports, with `null` stats. Re-paste: an old all-null snapshot gets its stats in place (same snapshot ID); a paste whose only stats request threw, pasted again with Blizzard answering, gets stats in place too; a paste with one piece known and one failed, pasted again, saves a new snapshot. The fixture `export.txt` gains a `redirected_base_stats` line.
- **By hand**, on local dev with a paste holding a catalysed tier piece: the character page row shows the base item's pair, not "Stats unverified", and its state follows the rules above; with a known target pair the group cell shows no "?".
- **Live check** (`npm run test:live`, if it fits the existing live test): Blizzard's item API returns secondary stats for a catalyst input item.
