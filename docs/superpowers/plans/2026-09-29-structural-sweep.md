# Structural Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring every component and the three oversized backend modules into line with the `Splitting code` rules in `AGENTS.md`, with no behavior change.

**Architecture:** Three phases in order: move all fifteen components into kebab-case directories (pure `git mv`), extract the parts inside those directories (two new pure functions under test, a search hook, sub-components, and the character page's sections), then split `db/queries.ts`, `server/views.ts` and `blizzard/client.ts` into directories of focused modules. No barrels: importers point at the module they use.

**Tech Stack:** TypeScript, React 19, Next.js 16 App Router, Drizzle over libsql, Vitest 5 in a Node environment.

**Spec:** `docs/superpowers/specs/2026-09-28-component-and-module-split-design.md` (PR 2)

## Global Constraints

- **No behavior changes.** Same markup, same requests, same copy. Anything that changes what a user sees is a defect in this PR.
- Names and signatures of every exported function stay the same, except the two pure extractions in Tasks 2 and 3, which are new. Only import paths change.
- **No barrels.** No `index.ts` that re-exports a directory. Importers name the module they use.
- Components live at `src/components/<kebab-dir>/<PascalName>.tsx`. Cross-component imports use `@/components/...`; imports inside one directory use `./`.
- Tests are `src/**/*.test.ts`, never `.tsx`, in a Node environment with no DOM. A hook or a component using hooks cannot be tested here; only pure `.ts` files get new tests.
- New fixtures use made-up names (`Testbear`), never real players' names.
- Use `git mv` for every move, so `git log --follow` keeps each file's history.
- **Never run `npm run build` while a `next dev` server is serving this directory.** Both write to `.next`, and during PR 1 this wedged the dev server's worker pool. Stop dev first, or verify with `npx next start -p 3001` after a build.
- `npm run lint` reports unused imports as warnings, not errors. After every move, `npx eslint <the new files>` must print nothing.
- Commit subjects are Conventional Commits, lowercase and imperative. No AI attribution in any commit.
- **One commit per task, in phase order** — moves (Task 1), extractions (Tasks 2–6), backend (Tasks 7–9). The spec asked for three commits so the moves could be read apart from the extractions and a bisect would land on one phase. Finer commits keep both properties and make the bisect finer, and PR 1 showed this repo merges pull requests with their commits intact.
- Before calling the work done: `npm run typecheck && npm run lint && npm test && npm run build`.

## Review Focus

- **A shared write lock silently becoming one lock per module.** If each `queries/` module got its own `WeakMap`, writes from two modules would stop serializing and parallel refreshes would collide. The existing `concurrent writes` test writes to three future modules at once; Task 7 proves it fails when the lock is split, before trusting it.
- **The character page rendering differently after it is cut into sections.** Task 6 captures the page's HTML before and after from a production server and diffs them with ages normalized. The diff must be empty.
- **The search bar's behavior drifting when its state moves into a hook** — the 300 ms debounce, closing on an outside click or Escape, and the manual realm fallback. No DOM test can see these, so Task 10 checks each by hand.
- **The Blizzard token no longer being invalidated on a 401** once the token cache moves to its own module. `client.test.ts` already covers this and must pass with no edits at all; an edit it needs is a behavior change.
- **A stale path left in documentation.** `AGENTS.md` names `src/core/db/queries.ts` and `src/server/views.ts`. Tasks 7 and 8 update them, and Task 10 greps for every old path.

---

### Task 1: Every component into a directory

**Files:**
- Move: all fifteen `src/components/*.tsx`, plus `class-colors.ts`, `row-tone.ts`, `row-tone.test.ts`, `ItemCard.test.ts`
- Create: `src/components/character-avatar/CharacterAvatar.test.ts`, `src/components/faction-badge/FactionBadge.test.ts`
- Delete: `src/components/identity-components.test.ts`
- Modify: every importer (found by the script below), `AGENTS.md`

**Interfaces:**
- Produces: the directory paths every later task uses, e.g. `@/components/item-card/ItemCard`, `@/components/shared/class-colors`, `@/components/shared/row-tone`.

- [ ] **Step 1: Move the components**

Run from the repository root, in Git Bash:

```bash
set -e
PAIRS="add-character-bar:AddCharacterBar character-avatar:CharacterAvatar character-card:CharacterCard character-settings:CharacterSettings crest-summary:CrestSummary faction-badge:FactionBadge item-card:ItemCard refresh-button:RefreshButton remove-character-button:RemoveCharacterButton setup-notice:SetupNotice simc-paste:SimcPaste stale-sync:StaleSync state-badge:StateBadge upgrade-badge:UpgradeBadge wowhead-refresh:WowheadRefresh"
for pair in $PAIRS; do
  dir=${pair%%:*}; name=${pair##*:}
  mkdir -p "src/components/$dir"
  git mv "src/components/$name.tsx" "src/components/$dir/$name.tsx"
done
git mv src/components/ItemCard.test.ts src/components/item-card/ItemCard.test.ts
git mv src/components/class-colors.ts src/components/shared/class-colors.ts
git mv src/components/row-tone.ts src/components/shared/row-tone.ts
git mv src/components/row-tone.test.ts src/components/shared/row-tone.test.ts
```

- [ ] **Step 2: Rewrite the imports**

`@/components/Name` becomes `@/components/dir/Name` everywhere. Inside component source files, `./Name` becomes `@/components/dir/Name`, because the importer now sits in a different directory. Test files are excluded from the `./` rule: each test moved beside its component, so its `./` import is still right.

```bash
for pair in $PAIRS; do
  dir=${pair%%:*}; name=${pair##*:}
  grep -rl --include='*.ts' --include='*.tsx' "'@/components/$name'" src | xargs -r sed -i "s#'@/components/$name'#'@/components/$dir/$name'#g"
  grep -rl --include='*.tsx' "'\./$name'" src/components | xargs -r sed -i "s#'\./$name'#'@/components/$dir/$name'#g"
done
for helper in class-colors row-tone; do
  grep -rl --include='*.ts' --include='*.tsx' "'@/components/$helper'" src | xargs -r sed -i "s#'@/components/$helper'#'@/components/shared/$helper'#g"
  grep -rl --include='*.tsx' "'\./$helper'" src/components | xargs -r sed -i "s#'\./$helper'#'@/components/shared/$helper'#g"
done
```

- [ ] **Step 3: Split the identity test**

The old file covered two components. Each half moves beside its own component, with its own copy of the `render` helper — three lines, not worth a shared utility.

Create `src/components/character-avatar/CharacterAvatar.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CharacterAvatar } from './CharacterAvatar';

// React 19 hoists <link rel="preload"> tags for images ahead of the markup.
const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/<link[^>]*\/>/g, '');
const base = { name: 'Testbear', className: 'Druid', size: 52 };

describe('CharacterAvatar', () => {
  it('shows the avatar in a class-colored ring', () => {
    const html = render(createElement(CharacterAvatar, { ...base, avatarUrl: 'https://render/a.jpg', classIconUrl: 'https://i/druid.jpg' }));
    expect(html).toContain('src="https://render/a.jpg"');
    expect(html).toContain('border-color:#FF7C0A');
  });

  it('falls back to the class icon, then to the initial', () => {
    expect(render(createElement(CharacterAvatar, { ...base, avatarUrl: null, classIconUrl: 'https://i/druid.jpg' }))).toContain('src="https://i/druid.jpg"');
    const initial = render(createElement(CharacterAvatar, { ...base, avatarUrl: null, classIconUrl: null }));
    expect(initial).not.toContain('<img');
    expect(initial).toContain('>T</span>');
  });
});
```

Create `src/components/faction-badge/FactionBadge.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FactionBadge } from './FactionBadge';

// React 19 hoists <link rel="preload"> tags for images ahead of the markup.
const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/<link[^>]*\/>/g, '');

describe('FactionBadge', () => {
  it('names the faction in its title and hides the shape from screen readers', () => {
    const html = render(createElement(FactionBadge, { faction: 'HORDE' }));
    expect(html).toContain('title="Horde"');
    expect(html).toContain('aria-hidden="true"');
    expect(render(createElement(FactionBadge, { faction: 'ALLIANCE' }))).toContain('title="Alliance"');
  });
});
```

Then remove the old file: `git rm -q src/components/identity-components.test.ts`

- [ ] **Step 4: Retire the "sweep is pending" note**

In `AGENTS.md`, delete this sentence pair from the `Every component lives in its own directory` bullet, since the sweep has now landed:

```markdown
 The existing components still sit flat at the root of `src/components` and move in one sweep — see `docs/superpowers/specs/2026-09-28-component-and-module-split-design.md`. Until that lands, follow this rule for new components and leave the flat ones alone rather than moving them piecemeal.
```

- [ ] **Step 5: Verify nothing is left flat and everything resolves**

Run: `ls src/components/*.tsx src/components/*.ts 2>/dev/null; npm run typecheck && npx eslint src/components src/app && npm test`
Expected: `ls` prints nothing (no flat files remain); typecheck clean; eslint prints nothing; **159 tests pass** — the identity split redistributes three tests without changing the count.

- [ ] **Step 6: Commit**

```bash
git add -A src/components src/app AGENTS.md
git commit -m "refactor: move every component into its own directory"
```

---

### Task 2: `crest-line.ts` in `character-card/`

**Files:**
- Create: `src/components/character-card/crest-line.ts`, `src/components/character-card/crest-line.test.ts`
- Modify: `src/components/character-card/CharacterCard.tsx` (remove `crestLine`, lines 8-16 of the original; update its call)

**Interfaces:**
- Produces: `crestLine(input: { crests: { balances: { name: string; quantity: number }[]; pastedAt: number } | null; gearFromSimc: boolean; upgradesReady: number }, now: number): { text: string; tone: string }`.

The original took the whole `CharacterCardView`. `AGENTS.md` says logic functions take only the data they need, so the extracted version takes three fields. The object parameter keeps the boolean readable at the call site.

- [ ] **Step 1: Write the failing test**

Create `src/components/character-card/crest-line.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { crestLine } from './crest-line';

const DAY = 24 * 60 * 60 * 1000;
const now = 10 * DAY;
const crests = (balances: { name: string; quantity: number }[]) => ({ balances, pastedAt: now - 2 * DAY });

describe('crestLine', () => {
  it('asks for a paste when crests are unknown', () => {
    expect(crestLine({ crests: null, gearFromSimc: false, upgradesReady: 0 }, now))
      .toEqual({ text: 'Crests unknown: paste SimC', tone: 'text-muted' });
  });

  it('names each crest by its first word and says when nothing is affordable', () => {
    const input = { crests: crests([{ name: 'Myth Crest', quantity: 12 }, { name: 'Hero Crest', quantity: 30 }]), gearFromSimc: true, upgradesReady: 0 };
    expect(crestLine(input, now)).toEqual({ text: 'Myth 12, Hero 30: no BiS upgrades affordable', tone: 'text-muted' });
  });

  it('says so when the paste had no crests at all', () => {
    expect(crestLine({ crests: crests([]), gearFromSimc: true, upgradesReady: 0 }, now).text).toBe('No crests: no BiS upgrades affordable');
  });

  it('counts one ready upgrade in the singular', () => {
    expect(crestLine({ crests: crests([{ name: 'Myth Crest', quantity: 12 }]), gearFromSimc: true, upgradesReady: 1 }, now))
      .toEqual({ text: 'Myth 12: 1 BiS upgrade ready', tone: 'text-upgrade' });
  });

  it('counts several ready upgrades in the plural', () => {
    expect(crestLine({ crests: crests([{ name: 'Myth Crest', quantity: 12 }]), gearFromSimc: true, upgradesReady: 3 }, now).text)
      .toBe('Myth 12: 3 BiS upgrades ready');
  });

  it('says how old the paste is when the gear itself came from Blizzard', () => {
    expect(crestLine({ crests: crests([{ name: 'Myth Crest', quantity: 12 }]), gearFromSimc: false, upgradesReady: 0 }, now).text)
      .toBe('Myth 12 (pasted 2 days ago): no BiS upgrades affordable');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/character-card/crest-line.test.ts`
Expected: FAIL — `Failed to resolve import "./crest-line"`.

- [ ] **Step 3: Move the function out**

Create `src/components/character-card/crest-line.ts`:

```ts
import { formatAge } from '@/core/format';

interface CrestLineInput {
  crests: { balances: { name: string; quantity: number }[]; pastedAt: number } | null;
  /** When the gear itself came from the same paste, its age is already shown beside the source. */
  gearFromSimc: boolean;
  upgradesReady: number;
}

/** The crest line on a character card: balances from the last paste, and how many BiS upgrades they pay for. */
export function crestLine({ crests, gearFromSimc, upgradesReady }: CrestLineInput, now: number): { text: string; tone: string } {
  if (!crests) return { text: 'Crests unknown: paste SimC', tone: 'text-muted' };
  const age = gearFromSimc ? '' : ` (pasted ${formatAge(crests.pastedAt, now)})`;
  const balances = (crests.balances.map((b) => `${b.name.split(' ')[0]} ${b.quantity}`).join(', ') || 'No crests') + age;
  if (upgradesReady === 0) return { text: `${balances}: no BiS upgrades affordable`, tone: 'text-muted' };
  const ready = `${upgradesReady} BiS ${upgradesReady === 1 ? 'upgrade' : 'upgrades'} ready`;
  return { text: `${balances}: ${ready}`, tone: 'text-upgrade' };
}
```

In `CharacterCard.tsx`, delete the local `crestLine` function, add `import { crestLine } from './crest-line';`, and replace the call:

```tsx
  const crests = crestLine(card, now);
```

with:

```tsx
  const crests = crestLine({ crests: card.crests, gearFromSimc: card.snapshot?.source === 'simc', upgradesReady: card.upgradesReady }, now);
```

If `formatAge` is now unused in `CharacterCard.tsx`, eslint will say so in Step 4 — it is still used for the `source` line, so it should stay.

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/components/character-card/crest-line.test.ts && npm run typecheck && npx eslint src/components/character-card`
Expected: 6 tests pass; typecheck clean; eslint prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/components/character-card
git commit -m "refactor: move the card's crest line into a tested function"
```

---

### Task 3: `import-message.ts` in `simc-paste/`

**Files:**
- Create: `src/components/simc-paste/import-message.ts`, `src/components/simc-paste/import-message.test.ts`
- Modify: `src/components/simc-paste/SimcPaste.tsx`

**Interfaces:**
- Produces: `interface ImportCounts { changed?: boolean; equipped?: number; bags?: number; vault?: number }` and `importMessage(data: ImportCounts | null): string`.

- [ ] **Step 1: Write the failing test**

Create `src/components/simc-paste/import-message.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { importMessage } from './import-message';

describe('importMessage', () => {
  it('counts what a paste brought in', () => {
    expect(importMessage({ changed: true, equipped: 16, bags: 4, vault: 3 }))
      .toBe('Imported 16 equipped, 4 bag and 3 Great Vault items.');
  });

  it('says nothing changed when the paste matched the last one', () => {
    expect(importMessage({ changed: false })).toBe('Nothing changed since your last paste.');
  });

  it('treats a reply with no body as nothing changed', () => {
    expect(importMessage(null)).toBe('Nothing changed since your last paste.');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/simc-paste/import-message.test.ts`
Expected: FAIL — `Failed to resolve import "./import-message"`.

- [ ] **Step 3: Move the message out**

Create `src/components/simc-paste/import-message.ts`:

```ts
/** What the SimC route reports after an import. */
export interface ImportCounts { changed?: boolean; equipped?: number; bags?: number; vault?: number }

export const importMessage = (data: ImportCounts | null): string =>
  data?.changed
    ? `Imported ${data.equipped} equipped, ${data.bags} bag and ${data.vault} Great Vault items.`
    : 'Nothing changed since your last paste.';
```

In `SimcPaste.tsx`, delete the local `interface ImportResponse { ... }` line, add `import { importMessage, type ImportCounts } from './import-message';`, change `run<ImportResponse>` to `run<ImportCounts>`, and replace:

```tsx
    setImported(result.data?.changed
      ? `Imported ${result.data.equipped} equipped, ${result.data.bags} bag and ${result.data.vault} Great Vault items.`
      : 'Nothing changed since your last paste.');
```

with:

```tsx
    setImported(importMessage(result.data));
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/components/simc-paste/import-message.test.ts && npm run typecheck && npx eslint src/components/simc-paste`
Expected: 3 tests pass; typecheck clean; eslint prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/components/simc-paste
git commit -m "refactor: move the SimC import message into a tested function"
```

---

### Task 4: The parts of `item-card/`

**Files:**
- Create: `src/components/item-card/wowhead.ts`, `src/components/item-card/wowhead.test.ts`, `src/components/item-card/quality-styles.ts`, `src/components/empty-slot-card/EmptySlotCard.tsx`
- Modify: `src/components/item-card/ItemCard.tsx`, `src/components/item-card/ItemCard.test.ts`, `src/app/characters/[id]/page.tsx`

**Interfaces:**
- Produces: `wowheadData(itemId: number, bonusIds: number[], itemLevel: number | null): string` from `item-card/wowhead`; `QUALITY_STYLES` from `item-card/quality-styles`; `EmptySlotCard` from `@/components/empty-slot-card/EmptySlotCard`. Task 6 imports `EmptySlotCard` from there.

`wowheadData` already has tests, so the RED here is the missing module, and the existing assertions move with it unchanged.

- [ ] **Step 1: Move the tests first**

Create `src/components/item-card/wowhead.test.ts` holding the `wowheadData` describe block from `ItemCard.test.ts`, unchanged:

```ts
import { describe, expect, it } from 'vitest';
import { wowheadData } from './wowhead';

describe('wowheadData', () => {
  it('includes bonus IDs and item level so the tooltip matches the item', () => {
    expect(wowheadData(271528, [13440, 12850], 321)).toBe('item=271528&bonus=13440:12850&ilvl=321');
  });

  it('leaves out empty parts', () => {
    expect(wowheadData(5, [], null)).toBe('item=5');
  });
});
```

In `ItemCard.test.ts`, delete the `describe('wowheadData', ...)` block and change the import to `import { ItemCard } from './ItemCard';`.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/item-card/wowhead.test.ts`
Expected: FAIL — `Failed to resolve import "./wowhead"`.

- [ ] **Step 3: Move the three parts out**

Create `src/components/item-card/wowhead.ts`, moving the function from `ItemCard.tsx` unchanged:

```ts
/** The `data-wowhead` attribute, with bonus IDs and item level so the tooltip shows this exact item. */
export function wowheadData(itemId: number, bonusIds: number[], itemLevel: number | null): string {
  const parts = [`item=${itemId}`];
  if (bonusIds.length > 0) parts.push(`bonus=${bonusIds.join(':')}`);
  if (itemLevel) parts.push(`ilvl=${itemLevel}`);
  return parts.join('&');
}
```

Create `src/components/item-card/quality-styles.ts`, moving the table unchanged and exporting it:

```ts
import type { Quality } from '@/core/types';

export const QUALITY_STYLES: Record<Quality, { ring: string; text: string; bg: string; border: string }> = {
  POOR: { ring: '#9d9d9d', text: '#b5b5b5', bg: '#1c1b1a', border: '#3d3b38' },
  COMMON: { ring: '#ffffff', text: '#f2f2f2', bg: '#1f1e1c', border: '#4a4744' },
  UNCOMMON: { ring: '#1eff00', text: '#6cf36c', bg: '#17200f', border: '#2f5a1f' },
  RARE: { ring: '#0070dd', text: '#5eaaff', bg: '#111b28', border: '#1f4670' },
  EPIC: { ring: '#a335ee', text: '#c58cf5', bg: '#1e1628', border: '#4f2c70' },
  LEGENDARY: { ring: '#ff8000', text: '#ffa64d', bg: '#2a1c0e', border: '#704014' },
  ARTIFACT: { ring: '#e6cc80', text: '#e6cc80', bg: '#262116', border: '#6b5d33' },
  HEIRLOOM: { ring: '#00ccff', text: '#5cdcff', bg: '#10222a', border: '#1d5566' },
};
```

Create `src/components/empty-slot-card/EmptySlotCard.tsx`, moving the component unchanged:

```tsx
export function EmptySlotCard() {
  return (
    <div className="flex min-h-[62px] items-center rounded-lg border border-dashed border-line-strong px-4 text-[15px] text-muted">
      Empty slot
    </div>
  );
}
```

In `ItemCard.tsx`: delete `QUALITY_STYLES`, `wowheadData` and `EmptySlotCard`; delete the now-unused `import type { Quality }` only if eslint flags it (the props interface still uses `Quality`, so it stays); add:

```tsx
import { QUALITY_STYLES } from './quality-styles';
import { wowheadData } from './wowhead';
```

In `src/app/characters/[id]/page.tsx`, replace:

```tsx
import { EmptySlotCard, ItemCard } from '@/components/item-card/ItemCard';
```

with:

```tsx
import { EmptySlotCard } from '@/components/empty-slot-card/EmptySlotCard';
import { ItemCard } from '@/components/item-card/ItemCard';
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npm run typecheck && npx eslint src/components/item-card src/components/empty-slot-card src/app && npm test`
Expected: typecheck clean; eslint prints nothing; **168 tests pass** (159 + 6 from Task 2 + 3 from Task 3; the `wowheadData` tests moved, so none are added here).

- [ ] **Step 5: Commit**

```bash
git add -A src/components/item-card src/components/empty-slot-card src/app
git commit -m "refactor: split the item card's Wowhead helper, quality table and empty slot"
```

---

### Task 5: The parts of `add-character-bar/`

**Files:**
- Create: `src/components/add-character-bar/use-character-search.ts`, `src/components/add-character-bar/SearchResults.tsx`, `src/components/shared/field-classes.ts`
- Modify: `src/components/add-character-bar/AddCharacterBar.tsx`, `src/components/character-settings/CharacterSettings.tsx`

**Interfaces:**
- Produces: `useCharacterSearch()` and `type SearchResult` from `add-character-bar/use-character-search`; `SearchResults` from `add-character-bar/SearchResults`; `LABEL_CLASS` from `@/components/shared/field-classes`.

No test step: both new files use hooks or render JSX with handlers, and this repo has no DOM. They are pure moves, checked by typecheck, build, and the hand checks in Task 10.

- [ ] **Step 1: The shared label class**

The spec expected input, select and label classes to be shared with `CharacterSettings`. Only the label class is actually identical; the selects differ in height and padding, and unifying them would change how the page looks. So only the label class moves.

Create `src/components/shared/field-classes.ts`:

```ts
/** The small uppercase label above a form field. */
export const LABEL_CLASS = 'text-[13px] font-semibold uppercase tracking-wider text-muted';
```

In `CharacterSettings.tsx`, add `import { LABEL_CLASS } from '@/components/shared/field-classes';`, then replace `className="text-[13px] font-semibold uppercase tracking-wider text-muted"` on the `spec` label with `className={LABEL_CLASS}`, and `className="mb-1.5 text-[13px] font-semibold uppercase tracking-wider text-muted"` on the legend with ``className={`mb-1.5 ${LABEL_CLASS}`}``. Both render the same class string as before.

- [ ] **Step 2: The search hook**

Create `src/components/add-character-bar/use-character-search.ts`. It takes over the search state and the three effects from `AddCharacterBar`, unchanged:

```ts
'use client';

import { useEffect, useRef, useState } from 'react';
import type { Faction, Region } from '@/core/types';

export interface SearchResult {
  name: string;
  realmName: string;
  blizzardRealmId: number;
  className: string;
  faction: Faction | null;
  classIconUrl: string | null;
}
interface Realm { id: number; name: string; slug: string }

/**
 * The name search: a debounced lookup while typing, a result list that closes on an outside click or
 * Escape, and a fallback to picking the realm by hand when search is unavailable.
 */
export function useCharacterSearch() {
  const [region, setRegion] = useState<Region>('eu');
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [manual, setManual] = useState(false);
  const [realms, setRealms] = useState<Realm[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close the result list on a click or tap outside the search field and its list, or on Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (manual || term.trim().length < 3) return;
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/search?region=${region}&term=${encodeURIComponent(term.trim())}`).catch(() => null);
      if (!res?.ok) { setManual(true); setSearchError('Search is unavailable. Pick the realm yourself.'); return; }
      setResults(await res.json());
    }, 300);
    return () => clearTimeout(timer);
  }, [term, region, manual]);

  useEffect(() => {
    if (!manual) return;
    fetch(`/api/realms?region=${region}`).then((r) => (r.ok ? r.json() : [])).then(setRealms).catch(() => setRealms([]));
  }, [manual, region]);

  const visibleResults = open && !manual && term.trim().length >= 3 ? results : [];

  /** Empties the field and the list after a character is added. */
  function clear() {
    setTerm('');
    setResults([]);
  }

  return { region, setRegion, term, setTerm, manual, setManual, realms, searchError, setOpen, searchRef, visibleResults, clear };
}
```

- [ ] **Step 3: The result list**

Create `src/components/add-character-bar/SearchResults.tsx`, holding the `<ul role="listbox">` from `AddCharacterBar` unchanged except that it reads props:

```tsx
import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { FACTION_TEXT, FactionBadge } from '@/components/faction-badge/FactionBadge';
import { classColor } from '@/components/shared/class-colors';
import type { SearchResult } from './use-character-search';

