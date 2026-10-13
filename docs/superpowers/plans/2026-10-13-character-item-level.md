# Character Item Level Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every character with gear shows its equipped item level, cut to one decimal, on its home-page card, its character page and its group member header.

**Architecture:** One pure function in `src/core/gear/item-level.ts` computes the number from equipped gear. `summarize` puts it on `CharacterSummary`, so all three loaders carry it with no other change. Three components render it. No schema change, no migration, no sync change.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Vitest (`environment: 'node'`, markup tests through `renderToStaticMarkup`), in-memory SQLite through `openTestDb()`.

**Spec:** `docs/superpowers/specs/2026-10-13-character-item-level-design.md` (read it first; review passed at 8336a71).

## Global Constraints

- **Weapon rule:** 16 slots from `SLOT_TYPES`; an empty slot counts 0; when `OFF_HAND` is empty and `MAIN_HAND` is filled, the main hand counts twice.
- **Accepted gaps, documented in a code comment, not fixed:** a lone one-hander also counts twice (overstates by main-hand ilvl / 16, e.g. 330.0 where the game shows 309.3); a Fury warrior's two two-handers each count once. Fixing either needs the weapon's inventory type, a schema change out of scope.
- **Cut, never round:** `Math.floor(avg * 10) / 10`.
- **Null:** no equipped items, or any equipped item with `itemLevel === null`. Nothing renders for null: no label, no empty line.
- **Display:** `toFixed(1)` (334 shows "334.0"), number in `font-mono`, words beside it. Character page and card: "Item level 334.6". Group header: "334.6 ilvl", `text-xs`, `title="Equipped item level"`, visible at every width (never inside the `sr-only` name).
- **Parity oracle:** the game's `/run local _,e=GetAverageItemLevel(); print(e, math.floor(e*10)/10)`; its second number must equal the page's on supported weapon setups. A mismatch is a defect that sends the spec back before merge.
- **Out of scope:** Blizzard's `equipped_item_level`, item level history, sorting by item level.
- **Rules:** pure logic in `src/core` (no `react`, `next`, DB). Failing test first. Fixtures use made-up names (Birkibjörn). Commits `type: lowercase imperative`, terse why-body, no AI attribution or mention. Gate: `npm run typecheck && npm run lint && npm test`, plus a production build in a separate git worktree with its own `npm ci` (never in the folder the :3000 dev server serves).

## Review Focus

1. **Unequal two-hander.** A uniform-level fixture can't tell "counted twice over 16" from "once over 15". Pinned in Task 1, test "counts a two-hander in both weapon slots".
2. **A SimC paste with unknown item levels.** Must give no number, never a low one. Pinned in Task 1, test "gives no number when any item level is unknown".
3. **Rounding up across a decimal.** 334.66 must show 334.6. Pinned in Task 1, test "cuts to one decimal, never rounds up".
4. **"undefined" or "null" in markup** when a view lacks the number. Pinned in Tasks 3 and 4 null-case markup tests; fixtures carry `itemLevel: null` explicitly.
5. **Group header on mobile.** The name is `sr-only` below `sm`; the number must be a visible sibling. Pinned in Task 4 test "shows the item level outside the screen-reader-only name", and checked by hand at 375 px.

---

### Task 1: The number

**Files:**
- Create: `src/core/gear/item-level.ts`
- Test: `src/core/gear/item-level.test.ts`

**Interfaces:**
- Consumes: `GearItem`, `SLOT_TYPES`, `SlotType` from `../types` (`GearItem.itemLevel: number | null`, `GearItem.slot: SlotType`).
- Produces: `equippedItemLevel(equipped: readonly GearItem[]): number | null`.

- [ ] **Step 1: Write the failing test**

