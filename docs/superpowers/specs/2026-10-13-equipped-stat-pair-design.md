# Show an equipped tier piece's real stats

Status: design approved in chat on 2026-10-13.
Date: 2026-10-13
Issue: #134. Tier piece with other stats than the BiS item shows as Done

## Goal

The owner saw a tier slot marked Done while the equipped piece seemed to have other stats than the BiS item. Investigation showed the state was right and the page was misleading:

- The equipped piece is a catalysed tier piece. The catalyst keeps the input item's stats, so this Plumage has Crit/Haste, the BiS pair, while the item's base stats are Crit/Mastery. Blizzard's profile data, the stored snapshot and the game all say Crit/Haste.
- The page never shows the equipped piece's stats. The only stats a player can see are in the Wowhead tooltip, and Wowhead shows the base stats even with the item's exact bonus IDs (tested with the owner's item). The game stores catalysed stats somewhere bonus IDs don't carry.
- The BiS column already shows the target pair ("catalyst Somber Spaulders, Crit/Haste"). So the page showed one pair on the BiS side and a different pair in the tooltip.

On a tier row, the page shows the equipped piece's real stat pair next to its item level, so the player can check it against the BiS pair without trusting the tooltip.

The issue asked to check every slot. Only tier rows compare stats; every other row matches the BiS item by item ID, and an item's stats come with its ID. The owner's other tier rows were checked against the database: two show Wrong stats correctly, and one is missing.

## What success looks like

- On the character page, a tier row whose piece fills the slot shows the equipped pair at the end of the item's detail line: "Myth 6/6 · 334 · Crit/Haste".
- In the group page's cell details, the same pair follows the item level on the track line.
- A row shows no pair when it isn't a tier row, when the slot isn't filled by a tier piece (Missing, BiS in bags), or when the equipped stats are unknown.
- The pair shows whether or not "Tier pieces must have the list's stats" is checked. It is information, not a verdict.
- States, stat comparison and the Wowhead tooltip don't change.

## Scope

In scope: one shared helper and its two callers.

Out of scope:

- Unknown stats falling through to Done. When either side's stats are unknown, `compareStats` in `src/core/gear/stat-pair.ts` returns `unknown` and the row shows Done. That is #138.
- The compact group cell. It has no room for another line.
- Any note about the Wowhead tooltip.
- Stat pairs on non-tier rows.

## Design

### Helper

`src/components/shared/equipped-stats.ts` (new), with `equipped-stats.test.ts` beside it. It lives in `shared/` because two components use it.

```ts
import type { GearRowView } from '@/server/views/types';
import { statPairLabel } from './stat-pair';

/** The equipped tier piece's real stat pair, which the Wowhead tooltip can't show for a catalysed piece. */
export function equippedStatText(row: Pick<GearRowView, 'bis' | 'state' | 'equippedStats'>): string | null
```

It returns `statPairLabel(row.equippedStats)` when all of these hold, and `null` otherwise:

- `row.bis.kind === 'item'` and `row.bis.isTier`: a tier row.
- `row.state` is not `'missing'` and not `'inBags'`: a tier piece fills the slot. `evaluateGear` reaches every other state only for a matched item.
- `row.equippedStats !== null`: the stats are known.

`statPairLabel([])` gives "no secondary stats", which is the right text for a piece that has none.

### Character page

In `src/components/character-page/GearTable.tsx`, the `ItemCard`'s `detail` becomes:

```ts
[trackText(row.equipped.trackLabel), row.equipped.itemLevel, equippedStatText(row)].filter(Boolean).join(' · ')
```

`ItemCard`'s detail line keeps the track's color on its leading track name (`detailParts`), and truncates when narrow, as today.

### Group page

In `src/components/cell-details/CellDetails.tsx`, the track line under the item name appends ` · <pair>` after the item level when `equippedStatText(cell)` is not null. `cell` is a `GearRowView`, so it passes as is.

## Testing

- **`equipped-stats.test.ts`** (write first, watch it fail):
  - A tier row in `done` with stats `['CRIT_RATING', 'HASTE_RATING']` gives "Crit/Haste".
  - `wrongStats`, `mythUpgradable` and `belowMyth` tier rows give the pair too.
  - A tier row in `missing` or `inBags` gives `null`.
  - A tier row with `equippedStats: null` gives `null`.
  - A non-tier item row and an "Any" row give `null`, even with stats.
  - Empty stats give "no secondary stats".
- **`GearTable.test.ts`:** a done tier row's markup contains "· Crit/Haste"; a non-tier row's doesn't.
- **By hand**, on a character with a catalysed tier piece, at 375 and 1440 px: the character page row and the group cell details show the pair, and it matches the game.
