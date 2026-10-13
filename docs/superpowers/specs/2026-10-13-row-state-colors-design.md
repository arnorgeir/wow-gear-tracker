# Row colors follow the item state

Status: design approved in chat on 2026-10-13.
Date: 2026-10-13
Issue: #123. Rethink row colors for equipped vs BiS states

## Goal

Gear rows on the character page and cells on the group page get a background and border for only three states: done, upgrade with crests, and wrong stats. A BiS item on a track below Myth, which the badge calls "Great Vault target", shows plain. The colors also disagree with the badges: the crests row is green while its badge and legend swatch are purple, and the wrong-stats row is gold while its badge is pink.

Every state where the BiS item is equipped gets a background and border, in the same color as its badge. States where the BiS item is not equipped stay plain. A colored row then means "you have it", and a plain row means "go get it".

## What success looks like

- Done, upgrade with crests, wrong stats and Great Vault target rows each get a fill and a 2 px border. BiS in bags and missing rows stay plain.
- Each toned row uses its badge's color family: done gold, crests purple, wrong stats pink, Great Vault target blue. Badge, group cell word, legend swatch and row agree.
- The toned states read apart without hue. Border lightness steps down from done to crests to Great Vault target, and wrong stats has a dashed border instead of a solid one. Every row keeps its state word.
- The character page and the group page use the same mapping, as they do today through `rowTone`.
- The legend lists wrong stats, which it is missing today.
- No row is toned while upgrade track data is unavailable, as today.

## Scope

In scope: the row tone mapping and styles, new color tokens, and the legend.

Out of scope:

- Badge text colors and wording. They stay as they are.
- The green upgrade arrow on group cells and the upgrade badge. Green there means "an upgrade exists", which is not a state.
- Item states themselves. `stateFor` in `src/core/gear/evaluate.ts` does not change.

## Design

### Mapping

`rowTone(state, tracksKnown)` in `src/components/shared/row-tone.ts` stays the one place that picks a tone. Both `GearTable` and `GroupCell` already call it, so they need no change.

`RowTone` becomes `'gold' | 'crest' | 'stats' | 'vault'`. The `green` tone is removed.

| State | Badge text | Tone | Fill | Border | Border luminance |
|---|---|---|---|---|---|
| `done` | Done | `gold` | `--color-gold-soft` #2e2513 (exists) | 2 px solid `--color-gold` #f2c14e (exists) | 0.58 |
| `mythUpgradable` | Upgrade with crests | `crest` | `--color-crest-soft` #251d33 (new) | 2 px solid `--color-crest-line` #a585d6 (new) | 0.30 |
| `wrongStats` | Wrong stats | `stats` | `--color-stats-soft` #2e1a25 (new) | 2 px dashed `--color-stats-line` #d07aa6 (new) | 0.30 |
| `belowMyth` | Great Vault target | `vault` | `--color-vault-soft` #16222f (new) | 2 px solid `--color-vault-line` #4270a0 (new) | 0.15 |
| `inBags` | BiS in bags | none | | | |
| `missing` | Missing | none | | | |

When `tracksKnown` is false, `rowTone` returns `null` for every state, as today.

Luminance is WCAG relative luminance. Each solid border is about 1.8 times as light as the next one down, so done, crests and Great Vault target still separate in grayscale. Wrong stats has the same lightness as crests and is told apart by its dashed border. The Great Vault target border is the dimmest and still has 3.1:1 contrast against its own fill.

Wrong stats moves from done's gold to pink. The gold came from e1132de ("only the stats are off"). The owner chose one color per state over that reasoning, so the row now matches its pink badge.

### Styles

`ROW_TONE_STYLES` keeps its shape: one `CSSProperties` object per tone, applied through `style` by both callers.

- Solid tones keep today's technique: `background` plus `boxShadow: '0 0 0 2px <border>'`.
- `stats` keeps today's technique: `background` plus `outline: '2px dashed <border>'` with `outlineOffset: '-2px'`.
- Every color is a `var(--color-…)` reference. No hex values in TypeScript. This also replaces today's hardcoded `#2e2513`, `#1a2e20` and `#3e8a4d` in the file.

### Tokens

`src/app/globals.css` gains six tokens in `@theme`, next to the existing `--color-gold-soft` group:

```css
--color-crest-soft: #251d33;
--color-crest-line: #a585d6;
--color-stats-soft: #2e1a25;
--color-stats-line: #d07aa6;
--color-vault-soft: #16222f;
--color-vault-line: #4270a0;
```

### Legend

`src/components/state-legend/StateLegend.tsx` gains `['bg-stats', 'Wrong stats']` after the crests entry, in the order of `ITEM_STATES`. The other entries already use the badge colors and do not change.

## Testing

- **`row-tone.test.ts`** (update first, watch it fail):
  - `done` gives `gold`, `mythUpgradable` gives `crest`, `wrongStats` gives `stats`, `belowMyth` gives `vault`.
  - `inBags` and `missing` give `null`.
  - With `tracksKnown` false, every state gives `null`.
  - Every value in `ROW_TONE_STYLES` uses only `var(--color-…)` colors, so no hex returns.
- **By hand**, on the character page and the group page at 375 and 1440 px, with a character that has rows in several states:
  - Each toned state shows the fill and border above. Plain states show none.
  - The legend lists all six states.
  - In a grayscale view (DevTools "Emulate vision deficiencies", Achromatopsia), done, crests and Great Vault target borders read as three different lightnesses, and wrong stats reads as dashed.
