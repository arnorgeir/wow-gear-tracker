# Tier set chip

Issue: #177. Show when a character has the 2-piece or 4-piece tier set bonus, as a simple chip.

## Decisions

The owner answered the issue's open questions:

1. **Where:** all three places: character card (home page), character page header, group page.
2. **What counts:** equipped pieces only. Bag and vault pieces never count.

Decided here:

3. **Count source.** Equipped items with `isTier` in the current snapshot, the same flag dungeon priority counts (`src/core/priority/rank.ts`). Blizzard sets it from the item's `set`; SimC pastes take it from item details. Catalysed pieces carry a `set`, so they count, as they do in game.
4. **Known limit: any set counts.** `isTier` is `Boolean(item.set)`, and snapshots store no set ID. Two pieces of last season's set plus two of this season's would show `4-set`, and a crafted or legacy set piece counts too. Dungeon priority already counts this way. Storing set IDs needs a schema change and migration, which an S chip doesn't justify; in current-season Mythic+ gear, mixed sets are rare. Listed as a question for the owner in the pull request.
5. **Thresholds.** 0 or 1 pieces: no chip. 2 or 3: `2-set`. 4 or 5: `4-set`. The game grants the 4-piece bonus for any 4 of the 5 tier slots.
6. **No chip for "no bonus".** A missing chip means fewer than 2 pieces, or no gear yet.
7. **Wording.** Visible text is `2-set` or `4-set`, the term players use, marked `aria-hidden`. A screen-reader-only label spells it out: "4-piece tier set bonus, 5 tier pieces equipped". The same text goes in `title` for mouse users; it's a convenience, never the only place the meaning lives. Text carries the meaning; color is decoration.
8. **Look.** A small rounded pill (`h-5`, `px-1.5`, `text-xs`, digits in `font-mono`), so it barely changes a text line's height. `4-set` is solid: `bg-gold text-bg`. `2-set` is an outline: `border border-gold-line text-gold`, no fill. The two differ strongly in lightness, not only in text. No new color tokens.
9. **One count, shared.** `countTierPieces(equipped)` and `tierSetBonus(pieces)` live in `src/core/gear/tier-set.ts`. `rankDungeons` switches to `countTierPieces`, so the chip and dungeon priority can't drift apart.

## Placement

The chip depends only on the tier count, never on whether the item level is known.

- **Character card** (`character-card/CharacterCard.tsx`): on the realm and item level line under the identity, after the item level. That line becomes `flex items-center gap-1.5`, with the realm text in its own `min-w-0 truncate` span and the chip `shrink-0`, so a long realm name truncates and the chip stays whole. The card's footer stays untouched: #178 adds an add-to-group button to the card and header.
- **Home page list view** (`character-row/CharacterRow.tsx`): same line, same treatment, so the list toggle doesn't hide the chip.
- **Character page header** (`character-page/CharacterHeader.tsx`): on the "Item level" line, after the number. When the item level is unknown and tier pieces exist, the chip sits on that line alone. The right-hand action cluster stays untouched for #178.
- **Group page** (`group-grid/MemberHeader.tsx`): on the item level line in each member's column header (`flex items-center gap-1`), so headers keep the height `MemberHeaderSkeleton` expects. The member chip row at the top is a reorder control and isn't touched.

## Shape

- `src/core/gear/tier-set.ts`: `countTierPieces(equipped: readonly Pick<GearItem, 'isTier'>[]): number` and `tierSetBonus(pieces: number): 2 | 4 | null`, with unit tests.
- `CharacterSummary` gains `tierPieces: number`: equipped tier items in the current snapshot, 0 without one. `summarize()` in `src/server/views/summarize.ts` computes it, so the card, list row, character page and group members all get it with no other loader change.
- New component `src/components/tier-set-chip/TierSetChip.tsx`, taking `pieces`. It renders nothing when `tierSetBonus` returns null, so callers pass `tierPieces` without a guard.
- Test files that build `CharacterSummary` literals gain `tierPieces: 0`.
- No schema change, migration, cache version or route change.

## Acceptance

- A character with 4 or 5 equipped tier pieces shows `4-set` on the card, the list row, the character page header and its group column header.
- 2 or 3 pieces show `2-set`. 0 or 1 pieces, or no gear yet, show no chip.
- Tier pieces only in bags or the vault never raise the count.
- The chip's screen-reader label names the bonus and the piece count; the visible text is hidden from screen readers.
- A character with tier pieces but an unknown item level still shows the chip.
- Untracked group members (no `character`) render as before.
- Dungeon priority's tier weighting is unchanged (existing `rank` tests pass).

## Edge cases

- **SimC paste over Blizzard data:** the count follows the current snapshot, the same gear the rest of the page shows.
- **Narrow screens:** realm text truncates before the chip does. In the group header the chip shares the item level line; on the narrowest column it wraps under it.
- **Tier flag unknown:** when Blizzard returns no item info for a piece, it counts as not tier, matching dungeon priority.

## Not in scope

- Showing which slots hold tier, or which pieces are missing for the next bonus.
- Counting bag or vault pieces.
- Telling sets apart by set ID (decision 4).

## Spec review

Reviewed by a Claude Opus subagent (Codex was at its usage limit). All ten findings resolved above: mixed sets (decision 4), list view (Placement), truncation and line height (Placement, decision 8), chip independent of item level, screen-reader text (decision 7), 2-set vs 4-set lightness (decision 8), group header height (Placement), shared count (decision 9), unknown tier flag (Edge cases), test literals (Shape).
