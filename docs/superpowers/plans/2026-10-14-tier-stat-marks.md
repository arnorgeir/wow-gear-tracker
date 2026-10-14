# Manual Tier Stat Marks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a player mark a "Stats unverified" tier row as right or wrong stats (#97). The mark applies only while the same piece (item ID and bonus IDs) and the same target item are in the slot, and real stats always win.

**Architecture:** One new table `tier_stat_marks` (per account, character and slot) with its queries. `evaluateGear` takes the marks as data and turns a matching unverified row into `stats: 'same' | 'different'`. Loaders read marks in `loadGear`. One `PUT`/`DELETE` route. One client component, `StatMark`, in the character page's gear table and the group cell details. No new state, no change to `rank.ts`.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Drizzle with libsql, Vitest (`environment: 'node'`, markup tests through `renderToStaticMarkup`), in-memory SQLite through `openTestDb()`.

**Spec:** `docs/superpowers/specs/2026-10-14-tier-stat-marks-design.md`. The spec is the authority; read it before Task 1.

**Branch:** `feat/tier-stat-marks` (exists, holds the spec and this plan). This work depends on #143 (`statsUnverified`, branch `origin/feat/minor-polish-batch`).

- Before Task 1: `git fetch origin`. If #143 has merged, `git rebase origin/main`. If it hasn't, `git rebase origin/feat/minor-polish-batch`, and say in the pull request that the branch sits on #143 and must be rebased on `main` once it merges.
- Check: `grep -n statsUnverified src/core/gear/evaluate.ts` prints a line. If it doesn't, stop: the base is wrong.

## Global Constraints

- Failing test first, watch it fail, then code. One commit per task; subjects `feat:`/`fix:`/`chore:` lowercase imperative, terse why-body only when the subject doesn't say it. No AI attribution or mention anywhere. Use the repo's `commit` skill.
- `src/core` never imports `next`, `react` or `src/app|components|server`.
- `GET` routes never write. Every DB write goes through `withWriteLock`.
- In-memory test DBs have one connection: database reads run in sequence, never in `Promise.all` beside a write.
- Fixture names are made up (Birkibjörn style). No real players.
- Never edit a committed migration. Generate the new one with `npm run db:generate -- --name tier-stat-marks`.
- Gate before the pull request: `npm run typecheck && npm run lint && npm test`, then `npm run build` in this worktree only if no dev server serves it.

## Review Focus

1. **Real stats win.** A mark is consulted only when `statsUnverified` is true (Task 2 tests with both pairs known, both directions).
2. **Lapsing.** Item ID, bonus IDs, target item ID or slot differing each leaves the row unverified; bonus IDs in another order still match (Task 2).
3. **Same piece across snapshots.** A mark made against a Blizzard piece applies after a SimC paste of the same item and bonus IDs (Task 3).
4. **Route errors.** A body that isn't JSON is a 400, never a 500 (Task 4).
5. **Per account.** A second account's marks are never listed (Task 1).

---

### Task 1: Table, migration and queries

**Files:** Modify `src/core/db/schema.ts`, `src/core/types.ts`. Create `src/core/db/queries/stat-marks.ts`, `src/core/db/queries/stat-marks.test.ts`. Generated: `drizzle/0015_tier-stat-marks.sql` and `drizzle/meta/*`.

- [ ] In `src/core/types.ts` add `export interface StatMark { slot: SlotType; itemId: number; bonusIds: number[]; targetItemId: number; right: boolean }`.
- [ ] Add `tierStatMarks` to `schema.ts` exactly as the spec's Data section shows (`SlotType` is already imported there; `primaryKey` too).
- [ ] Run `npm run db:generate -- --name tier-stat-marks`. Check the SQL creates `tier_stat_marks` with both foreign keys `ON DELETE cascade` and the composite primary key, and nothing else.
- [ ] Tests (`openTestDb()`, insert a character with `insertCharacter`; account 1 is seeded by migration `0010`; insert account 2 with `db.insert(accounts).values({ id: 2, name: 'Second' })`):
  - `setStatMark` then `listStatMarks` returns the mark with bonus IDs sorted ascending (write `[30, 10]`, read `[10, 30]`).
  - A second `setStatMark` in the same slot replaces the first (one row, the new values).
  - `clearStatMark` removes it; clearing an empty slot doesn't throw.
  - Account 2's mark and another character's mark are not in account 1's list for the character.
  - Deleting the character (`deleteCharacter`) removes its marks.
