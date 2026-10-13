# Equipped Stat Pair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tier row whose piece fills the slot shows the equipped piece's real stat pair, which the Wowhead tooltip can't show for a catalysed piece.

**Architecture:** One shared helper, `equippedStatText(row)`, decides when a row has a pair and words it. `ItemCard` gains an optional `stats` line, which `GearTable` fills. `CellDetails` appends the pair to its track line. States, stat comparison and tooltips don't change.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Vitest (`environment: 'node'`, markup tests through `renderToStaticMarkup`).

**Spec:** `docs/superpowers/specs/2026-10-13-equipped-stat-pair-design.md` (read it first).

## Global Constraints

- **Out of scope:** unknown stats falling through to Done (#138), the compact group cell, any tooltip note, pairs on non-tier rows.
- **Pair wording:** always `statPairLabel` from `src/components/shared/stat-pair.ts` ("Crit/Haste", "no secondary stats"). No second label map.
- **Taller tier rows are intended:** a three-line `ItemCard` is about 80 px against today's 62 px minimum. Don't squeeze it back to two lines.
- **Components:** branching logic lives in a tested `.ts`; `.tsx` holds JSX. Import through `@/`, relative only inside a component's own directory.
- **Tests:** write the failing test first and watch it fail. Fixtures use made-up character names (Birkibjörn).
- **Commits:** subjects are `type: lowercase imperative`, with terse bodies that say why. No AI attribution, no `Co-Authored-By`, no mention of AI tools. Use the `commit` skill.
- **Gate before done:** `npm run typecheck && npm run lint && npm test`, plus a production build in a separate git worktree. Never build in the folder the owner's dev server (:3000) serves. Turbopack rejects a `node_modules` junction, so run `npm ci` in the worktree.

## Review Focus

1. **A tier row in Missing whose slot holds some other item with stats.** No pair may show; the stats belong to the wrong item. Pinned in Task 1, test "gives no pair when no tier piece fills the slot".
2. **Stats unknown (SimC paste with no Blizzard copy).** No pair, never an empty or "null" line. Pinned in Task 1, test "gives no pair while the stats are unknown".
3. **A piece with no secondary stats.** Shows "no secondary stats", not a blank line. Pinned in Task 1, test "words a piece with no secondary stats".
4. **Non-tier rows with stats.** No pair; their stats come with the item ID. Pinned in Task 1, test "gives no pair on non-tier rows", and in Tasks 2 and 3 markup tests.
5. **The pair cut off on the character page.** It must sit on its own line, not the truncating detail line. Pinned in Task 2, test "shows a tier row's pair on its own line", and checked by hand in Task 4.

---

### Task 1: The helper

**Files:**
- Create: `src/components/shared/equipped-stats.ts`
- Test: `src/components/shared/equipped-stats.test.ts`

**Interfaces:**
- Consumes: `GearRowView` from `@/server/views/types` (`bis: BisView`, `state: ItemState`, `equippedStats: string[] | null`), `statPairLabel(stats: readonly string[]): string` from `./stat-pair`.
- Produces: `equippedStatText(row: Pick<GearRowView, 'bis' | 'state' | 'equippedStats'>): string | null`.

- [ ] **Step 1: Write the failing test**

Create `src/components/shared/equipped-stats.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ItemState } from '@/core/types';
import type { BisView } from '@/server/views/types';
import { equippedStatText } from './equipped-stats';

const item = { itemId: 251223, name: 'Somber Spaulders', itemLevel: 334, quality: 'EPIC' as const, bonusIds: [], iconUrl: null, trackLabel: null };
const tierBis: BisView = { kind: 'item', ...item, isTier: true, isCatalyst: true, source: '', targetStats: ['CRIT_RATING', 'HASTE_RATING'], targetIsTierPiece: false };
const plainBis: BisView = { ...tierBis, isTier: false, isCatalyst: false };
const anyBis: BisView = { kind: 'any', minItemLevel: 330, source: '' };
const CRIT_HASTE = ['CRIT_RATING', 'HASTE_RATING'];
const row = (state: ItemState, equippedStats: string[] | null, bis: BisView = tierBis) => ({ bis, state, equippedStats });

describe('equippedStatText', () => {
  it('words the pair of a tier piece that fills the slot', () => {
    expect(equippedStatText(row('done', CRIT_HASTE))).toBe('Crit/Haste');
  });

  it('gives the pair in every filled state', () => {
    for (const state of ['wrongStats', 'mythUpgradable', 'belowMyth'] as const) expect(equippedStatText(row(state, CRIT_HASTE))).toBe('Crit/Haste');
  });

  it('gives no pair when no tier piece fills the slot', () => {
    expect(equippedStatText(row('missing', CRIT_HASTE))).toBeNull();
    expect(equippedStatText(row('inBags', CRIT_HASTE))).toBeNull();
  });

  it('gives no pair while the stats are unknown', () => {
    expect(equippedStatText(row('done', null))).toBeNull();
  });

  it('gives no pair on non-tier rows', () => {
    expect(equippedStatText(row('done', CRIT_HASTE, plainBis))).toBeNull();
    expect(equippedStatText(row('done', CRIT_HASTE, anyBis))).toBeNull();
  });

  it('words a piece with no secondary stats', () => {
    expect(equippedStatText(row('done', []))).toBe('no secondary stats');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/shared/equipped-stats.test.ts`
Expected: FAIL, cannot resolve `./equipped-stats`.

- [ ] **Step 3: Write the helper**

Create `src/components/shared/equipped-stats.ts`:

```ts
import type { GearRowView } from '@/server/views/types';
import { statPairLabel } from './stat-pair';

/**
 * The equipped tier piece's real stat pair, which the Wowhead tooltip can't show for a catalysed piece: the
 * catalyst keeps the input item's stats, and Wowhead shows the base item's. Null unless a tier piece fills a
 * tier row and its stats are known; Missing and BiS in bags rows show some other item, or none.
 */
export function equippedStatText(row: Pick<GearRowView, 'bis' | 'state' | 'equippedStats'>): string | null {
  if (row.bis.kind !== 'item' || !row.bis.isTier) return null;
  if (row.state === 'missing' || row.state === 'inBags' || row.equippedStats === null) return null;
  return statPairLabel(row.equippedStats);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/shared/equipped-stats.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/equipped-stats.ts src/components/shared/equipped-stats.test.ts
git commit -F - <<'EOF'
feat: word an equipped tier piece's stat pair

Catalysed piece keeps input stats; Wowhead tooltip shows base stats,
so the page needs its own source for the real pair.
EOF
```

### Task 2: Character page

**Files:**
- Modify: `src/components/item-card/ItemCard.tsx` (props and the text column)
- Modify: `src/components/character-page/GearTable.tsx` (the equipped `ItemCard`)
- Test: `src/components/character-page/GearTable.test.ts` (new `describe`)

**Interfaces:**
- Consumes: `equippedStatText` from `@/components/shared/equipped-stats` (Task 1).
- Produces: `ItemCardProps.stats?: string`, a third line under `detail`. Other `ItemCard` callers pass nothing.

- [ ] **Step 1: Write the failing test**

Append to `src/components/character-page/GearTable.test.ts`:

```ts
describe('GearTable equipped stats', () => {
  const tier: GearRowView = {
    ...row, equippedStats: ['CRIT_RATING', 'HASTE_RATING'],
    bis: { kind: 'item', ...equipped, isTier: true, isCatalyst: true, source: '', targetStats: ['CRIT_RATING', 'HASTE_RATING'], targetIsTierPiece: false },
  };

  it("shows a tier row's pair on its own line", () => {
    const html = render([tier], false);
    expect(html).toMatch(/<span class="[^"]*font-mono[^"]*">Crit\/Haste<\/span>/);
    expect(html).not.toContain('321 · Crit/Haste');
  });

  it('shows no pair on a non-tier row', () => {
    expect(render([{ ...row, equippedStats: ['CRIT_RATING', 'HASTE_RATING'] }], false)).not.toContain('Crit/Haste');
  });
});
```

`BisTarget` may print the target pair inside a longer string ("catalyst …, Crit/Haste"), never as a span holding only "Crit/Haste", so the first assertion matches only the new line. The non-tier fixture's BiS has `targetStats: null`, so it prints no pair at all.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/character-page/GearTable.test.ts`
Expected: FAIL on "shows a tier row's pair on its own line"; the other test passes already.

- [ ] **Step 3: Add the `stats` line to `ItemCard`**

In `src/components/item-card/ItemCard.tsx`, add to `ItemCardProps` after `detail?: string;`:

```ts
  /** A third line under the detail, such as a tier piece's real stat pair. Its own line, so the truncating detail can't cut it. */
  stats?: string;
```

Add `stats` to the destructured props:

```ts
export function ItemCard({ itemId, name, quality, iconUrl, bonusIds, itemLevel, detail, stats, wrap }: ItemCardProps) {
```

and render it after the detail line:

```tsx
        {detail && <Detail detail={detail} wrap={wrap} />}
        {stats && <span className={`${wrap ? 'wrap-anywhere' : 'truncate'} font-mono text-[13px] text-muted`}>{stats}</span>}
```

- [ ] **Step 4: Fill it in `GearTable`**

In `src/components/character-page/GearTable.tsx`, add the import beside the other shared imports:

```ts
import { equippedStatText } from '@/components/shared/equipped-stats';
```

and pass it to the equipped `ItemCard`, after its `detail` prop:

```tsx
              detail={[trackText(row.equipped.trackLabel), row.equipped.itemLevel].filter(Boolean).join(' · ')}
              stats={equippedStatText(row) ?? undefined} />
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/character-page/GearTable.test.ts`
Expected: PASS, all tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/item-card/ItemCard.tsx src/components/character-page/GearTable.tsx src/components/character-page/GearTable.test.ts
git commit -F - <<'EOF'
feat: show equipped tier stat pair on character page

Own card line: detail truncates at ~21 chars at 1440 px and would cut
the pair. Tier rows grow ~18 px, owner's choice.
EOF
```

### Task 3: Group cell details

**Files:**
- Modify: `src/components/cell-details/CellDetails.tsx` (the track line)
- Test: `src/components/cell-details/CellDetails.test.ts` (new)

**Interfaces:**
- Consumes: `equippedStatText` from `@/components/shared/equipped-stats` (Task 1).
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Create `src/components/cell-details/CellDetails.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GearRowView } from '@/server/views/types';
import { CellDetails } from './CellDetails';