interface Props {
  results: SearchResult[];
  busy: boolean;
  onPick: (result: SearchResult) => void;
  onManual: () => void;
}

export function SearchResults({ results, busy, onPick, onManual }: Props) {
  return (
    <ul role="listbox" aria-label="Matching characters"
      className="absolute top-full z-10 mt-2 flex w-full flex-col gap-0.5 rounded-xl border border-line-strong bg-surface-2 p-1.5 shadow-2xl">
      {results.map((r) => (
        <li key={`${r.blizzardRealmId}-${r.name}`} role="option" aria-selected="false">
          <button type="button" disabled={busy} onClick={() => onPick(r)}
            className="flex h-14 w-full items-center gap-3.5 rounded-lg px-3 text-left hover:bg-raised">
            <span className="relative shrink-0">
              {r.classIconUrl
                ? <img src={r.classIconUrl} alt="" width={40} height={40} className="size-10 rounded-lg border-2" style={{ borderColor: classColor(r.className) }} />
                : <CharacterAvatar name={r.name} className={r.className} avatarUrl={null} classIconUrl={null} size={40} />}
              {r.faction && <span className="absolute -bottom-1.5 -right-1.5"><FactionBadge faction={r.faction} /></span>}
            </span>
            <span className="grow text-[17px]"><strong className="font-semibold">{r.name}</strong><span className="text-muted"> - {r.realmName}</span></span>
            <span className="flex flex-col items-end">
              <span className="text-sm font-semibold" style={{ color: classColor(r.className) }}>{r.className}</span>
              {r.faction && <span className="text-xs font-semibold" style={{ color: FACTION_TEXT[r.faction].color }}>{FACTION_TEXT[r.faction].label}</span>}
            </span>
          </button>
        </li>
      ))}
      <li className="border-t border-line px-3 pb-1 pt-2.5 text-sm text-muted">
        Not listed? <button type="button" className="text-gold underline" onClick={onManual}>Pick the realm yourself</button>
      </li>
    </ul>
  );
}
```

- [ ] **Step 4: Rewire `AddCharacterBar`**

Replace the whole file:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApiAction } from '@/components/hooks/use-api-action';
import { LABEL_CLASS } from '@/components/shared/field-classes';
import { REGIONS, type Region } from '@/core/types';
import { SearchResults } from './SearchResults';
import { useCharacterSearch } from './use-character-search';

const inputClass = 'h-12 rounded-xl border border-line-strong bg-surface-2 px-4 text-[17px] text-ink focus:border-gold focus:outline-none';
// Narrower padding and width: the region select only ever shows two letters.
const regionClass = `${inputClass.replace('px-4', 'px-3')} w-20`;

export function AddCharacterBar() {
  const router = useRouter();
  const search = useCharacterSearch();
  const [realmSlug, setRealmSlug] = useState('');
  const { busy, error, run } = useApiAction();

  async function add(body: Record<string, unknown>) {
    const result = await run<{ id?: number }>('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region: search.region, ...body }),
    }, { fallbackError: 'Couldn’t add that character.', after: 'none' });
    if (!result.ok || !result.data?.id) return;
    search.clear();
    router.push(`/characters/${result.data.id}`);
  }

  return (
    <section aria-label="Add a character" className="relative flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="region" className={LABEL_CLASS}>Region</label>
        <select id="region" value={search.region} onChange={(e) => search.setRegion(e.target.value as Region)} className={regionClass}>
          {REGIONS.map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}
        </select>
      </div>

      <div ref={search.searchRef} className="relative flex min-w-64 grow flex-col gap-1.5">
        <label htmlFor="character-name" className={LABEL_CLASS}>Character name</label>
        <input id="character-name" type="search" autoComplete="off" value={search.term}
          onChange={(e) => { search.setTerm(e.target.value); search.setOpen(true); }} onFocus={() => search.setOpen(true)}
          placeholder="Search by name" className={inputClass} />
        {search.visibleResults.length > 0 && (
          <SearchResults results={search.visibleResults} busy={busy}
            onPick={(r) => add({ name: r.name, realmId: r.blizzardRealmId })} onManual={() => search.setManual(true)} />
        )}
      </div>

      {search.manual && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="realm" className={LABEL_CLASS}>Realm</label>
          <select id="realm" value={realmSlug} onChange={(e) => setRealmSlug(e.target.value)} className={`${inputClass} w-56`}>
            <option value="">Choose a realm</option>
            {search.realms.map((r) => <option key={r.id} value={r.slug}>{r.name}</option>)}
          </select>
        </div>
      )}

      {search.manual && (
        <button type="button" disabled={busy || !realmSlug || !search.term.trim()} onClick={() => add({ name: search.term.trim(), realmSlug })}
          className="h-12 rounded-xl border border-line-strong bg-raised px-5 font-semibold disabled:opacity-50">
          Add character
        </button>
      )}

      {/* Two paragraphs, not one with a precedence: the search hint explains the realm dropdown and has to
          stay readable while a failed add request is also on screen. */}
      {error && <p role="alert" className="w-full text-sm text-[#f3c9a2]">{error}</p>}
      {search.searchError && <p role="status" className="w-full text-sm text-[#f3c9a2]">{search.searchError}</p>}
    </section>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npx eslint src/components && npm test`
