# Tier set chip: implementation plan

Spec: `docs/superpowers/specs/2026-10-17-tier-set-chip-design.md` (the authority). Issue #177. Branch `feat/tier-set-chip`, worktree `C:\workspace\wgt-177`.

Gate after every task: `npm run typecheck && npm run lint && npm test`. Build (`npm run build`, worktree only) after task 4.

## Task 1: core count and thresholds

1. Write `src/core/gear/tier-set.test.ts` first:
   - `countTierPieces([])` is 0; counts only `isTier: true` items.
   - `tierSetBonus`: 0 → null, 1 → null, 2 → 2, 3 → 2, 4 → 4, 5 → 4.
2. Watch it fail, then write `src/core/gear/tier-set.ts`:
   - `countTierPieces(equipped: readonly Pick<GearItem, 'isTier'>[]): number`
   - `tierSetBonus(pieces: number): 2 | 4 | null`
3. In `src/core/priority/rank.ts`, replace `character.equipped.filter((item) => item.isTier).length` with `countTierPieces(character.equipped)`. Existing rank tests must pass unchanged.
4. Commit: `feat: count equipped tier pieces in one place`.

## Task 2: summary field

1. Add `tierPieces: number` to `CharacterSummary` in `src/server/views/types.ts`, with a doc comment: equipped tier pieces in the current snapshot, 0 without one.
2. Test first in `src/server/views/views.test.ts` (or the nearest existing `summarize`/card loader test): a snapshot with tier pieces equipped plus a tier piece in bags yields the equipped count only; no snapshot yields 0.
3. In `summarize()` (`src/server/views/summarize.ts`): `tierPieces: snapshot ? countTierPieces(equippedGear(snapshot)) : 0`.
4. Add `tierPieces: 0` to the `CharacterSummary` literals in: `character-card/CharacterCard.test.ts`, `character-page/CharacterHeader.test.ts`, `character-row/CharacterRow.test.ts`, `group-grid/GroupGrid.test.ts`, `server/views/views.test.ts`, plus any other file typecheck names.
5. Commit: `feat: carry tier piece count on character summary`.

## Task 3: chip component

1. `src/components/tier-set-chip/TierSetChip.test.ts` first (render with `renderToStaticMarkup`, as other component tests do):
   - `pieces` 0 and 1 render an empty string.
   - 2 and 3 render `2-set`, outline classes (`border-gold-line`, no `bg-gold`).
   - 4 and 5 render `4-set` with `bg-gold`.
   - Visible text is inside an `aria-hidden="true"` span; an `sr-only` span reads e.g. `4-piece tier set bonus, 5 tier pieces equipped` (singular never occurs: pieces ≥ 2).
   - `title` equals the same label.
2. `TierSetChip.tsx`: `export function TierSetChip({ pieces }: { pieces: number })`. Returns null when `tierSetBonus(pieces)` is null. Pill: `inline-flex h-5 shrink-0 items-center rounded-full px-1.5 text-xs font-semibold`, plus `bg-gold text-bg` for 4 or `border border-gold-line text-gold` for 2. Digit in `font-mono`.
3. Commit: `feat: add tier set chip`.

## Task 4: placements

Each with a test in the existing component test file, asserting `4-set` appears with `tierPieces: 4` and is absent with `tierPieces: 1`, and that it shows with `itemLevel: null`.

1. `character-card/CharacterCard.tsx`: realm line becomes `flex min-w-0 items-center gap-1.5 text-[15px] text-muted`; realm and item level text move into a `min-w-0 truncate` span; `<TierSetChip pieces={card.tierPieces} />` after it. Footer untouched.
2. `character-row/CharacterRow.tsx`: same treatment on its realm line (`text-sm`).
3. `character-page/CharacterHeader.tsx`: the item level line becomes `flex items-center gap-2 text-muted`, rendered when `itemLevel !== null || tierSetBonus(tierPieces) !== null`; the "Item level" text only when known, then the chip. Action cluster untouched. Test in `CharacterHeader.test.ts`.
4. `group-grid/MemberHeader.tsx`: wrap the item level span and the chip in `flex flex-wrap items-center justify-center gap-1 sm:justify-start`, rendered when either exists. Test in `GroupGrid.test.ts` (or a new `MemberHeader` render test there).
5. Run the full gate and `npm run build`.
6. Commit: `feat: show tier set chip on card, row, header and group`.

## Task 5: pull request

Screenshots from the e2e harness (`e2e/pr-shots.spec.ts`, git-ignored), if the fake Blizzard data can give a made-up character tier pieces (`set` on equipped items); otherwise say so and cover it in How to test. Questions for Nóri: spec decision 4 (any set counts).