const equipped = { itemId: 271526, name: 'Enigmatic Dreamwatcher’s Plumage', itemLevel: 334, quality: 'EPIC' as const, bonusIds: [12], iconUrl: null, trackLabel: 'Myth 6/6' };
const tier: GearRowView = {
  slotLabel: 'Shoulders', slot: 'SHOULDER', state: 'done', equipped, equippedStats: ['CRIT_RATING', 'HASTE_RATING'], upgrade: null,
  bis: { kind: 'item', ...equipped, isTier: true, isCatalyst: true, source: '', targetStats: ['CRIT_RATING', 'HASTE_RATING'], targetIsTierPiece: false },
};
const render = (cell: GearRowView) =>
  renderToStaticMarkup(createElement(CellDetails, { id: 'cell', tracksKnown: true, anchor: { current: null }, cell, slotLabel: 'Shoulders', character: null, memberName: 'Birkibjörn' }));

describe('CellDetails', () => {
  it("adds a tier piece's stat pair after the item level", () => {
    expect(render(tier)).toContain(' · Crit/Haste');
  });

  it('adds no pair for a non-tier row', () => {
    const plain: GearRowView = { ...tier, bis: { ...tier.bis, isTier: false, isCatalyst: false, targetStats: null } as GearRowView['bis'] };
    expect(render(plain)).not.toContain('Crit/Haste');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/cell-details/CellDetails.test.ts`
Expected: FAIL on "adds a tier piece's stat pair after the item level"; the non-tier test passes already.

- [ ] **Step 3: Append the pair**

In `src/components/cell-details/CellDetails.tsx`, add the import beside the other shared imports:

```ts
import { equippedStatText } from '@/components/shared/equipped-stats';
```

After `const track = trackDisplay(...)`, add:

```ts
  const stats = equippedStatText(cell);
```

and change the track line to:

```tsx
            <span className="font-mono text-[13px] text-muted" title={track.hint}>
              <span className={track.className}>{track.text}</span>{eq.itemLevel ? ` · ${eq.itemLevel}` : ''}{stats ? ` · ${stats}` : ''}
            </span>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/cell-details/CellDetails.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/cell-details/CellDetails.tsx src/components/cell-details/CellDetails.test.ts
git commit -F - <<'EOF'
feat: show equipped tier stat pair in group cell details

Same reason as character page; compact cell has no room, details
card does.
EOF
```

### Task 4: Gate and hand checks

**Files:** none changed unless a check fails.

- [ ] **Step 1: Full gate**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all clean.

- [ ] **Step 2: Build in a separate worktree**

```bash
git worktree add ../wgt-pair-build HEAD --detach
cd ../wgt-pair-build && npm ci && npm run build
cd ../wow-gear-tracker && git worktree remove --force ../wgt-pair-build
```

Expected: clean build. Delete any leftover `../wgt-pair-build` folder.

- [ ] **Step 3: Hand checks**, on a character with a catalysed tier piece, at 375, 1024 and 1440 px (record in the pull request's Testing section; the owner runs them if Claude can't):
  - Character page: the tier row shows the whole pair on its own line, uncut, matching the game. Only tier rows with a pair are taller, and the table still lines up.
  - Group page: the cell details show "Myth 6/6 · 334 · Crit/Haste" (or that piece's pair) on the track line.
  - A non-tier row and a Missing tier row show no pair.