Expected: typecheck clean; eslint prints nothing; 168 tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A src/components
git commit -m "refactor: split the add bar's search hook and result list, and share the label class"
```

---

### Task 6: The character page's sections

**Files:**
- Create in `src/components/character-page/`: `CharacterHeader.tsx`, `CharacterAlerts.tsx`, `ListTabs.tsx`, `GearTable.tsx`, `BisTarget.tsx`, `VaultSection.tsx`
- Modify: `src/app/characters/[id]/page.tsx` (whole file)

**Interfaces:**
- Consumes: `CharacterPageView`, `GearRowView`, `VaultChoiceView` from `@/server/views` (Task 8 repoints these to `@/server/views/types`); `EmptySlotCard` from Task 4.
- Produces: the six section components.

The spec named five sections. The four status alerts at the top of the page are a sixth: left in the page, they would keep it from being pure composition, so they become `CharacterAlerts`. Every section is used only by the page, and `BisTarget` only by `GearTable`, so they are files in one directory rather than directories of their own.

- [ ] **Step 1: Capture the page as it renders today**

The riskiest move in the PR, so it gets a before-and-after diff rather than trust. Stop any `next dev` first (see Global Constraints).

```bash
npm run build >/dev/null && (npx next start -p 3001 >/dev/null 2>&1 &)
curl -s --retry 20 --retry-connrefused --retry-delay 1 -o /dev/null http://localhost:3001/
curl -s http://localhost:3001/characters/1 > /tmp/page-before.html
curl -s http://localhost:3001/ > /tmp/home-before.html
taskkill //F //PID $(netstat -ano | grep ':3001' | grep LISTENING | awk '{print $NF}' | head -1)
```

Expected: both files are larger than 10 KB and contain `Great Vault` and `Characters` respectively.

- [ ] **Step 2: Create the sections**

`src/components/character-page/CharacterHeader.tsx`:

```tsx
import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { RefreshButton } from '@/components/refresh-button/RefreshButton';
import { RemoveCharacterButton } from '@/components/remove-character-button/RemoveCharacterButton';
import { classColor } from '@/components/shared/class-colors';
import { formatAge } from '@/core/format';
import type { CharacterPageView } from '@/server/views';

