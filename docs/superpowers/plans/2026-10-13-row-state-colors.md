# Row State Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every state where the BiS item is equipped gets a row fill and border in its badge's color, with lightness steps and a dashed border so the states read apart without hue.

**Architecture:** `rowTone` in `src/components/shared/row-tone.ts` stays the one place that maps a state to a tone, and `ROW_TONE_STYLES` the one place that styles it. Both callers, `GearTable` and `GroupCell`, need no change. Six new color tokens go in `src/app/globals.css`. The legend gains its missing Wrong stats entry.

**Tech Stack:** Next.js 16, React 19, Tailwind v4 `@theme` tokens, Vitest (`environment: 'node'`).

**Spec:** `docs/superpowers/specs/2026-10-13-row-state-colors-design.md` (read it first).

## Global Constraints

- **Tokens:** colors live in `src/app/globals.css` `@theme`. `row-tone.ts` holds no hex values, only `var(--color-…)` references.
- **Literal token names:** write each `var(--color-…)` name out in full in `row-tone.ts`. Tailwind v4 emits a theme variable only when its scanner finds the literal name in a source file; a name built with a template string is never emitted, and the row renders plain.
- **Borders sit inside the element:** every tone uses `outline` with `outlineOffset: '-2px'`. No `boxShadow`.
- **Out of scope:** badge text colors and wording, the green upgrade arrow, `stateFor` in `src/core/gear/evaluate.ts`, and the character card bar.
- **Tests:** write the failing test first and watch it fail.
- **Commits:** subjects are `type: lowercase imperative`, with terse bodies that say why. No AI attribution, no `Co-Authored-By`, no mention of AI tools. Use the `commit` skill.
- **Gate before done:** `npm run typecheck && npm run lint && npm test`, plus `npm run build`. Never build in the folder the owner's dev server (:3000) serves; use a separate git worktree or stop dev first.

## Review Focus

1. **Upgrade track data unavailable.** No state may be toned, including the new `belowMyth` tone. Pinned in Task 1, test "shows no tone for any state while track data is unavailable".
2. **A mistyped token name.** The browser drops the declaration and the row renders plain with no error. Pinned in Task 1, test "declares every token it uses in globals.css".
3. **A hex color slipping back into `ROW_TONE_STYLES`.** Pinned in Task 1, test "uses only theme tokens".
4. **An outer ring returning.** On the 375 px group grid, cells are 3 px apart, so an outer `boxShadow` makes toned neighbours overlap. Pinned in Task 1, test "draws every border inside the element", and checked by hand in Task 3.
5. **Legend order drifting from the card bar.** The bar's segments have no words, so order is the only cue for color-blind players. Pinned in Task 2, test "lists the states in card-bar order".

---

### Task 1: Tones and tokens

**Files:**
- Modify: `src/components/shared/row-tone.ts` (whole file)
- Modify: `src/app/globals.css` (the `--color-gold-soft` group in `@theme`)
- Test: `src/components/shared/row-tone.test.ts` (whole file)

**Interfaces:**
- Consumes: `ItemState` from `@/core/types` (`'missing' | 'inBags' | 'wrongStats' | 'belowMyth' | 'mythUpgradable' | 'done'`) and `ITEM_STATES`.
- Produces: `type RowTone = 'gold' | 'crest' | 'stats' | 'vault'`, `rowTone(state: ItemState, tracksKnown: boolean): RowTone | null` and `ROW_TONE_STYLES: Record<RowTone, CSSProperties>`. Signatures unchanged; callers `GearTable.tsx` and `GroupCell.tsx` stay as they are.

- [ ] **Step 1: Write the failing test**

Replace `src/components/shared/row-tone.test.ts` with:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ITEM_STATES } from '@/core/types';
import { ROW_TONE_STYLES, rowTone } from './row-tone';

const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
const styleText = Object.values(ROW_TONE_STYLES).flatMap((style) => Object.values(style).map(String)).join(' ');

describe('rowTone', () => {
  it('tones every state where the BiS item is equipped', () => {
    expect(rowTone('done', true)).toBe('gold');
    expect(rowTone('mythUpgradable', true)).toBe('crest');
    expect(rowTone('wrongStats', true)).toBe('stats');
    expect(rowTone('belowMyth', true)).toBe('vault');
  });

  it('leaves states without the BiS item equipped plain', () => {
    expect(rowTone('inBags', true)).toBeNull();
    expect(rowTone('missing', true)).toBeNull();
  });

  it('shows no tone for any state while track data is unavailable', () => {
    for (const state of ITEM_STATES) expect(rowTone(state, false)).toBeNull();
  });
});