Create `src/core/gear/item-level.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SLOT_TYPES, type GearItem, type SlotType } from '../types';
import { equippedItemLevel } from './item-level';

const item = (slot: SlotType, itemLevel: number | null): GearItem =>
  ({ slot, itemId: 1, name: 'Piece', itemLevel, quality: 'EPIC', bonusIds: [], isTier: false });
const ARMOR = SLOT_TYPES.filter((s) => s !== 'MAIN_HAND' && s !== 'OFF_HAND');
const set = (level: number, slots: readonly SlotType[] = SLOT_TYPES) => slots.map((s) => item(s, level));

describe('equippedItemLevel', () => {
  it('averages a full set', () => {
    expect(equippedItemLevel(set(330))).toBe(330);
  });

  it('cuts to one decimal, never rounds up', () => {
    // 15 at 334 and one at 345: 5355 / 16 = 334.6875, shown 334.6.
    expect(equippedItemLevel([...set(334, SLOT_TYPES.slice(0, 15)), item('OFF_HAND', 345)])).toBe(334.6);
  });

  it('counts an empty slot as 0', () => {
    // 15 at 320, no HEAD: 4800 / 16 = 300.
    expect(equippedItemLevel(set(320, SLOT_TYPES.filter((s) => s !== 'HEAD')))).toBe(300);
  });

  it('counts a two-hander in both weapon slots', () => {
    // (14 × 330 + 2 × 346) / 16 = 332, not (14 × 330 + 346) / 15 = 331.
    expect(equippedItemLevel([...set(330, ARMOR), item('MAIN_HAND', 346)])).toBe(332);
  });

  it('counts each weapon once when both hands are filled', () => {
    // (14 × 330 + 346 + 314) / 16 = 330.
    expect(equippedItemLevel([...set(330, ARMOR), item('MAIN_HAND', 346), item('OFF_HAND', 314)])).toBe(330);
  });

  it('counts a lone one-hander twice too, the documented gap', () => {
    // The game shows 309.3 here: it can't be told from a two-hander without the inventory type.
    expect(equippedItemLevel([...set(330, ARMOR), item('MAIN_HAND', 330)])).toBe(330);
  });

  it('gives no number when any item level is unknown', () => {
    expect(equippedItemLevel([...set(330, SLOT_TYPES.slice(0, 15)), item('OFF_HAND', null)])).toBeNull();
  });

  it('gives no number without gear', () => {
    expect(equippedItemLevel([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/gear/item-level.test.ts`
Expected: FAIL, cannot resolve `./item-level`.

- [ ] **Step 3: Write the function**

Create `src/core/gear/item-level.ts`:

```ts
import { SLOT_TYPES, type GearItem, type SlotType } from '../types';

/**
 * The equipped item level the game shows, cut to one decimal: the 16 slots averaged, an empty slot counting 0.
 * Null without gear, or when any item's level is unknown, since a wrong number is worse than none.
 */
export function equippedItemLevel(equipped: readonly GearItem[]): number | null {
  if (equipped.length === 0 || equipped.some((g) => g.itemLevel === null)) return null;
  const level = new Map<SlotType, number>(equipped.map((g) => [g.slot, g.itemLevel ?? 0]));
  // The game counts a two-hander in both weapon slots. ponytail: GearItem has no inventory type, so a lone
  // one-hander counts twice too (overstates by its level / 16), and a Fury warrior's two two-handers each count
  // once. Storing the weapon's inventory type fixes both.
  const offHand = level.get('OFF_HAND') ?? level.get('MAIN_HAND') ?? 0;
  const sum = SLOT_TYPES.reduce((total, slot) => total + (slot === 'OFF_HAND' ? offHand : level.get(slot) ?? 0), 0);
  // sum / 16 has at most four binary fraction digits, so × 10 is exact and the floor never slips a step.
  return Math.floor((sum / SLOT_TYPES.length) * 10) / 10;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/gear/item-level.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/gear/item-level.ts src/core/gear/item-level.test.ts
git commit -F - <<'EOF'
feat: compute equipped item level from gear

From stored gear, not Blizzard's field: no migration, and SimC
pastes update it at once. Lone one-hander counts twice: no
inventory type stored.
EOF
```

### Task 2: On the summary

**Files:**
- Modify: `src/server/views/types.ts` (`CharacterSummary`)
- Modify: `src/server/views/summarize.ts` (`summarize`)
- Modify (fixtures only): `src/components/character-card/CharacterCard.test.ts`, `src/components/group-grid/GroupGrid.test.ts`, `src/components/character-page/CharacterHeader.test.ts`
- Test: `src/server/views/views.test.ts` (new `describe`)