export function CharacterHeader({ view, now }: { view: CharacterPageView; now: number }) {
  const source = view.snapshot && view.sourceAt !== null
    ? `${view.snapshot.source === 'simc' ? 'From SimC, pasted' : 'From Blizzard, synced'} ${formatAge(view.sourceAt, now)}`
    : 'Not synced yet';
  return (
    <div className="flex flex-wrap items-center justify-between gap-6">
      <div className="flex items-center gap-4">
        <CharacterAvatar name={view.name} className={view.className} avatarUrl={view.avatarUrl} classIconUrl={view.classIconUrl} size={76} />
        <div className="flex flex-col">
          <h1 className="font-display text-4xl font-bold tracking-wide">{view.name}</h1>
          <span className="text-muted">{view.realmName} ({view.region.toUpperCase()})</span>
          <span className="font-semibold" style={{ color: classColor(view.className) }}>{view.identity}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted">{source}</span>
        <RefreshButton id={view.id} />
        <RemoveCharacterButton id={view.id} name={view.name} redirectTo="/" />
      </div>
    </div>
  );
}
```

`src/components/character-page/CharacterAlerts.tsx`:

```tsx
import { formatAge } from '@/core/format';
import type { CharacterPageView } from '@/server/views';

export function CharacterAlerts({ view, now }: { view: CharacterPageView; now: number }) {
  return (
    <>
      {view.status === 'notFound' && (
        <p role="alert" className="rounded-lg border border-[#8a5a2b] bg-[#2e1f16] p-3 text-[#f3c9a2]">
          Blizzard can&rsquo;t find this character. It may have been renamed or transferred. You can remove it and search again.
        </p>
      )}
      {view.status === 'ok' && view.lastSyncError && <p role="alert" className="text-[#f3c9a2]">{view.lastSyncError}</p>}
      {view.bisError && (
        <p role="alert" className="text-[#f3c9a2]">
          {view.bisError}{view.bisFetchedAt ? `. Showing the list from ${formatAge(view.bisFetchedAt, now)}.` : '.'}
        </p>
      )}
      {view.tracksError && <p role="alert" className="text-[#f3c9a2]">{view.tracksError}.</p>}
    </>
  );
}
```

`src/components/character-page/ListTabs.tsx`:

```tsx
import Link from 'next/link';
import { LIST_TYPES, type ListType } from '@/core/types';
import type { CharacterPageView } from '@/server/views';