- [ ] Implement:

```ts
export async function listStatMarks(db: Db, accountId: number, characterId: number): Promise<StatMark[]>
export async function setStatMark(db: Db, accountId: number, characterId: number, mark: StatMark): Promise<void>
export async function clearStatMark(db: Db, accountId: number, characterId: number, slot: SlotType): Promise<void>
```

  `listStatMarks` selects and maps to `StatMark`. `setStatMark` wraps an insert with `onConflictDoUpdate` on `[accountId, characterId, slot]` (setting itemId, bonusIds, targetItemId, right) in `withWriteLock`, sorting `bonusIds` with `(a, b) => a - b` first. `clearStatMark` deletes in `withWriteLock`. Follow `src/core/db/queries/bis-settings.ts` for style.
- [ ] Commit `feat: store manual tier stat marks` (body: per account, character and slot; lapses by piece and target, so no cleanup).

### Task 2: Marks in gear evaluation

**Files:** Modify `src/core/gear/stat-pair.ts`, `src/core/gear/evaluate.ts`. Tests: `src/core/gear/evaluate.test.ts`, `src/core/priority/priority.test.ts`. Fix every fixture that builds a `GearRow` by adding `statsMark: null` (`grep -rn "statsUnverified" src --include=*.test.ts` finds them).

- [ ] Export `itemKey` from `stat-pair.ts` (add `export`; no other change).
- [ ] Tests in `evaluate.test.ts`, building an unverified matched tier row (equipped tier piece with `secondaryStats: null`, target with known stats) and a mark `{ slot, itemId, bonusIds, targetItemId: row.itemId, right }`:
  - right mark: `statsUnverified: false`, `statsMark: 'right'`, `stats: 'same'`, state from the track (Myth 6/6 gives `done`, Hero gives `belowMyth`).
  - wrong mark: `state: 'wrongStats'`, `statsMark: 'wrong'`, `stats: 'different'`.
  - lapses, each giving `statsUnverified: true`, `statsMark: null` and the #138 state: other equipped item ID; other bonus IDs; other `targetItemId`; mark in another slot.
  - bonus IDs `[2, 1]` on the item and `[1, 2]` on the mark match.
  - ignored when both pairs are known: a right mark on a known mismatch stays `wrongStats`; a wrong mark on a known match stays `done`. `statsMark: null` in both.
  - ignored with `statsMatter: false`.
  - no `marks` input: `statsMark: null` everywhere.
- [ ] Implement in `evaluateGear`: `Input` gains `marks?: readonly StatMark[]` (default `[]`); `GearRow` gains `statsMark: 'right' | 'wrong' | null` with a one-line doc comment. After `statsUnverified` is computed:

```ts
const mark = statsUnverified && row.kind === 'item'
  ? marks.find((m) => m.slot === slot && m.targetItemId === row.itemId && itemKey(m) === itemKey(item!))
  : undefined;
const finalStats = mark ? (mark.right ? 'same' : 'different') : stats;
```

  Return `stats: finalStats`, `statsUnverified: statsUnverified && !mark`, `statsMark: mark ? (mark.right ? 'right' : 'wrong') : null`, and `state: stateFor(row, matched, track, bagItemIds, finalStats, statsMatter)`. Adjust names to fit the surrounding code; keep the function pure.
- [ ] Tests in `priority.test.ts` (`rankDungeons` with rows from `evaluateGear` with marks):
  - a wrong-marked row with a known target pair credits only drops whose pair equals the target's, at weight 1 (same as a known mismatch).
  - a wrong-marked row with an unknown target pair credits only a dungeon dropping the exact target item ID; a dungeon with only other compatible chests gives no credit.
  - a right-marked Myth 6/6 row gives no credit.
- [ ] Commit `feat: apply manual stat marks to unverified tier rows`.

### Task 3: Load marks into the views

**Files:** Modify `src/server/views/summarize.ts`, `member.ts`, `character-page.ts`, `group-page.ts`, `character-cards.ts`, `types.ts`. Tests: `src/server/views/views.test.ts` (and fixtures building `GearRowView` gain `statsMark: null`).