describe('ROW_TONE_STYLES', () => {
  it('uses only theme tokens', () => {
    expect(styleText).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('declares every token it uses in globals.css', () => {
    const names = [...styleText.matchAll(/var\((--color-[\w-]+)\)/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(css).toContain(`${name}:`);
  });

  it('draws every border inside the element', () => {
    for (const style of Object.values(ROW_TONE_STYLES)) {
      expect(style.boxShadow).toBeUndefined();
      expect(style.outlineOffset).toBe('-2px');
    }
  });

  it('dashes only the wrong-stats border', () => {
    expect(ROW_TONE_STYLES.stats.outline).toContain('dashed');
    for (const tone of ['gold', 'crest', 'vault'] as const) expect(ROW_TONE_STYLES[tone].outline).toContain('solid');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/shared/row-tone.test.ts`
Expected: FAIL. `mythUpgradable` gives `green`, `belowMyth` gives `null`, a hex match, undeclared tokens absent (only `--color-gold` is used today), and `boxShadow` defined.

- [ ] **Step 3: Add the tokens**

In `src/app/globals.css`, after `--color-gold-wash-line: #4d4128;`, add:

```css
  /* Row tones for equipped-BiS states: a dark fill and a border per badge color. Border lightness steps down from gold to crest to vault. */
  --color-crest-soft: #251d33;
  --color-crest-line: #a585d6;
  --color-stats-soft: #2e1a25;
  --color-stats-line: #d07aa6;
  --color-vault-soft: #16222f;
  --color-vault-line: #4270a0;
```

- [ ] **Step 4: Rewrite `row-tone.ts`**

Replace `src/components/shared/row-tone.ts` with:

```ts
import type { CSSProperties } from 'react';
import type { ItemState } from '@/core/types';

export type RowTone = 'gold' | 'crest' | 'stats' | 'vault';

/** Every state where the BiS item is equipped gets its badge's color; bags and missing stay plain. */
const TONES: Record<ItemState, RowTone | null> = {
  done: 'gold',
  mythUpgradable: 'crest',
  wrongStats: 'stats',
  belowMyth: 'vault',
  inBags: null,
  missing: null,
};

/** No highlight while track data is unavailable, since states can't be trusted then. */
export function rowTone(state: ItemState, tracksKnown: boolean): RowTone | null {
  return tracksKnown ? TONES[state] : null;
}

// Border lightness steps down gold > crest > vault so the tones read apart in grayscale; stats matches crest's
// lightness and differs in shape, a dashed border. The outline sits inside the element, so toned neighbours
// on the 3 px mobile grid gap never overlap. Token names stay literal so Tailwind emits them.
export const ROW_TONE_STYLES: Record<RowTone, CSSProperties> = {
  gold: { background: 'var(--color-gold-soft)', outline: '2px solid var(--color-gold)', outlineOffset: '-2px' },
  crest: { background: 'var(--color-crest-soft)', outline: '2px solid var(--color-crest-line)', outlineOffset: '-2px' },
  stats: { background: 'var(--color-stats-soft)', outline: '2px dashed var(--color-stats-line)', outlineOffset: '-2px' },
  vault: { background: 'var(--color-vault-soft)', outline: '2px solid var(--color-vault-line)', outlineOffset: '-2px' },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/shared/row-tone.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: clean. Nothing else referenced the `green` tone.

- [ ] **Step 7: Commit**

```bash
git add src/components/shared/row-tone.ts src/components/shared/row-tone.test.ts src/app/globals.css
git commit -F - <<'EOF'
feat: tone every equipped-bis row in its badge color

Great Vault target rows showed plain; crests and wrong-stats rows
disagreed with their badges. Inset outline: outer ring overlapped
toned neighbours on the 3 px mobile grid gap.
EOF
```

### Task 2: Legend entry

**Files:**
- Modify: `src/components/state-legend/StateLegend.tsx:1-7`
- Test: `src/components/state-legend/StateLegend.test.ts` (new)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `StateLegend` unchanged in signature; `LEGEND` gains an entry.

- [ ] **Step 1: Write the failing test**

Create `src/components/state-legend/StateLegend.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StateLegend } from './StateLegend';

describe('StateLegend', () => {
  it('lists the states in card-bar order', () => {
    const html = renderToStaticMarkup(createElement(StateLegend));
    const labels = ['Done: Myth max', 'Upgrade with crests', 'Great Vault target', 'Wrong stats', 'BiS in bags', 'Missing'];
    const positions = labels.map((label) => html.indexOf(label));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('keys wrong stats with the card bar color', () => {
    expect(renderToStaticMarkup(createElement(StateLegend))).toMatch(/bg-stats[^>]*><\/span>Wrong stats/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/state-legend/StateLegend.test.ts`
Expected: FAIL. "Wrong stats" is missing, so its position is -1.

- [ ] **Step 3: Add the entry**

In `src/components/state-legend/StateLegend.tsx`, change `LEGEND` to:

```ts
const LEGEND = [
  ['bg-gold', 'Done: Myth max'],
  ['bg-crest', 'Upgrade with crests'],
  ['bg-vault', 'Great Vault target'],
  // After vault, matching the character card bar's segment order: the bar has no words, so order maps it here.
  ['bg-stats', 'Wrong stats'],
  ['bg-bags', 'BiS in bags'],
  ['bg-missing', 'Missing'],
] as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/state-legend/StateLegend.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/state-legend/StateLegend.tsx src/components/state-legend/StateLegend.test.ts
git commit -F - <<'EOF'
feat: add wrong stats to state legend

Card bar already draws a stats segment the legend never named. Placed
after vault to match bar order.
EOF
```

### Task 3: Gate and hand checks

**Files:** none changed unless a check fails.

- [ ] **Step 1: Full gate**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all clean.

- [ ] **Step 2: Build**

Run `npm run build` in a separate git worktree, or after stopping dev on :3000. Expected: clean. Restart dev afterwards if stopped.

- [ ] **Step 3: Hand checks**, at 375 and 1440 px, with a character that has rows in several states (record results in the pull request's Testing section):
  - Character page and group page: done gold, crests purple, wrong stats pink dashed, Great Vault target blue. BiS in bags and missing plain.
  - Group page at 375 px: two toned cells side by side and above each other keep separate borders.
  - Home and group pages: legend lists six states in order Done, Upgrade with crests, Great Vault target, Wrong stats, BiS in bags, Missing. On home, the Wrong stats swatch matches the card bar's pink segment.
  - DevTools Rendering, "Emulate vision deficiencies", Achromatopsia: done, crests and Great Vault target borders read as three lightnesses; wrong stats reads as dashed.
  - In DevTools, the six new `--color-*` variables resolve on `:root` (Tailwind emitted them).