const LIST_NAMES: Record<ListType, string> = { overall: 'Overall', raid: 'Raid', mythicPlus: 'Mythic+' };

export function ListTabs({ id, listType, counts }: Pick<CharacterPageView, 'id' | 'listType' | 'counts'>) {
  return (
    <nav aria-label="BiS lists" className="flex gap-2 border-b border-line">
      {LIST_TYPES.map((l) => (
        <Link key={l} href={`/characters/${id}?list=${l}`} aria-current={l === listType ? 'page' : undefined}
          className={`-mb-px border-b-2 px-4 py-3 font-semibold no-underline ${l === listType ? 'border-gold text-ink' : 'border-transparent text-muted'}`}>
          {LIST_NAMES[l]} <span className="font-mono text-sm">{counts[l].bis}/{counts[l].total}</span>
        </Link>
      ))}
    </nav>
  );
}
```

`src/components/character-page/BisTarget.tsx`:

```tsx
import { ItemCard } from '@/components/item-card/ItemCard';
import type { GearRowView } from '@/server/views';

export function BisTarget({ row }: { row: GearRowView }) {
  const name = row.bis.isTier ? `Tier piece (catalyst ${row.bis.name})` : row.bis.name;
  return (
    <ItemCard itemId={row.bis.itemId} name={name} quality={row.bis.quality} iconUrl={row.bis.iconUrl}
      bonusIds={row.bis.bonusIds} itemLevel={null} detail={row.bis.source} />
  );
}
```

`src/components/character-page/GearTable.tsx`:

```tsx
import { EmptySlotCard } from '@/components/empty-slot-card/EmptySlotCard';
import { ItemCard } from '@/components/item-card/ItemCard';
import { ROW_TONE_STYLES, rowTone } from '@/components/shared/row-tone';
import { StateBadge } from '@/components/state-badge/StateBadge';
import { UpgradeBadge } from '@/components/upgrade-badge/UpgradeBadge';
import type { GearRowView } from '@/server/views';
import { BisTarget } from './BisTarget';

export function GearTable({ rows, tracksKnown }: { rows: GearRowView[]; tracksKnown: boolean }) {
  return (
    <section aria-label="Gear by slot" className="flex flex-col rounded-2xl border border-line bg-surface py-1">
      <div className="hidden grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_190px] gap-3 border-b border-line px-4 py-3 text-[13px] font-semibold uppercase tracking-wider text-muted md:grid">
        <span>Slot</span><span>Equipped</span><span>BiS</span><span>State</span>
      </div>
      {rows.length === 0 && <p className="p-6 text-muted">No BiS list to compare against yet.</p>}
      {rows.map((row, index) => {
        const tone = rowTone(row.state, tracksKnown);
        return (
        <div key={`${row.slot}-${index}`} style={tone ? ROW_TONE_STYLES[tone] : undefined}
          className="mx-2 my-1 grid grid-cols-1 gap-3 rounded-[10px] px-3 py-2 md:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_190px] md:items-center">
          <span className="font-semibold text-muted">{row.slotLabel}</span>
          {row.equipped ? (
            <ItemCard itemId={row.equipped.itemId} name={row.equipped.name} quality={row.equipped.quality} iconUrl={row.equipped.iconUrl}
              bonusIds={row.equipped.bonusIds} itemLevel={row.equipped.itemLevel}
              detail={[row.equipped.trackLabel ?? 'no track', row.equipped.itemLevel].filter(Boolean).join(' · ')} />
          ) : <EmptySlotCard />}
          <BisTarget row={row} />
          <div className="flex flex-col gap-1.5">
            <StateBadge state={row.state} />
            {row.upgrade && <UpgradeBadge upgrade={row.upgrade} />}
          </div>
        </div>
        );
      })}
    </section>
  );
}
```

`src/components/character-page/VaultSection.tsx`:

```tsx
import { ItemCard } from '@/components/item-card/ItemCard';
import { formatAge } from '@/core/format';
import type { CharacterPageView } from '@/server/views';

type Props = Pick<CharacterPageView, 'vault' | 'vaultChoices' | 'vaultChoicesAt'> & { now: number };