- [ ] Tests (`views.test.ts`, following its existing setup): with a catalysed tier piece pasted by SimC that the Blizzard snapshot doesn't know, and a known target pair:
  - no mark: the row has `statsUnverified: true` (sanity).
  - after `setStatMark(db, 1, id, { right: true, ... })` with the paste's item ID and bonus IDs: the character page row has `statsMark: 'right'`, state `done`, and `doneCount` counts it; the card's `counts.done` counts it.
  - with `right: false`: state `wrongStats`, card `counts.wrongStats` is 1.
  - a mark made against a Blizzard snapshot's piece applies after a SimC paste of the same item ID and bonus IDs; a later paste with another tier piece in the slot makes the row unverified again.
- [ ] `GearContext` gains `marks: StatMark[]`. `loadGear(db, characterId, accountId)` reads `listStatMarks(db, accountId, characterId)` after its snapshot reads, with `await`, in sequence.
- [ ] `MemberContext` gains `accountId: number`; `loadMember` calls `loadGear(ctx.db, character.id, ctx.accountId)` and passes `marks: gear.marks` to `evaluateGear`. `getCharacterPage` and `getGroupPage` pass `accountId: services.currentAccountId()` in the context they build.
- [ ] `getCharacterCards` passes `services.currentAccountId()` to `loadGear` and `marks: gear.marks` to its `evaluateGear` call.
- [ ] `GearRowView` gains `statsMark: 'right' | 'wrong' | null` (doc comment: "A player's mark on an unverified tier piece, when it applies."); `rowView` copies `r.statsMark`.
- [ ] Commit `feat: load stat marks into gear views`.

### Task 4: Stat mark route

**Files:** Create `src/app/api/characters/[id]/stat-mark/route.ts`, `src/app/api/characters/[id]/stat-mark/stat-mark-route.test.ts`.

- [ ] Tests, following `src/app/api/bis/bis-routes.test.ts` (mock `@/server/services`, `openTestDb()`, call handlers with a `NextRequest` and `{ params: Promise.resolve({ id }) }`):
  - `PUT` with a valid body answers 200 and `listStatMarks(db, 1, id)` holds the mark; `DELETE` with `{ slot }` answers 200 and removes it.
  - 404 `{ error: 'Unknown character' }` for an id with no character, and for id `abc`.
  - 400 `{ error: 'Invalid stat mark.' }` for: slot `'NOSE'`; `itemId: 1.5`; `targetItemId: 0`; `bonusIds: 'x'`; `bonusIds: [-1]`; `right` missing; a body that isn't JSON (`body: 'not json'`) for `PUT` and for `DELETE`; a `DELETE` with no body.
- [ ] Implement:

```ts
const invalid = () => new UserError('Invalid stat mark.');
const readBody = async (request: NextRequest) => {
  const body: unknown = await request.json().catch(() => { throw invalid(); });
  if (typeof body !== 'object' || body === null) throw invalid();
  return body as Record<string, unknown>;
};
const parseSlot = (v: unknown): SlotType => { if ((SLOT_TYPES as readonly unknown[]).includes(v)) return v as SlotType; throw invalid(); };
const positiveInt = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v > 0;
```

  `PUT`: `parseId`, else 404 as in `src/app/api/characters/[id]/route.ts`; inside `try`, `getCharacter` (404 when null), `readBody`, validate (`positiveInt` for `itemId` and `targetItemId`, `Array.isArray(bonusIds) && bonusIds.every((b) => Number.isInteger(b) && b >= 0)`, `typeof right === 'boolean'`), then `setStatMark(db, s.currentAccountId(), id, { slot, itemId, bonusIds, targetItemId, right })`; answer `{ ok: true }`. `DELETE`: same id and character checks, `readBody`, `parseSlot`, `clearStatMark`. `catch (err) { return errorResponse(err); }`. No `GET`.
- [ ] Commit `feat: add stat mark route`.

### Task 5: Wording for marked rows

**Files:** Modify `src/components/shared/equipped-stats.ts`, `src/components/group-grid/cell-note.ts`, `src/components/group-grid/cell-label.ts`. Tests beside each.

- [ ] Tests:
  - `equippedStatText`: `statsMark: 'right'` gives `"Stats confirmed by hand"`; `'wrong'` (state `wrongStats`, `equippedStats: null`) gives `"Stats marked wrong by hand"`; `statsMark: null` with a known pair is unchanged.
  - `needText` for `wrongStats`: `equippedStats: null` and known target gives `"Tier, stats marked wrong; BiS wants Crit/Haste"`; known equipped and `targetStats: null` gives `"Tier, Haste/Mastery; BiS wants <bis.name>'s stats"`; both known is unchanged.
  - `cellLabel` adds `", stats confirmed by hand"` or `", stats marked wrong by hand"` after the state text, in the same place as `", stats unverified"`.
