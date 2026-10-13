# Show each character's item level

Status: design approved in chat on 2026-10-13. Spec review passed on 2026-10-13 in round 2; round 1 folded in: named game reference, weapon-rule gaps, corrected lone one-hander error.
Date: 2026-10-13
Issue: #140. Show each character's item level on character and group pages

## Goal

Players want to see where each character stands at a glance. The app shows every equipped item's level but never the character's overall item level. This adds it to the home page's character cards, the character page header and the group page's member headers.

## What success looks like

- A character with gear shows its equipped item level, with one decimal, on its home-page card, its character page and its group member header.
- The number matches the game's equipped item level, cut to one decimal, for a character with a full set and one two-handed weapon, two one-handers, or a one-hander with an off-hand or shield. The reference is the game's own raw value, read in the client with `/run local _,e=GetAverageItemLevel(); print(e, math.floor(e*10)/10)`: its second number must equal the page's.
- A SimC paste updates the number at once, with no Blizzard sync.
- A character with no gear, or with any equipped item whose level is unknown, shows no number and no empty label.

## Scope

In scope: one pure function, one field on `CharacterSummary`, and a line on three components.

Out of scope:

- Blizzard's own `equipped_item_level` from the profile call. The owner chose the computed number: it needs no schema change and follows SimC pastes.
- Item level history or trends.
- Sorting or ranking by item level.

## Design

### The number

`src/core/gear/item-level.ts` (new), with `item-level.test.ts` beside it. Pure logic, so it lives in `src/core/gear`.

```ts
/** The equipped item level the game shows, cut to one decimal; null when it can't be known. */
export function equippedItemLevel(equipped: readonly GearItem[]): number | null
```

- It averages over the 16 slots in `SLOT_TYPES`. An empty slot counts as 0, as the game counts it.
- When `OFF_HAND` is empty and `MAIN_HAND` is filled, the main hand counts twice: the game counts a two-handed weapon in both weapon slots, over 16. This rule is the working assumption; the hand check against `GetAverageItemLevel` above confirms it, and a mismatch there sends the spec back before merge.
- Known gaps, accepted because fixing them needs the weapon's inventory type, which `GearItem` doesn't store (out of scope: a schema change):
  - A lone one-hander also counts twice. That only happens mid-gearing. The number then overstates by the main hand's item level / 16 before the cut: 14 items and a one-hander at 330 show 330.0 where the game shows 309.3. A code comment names this ceiling; the fix is storing the inventory type.
  - A Fury warrior with two two-handers counts each once. Reports differ on how the character sheet counts a second two-hander, so the number may differ there.
- It cuts to one decimal (`Math.floor(avg * 10) / 10`), so rounding never pushes it above the game's raw value. That holds only for the supported weapon setups above. The game's own whole number is floored too.
- It returns `null` when `equipped` is empty, or when any equipped item has `itemLevel === null`. A wrong number is worse than none.

### Views

`CharacterSummary` in `src/server/views/types.ts` gains `itemLevel: number | null`. `summarize` in `src/server/views/summarize.ts` fills it from the snapshot it already receives: `snapshot ? equippedItemLevel(equippedGear(snapshot)) : null`. Every loader that builds a summary (character cards, character page, group member) gets it with no other change. The current snapshot is the paste for SimC and the sync for Blizzard, so the number follows whichever is newer.

### Display

The number is `font-mono` and always has words beside it. Nothing renders when it is `null`. A shared formatter isn't needed: `toFixed(1)` keeps the trailing `.0`, so 334 shows as "334.0" and every number has the same shape.

- **Character page** (`src/components/character-page/CharacterHeader.tsx`): a fourth line in the identity block, under the spec line: "Item level 334.6", in `text-muted` with the number in `font-mono`.
- **Character card** (`src/components/character-card/CharacterCard.tsx`): the same line under the identity line.
- **Group member header** (`src/components/group-grid/MemberHeader.tsx`): "334.6 ilvl" under the name, `text-xs`, with `title="Equipped item level"`. It shows at every width, including the narrow mobile column where the name is screen-reader only, so it can't hide behind `sr-only`.

## Testing

- **`item-level.test.ts`** (write first, watch it fail):
  - 16 items at 330 give 330.
  - A full set with mixed levels gives the average cut to one decimal (for example a sum giving 334.66 shows 334.6, never 334.7).
  - A two-hander at a different level from the rest counts twice: 14 items at 330 and a two-hander at 346 give 332.0, not 331.0 (counting it once over 15).
  - A lone one-hander counts twice too: 14 items and a one-hander at 330 give 330.0 (the documented gap).
  - An empty slot counts as 0.
  - `MAIN_HAND` with no `OFF_HAND` counts twice; with both filled, each counts once.
  - Any item with `itemLevel: null` gives `null`.
  - No items give `null`.
- **`summarize`:** a snapshot's equipped items fill `itemLevel`; no snapshot gives `null`.
- **Markup tests** (`renderToStaticMarkup`, beside each component): `CharacterHeader`, `CharacterCard` and `MemberHeader` show the number with its words, and show nothing for `null`.
- **By hand** at 375, 1024 and 1440 px: the number shows on all three pages, the group header stays the same height for every member, and the number equals the second value of `/run local _,e=GetAverageItemLevel(); print(e, math.floor(e*10)/10)` in the game, for a character synced from Blizzard and for one after a SimC paste. Record the game build and weapon setup. A mismatch on a supported setup is a defect, not a hand-check note.