**Interfaces:**
- Consumes: `equippedItemLevel` (Task 1), `equippedGear(snapshot: Snapshot): GearItem[]` from `@/core/db/queries/snapshots` (already imported in `summarize.ts`).
- Produces: `CharacterSummary.itemLevel: number | null`, inherited by `CharacterCardView` and `CharacterPageView`, and reached on the group page as `GroupMemberView.character.itemLevel`.

- [ ] **Step 1: Write the failing test**

Append to `src/server/views/views.test.ts`. The seeded `gear` is HEAD 321 and NECK 318, every other slot empty: (321 + 318) / 16 = 39.9375, shown 39.9.

```ts
describe('item level', () => {
  it('puts the equipped item level on the page and the card', async () => {
    const s = await services();
    await seed(s);
    await prime(s);
    expect((await birkiPage(s)).itemLevel).toBe(39.9);
    const { cards: [card] } = await getCharacterCards(s);
    expect(card!.itemLevel).toBe(39.9);
  });

  it('gives no item level without gear', async () => {
    const s = await services();
    await seed(s, false);
    await prime(s);
    const { cards: [card] } = await getCharacterCards(s);
    expect(card!.itemLevel).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/views/views.test.ts -t "item level"`
Expected: FAIL, `itemLevel` is `undefined`.

- [ ] **Step 3: Add the field and fill it**

In `src/server/views/types.ts`, in `CharacterSummary`, after `identity`:

```ts
  /** Equipped item level cut to one decimal, from the current snapshot; null without gear or with an unknown item level. */
  itemLevel: number | null;
```

In `src/server/views/summarize.ts`, add the import beside the other `@/core/gear` imports:

```ts
import { equippedItemLevel } from '@/core/gear/item-level';
```

and in `summarize`'s returned object, after `identity: identityLine(...)`:

```ts
    itemLevel: snapshot ? equippedItemLevel(equippedGear(snapshot)) : null,
```

- [ ] **Step 4: Add the field to typed fixtures**

`npm run typecheck` now fails on the two fixtures typed as summaries. Add `itemLevel: null` to:
- `card(...)` in `src/components/character-card/CharacterCard.test.ts`, after `identity: 'Guardian Druid',`
- `summary(...)` in `src/components/group-grid/GroupGrid.test.ts`, after `identity: 'Guardian Druid',`

And to the `view` object in `src/components/character-page/CharacterHeader.test.ts` (it's cast, so typecheck won't flag it), after `specIconUrl: 'https://render/guardian.jpg',`.

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/server/views/views.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/server/views/types.ts src/server/views/summarize.ts src/server/views/views.test.ts src/components/character-card/CharacterCard.test.ts src/components/group-grid/GroupGrid.test.ts src/components/character-page/CharacterHeader.test.ts
git commit -F - <<'EOF'
feat: carry item level on character summary

summarize already has the current snapshot, so all three pages get
it with no loader change.
EOF
```

### Task 3: Character page and card

**Files:**
- Modify: `src/components/character-page/CharacterHeader.tsx` (identity block)
- Modify: `src/components/character-card/CharacterCard.tsx` (identity block)
- Test: `src/components/character-page/CharacterHeader.test.ts`, `src/components/character-card/CharacterCard.test.ts`

**Interfaces:**
- Consumes: `CharacterSummary.itemLevel` (Task 2).
- Produces: nothing new.

- [ ] **Step 1: Write the failing tests**

Append inside `describe('CharacterHeader', ...)` in `src/components/character-page/CharacterHeader.test.ts`:

```ts
  it('shows the item level under the spec', () => {
    const html = renderToStaticMarkup(createElement(CharacterHeader, { view: { ...view, itemLevel: 334.6 }, now: 0 }));
    expect(html).toContain('Item level <span class="font-mono">334.6</span>');
    expect(html.indexOf('Troll Guardian Druid')).toBeLessThan(html.indexOf('Item level'));
  });

  it('shows no item level when unknown', () => {
    expect(renderToStaticMarkup(createElement(CharacterHeader, { view, now: 0 }))).not.toContain('Item level');
  });
