# Manual tier stat marks

Status: recommendations pre-approved by the owner on 2026-10-14 ("give one choice each, no surveys"). Spec review round 1 (Opus reviewer) folded in: S1.1 a body that isn't JSON is a 400, not a 500; S1.2 tests rendering `StatMark` mock `next/navigation`; S1.3 a wrong mark with an unknown target pair credits only the exact target item.
Date: 2026-10-14
Issue: #97. Confirm a tier piece has the right stats by hand

Builds on #138 (pull request #143, `statsUnverified`). **Implementation must rebase on `main` after #143 merges**: this design reads `GearRow.statsUnverified`, `GearRowView.statsUnverified`, the "Stats unverified" text in `equippedStatText` and the "Done?" word in `stateWord`, none of which are on `main` yet.

## Goal

A tier row whose stats can't be compared (the equipped piece's or the target's pair is unknown) shows "Stats unverified" and "Done?" after #138. The player can see the real stats in game. This change lets them say so: a mark turns the row into a definite **right stats** (Done, no question mark) or **wrong stats** (the existing `wrongStats` state).

A mark is only trusted for the piece and the target it was made against. Equipping another piece, upgrading it, or a list change that names another target makes it lapse. Real stats always win: once both pairs are known, the mark is ignored.

## What success looks like

- On a "Stats unverified" row, the character page and the group cell details offer **Right stats** and **Wrong stats**.
- After **Right stats**, the row shows its track's state (Done, Upgrade or Below Myth) with no "?" and the item line says "Stats confirmed by hand". It counts as before.
- After **Wrong stats**, the row is `wrongStats`: the "Stats" word and tone, "Needed" target in the details, Wrong stats count on the card, and the dungeon priority asks for drops with the list's stats only, at weight 1, exactly as a known mismatch does today. The item line says "Stats marked wrong by hand". While the target's pair is unknown, `tierCredit` falls back to item-ID equality, so a wrong mark then credits only a dungeon that drops the exact target item: often nothing for a non-catalyst tier target, which never drops, until the target's pair is fetched. That is accepted, not fixed here.
- A marked row offers **Undo stats check**, which returns it to unverified.
- Equipping a different piece in the slot, in a Blizzard sync or a SimC paste, or changing its bonus IDs (an upgrade), makes the row unverified again. Re-equipping the marked piece brings the mark back.
- Changing the row's target item (an override, a manual list edit, a Method update, another compared list) makes the mark lapse.
- When the next Blizzard sync gives the piece's stats and the target's are known, the row follows the real comparison, whatever the mark says.
- A second account never sees the first account's marks.

## Scope

In scope: the table, its queries, one route, the evaluation change, view fields and one small client control used in two places.

Out of scope:

- Entering the stat pair itself ("this piece is Haste/Mastery"). A verdict is all the row needs; a pair would need a stat picker and doesn't help while the target's pair is unknown.
- Marks on rows that aren't unverified: known pairs, non-tier rows, `statsMatter: false` specs.
- Keeping a mark through an upgrade. The piece is identified by its full bonus IDs, the same key `borrowStats` uses, so an upgrade lapses the mark just as it stops borrowing Blizzard's stats. If re-marking after upgrades proves annoying, strip upgrade-track bonus IDs from the key later.
- Removing lapsed rows. They are inert, replaced by the next mark in the slot, and deleted with the character.
- Bag and Great Vault items (#96). Only the equipped piece in the row's slot can be marked.

## Design

### Decisions

1. **What identifies the piece:** character, slot, item ID and sorted bonus IDs. Item ID plus bonus IDs is the identity `borrowStats` already trusts across Blizzard and SimC snapshots (`itemKey` in `src/core/gear/stat-pair.ts`), so the mark survives a paste or a sync of the same piece and lapses when the piece or its bonus IDs change, whichever snapshot reports it.
2. **What scopes it to the target:** the target item ID, the BiS row's `itemId` that `targets` is keyed by (the tier item, or the base item for a catalyst row). An item ID's stats are fixed, so its pair adds nothing; storing the pair instead would also lapse every mark made while the target's pair was still unfetched as soon as it arrives. A list change that names another item lapses the mark; one that keeps the item keeps it, which is right.
3. **Per account:** keyed by `accountId` like `spec_settings` and `bis_overrides`, resolved with `services.currentAccountId()` (`LOCAL_ACCOUNT_ID` today).
4. **One mark per slot:** primary key `(account_id, character_id, slot)`. A new mark replaces the old one.
5. **Real stats win:** a mark is consulted only when `statsUnverified` is true, which already requires `statsMatter`, a matched tier row and a missing pair. It never overrides a known comparison.
6. **No new state, no ranking change:** a right mark leaves the track's state, a wrong mark gives `wrongStats`. Counts (`countStates`, `doneCount`), tones, `upgradeFor` and `rankDungeons` in `src/core/priority/rank.ts` read the state and need no change.
7. **The route stores what the player saw.** The client sends the equipped item and target from the row it showed. The server doesn't recompute them: if the gear or list changed in between, the mark simply doesn't match and the row stays unverified, which is the safe outcome.

### Data

`src/core/db/schema.ts` gains:

```ts
/** A player's verdict on a tier piece whose stats couldn't be compared. Applies only while the piece and target match. */
export const tierStatMarks = sqliteTable('tier_stat_marks', {
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  characterId: integer('character_id').notNull().references(() => characters.id, { onDelete: 'cascade' }),
  slot: text('slot').$type<SlotType>().notNull(),
  itemId: integer('item_id').notNull(),
  /** Sorted ascending, so it compares with `itemKey`. */
  bonusIds: text('bonus_ids', { mode: 'json' }).$type<number[]>().notNull(),
  targetItemId: integer('target_item_id').notNull(),
  right: integer('right', { mode: 'boolean' }).notNull(),
}, (t) => [primaryKey({ columns: [t.accountId, t.characterId, t.slot] })]);
```

The plan runs `npm run db:generate -- --name tier-stat-marks` (migration `0015_tier-stat-marks.sql`). No cache version bump: no Raidbots or season table changes.

`src/core/types.ts` gains `export interface StatMark { slot: SlotType; itemId: number; bonusIds: number[]; targetItemId: number; right: boolean }`.

`src/core/db/queries/stat-marks.ts`, new:

- `listStatMarks(db, accountId, characterId): Promise<StatMark[]>`.
- `setStatMark(db, accountId, characterId, mark: StatMark)`: upsert on the primary key, bonus IDs sorted before writing, inside `withWriteLock`.
- `clearStatMark(db, accountId, characterId, slot)`: delete inside `withWriteLock`.

### Evaluation

`src/core/gear/stat-pair.ts` exports `itemKey` (unchanged) so the mark match uses the same identity as `borrowStats`.

`evaluateGear` in `src/core/gear/evaluate.ts`:

- `Input` gains `marks?: readonly StatMark[]` (default `[]`).
- `GearRow` gains `statsMark: 'right' | 'wrong' | null`: the mark that was applied.
- For each row, after `stats` and `statsUnverified` are computed: when `statsUnverified` and a mark exists with `slot === slot`, `itemKey(mark) === itemKey(item)` and `targetItemId === row.itemId`, set `stats` to `'same'` (right) or `'different'` (wrong), `statsUnverified` to false and `statsMark` accordingly, then compute `state` with `stateFor` from the new `stats`. Otherwise `statsMark` is null and the row is as #138 left it.

Logic stays pure: marks are data passed in, like `targets`.

### Loading

- `GearContext` in `src/server/views/summarize.ts` gains `marks: StatMark[]`. `loadGear(db, characterId, accountId)` reads them with `listStatMarks`, after its snapshot reads (in sequence, per the in-memory database rule).
- `MemberContext` in `src/server/views/member.ts` gains `accountId: number`. `loadMember` passes it to `loadGear` and `marks: gear.marks` to `evaluateGear`. `getCharacterPage` and `getGroupPage` pass `services.currentAccountId()`.
- `getCharacterCards` in `src/server/views/character-cards.ts` passes `services.currentAccountId()` to `loadGear` and `marks: gear.marks` to its own `evaluateGear` call, so card counts agree with the pages.
- `GearRowView` in `src/server/views/types.ts` gains `statsMark: 'right' | 'wrong' | null`, copied by `rowView`.
- `CharacterPageView` already carries the character `id` through `summary`; `GearTable` gains a `characterId` prop, passed from `src/app/characters/[region]/[realm]/[name]/page.tsx`. `CellDetails` already has `character: CharacterSummary | null` and uses `character.id`; with no character it shows no control.

### Route

`src/app/api/characters/[id]/stat-mark/route.ts`, thin like `src/app/api/bis/overrides/route.ts`:

- `PUT`, body `{ slot, itemId, bonusIds, targetItemId, right }`. Validates `parseId`, `slot` in `SLOT_TYPES`, positive integer `itemId` and `targetItemId`, `bonusIds` an array of non-negative integers, `right` a boolean; anything else is a `UserError` ("Invalid stat mark."). The body is parsed with `await request.json().catch(() => { throw new UserError('Invalid stat mark.'); })`, so a body that isn't JSON, or a bodyless `DELETE`, is a 400 instead of a logged 500. An unknown character answers 404, as `PATCH /api/characters/<id>` does. Calls `setStatMark` with `services.currentAccountId()`.
- `DELETE`, body `{ slot }`. Same id and slot checks; calls `clearStatMark`.
- Errors through `errorResponse`. No `GET`; the request guard covers both writes.

### UI

`src/components/stat-mark/StatMark.tsx`, a client component: `StatMark({ characterId, row }: { characterId: number; row: GearRowView })`. Uses `useApiAction` with `after: 'refresh'`, shows its error in a `role="alert"` span like `StatsMatter`.

- `row.statsUnverified`: two small buttons, **Right stats** and **Wrong stats**, each sending `PUT` with `slot: row.slot`, `itemId` and `bonusIds` from `row.equipped`, `targetItemId` from `row.bis.itemId`.
- `row.statsMark !== null`: one **Undo stats check** button sending `DELETE`.
- Otherwise renders nothing. Buttons are disabled while `busy`, at least 44 px tall on touch, and their words carry the meaning, not color.

Placed in `GearTable` under the state badge (beside `UpgradeBadge`) and in `CellDetails` under the badge row. The compact grid cell gets no control: "Done?" already says to open the details.

Wording, in `equippedStatText` (`src/components/shared/equipped-stats.ts`), checked right after the "Stats unverified" check: `statsMark === 'right'` gives "Stats confirmed by hand", `'wrong'` gives "Stats marked wrong by hand". Its `Pick` gains `statsMark`. `cellLabel` adds ", stats confirmed by hand" or ", stats marked wrong by hand" to the accessible name. A wrong mark otherwise reuses `wrongStats`: its word, tone, "Needed" target and note. One fix there: `needText` (`src/components/group-grid/cell-note.ts`) reads a null pair as `[]` and would say "no secondary stats". For a null side it says instead "Tier, stats marked wrong" (equipped) and "BiS wants <target name>'s stats" (target); known sides keep their pair label.

## Testing

- `evaluate` tests: a right mark on an unverified row gives the track's state, `statsUnverified: false`, `statsMark: 'right'`; a wrong mark gives `wrongStats` and `statsMark: 'wrong'`; each lapses (row stays unverified, `statsMark: null`) when the equipped item ID differs, when bonus IDs differ, when the target item ID differs and when the slot differs; bonus IDs in another order still match; a mark is ignored when both pairs are known (real comparison wins, both directions) and when `statsMatter` is false.
- Same piece across snapshots: a mark made against a Blizzard snapshot's piece applies after a SimC paste of the same item and bonus IDs (through `loadGear` with `openTestDb()`), and lapses after a paste with another tier piece in the slot.
- Queries: set, replace in the same slot, clear; marks of a second account and of another character are not listed; deleting the character removes its marks.
- Route: `PUT` and `DELETE` happy paths; 404 for an unknown character; 400 for a bad slot, a non-integer item, a non-array `bonusIds`, a missing `right`, and a body that isn't JSON (both methods).
- Views: `rowView` copies `statsMark`; card counts and the character page `doneCount` move a right-marked row into done and a wrong-marked row into Wrong stats; `rankDungeons` gives a wrong-marked row only same-stat credits at weight 1 (through `priorityCharacter`), and with an unknown target pair credits only a dungeon dropping the exact target item.
- Components: `equippedStatText` for both marks; `needText` for a wrong mark with an unknown equipped pair, an unknown target pair, and both known (unchanged); `cellLabel` wording; `StatMark` markup (`renderToStaticMarkup`): two buttons for an unverified row, "Undo stats check" for a marked row, nothing otherwise. `StatMark` calls `useRouter()` through `useApiAction`, which throws in a static render, so `StatMark.test.ts`, `CellDetails.test.ts` and `GearTable.test.ts` mock `next/navigation` as `GroupGrid.test.ts` does.
- By hand at 375 and 1440 px: paste a SimC export with a catalysed tier piece the Blizzard snapshot hasn't seen, in a slot whose target pair is known. The group cell shows "Done?"; mark it right in the details and it shows "Done" with "Stats confirmed by hand"; clear it; mark it wrong and it shows "Stats" with the needed target, and the priority list changes. On the character page, the same controls work under the state badge. Paste again with another piece in the slot: the row is unverified again.
- Not covered: there are no browser-level tests yet (#35); button focus and the refresh after a mark are checked by hand.