- [ ] Implement:
  - `equippedStatText`: `Pick` gains `statsMark`. After the `statsUnverified` check: `if (row.statsMark === 'right') return 'Stats confirmed by hand'; if (row.statsMark === 'wrong') return 'Stats marked wrong by hand';`.
  - `needText`: `const have = cell.equippedStats ? statPairLabel(cell.equippedStats) : 'stats marked wrong'; const want = cell.bis.targetStats ? statPairLabel(cell.bis.targetStats) : \`${cell.bis.name}'s stats\`;` and return `` `Tier, ${have}; BiS wants ${want}` ``.
  - `cellLabel`: `const mark = cell.statsMark === 'right' ? ', stats confirmed by hand' : cell.statsMark === 'wrong' ? ', stats marked wrong by hand' : '';`, inserted beside `unverified`.
- [ ] Commit `feat: word manually marked tier stats`.

### Task 6: StatMark control

**Files:** Create `src/components/stat-mark/StatMark.tsx`, `src/components/stat-mark/StatMark.test.ts`. Modify `src/components/character-page/GearTable.tsx`, `src/components/cell-details/CellDetails.tsx`, `src/app/characters/[region]/[realm]/[name]/page.tsx`. Tests: `GearTable.test.ts`, `CellDetails.test.ts`.

- [ ] Add to `StatMark.test.ts`, `GearTable.test.ts` and `CellDetails.test.ts`, above the tests: `vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }) }));` with the comment from `GroupGrid.test.ts`, and import `vi`.
- [ ] Tests (markup):
  - `StatMark` with `statsUnverified: true` renders buttons "Right stats" and "Wrong stats" and no "Clear mark"; with `statsMark: 'right'` renders "Clear mark" only; with neither renders `''`.
  - `GearTable` with `characterId: 7` and an unverified tier row shows "Right stats"; `CellDetails` with a `character` summary and an unverified row shows "Right stats"; with `character: null` it doesn't.
- [ ] Implement `StatMark({ characterId, row }: { characterId: number; row: GearRowView })` as `'use client'`, using `useApiAction` (`busy`, `error`, `run`):
  - URL `/api/characters/${characterId}/stat-mark`, JSON body, `{ after: 'refresh' }`.
  - Unverified: two `type="button"` buttons; each sends `PUT` with `{ slot: row.slot, itemId: row.equipped!.itemId, bonusIds: row.equipped!.bonusIds, targetItemId: row.bis.itemId, right }` (guard: render nothing unless `row.equipped` and `row.bis.kind === 'item'`).
  - Marked: one "Clear mark" button sending `DELETE` with `{ slot: row.slot }`.
  - Buttons `disabled={busy}`, classes `min-h-11 rounded-lg border border-line px-3 text-sm font-semibold` in a `flex flex-wrap gap-2` wrapper; error in `<span role="alert" className="text-sm text-missing">`.
- [ ] `GearTable` gains `characterId: number`; render `<StatMark characterId={characterId} row={row} />` in the state column after `UpgradeBadge`. `page.tsx` passes `characterId={view.id}`.
- [ ] `CellDetails`: render `{character && <StatMark characterId={character.id} row={cell} />}` after the badge row.
- [ ] By hand (dev server, 375 and 1440 px): the spec's Testing by-hand steps, with a target pair that is known. Record results for the pull request.
- [ ] Commit `feat: let players mark unverified tier stats`.

### Task 7: Gate and pull request

- [ ] `git fetch origin`; rebase on `origin/main` if #143 has merged (else on `origin/feat/minor-polish-batch`), resolving conflicts in favor of #143's code plus these additions.
- [ ] `npm run typecheck && npm run lint && npm test`, all clean. `npm run build` with no dev server on this folder.
- [ ] Push and open the pull request per `AGENTS.md`: `Closes #97.`, `## What changes`, `## Data` (new table `tier_stat_marks`, migration `0015_tier-stat-marks`, no cache version bump), `## Testing` (test count; typecheck, lint, build; by-hand results; not covered: no browser-level tests (#35), button focus and refresh checked by hand), `Spec: docs/superpowers/specs/2026-10-14-tier-stat-marks-design.md`. If based on #143's branch, say so.