```

Append to `src/components/character-card/CharacterCard.test.ts`:

```ts
describe('CharacterCard item level', () => {
  it('shows the item level with one decimal', () => {
    expect(render(card({ itemLevel: 334 }))).toContain('Item level <span class="font-mono">334.0</span>');
  });

  it('shows no item level when unknown', () => {
    expect(render(card({}))).not.toContain('Item level');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/character-page/CharacterHeader.test.ts src/components/character-card/CharacterCard.test.ts`
Expected: FAIL on the two "shows the item level" tests; the null tests pass already.

- [ ] **Step 3: Render the line**

In `src/components/character-page/CharacterHeader.tsx`, after the spec line's closing `</span>` (the one holding `{view.identity}`), inside the same `flex flex-col` div:

```tsx
          {view.itemLevel !== null && <span className="text-muted">Item level <span className="font-mono">{view.itemLevel.toFixed(1)}</span></span>}
```

In `src/components/character-card/CharacterCard.tsx`, after `<span className="text-[15px] font-semibold" style={{ color }}>{card.identity}</span>`:

```tsx
          {card.itemLevel !== null && <span className="text-[15px] text-muted">Item level <span className="font-mono">{card.itemLevel.toFixed(1)}</span></span>}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/character-page/CharacterHeader.test.ts src/components/character-card/CharacterCard.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/character-page/CharacterHeader.tsx src/components/character-page/CharacterHeader.test.ts src/components/character-card/CharacterCard.tsx src/components/character-card/CharacterCard.test.ts
git commit -m "feat: show item level on character page and card"
```

### Task 4: Group member header

**Files:**
- Modify: `src/components/group-grid/MemberHeader.tsx`
- Test: `src/components/group-grid/GroupGrid.test.ts` (new `describe`; `MemberHeader` renders through `GroupGrid`)

**Interfaces:**
- Consumes: `GroupMemberView.character.itemLevel` (Task 2).
- Produces: nothing new.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/group-grid/GroupGrid.test.ts`:

```ts
describe('GroupGrid item level', () => {
  it('shows the item level outside the screen-reader-only name', () => {
    const html = render([member({ character: { ...summary(3, 'Birkibjörn'), itemLevel: 334.6 } })], []);
    expect(html).toMatch(/<span class="[^"]*font-mono[^"]*" title="Equipped item level">334\.6 ilvl<\/span>/);
    expect(html).not.toMatch(/sr-only[^>]*>[^<]*334\.6/);
  });

  it('shows no item level when unknown', () => {
    expect(render([member({ character: summary(3, 'Birkibjörn') })], [])).not.toContain('ilvl');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/group-grid/GroupGrid.test.ts`
Expected: FAIL on "shows the item level outside the screen-reader-only name".

- [ ] **Step 3: Render it**

In `src/components/group-grid/MemberHeader.tsx`, after the closing `</Link>` of the avatar-and-name link:

```tsx
      {c.itemLevel !== null && <span className="font-mono text-xs text-muted" title="Equipped item level">{`${c.itemLevel.toFixed(1)} ilvl`}</span>}
```

The template string keeps "334.6 ilvl" one text node; `{n} ilvl` would put a `<!-- -->` between them.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/group-grid/GroupGrid.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/group-grid/MemberHeader.tsx src/components/group-grid/GroupGrid.test.ts
git commit -m "feat: show item level in group member header"
```

### Task 5: Gate, build and hand checks

**Files:** none changed unless a check fails.

- [ ] **Step 1: Full gate**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all clean.

- [ ] **Step 2: Build in a separate worktree**

```bash
git worktree add ../wgt-ilvl-build HEAD --detach
cd ../wgt-ilvl-build && npm ci && npm run build
cd ../wow-gear-tracker && git worktree remove --force ../wgt-ilvl-build
```

Expected: clean build. Delete any leftover `../wgt-ilvl-build` folder.

- [ ] **Step 3: Hand checks** (record in the pull request's Testing section; the owner runs the game checks):
  - At 375, 1024 and 1440 px: the number shows on the home-page card, the character page header and the group member header; at 375 px the group header shows it although the name is hidden; group headers line up.
  - Game parity: in game, `/run local _,e=GetAverageItemLevel(); print(e, math.floor(e*10)/10)`. Its second number equals the page's, for a character synced from Blizzard and for one after a SimC paste. Record the game build and weapon setup (two-hander, two one-handers, or one-hander plus off-hand). A mismatch on one of those setups is a defect: stop and send the spec back.