export function VaultSection({ vault, vaultChoices, vaultChoicesAt, now }: Props) {
  return (
    <section aria-label="Great Vault" className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-display text-2xl font-bold">Great Vault</h2>

      <div className="flex flex-col gap-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-muted">BiS items below Myth track</h3>
        {vault.length === 0 ? (
          <p className="text-muted">None. Every BiS item you have is on Myth track.</p>
        ) : vault.map((row) => row.equipped && (
          <ItemCard key={row.slot} itemId={row.equipped.itemId} name={row.equipped.name} quality={row.equipped.quality}
            iconUrl={row.equipped.iconUrl} bonusIds={row.equipped.bonusIds} itemLevel={row.equipped.itemLevel}
            detail={row.equipped.trackLabel ?? undefined} />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-muted">
          This week&rsquo;s choices{vaultChoicesAt !== null ? `, from SimC pasted ${formatAge(vaultChoicesAt, now)}` : ''}
        </h3>
        {vaultChoicesAt === null ? (
          <p className="text-muted">Paste SimC to see your Great Vault choices.</p>
        ) : vaultChoices.length === 0 ? (
          <p className="text-muted">No item choices in the vault in the last paste.</p>
        ) : vaultChoices.map((choice, index) => (
          <div key={`${choice.itemId}-${index}`} className="flex items-center gap-3">
            <div className="min-w-0 grow">
              <ItemCard itemId={choice.itemId} name={choice.name} quality={choice.quality} iconUrl={choice.iconUrl}
                bonusIds={choice.bonusIds} itemLevel={choice.itemLevel}
                detail={[choice.trackLabel, choice.itemLevel].filter(Boolean).join(' · ') || undefined} />
            </div>
            <span className={`w-20 shrink-0 text-sm font-bold ${choice.isBis ? 'text-bags' : 'text-muted'}`}>{choice.isBis ? 'BiS' : 'Not BiS'}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Reduce the page to composition**

Replace the whole of `src/app/characters/[id]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CharacterAlerts } from '@/components/character-page/CharacterAlerts';
import { CharacterHeader } from '@/components/character-page/CharacterHeader';
import { GearTable } from '@/components/character-page/GearTable';
import { ListTabs } from '@/components/character-page/ListTabs';
import { VaultSection } from '@/components/character-page/VaultSection';
import { CharacterSettings } from '@/components/character-settings/CharacterSettings';
import { CrestSummary } from '@/components/crest-summary/CrestSummary';
import { SetupNotice } from '@/components/setup-notice/SetupNotice';
import { SimcPaste } from '@/components/simc-paste/SimcPaste';
import { StaleSync } from '@/components/stale-sync/StaleSync';
import { MissingConfigError } from '@/core/config';
import { isStale } from '@/core/sync/character-sync';
import { LIST_TYPES, type ListType } from '@/core/types';
import { getServices, type Services } from '@/server/services';
import { getCharacterPage } from '@/server/views';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ list?: string }> };

export default async function CharacterPage({ params, searchParams }: Props) {
  const [{ id }, { list }] = await Promise.all([params, searchParams]);
  let services: Services;
  try {
    services = await getServices();
  } catch (err) {
    if (err instanceof MissingConfigError) return <SetupNotice missing={err.missing} />;
    throw err;
  }
  const listType = (LIST_TYPES as readonly string[]).includes(list ?? '') ? (list as ListType) : undefined;
  const view = await getCharacterPage(services, Number(id), listType);
  if (!view) notFound();
  const now = services.now();

  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-10 sm:px-16">
      <Link href="/" className="text-sm">&larr; All characters</Link>
      <CharacterHeader view={view} now={now} />
      <CharacterAlerts view={view} now={now} />
      <SimcPaste id={view.id} />
      <section aria-label="Crests" className="flex flex-col gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">Crests</h2>
        <CrestSummary crests={view.crests} now={now} />
      </section>
      <CharacterSettings id={view.id} specs={view.specs} spec={view.spec} activeSpec={view.activeSpec} priorityList={view.priorityList} />
      <ListTabs id={view.id} listType={view.listType} counts={view.counts} />
      <GearTable rows={view.rows} tracksKnown={!view.tracksError} />
      <VaultSection vault={view.vault} vaultChoices={view.vaultChoices} vaultChoicesAt={view.vaultChoicesAt} now={now} />
      <StaleSync ids={view.status === 'ok' && isStale(view.lastSyncedAt, now) ? [view.id] : []} />
    </main>
  );
}
```

- [ ] **Step 4: Verify the build and diff the rendered page**

```bash
npm run typecheck && npx eslint src/components/character-page src/app && npm test
npm run build >/dev/null && (npx next start -p 3001 >/dev/null 2>&1 &)
curl -s --retry 20 --retry-connrefused --retry-delay 1 -o /dev/null http://localhost:3001/
curl -s http://localhost:3001/characters/1 > /tmp/page-after.html
curl -s http://localhost:3001/ > /tmp/home-after.html
taskkill //F //PID $(netstat -ano | grep ':3001' | grep LISTENING | awk '{print $NF}' | head -1)
norm() { sed -E 's#/_next/static/[^"]+#STATIC#g; s#(just now|[0-9]+ (min|h|days?) ago)#AGE#g; s#<script[^>]*>[^<]*</script>##g' "$1" | tr '>' '\n'; }
diff <(norm /tmp/page-before.html) <(norm /tmp/page-after.html) && echo PAGE-IDENTICAL
diff <(norm /tmp/home-before.html) <(norm /tmp/home-after.html) && echo HOME-IDENTICAL
```

Expected: typecheck clean; eslint prints nothing; 168 tests pass; both `PAGE-IDENTICAL` and `HOME-IDENTICAL` print. If a diff appears, read it: a moved element or a changed class string is a defect to fix, not a diff to accept. A difference only inside inline React payload that the normalizer missed is not a defect, and gets a ledger ruling that quotes it.

- [ ] **Step 5: Commit**

```bash
git add -A src/components/character-page src/app
git commit -m "refactor: cut the character page into sections"
```

---

### Task 7: `db/queries/` by entity

**Files:**
- Create in `src/core/db/queries/`: `write-lock.ts`, `characters.ts`, `snapshots.ts`, `bis-lists.ts`, `tracks.ts`, `meta.ts`, `media.ts`, and tests `characters.test.ts`, `snapshots.test.ts`, `bis-lists.test.ts`, `reference-data.test.ts`, `write-lock.test.ts`
- Delete: `src/core/db/queries.ts`, `src/core/db/queries.test.ts`
- Modify: the 13 importers listed in Step 3, `AGENTS.md`

**Interfaces:**
- Produces, per module — every name and signature unchanged:
  - `write-lock`: `withWriteLock<T>(db: Db, task: () => Promise<T>): Promise<T>` (newly exported, for use inside the directory)
  - `characters`: `CharacterRow`, `NewCharacter`, `insertCharacter`, `listCharacters`, `getCharacter`, `updateCharacter`, `deleteCharacter`
  - `snapshots`: `SnapshotItemInput`, `SnapshotCurrency`, `Snapshot`, `gearToSnapshotItems`, `saveSnapshotIfChanged`, `getLatestSnapshot`, `equippedGear`
  - `bis-lists`: `replaceBisLists`, `getBisLists`
  - `tracks`: `replaceTracks`, `getTrackMap`, `replaceBonusQualities`, `getBonusQualityMap`
  - `meta`: `getMeta`, `setMeta`
  - `media`: `upsertItemIcons`, `getItemIcons`, `upsertItemDetails`, `getItemDetailsMap`, `upsertClassIcons`, `getClassIconMap`

- [ ] **Step 1: Create the modules**

Each module is a verbatim move of the symbols listed above, from `queries.ts`. Private helpers go with the module that uses them: `nameKeyOf` with `characters.ts`; `hashSnapshot` and `latestSnapshotRow` with `snapshots.ts`.

`write-lock.ts` takes the lock and its whole comment, and exports the function:

```ts
import type { Db } from '../client';

// Every write in this directory runs through this lock, one at a time per database.
// libsql's SQLite driver runs synchronously on the main thread: a write that waits on another
// connection's lock blocks the event loop, so the lock holder can never finish. An in-memory
// database also has one connection, which an open transaction holds (TRANSACTION_ACTIVE).
// The client's busy timeout still covers other processes writing to the same file.
// There is exactly one lock map, here: a module keeping its own would stop writes serializing.
const writeLocks = new WeakMap<Db, Promise<unknown>>();

export function withWriteLock<T>(db: Db, task: () => Promise<T>): Promise<T> {
```

— followed by the original function body, unchanged.

Every other module starts from the original header, **one directory deeper**, plus the lock:

```ts
import { createHash } from 'node:crypto';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { ItemDetails } from '../../blizzard/client';
import type { BonusQuality } from '../../raidbots/tracks';
import type { Db } from '../client';
import { bisItems, bisLists, characters, gearSnapshots, items, meta, snapshotItems, upgradeTracks, bonusQualities, snapshotCurrencies, itemDetails, classMedia } from '../schema';
import {
  LIST_TYPES, type BisLists, type GearItem, type ItemLocation, type Quality, type Region, type SlotType, type SnapshotSource, type Track,
} from '../../types';
import { withWriteLock } from './write-lock';
```

After pasting a module's symbols below that header, prune it:

Run: `npx eslint src/core/db/queries/<module>.ts`
Delete every import it flags as unused, and repeat until it prints nothing. If `snapshots.ts` needs `CharacterRow` or any other symbol from a sibling, import it from `./characters`, never copy it.

- [ ] **Step 2: Split the tests**

Each `describe` block of `queries.test.ts` moves verbatim:

| New test file | Blocks |
|---|---|
| `characters.test.ts` | `characters` |
| `snapshots.test.ts` | `snapshots`, `snapshot sources` |
| `bis-lists.test.ts` | `BiS lists` |
| `reference-data.test.ts` | `tracks, meta and icons` — it spans `tracks`, `meta` and `media`, so it is named for what it covers |
| `write-lock.test.ts` | `concurrent writes`, `file database` |

Each file starts from the original test header one directory deeper (`../client`, `../../types`), with the single `from './queries'` import replaced by one import per module, each holding all of that module's names from the Interfaces block. Copy the `newCharacter` and `gear` fixtures into each file that uses them — they are ten lines, and a test reads better with its fixtures in view. Then prune each file with `npx eslint` as in Step 1.

- [ ] **Step 3: Repoint the importers**

| File | New imports |
|---|---|
| `src/app/api/characters/[id]/route.ts` | `import { deleteCharacter, getCharacter, updateCharacter } from '@/core/db/queries/characters';` |
| `src/app/api/characters/[id]/simc/route.ts` | `import { getCharacter } from '@/core/db/queries/characters';` |
| `src/app/api/characters/[id]/sync/route.ts` | `import { getCharacter } from '@/core/db/queries/characters';` |
| `src/core/characters/add-character.test.ts` | `import { getCharacter } from '../db/queries/characters';` |
| `src/core/characters/add-character.ts` | `import { insertCharacter } from '../db/queries/characters';` |
| `src/core/simc/import-simc.test.ts` | `import { insertCharacter } from '../db/queries/characters';`<br>`import { getLatestSnapshot } from '../db/queries/snapshots';` |
| `src/core/simc/import-simc.ts` | `import { getCharacter } from '../db/queries/characters';`<br>`import { saveSnapshotIfChanged, type SnapshotItemInput } from '../db/queries/snapshots';` |
| `src/core/sync/character-sync.test.ts` | `import { getCharacter, insertCharacter } from '../db/queries/characters';`<br>`import { gearToSnapshotItems, getLatestSnapshot, saveSnapshotIfChanged } from '../db/queries/snapshots';` |
| `src/core/sync/character-sync.ts` | `import { getCharacter, updateCharacter } from '../db/queries/characters';`<br>`import { gearToSnapshotItems, saveSnapshotIfChanged } from '../db/queries/snapshots';` |
| `src/core/sync/reference-sync.test.ts` | `import { setMeta } from '../db/queries/meta';` |
| `src/core/sync/reference-sync.ts` | `import { getBisLists, replaceBisLists } from '../db/queries/bis-lists';`<br>`import { getMeta, setMeta } from '../db/queries/meta';`<br>`import { getBonusQualityMap, getTrackMap, replaceBonusQualities, replaceTracks } from '../db/queries/tracks';`<br>`import { getClassIconMap, getItemDetailsMap, getItemIcons, upsertClassIcons, upsertItemDetails, upsertItemIcons } from '../db/queries/media';` |
| `src/server/views.test.ts` | `import { insertCharacter, updateCharacter } from '@/core/db/queries/characters';`<br>`import { gearToSnapshotItems, saveSnapshotIfChanged } from '@/core/db/queries/snapshots';` |
| `src/server/views.ts` | `import { getCharacter, listCharacters, type CharacterRow } from '@/core/db/queries/characters';`<br>`import { equippedGear, getLatestSnapshot, type Snapshot, type SnapshotItemInput } from '@/core/db/queries/snapshots';` |

Then delete the originals: `git rm -q src/core/db/queries.ts src/core/db/queries.test.ts`

- [ ] **Step 4: Update the agent rules**

In `AGENTS.md`, replace ``**Every write goes through `withWriteLock`** in `src/core/db/queries.ts`.`` with ``**Every write goes through `withWriteLock`** in `src/core/db/queries/write-lock.ts`.``

- [ ] **Step 5: Verify, including that the lock test can fail**

Run: `npm run typecheck && npx eslint src/core src/server src/app && npm test`
Expected: typecheck clean; eslint prints nothing; 168 tests pass.

Now prove the moved `concurrent writes` test still guards the shared lock. In `tracks.ts`, temporarily replace `import { withWriteLock } from './write-lock';` with a private copy:

```ts
const ownLocks = new WeakMap<object, Promise<unknown>>();
function withWriteLock<T>(db: object, task: () => Promise<T>): Promise<T> {
  const run = (ownLocks.get(db) ?? Promise.resolve()).then(task, task);
  ownLocks.set(db, run.catch(() => undefined));
  return run;
}
```

Run: `npx vitest run src/core/db/queries/write-lock.test.ts`
Expected: FAIL in `concurrent writes`, because a track write no longer waits for the BiS and snapshot writes. Then revert with `git checkout src/core/db/queries/tracks.ts` if it was committed, or undo the edit, and rerun: PASS.

If it passes with the broken lock, the test does not exercise cross-module writes. Record that as a ruling and add a test that runs `replaceTracks` and `saveSnapshotIfChanged` in parallel on one in-memory database, confirming it fails with the private lock before keeping it.

- [ ] **Step 6: Commit**

```bash
git add -A src/core src/server src/app AGENTS.md
git commit -m "refactor: split the database queries by entity, sharing one write lock"
```

---

### Task 8: `server/views/`

**Files:**
- Create in `src/server/views/`: `types.ts`, `summarize.ts`, `item-view.ts`, `character-cards.ts`, `character-page.ts`
- Move: `src/server/views.test.ts` → `src/server/views/views.test.ts`
- Delete: `src/server/views.ts`
- Modify: every importer of `@/server/views`, `AGENTS.md`

**Interfaces:**
- Produces:
  - `types`: `ItemView`, `GearRowView`, `VaultChoiceView`, `CrestView`, `CharacterSummary`, `CharacterCardView`, `CharacterPageView`
  - `summarize`: `GearContext`, `loadGear`, `summarize`, `upgradeFor`, `crestView` — the helpers both loaders share, now exported
  - `item-view`: `itemView`
  - `character-cards`: `getCharacterCards(services: Services): Promise<CharacterCardView[]>`
  - `character-page`: `getCharacterPage(services: Services, id: number, listType?: ListType): Promise<CharacterPageView | null>`, with the private `bisCount`

- [ ] **Step 1: Create the modules**

Verbatim moves again. Each starts from the original header (Task 7's rewritten version) with `./services` becoming `../services`; every other import already uses the `@/` alias and needs no change. Siblings import each other: `character-cards.ts` and `character-page.ts` take their types from `./types` and helpers from `./summarize`; `character-page.ts` also takes `itemView` from `./item-view`. Prune each file with `npx eslint` until it prints nothing.

- [ ] **Step 2: Move the test**

The test's shared `services()` and `seed()` fixtures serve every block, including two that exercise both loaders, so it moves as one file rather than splitting.

```bash
git mv src/server/views.test.ts src/server/views/views.test.ts
```

Change its imports: `getCharacterCards` from `./character-cards`, `getCharacterPage` from `./character-page`, `Services` from `../services`.

- [ ] **Step 3: Repoint the importers**

Run `grep -rn "'@/server/views'" src` and rewrite each: types come from `@/server/views/types`, `getCharacterCards` from `@/server/views/character-cards`, `getCharacterPage` from `@/server/views/character-page`. A line importing a loader and a type becomes two imports. Expect `src/app/page.tsx`, `src/app/characters/[id]/page.tsx`, `character-card/CharacterCard.tsx`, `crest-summary/CrestSummary.tsx`, and the five `character-page/` sections from Task 6.

Then `git rm -q src/server/views.ts`.

- [ ] **Step 4: Update the agent rules**

In `AGENTS.md`, replace `- `views.ts` turns rows into `*View` types shaped for rendering.` with ``- `views/` turns rows into `*View` types shaped for rendering, one loader per page, with the types in `views/types.ts`.``, and in the thin-pages bullet replace `src/server/views.ts` with `src/server/views/`.

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npx eslint src/server src/app src/components && npm test`
Expected: typecheck clean; eslint prints nothing; 168 tests pass, with `views.test.ts` unchanged except its imports.

- [ ] **Step 6: Commit**

```bash
git add -A src/server src/app src/components AGENTS.md
git commit -m "refactor: split the view loaders into one module per page"
```

---

### Task 9: `blizzard/` — types, token, parsers, client

**Files:**
- Create in `src/core/blizzard/`: `types.ts`, `token.ts`, `parse.ts`, `parse.test.ts`
- Modify: `src/core/blizzard/client.ts`, and every importer of the moved types

**Interfaces:**
- Produces:
  - `types`: `CharacterRef`, `CharacterProfile`, `Realm`, `PlayableClass`, `ItemDetails` — unchanged
  - `parse`: `RawProfile`, `RawEquipment` (now exported), `parseProfile(raw: RawProfile): CharacterProfile`, `parseEquipment(raw: RawEquipment): GearItem[]`
  - `token`: `createTokenSource(options: { clientId: string; clientSecret: string; fetchFn: FetchFn; now: () => number }): { get(): Promise<string>; invalidate(): void }`
  - `client`: `BlizzardClient` and `createBlizzardClient` stay here, unchanged in signature, so the nine importers that use only them do not move.

- [ ] **Step 1: Write the failing parser test**

Create `src/core/blizzard/parse.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseEquipment, parseProfile, type RawEquipment, type RawProfile } from './parse';

const profile: RawProfile = {
  name: 'Testbear',
  realm: { id: 1303, name: 'Tarren Mill', slug: 'tarren-mill' },
  character_class: { name: 'Druid' },
  active_spec: { name: 'Guardian' },
  race: { name: 'Troll' },
  faction: { type: 'HORDE' },
};

describe('parseProfile', () => {
  it('maps a full profile', () => {
    expect(parseProfile(profile)).toEqual({
      name: 'Testbear', realmId: 1303, realmSlug: 'tarren-mill', realmName: 'Tarren Mill',
      className: 'Druid', specName: 'Guardian', raceName: 'Troll', faction: 'HORDE',
    });
  });

  it('leaves spec and race empty when Blizzard omits them', () => {
    const bare: RawProfile = { name: profile.name, realm: profile.realm, character_class: profile.character_class };
    expect(parseProfile(bare)).toMatchObject({ specName: '', raceName: '' });
  });

  it('keeps only the two real factions', () => {
    expect(parseProfile({ ...profile, faction: { type: 'ALLIANCE' } }).faction).toBe('ALLIANCE');
    expect(parseProfile({ ...profile, faction: { type: 'NEUTRAL' } }).faction).toBeNull();
    expect(parseProfile({ ...profile, faction: undefined }).faction).toBeNull();
  });
});

describe('parseEquipment', () => {
  it('keeps gear slots and drops cosmetic ones', () => {
    const raw: RawEquipment = {
      equipped_items: [
        { slot: { type: 'HEAD' }, item: { id: 1 }, name: 'Helm' },
        { slot: { type: 'TABARD' }, item: { id: 2 }, name: 'Tabard' },
        { slot: { type: 'SHIRT' }, item: { id: 3 }, name: 'Shirt' },
      ],
    };
    expect(parseEquipment(raw).map((g) => g.slot)).toEqual(['HEAD']);
  });

  it('fills defaults for anything Blizzard leaves out', () => {
    const [item] = parseEquipment({ equipped_items: [{ slot: { type: 'NECK' }, item: { id: 9 }, name: 'Chain' }] });
    expect(item).toEqual({ slot: 'NECK', itemId: 9, name: 'Chain', itemLevel: null, quality: 'COMMON', bonusIds: [], isTier: false });
  });

  it('reads level, quality, bonus IDs and set membership when present', () => {
    const [item] = parseEquipment({ equipped_items: [{
      slot: { type: 'CHEST' }, item: { id: 7 }, name: 'Robe', level: { value: 321 }, quality: { type: 'EPIC' }, bonus_list: [12850], set: {},
    }] });
    expect(item).toMatchObject({ itemLevel: 321, quality: 'EPIC', bonusIds: [12850], isTier: true });
  });

  it('returns nothing when no items are equipped', () => {
    expect(parseEquipment({})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/core/blizzard/parse.test.ts`
Expected: FAIL — `Failed to resolve import "./parse"`.

- [ ] **Step 3: Create `types.ts` and `parse.ts`**

`types.ts` takes `CharacterRef`, `CharacterProfile`, `Realm`, `PlayableClass` and `ItemDetails` from `client.ts` verbatim, with the one import they need: `import type { Faction, Quality, Region } from '../types';` (prune with eslint).

`parse.ts`:

```ts
import { SLOT_TYPES, type GearItem, type Quality, type SlotType } from '../types';
import type { CharacterProfile } from './types';

export interface RawEquipment {
  equipped_items?: {
    slot: { type: string };
    item: { id: number };
    name: string;
    level?: { value: number };
    quality?: { type: string };
    bonus_list?: number[];
    set?: unknown;
  }[];
}

export interface RawProfile {
  name: string;
  realm: { id: number; name: string; slug: string };
  character_class: { name: string };
  active_spec?: { name: string };
  race?: { name: string };
  faction?: { type: string };
}

const GEAR_SLOTS = new Set<string>(SLOT_TYPES);

export function parseProfile(raw: RawProfile): CharacterProfile {
  return {
    name: raw.name,
    realmId: raw.realm.id,
    realmSlug: raw.realm.slug,
    realmName: raw.realm.name,
    className: raw.character_class.name,
    specName: raw.active_spec?.name ?? '',
    raceName: raw.race?.name ?? '',
    faction: raw.faction?.type === 'HORDE' || raw.faction?.type === 'ALLIANCE' ? raw.faction.type : null,
  };
}

/** Equipped gear in the slots this app compares; tabards and shirts are cosmetic and dropped. */
export function parseEquipment(raw: RawEquipment): GearItem[] {
  return (raw.equipped_items ?? [])
    .filter((item) => GEAR_SLOTS.has(item.slot.type))
    .map((item) => ({
      slot: item.slot.type as SlotType,
      itemId: item.item.id,
      name: item.name,
      itemLevel: item.level?.value ?? null,
      quality: (item.quality?.type ?? 'COMMON') as Quality,
      bonusIds: item.bonus_list ?? [],
      isTier: Boolean(item.set),
    }));
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/core/blizzard/parse.test.ts`
Expected: 7 tests pass.

- [ ] **Step 5: Create `token.ts`**

The token lived in `createBlizzardClient`'s closure, and `api()` cleared it after a 401. Both operations become methods:

```ts
import { HttpError, REQUEST_TIMEOUT_MS, type FetchFn } from '../http';

interface TokenOptions {
  clientId: string;
  clientSecret: string;
  fetchFn: FetchFn;
  now: () => number;
}

/** A client-credentials token, fetched on first use and refreshed a minute before it expires. */
export function createTokenSource(options: TokenOptions) {
  let token: { value: string; expiresAt: number } | null = null;

  async function get(): Promise<string> {
    if (token && token.expiresAt > options.now() + 60_000) return token.value;
    const url = 'https://oauth.battle.net/token';
    const res = await options.fetchFn(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${options.clientId}:${options.clientSecret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new HttpError(res.status, url, await res.text());
    const data = (await res.json()) as { access_token: string; expires_in: number };
    token = { value: data.access_token, expiresAt: options.now() + data.expires_in * 1000 };
    return token.value;
  }

  /** Forgets the token, after Blizzard rejects it with a 401. */
  function invalidate() {
    token = null;
  }

  return { get, invalidate };
}
```

- [ ] **Step 6: Slim `client.ts`**

In `client.ts`:
- Delete the five moved types, `RawEquipment`, `RawProfile`, `GEAR_SLOTS`, the `token` variable and `getToken`.
- Add `import { parseEquipment, parseProfile, type RawEquipment, type RawProfile } from './parse';`, `import { createTokenSource } from './token';` and `import type { CharacterProfile, CharacterRef, ItemDetails, PlayableClass, Realm } from './types';`.
- After `const now = options.now ?? Date.now;` add `const token = createTokenSource({ clientId: options.clientId, clientSecret: options.clientSecret, fetchFn, now });`
- In `api()`, replace `${await getToken()}` with `${await token.get()}`, and `token = null;` with `token.invalidate();`.
- `getProfile` becomes `return parseProfile(await api<RawProfile>(ref.region, characterPath(ref), 'profile'));`
- `getEquipment` becomes `return parseEquipment(await api<RawEquipment>(ref.region, `${characterPath(ref)}/equipment`, 'profile'));`

Prune with `npx eslint src/core/blizzard`.

- [ ] **Step 7: Repoint the type importers**

Run `grep -rn "blizzard/client'" src | grep -E "CharacterRef|CharacterProfile|ItemDetails|Realm|PlayableClass"`. For each hit, move those type names to an import from the sibling `types` module (`'../blizzard/types'`, `'../../blizzard/types'` from inside `db/queries/`, or `'@/core/blizzard/types'`), leaving `BlizzardClient` and `createBlizzardClient` on `client`.

- [ ] **Step 8: Verify, with the client test untouched**

Run: `git diff --stat HEAD -- src/core/blizzard/client.test.ts && npm run typecheck && npx eslint src/core && npm test`
Expected: the `git diff` prints nothing — **`client.test.ts` passes with no edits**, which is the proof that token reuse and the 401 retry survived the move. Typecheck clean; eslint prints nothing; **175 tests pass** (168 + 7).

- [ ] **Step 9: Commit**

```bash
git add -A src/core src/server
git commit -m "refactor: split the Blizzard client's types, token and parsers into modules"
```

---

### Task 10: Hand checks, spec corrections, and the pull request

**Files:**
- Modify: `docs/superpowers/specs/2026-09-28-component-and-module-split-design.md`

- [ ] **Step 1: Grep for stale paths**

```bash
grep -rn "db/queries.ts\|server/views.ts\|identity-components\|components/[A-Z][A-Za-z]*\.tsx\|'@/components/[A-Z]" AGENTS.md README.md src docs/superpowers/specs/2026-09-28-component-and-module-split-design.md
```

Expected: hits only in the spec, where it describes the state before this work. Anything in `AGENTS.md`, `README.md` or `src` is a stale path to fix.

- [ ] **Step 2: Correct the spec**

In the spec's success criteria, replace `Three pure functions that currently have no tests have them: the crest line, the SimC import message, and the Wowhead data attribute.` with `Two pure functions that had no tests have them: the crest line and the SimC import message. The Wowhead data attribute already had tests, which moved with it. The Blizzard parsers are newly tested as well.`

In Commit 2's `add-character-bar/` paragraph, replace `` `field-classes.ts` takes the input, select and label class strings that `character-settings/` currently duplicates`` with `` `field-classes.ts` takes the label class, the only string `character-settings/` actually duplicated; the selects differ in height and padding, and unifying them would change the page``.

- [ ] **Step 3: Full gate**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all clean, 175 tests.

- [ ] **Step 4: Hand checks on a production server**

Run `npx next start -p 3001` and check, recording each result:

- [ ] Home page: both character cards render with their crest lines.
- [ ] Type three letters of a name: results appear after a short pause.
- [ ] Click outside the search: the list closes. Focus the field and press **Escape**: it closes.
- [ ] Character page: header, alerts, tabs, gear table with gold and green rows, and the vault all render.
- [ ] Switch list tabs: the table changes and the active tab is underlined.

Stop the server afterwards.

- [ ] **Step 5: Commit and open the pull request**

```bash
git add docs/superpowers/specs/2026-09-28-component-and-module-split-design.md
git commit -m "docs: correct the spec's test count and field class claims"
git push -u origin chore/split-components-and-modules
```

The description follows `AGENTS.md`: a framing sentence, `## What changes` with the three phases, `## Testing` naming the before-and-after HTML diff, the deliberately broken lock, the untouched `client.test.ts` and the hand checks, and `Spec:` and `Plan:` lines. It must say the PR is meant to be reviewed **commit by commit**, since the first commit is fifteen renames and the extractions are where a mistake would hide.
