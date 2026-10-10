# Skeleton Loaders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every wait for data shows a pulsing skeleton shaped like the content it waits for, with words only where the shape can't explain itself.

**Architecture:** One `Skeleton` primitive and a skeleton beside each data section. Route `loading.tsx` files compose them for page loads. Components swap a section for its skeleton during background-sync waits. Two client owners of pending state drive the swaps: a new `ListSwitchProvider` for list tabs, and a new `GroupBody` that reads `GroupEditsProvider` for group edits. A `PendingCharacterProvider` lets the add bar show a named skeleton card in the grid beside it.

**Tech Stack:** Next.js App Router (this repo's version: read `node_modules/next/dist/docs/` before relying on any API), React 19, Tailwind v4, Vitest with `renderToStaticMarkup`.

**Spec:** `docs/superpowers/specs/2026-10-10-skeleton-loaders-design.md`. The spec wins where this plan disagrees.

## Global Constraints

- Branch: `feat/skeleton-loaders`, cut from fetched `origin/main` after the spec branch merges, or from `docs/skeleton-loaders` if it hasn't (say so in the pull request).
- Skeleton shapes are `aria-hidden`. Each skeleton region shown on screen has exactly one `role="status"` element. Visible loading text only for: "Adding {name}…", the page-level track data line, and errors.
- Skeleton block classes: `animate-pulse bg-line motion-reduce:animate-none`. No new color token.
- Every component lives in its own kebab-case directory; a component only its parent renders is a file in the parent's directory. Branching worth a test lives in a `.ts` beside it.
- Skeletons rendered by client components (`GroupBody`, `AutoAddCharacter`, `CharacterGrid`) import nothing server-only.
- No new dependency. No schema change, migration or cache version bump.
- Tests are `*.test.ts` beside the code, rendering with `createElement` and `renderToStaticMarkup`. Client components that call `useRouter` need `vi.mock('next/navigation', ...)` as in `src/components/group-grid/GroupGrid.test.ts`.
- Fixtures use made-up names such as Birkibjörn, never real players.
- Commits: `type: lowercase imperative summary`, through the repo's `commit` skill. No AI attribution.
- Before calling work done: `npm run typecheck && npm run lint && npm test`, and `npm run build` with dev stopped.

## Clarifications of the spec

These follow the spec's intent and change no behavior:

- **Status ownership.** Section skeletons take an optional `status?: string`. When set, they render one `sr-only` `role="status"` with it. Route `loading.tsx` files render one status of their own and pass none to the skeletons inside, so a page load announces once, not once per card. The "exactly one status" render tests run on the composed region: the route skeleton, or the section in its in-page state.
- **Tab click handling.** `next/link`'s `onNavigate` runs only for a plain client-side navigation, not for modifier clicks or middle-click (see `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md`, `onNavigate`). `ListTabs` calls `preventDefault()` and `select(...)` there, so no modifier-key logic is needed.
- **Pending card placement.** The spec's `PendingCharacterCard` becomes `CharacterGrid`, a client component that renders the card grid, the empty state, and the named skeleton card. One component has to own the "empty list, but adding" case anyway.
- **Slot labels in skeletons** come from `SLOT_LABELS` in `src/server/views/group-grid.ts`, a pure module with no server-only imports.

## Review Focus

1. **A failed add from the bar on `/`:** the named skeleton card must disappear with the error, not stay. Task 8 checks it by hand and keeps the clearing in one derived value.
2. **Removing the last group member while another edit is pending:** the empty-state text shows, not a zero-column skeleton. Task 6's `groupBodyMode` test pins it.
3. **A card whose BiS list failed:** it keeps the error text, never a skeleton. Task 2 tests it.
4. **A gear table that still has rows while BiS reloads:** it keeps the rows. Task 3 tests it.
5. **Middle-click or Ctrl-click on a list tab:** it opens a new browser tab and the current page doesn't skeleton. Task 5 relies on `onNavigate` and checks by hand.

## File Structure

| File | Job |
|---|---|
| `src/components/skeleton/Skeleton.tsx` | The pulsing block |
| `src/components/shared/loading-copy.ts` | All loading wording |
| `src/components/character-card/CardProgressSkeleton.tsx`, `CharacterCardSkeleton.tsx` | Card shapes |
| `src/components/character-page/GearTableHeader.tsx` | Header row shared by the table and its skeleton |
| `src/components/character-page/GearTableSkeleton.tsx`, `DungeonRowsSkeleton.tsx`, `DungeonPrioritySkeleton.tsx`, `VaultSectionSkeleton.tsx`, `CharacterPageSkeleton.tsx` | Character page shapes |
| `src/components/group-grid/CellSkeleton.tsx`, `GroupGridSkeleton.tsx` | Group grid shapes |
| `src/components/group-priority/PriorityRowsSkeleton.tsx`, `GroupPrioritySkeleton.tsx` | Group dungeon shapes |
| `src/components/group-vault/GroupVaultSkeleton.tsx` | Group vault shape |
| `src/components/list-switch/ListSwitchProvider.tsx`, `WhileListSettled.tsx` | Tab-switch pending state |
| `src/components/group-body/GroupBody.tsx`, `group-body-mode.ts`, `panel-box.ts` | Empty, skeleton or real group panels |
| `src/components/pending-character/PendingCharacterProvider.tsx` | The name being added from the bar |
| `src/components/character-grid/CharacterGrid.tsx` | Card grid, empty state, pending card |
| `src/app/loading.tsx`, `src/app/group/loading.tsx`, `src/app/characters/[region]/[realm]/[name]/loading.tsx` | Route skeletons |

---

### Task 1: Probe search-param navigation against a route fallback

Throwaway. Answers the spec's open question before building on it. Needs the local dev server with `.env` and a database holding at least one tracked character with a BiS list. **In a cloud session, skip this task** and add "Search-param navigation probe not run" to the pull request's Testing section; Task 9's hand checks cover it.

**Files (all reverted at the end):**
- Create: `src/app/characters/[region]/[realm]/[name]/loading.tsx`
- Modify: `src/app/characters/[region]/[realm]/[name]/page.tsx`
- Modify: `src/components/character-page/ListTabs.tsx`

- [ ] **Step 1: Add a visible route fallback and a server delay**

`loading.tsx`:

```tsx
export default function Loading() {
  return <p className="p-16 text-4xl text-gold">ROUTE FALLBACK</p>;
}
```

In `page.tsx`, first line of `CharacterPage`: `await new Promise((r) => setTimeout(r, 2000));`

- [ ] **Step 2: Make the tabs navigate inside a transition**

`ListTabs.tsx`, temporarily:

```tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LIST_TYPES, type ListType } from '@/core/types';
import type { CharacterPageView } from '@/server/views/types';

const LIST_NAMES: Record<ListType, string> = { overall: 'Overall', raid: 'Raid', mythicPlus: 'Mythic+' };

export function ListTabs({ href, listType, counts }: Pick<CharacterPageView, 'href' | 'listType' | 'counts'>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <nav aria-label="BiS lists" className="flex gap-2 border-b border-line">
      {pending && <span className="text-gold">PENDING</span>}
      {LIST_TYPES.map((l) => (
        <Link key={l} href={`${href}?list=${l}`} aria-current={l === listType ? 'page' : undefined}
          onNavigate={(e) => { e.preventDefault(); startTransition(() => router.push(`${href}?list=${l}`, { scroll: false })); }}
          className={`-mb-px border-b-2 px-4 py-3 font-semibold no-underline ${l === listType ? 'border-gold text-ink' : 'border-transparent text-muted'}`}>
          {LIST_NAMES[l]} <span className="font-mono text-sm">{counts[l].bis}/{counts[l].total}</span>
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: Check in the browser**

Run `npm run dev`. Open a tracked character's page and wait for it. Click another list tab.

- Expected: "PENDING" shows for about 2 s, the old page stays, then the new list renders. "ROUTE FALLBACK" never shows.
- Also click a tab plainly (as above), then repeat with a `?list=` URL typed into the address bar: a full load may show the fallback. That is expected and fine.

Then stop dev, run `npm run build`, run `npx next start -p 3001`, and repeat the tab click on port 3001. Restart dev afterwards if needed.

- [ ] **Step 4: Record and revert**

Write the result for dev and production into the pull request's Testing notes, then revert: `git checkout -- src/app src/components/character-page/ListTabs.tsx` and delete the probe `loading.tsx`.

**If "ROUTE FALLBACK" showed on a transition navigation:** stop and tell the owner before going on. The fix the spec names is to move the character route's loading boundary below the parts that must stay. That changes Task 7's file layout, so it needs a plan update first.

---

### Task 2: Skeleton primitive, loading copy, and character card skeletons

**Files:**
- Create: `src/components/skeleton/Skeleton.tsx`, `src/components/skeleton/Skeleton.test.ts`
- Modify: `src/components/shared/loading-copy.ts`
- Create: `src/components/character-card/CardProgressSkeleton.tsx`, `src/components/character-card/CharacterCardSkeleton.tsx`, `src/components/character-card/CharacterCard.test.ts`
- Modify: `src/components/character-card/CharacterCard.tsx`

**Interfaces:**
- Produces: `Skeleton({ className }: { className?: string })`; the copy constants below; `CardProgressSkeleton()`; `CharacterCardSkeleton({ name }: { name?: string })`.

- [ ] **Step 1: Write the failing tests**

`src/components/skeleton/Skeleton.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('is a hidden pulsing block that stops pulsing for reduced motion', () => {
    const html = renderToStaticMarkup(createElement(Skeleton, { className: 'h-4 w-32 rounded-md' }));
    expect(html).toBe('<div aria-hidden="true" class="animate-pulse bg-line motion-reduce:animate-none h-4 w-32 rounded-md"></div>');
  });
});
```

`src/components/character-card/CharacterCard.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterCardView } from '@/server/views/types';
import { CharacterCard } from './CharacterCard';
import { CharacterCardSkeleton } from './CharacterCardSkeleton';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }) }));

const counts = { done: 5, mythUpgradable: 2, belowMyth: 3, wrongStats: 0, missing: 6, inBags: 0 };
const card = (over: Partial<CharacterCardView>): CharacterCardView => ({
  id: 3, href: '/characters/eu/argent-dawn/birkibj%C3%B6rn', name: 'Birkibjörn', realmName: 'Argent Dawn', realmId: 1, region: 'eu',
  className: 'Druid', activeSpec: 'Guardian', spec: 'Guardian', specSlug: 'guardian-druid', status: 'ok', lastSyncedAt: 5, lastSyncError: null,
  priorityList: 'mythicPlus', snapshot: null, sourceAt: null, race: null, faction: null, avatarUrl: null, classIconUrl: null, identity: 'Guardian Druid',
  counts, tracksError: null, tracksKnown: true, tracksLoading: false, total: 16, bisError: null, crests: null, upgradesReady: 0, ...over,
});
const render = (c: CharacterCardView) => renderToStaticMarkup(createElement(CharacterCard, { card: c, now: 10 })).replace(/<link[^>]*\/>/g, '');
const statuses = (html: string) => html.match(/role="status"/g)?.length ?? 0;

describe('CharacterCard loading states', () => {
  it('shows a progress skeleton while the BiS list loads, saying so only to screen readers', () => {
    const html = render(card({ counts: null }));
    expect(html).toContain('animate-pulse');
    expect(html).toMatch(/<span role="status" class="sr-only">Loading BiS list…<\/span>/);
    expect(statuses(html)).toBe(1);
  });

  it('keeps the error text, not a skeleton, when the BiS list failed', () => {
    const html = render(card({ counts: null, bisError: 'Method’s page couldn’t be read.' }));
    expect(html).toContain('Method’s page couldn’t be read.');
    expect(html).not.toContain('animate-pulse');
  });

  it('keeps the real bar and skeletons only the summary while track data loads', () => {
    const html = render(card({ tracksLoading: true, tracksKnown: false }));
    expect(html).toContain('bg-gold');
    expect(html).toMatch(/<span role="status" class="sr-only">Loading upgrade track data…<\/span>/);
    expect(html).toContain('animate-pulse');
  });

  it('shows no skeleton once everything has loaded', () => {
    expect(render(card({}))).not.toContain('animate-pulse');
  });
});

describe('CharacterCardSkeleton', () => {
  it('is all shapes without a name, and has no status of its own', () => {
    const html = renderToStaticMarkup(createElement(CharacterCardSkeleton));
    expect(html).toContain('animate-pulse');
    expect(statuses(html)).toBe(0);
  });

  it('shows the name and says it is being added', () => {
    const html = renderToStaticMarkup(createElement(CharacterCardSkeleton, { name: 'Birkibjörn' }));
    expect(html).toContain('>Birkibjörn<');
    expect(html).toMatch(/<span role="status" class="text-sm text-muted">Adding Birkibjörn…<\/span>/);
    expect(statuses(html)).toBe(1);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/skeleton src/components/character-card/CharacterCard.test.ts`
Expected: FAIL, cannot resolve `./Skeleton` and `./CharacterCardSkeleton`.

- [ ] **Step 3: Implement**

`src/components/skeleton/Skeleton.tsx`:

```tsx
/** A pulsing placeholder block. The caller sets its size and corner radius. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse bg-line motion-reduce:animate-none ${className}`} />;
}
```

`src/components/shared/loading-copy.ts`, replacing the file:

```ts
// One wording for every view that waits on data.
export const BIS_LOADING = 'Loading BiS list…';
export const TRACKS_LOADING = 'Loading upgrade track data…';
export const CHARACTERS_LOADING = 'Loading characters…';
export const CHARACTER_LOADING = 'Loading character…';
export const GROUP_LOADING = 'Loading group…';
export const GROUP_UPDATING = 'Updating group…';
export const LIST_LOADING = 'Loading list…';
export const addingText = (name: string) => `Adding ${name}…`;
export const syncingText = (name: string) => `Syncing ${name}…`;
```

`src/components/character-card/CardProgressSkeleton.tsx`:

```tsx
import { Skeleton } from '@/components/skeleton/Skeleton';

/** The card's progress block while its BiS list loads: list label, count, bar, summary and crests. */
export function CardProgressSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <Skeleton className="h-4 w-24 rounded-md" />
        <Skeleton className="h-4 w-12 rounded-md" />
      </div>
      <Skeleton className="h-2.5 w-full rounded-full" />
      <Skeleton className="h-4 w-40 rounded-md" />
      <div className="flex gap-1.5">
        <Skeleton className="h-6 w-14 rounded-full" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
    </div>
  );
}
```

`src/components/character-card/CharacterCardSkeleton.tsx`:

```tsx
import { Skeleton } from '@/components/skeleton/Skeleton';
import { addingText } from '@/components/shared/loading-copy';
import { CardProgressSkeleton } from './CardProgressSkeleton';

/** A whole card's shape. With a name it is a card being added, and says so. */
export function CharacterCardSkeleton({ name }: { name?: string }) {
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-3.5">
        <Skeleton className="size-[52px] shrink-0 rounded-full" />
        <div className="flex min-w-0 grow flex-col gap-1.5">
          {name ? <span className="truncate text-xl font-bold">{name}</span> : <Skeleton className="h-6 w-32 rounded-md" />}
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-4 w-28 rounded-md" />
        </div>
      </div>
      <CardProgressSkeleton />
      <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
        {name ? <span role="status" className="text-sm text-muted">{addingText(name)}</span> : <Skeleton className="h-4 w-36 rounded-md" />}
      </div>
    </article>
  );
}
```

`src/components/character-card/CharacterCard.tsx`: add the imports `import { Skeleton } from '@/components/skeleton/Skeleton';` and `import { CardProgressSkeleton } from './CardProgressSkeleton';`, change the copy import to `import { BIS_LOADING, TRACKS_LOADING } from '@/components/shared/loading-copy';`, then replace the summary line:

```tsx
          {card.tracksLoading
            ? <><span role="status" className="sr-only">{TRACKS_LOADING}</span><Skeleton className="h-4 w-40 rounded-md" /></>
            : summary && <span className="text-sm text-muted">{summary}</span>}
```

and the final branch:

```tsx
      ) : card.bisError ? (
        <p className="text-sm text-muted">{card.bisError}</p>
      ) : (
        <><span role="status" className="sr-only">{BIS_LOADING}</span><CardProgressSkeleton /></>
      )}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/components/skeleton src/components/character-card`
Expected: PASS, including the existing `bis-summary` and `crest-line` tests.

- [ ] **Step 5: Commit**

`git add src/components/skeleton src/components/shared/loading-copy.ts src/components/character-card`, then commit with the `commit` skill: `feat: skeleton the character card while its data loads`.

---

### Task 3: Character page section skeletons and in-page swaps

**Files:**
- Create: `src/components/character-page/GearTableHeader.tsx`, `GearTableSkeleton.tsx`, `DungeonRowsSkeleton.tsx`, `DungeonPrioritySkeleton.tsx`, `VaultSectionSkeleton.tsx`, `CharacterPageSkeleton.tsx`, `GearTable.test.ts`, `skeletons.test.ts`
- Modify: `src/components/character-page/GearTable.tsx`, `src/components/character-page/DungeonPriority.tsx`, `src/components/character-page/DungeonPriority.test.ts`

**Interfaces:**
- Consumes: `Skeleton`, `BIS_LOADING`, `LIST_LOADING` (Task 2).
- Produces: `GearTableSkeleton({ status }: { status?: string })`, `DungeonPrioritySkeleton({ status }: { status?: string })`, `VaultSectionSkeleton({ status }: { status?: string })`, `CharacterPageSkeleton({ heading }: { heading?: ReactNode })`. All client-safe: no server-only imports.

- [ ] **Step 1: Write the failing tests**

`src/components/character-page/GearTable.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GearRowView } from '@/server/views/types';
import { GearTable } from './GearTable';

const equipped = { itemId: 271528, name: 'Enigmatic Dreamwatcher’s Somnolent Stare', itemLevel: 321, quality: 'EPIC' as const, bonusIds: [12], iconUrl: null, trackLabel: 'Myth 2/6' };
const row: GearRowView = {
  slotLabel: 'Head', slot: 'HEAD', state: 'done', equipped, equippedStats: null, upgrade: null,
  bis: { kind: 'item', ...equipped, isTier: false, isCatalyst: false, source: '', targetStats: null, targetIsTierPiece: false },
};
const render = (rows: GearRowView[], bisLoading: boolean) =>
  renderToStaticMarkup(createElement(GearTable, { rows, tracksKnown: true, bisLoading })).replace(/<link[^>]*\/>/g, '');

describe('GearTable loading', () => {
  it('shows skeleton rows under the real header while the BiS list loads', () => {
    const html = render([], true);
    expect(html).toContain('>Equipped<');
    expect((html.match(/animate-pulse/g) ?? []).length).toBeGreaterThanOrEqual(16 * 3);
    expect(html).toMatch(/<span role="status" class="sr-only">Loading BiS list…<\/span>/);
    expect(html.match(/role="status"/g)).toHaveLength(1);
  });

  it('keeps real rows when it has them, even while the BiS list reloads', () => {
    const html = render([row], true);
    expect(html).toContain('Enigmatic Dreamwatcher’s Somnolent Stare');
    expect(html).not.toContain('animate-pulse');
  });

  it('says there is no list when nothing is loading', () => {
    expect(render([], false)).toContain('No BiS list to compare against yet.');
  });
});
```

`src/components/character-page/skeletons.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CharacterPageSkeleton } from './CharacterPageSkeleton';
import { DungeonPrioritySkeleton } from './DungeonPrioritySkeleton';
import { GearTableSkeleton } from './GearTableSkeleton';
import { VaultSectionSkeleton } from './VaultSectionSkeleton';

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const statuses = (h: string) => h.match(/role="status"/g)?.length ?? 0;

describe('character page skeletons', () => {
  it('carry a status only when given one', () => {
    for (const C of [GearTableSkeleton, DungeonPrioritySkeleton, VaultSectionSkeleton]) {
      expect(statuses(html(createElement(C)))).toBe(0);
      const withStatus = html(createElement(C, { status: 'Loading list…' }));
      expect(statuses(withStatus)).toBe(1);
      expect(withStatus).toContain('<span role="status" class="sr-only">Loading list…</span>');
    }
  });

  it('keep the real headings and labels', () => {
    expect(html(createElement(GearTableSkeleton))).toContain('>Main Hand<');
    expect(html(createElement(DungeonPrioritySkeleton))).toContain('Dungeon priority</h2>');
    expect(html(createElement(VaultSectionSkeleton))).toContain('Great Vault</h2>');
  });

  it('builds the whole page with no status, under an optional heading', () => {
    const page = html(createElement(CharacterPageSkeleton, { heading: createElement('p', null, 'Adding birkibjörn – argent-dawn…') }));
    expect(page.indexOf('Adding birkibjörn')).toBeLessThan(page.indexOf('animate-pulse'));
    expect(page).toContain('aria-label="Gear by slot"');
    expect(page).toContain('aria-label="Dungeon priority"');
    expect(page).toContain('aria-label="Great Vault"');
    expect(statuses(page)).toBe(0);
  });
});
```

Add to `DungeonPriority.test.ts`, inside the `describe`:

```ts
  it('shows skeleton rows under the real heading while the season or BiS list loads', () => {
    for (const p of [{ ...base, season: 'loading' as const }, { ...base, bisLoading: true }]) {
      const html = render(p);
      expect(html).toContain('Dungeon priority</h2>');
      expect(html).toContain('animate-pulse');
      expect(html.match(/role="status"/g)).toHaveLength(1);
    }
    expect(render({ ...base, season: 'loading' })).toMatch(/<span role="status" class="sr-only">Loading this season’s loot…<\/span>/);
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/character-page`
Expected: FAIL: missing skeleton modules; GearTable has no `animate-pulse`; DungeonPriority renders a `<p>`.

- [ ] **Step 3: Implement the shapes**

`GearTableHeader.tsx`:

```tsx
export const GEAR_COLUMNS = 'md:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_190px]';

export function GearTableHeader() {
  return (
    <div className={`hidden grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_190px] gap-3 border-b border-line px-4 py-3 text-[13px] font-semibold uppercase tracking-wider text-muted md:grid`}>
      <span>Slot</span><span>Equipped</span><span>BiS</span><span>State</span>
    </div>
  );
}
```

`GearTableSkeleton.tsx`:

```tsx
import { Skeleton } from '@/components/skeleton/Skeleton';
import { SLOT_TYPES } from '@/core/types';
import { SLOT_LABELS } from '@/server/views/group-grid';
import { GEAR_COLUMNS, GearTableHeader } from './GearTableHeader';

/** One placeholder row per slot, on the gear table's grid. */
export function GearRowsSkeleton() {
  return SLOT_TYPES.map((slot) => (
    <div key={slot} className={`mx-2 my-1 grid grid-cols-1 gap-3 rounded-[10px] px-3 py-2 ${GEAR_COLUMNS} md:items-center`}>
      <span className="font-semibold text-muted">{SLOT_LABELS[slot]}</span>
      <Skeleton className="h-[62px] rounded-lg" />
      <Skeleton className="h-[62px] rounded-lg" />
      <Skeleton className="h-6 w-28 rounded-full" />
    </div>
  ));
}

export function GearTableSkeleton({ status }: { status?: string }) {
  return (
    <section aria-label="Gear by slot" className="flex flex-col rounded-2xl border border-line bg-surface py-1">
      {status && <span role="status" className="sr-only">{status}</span>}
      <GearTableHeader />
      <GearRowsSkeleton />
    </section>
  );
}
```

`DungeonRowsSkeleton.tsx`:

```tsx
import { Skeleton } from '@/components/skeleton/Skeleton';

/** Four ranked dungeons: name, score and the items each would credit. */
export function DungeonRowsSkeleton() {
  return (
    <ol aria-hidden="true" className="flex flex-col gap-4">
      {[2, 1, 2, 1].map((items, i) => (
        <li key={i} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <Skeleton className="h-5 w-40 rounded-md" />
            <Skeleton className="h-5 w-8 rounded-md" />
          </div>
          {Array.from({ length: items }, (_, j) => <Skeleton key={j} className="h-[62px] rounded-lg" />)}
        </li>
      ))}
    </ol>
  );
}
```

`DungeonPrioritySkeleton.tsx`:

```tsx
import { BrandIcon } from '@/components/brand-icon/BrandIcon';
import { DungeonRowsSkeleton } from './DungeonRowsSkeleton';

export function DungeonPrioritySkeleton({ status }: { status?: string }) {
  return (
    <section aria-label="Dungeon priority" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      {status && <span role="status" className="sr-only">{status}</span>}
      <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold"><BrandIcon name="dungeons" size={28} className="text-gold" />Dungeon priority</h2>
      <DungeonRowsSkeleton />
    </section>
  );
}
```

`VaultSectionSkeleton.tsx`:

```tsx
import { BrandIcon } from '@/components/brand-icon/BrandIcon';
import { Skeleton } from '@/components/skeleton/Skeleton';

const SUBHEADING = 'text-[13px] font-semibold uppercase tracking-wider text-muted';

export function VaultSectionSkeleton({ status }: { status?: string }) {
  return (
    <section aria-label="Great Vault" className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5">
      {status && <span role="status" className="sr-only">{status}</span>}
      <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold"><BrandIcon name="vault" size={28} className="text-gold" />Great Vault</h2>
      <div className="flex flex-col gap-2">
        <h3 className={SUBHEADING}>BiS items below Myth track</h3>
        <Skeleton className="h-[62px] rounded-lg" />
        <Skeleton className="h-[62px] rounded-lg" />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className={SUBHEADING}>This week&rsquo;s choices</h3>
        <Skeleton className="h-[62px] rounded-lg" />
        <Skeleton className="h-[62px] rounded-lg" />
        <Skeleton className="h-[62px] rounded-lg" />
      </div>
    </section>
  );
}
```

`CharacterPageSkeleton.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Skeleton } from '@/components/skeleton/Skeleton';
import { DungeonPrioritySkeleton } from './DungeonPrioritySkeleton';
import { GearTableSkeleton } from './GearTableSkeleton';
import { VaultSectionSkeleton } from './VaultSectionSkeleton';

/** The character page below the back link. The caller owns the status line. */
export function CharacterPageSkeleton({ heading }: { heading?: ReactNode }) {
  return (
    <>
      {heading}
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-[76px] shrink-0 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-56 rounded-md" />
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="h-4 w-44 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-10 w-64 rounded-xl" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
      <section aria-hidden="true" className="flex flex-col gap-2">
        <Skeleton className="h-4 w-16 rounded-md" />
        <div className="flex gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-7 w-20 rounded-full" />)}</div>
      </section>
      <Skeleton className="h-12 w-full max-w-xl rounded-xl" />
      <div className="flex gap-2 border-b border-line pb-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-6 w-24 rounded-md" />)}</div>
      <div className="grid grid-cols-1 gap-8 min-[1380px]:grid-cols-[860px_minmax(0,1fr)] min-[1380px]:items-start">
        <GearTableSkeleton />
        <div className="flex flex-col gap-8">
          <DungeonPrioritySkeleton />
          <VaultSectionSkeleton />
        </div>
      </div>
    </>
  );
}
```

The header, SimC paste bar, crests, settings and tabs bars are approximate. In Task 9, compare them against a loaded page and adjust heights so nothing jumps by more than a line.

- [ ] **Step 4: Swap the in-page waits**

`GearTable.tsx`: import `GearTableHeader` and `GearRowsSkeleton`, replace the inline header `div` with `<GearTableHeader />`, and replace the empty-rows block:

```tsx
      {rows.length === 0 && (bisLoading
        ? <><span role="status" className="sr-only">{BIS_LOADING}</span><GearRowsSkeleton /></>
        : <p className="p-6 text-muted">No BiS list to compare against yet.</p>)}
```

Use `GEAR_COLUMNS` from `GearTableHeader` in the real row's `className` in place of the repeated `md:grid-cols-[...]` string.

`DungeonPriority.tsx`: import `DungeonRowsSkeleton`, and in `Ranking` replace the first two lines:

```tsx
  if (priority.bisLoading) return <><span role="status" className="sr-only">{BIS_LOADING}</span><DungeonRowsSkeleton /></>;
  if (priority.season === 'loading') return <><span role="status" className="sr-only">{SEASON_LOADING}</span><DungeonRowsSkeleton /></>;
```

- [ ] **Step 5: Run them to see them pass**

Run: `npx vitest run src/components/character-page`
Expected: PASS, the existing DungeonPriority and VaultSection tests included. The existing "says the BiS list is loading" test still finds the sr-only text.

- [ ] **Step 6: Commit**

`feat: skeleton character page sections while they load`

---

### Task 4: Group grid, priority and vault skeletons, and skeleton cells

**Files:**
- Create: `src/components/group-grid/CellSkeleton.tsx`, `src/components/group-grid/GroupGridSkeleton.tsx`, `src/components/group-grid/GroupGridSkeleton.test.ts`
- Create: `src/components/group-priority/PriorityRowsSkeleton.tsx`, `src/components/group-priority/GroupPrioritySkeleton.tsx`
- Create: `src/components/group-vault/GroupVaultSkeleton.tsx`
- Modify: `src/components/group-grid/cell-note.ts`, `cell-note.test.ts`, `GroupGrid.tsx`, `GroupGrid.test.ts`
- Modify: `src/components/group-priority/GroupPriority.tsx`, `GroupPriority.test.ts`
- Modify: `src/components/group-layout/GroupLayout.tsx`, `GroupLayout.test.ts`

**Interfaces:**
- Consumes: `Skeleton`, `syncingText`, `BIS_LOADING` (Task 2).
- Produces: `GroupGridSkeleton({ members, status }: { members: number; status?: string })`, `GroupPrioritySkeleton({ status }: { status?: string })`, `GroupVaultSkeleton()`, all client-safe. `cellNote(...)` returns `{ text: string; dim: boolean } | { skeleton: true } | null`. `GroupLayout` takes `dungeonCount: number | null`.

- [ ] **Step 1: Write the failing tests**

`cell-note.test.ts`, replacing the `cellNote` test body:

```ts
  it('fills cells for members without rows, with skeletons for the ones still loading', () => {
    expect(cellNote('ready', true)).toBeNull();
    expect(cellNote('ready', false)).toEqual({ text: 'No BiS list', dim: false });
    expect(cellNote('ready', false, true)).toEqual({ skeleton: true });
    expect(cellNote('syncing', false)).toEqual({ skeleton: true });
    expect(cellNote('untracked', false)).toEqual({ text: 'Not tracked', dim: true });
    expect(cellNote('noGear', false)).toEqual({ text: 'No gear yet', dim: true });
    expect(cellNote('notFound', false)).toEqual({ text: 'Not found', dim: true });
  });
```

`GroupGrid.test.ts`, add inside the `describe`:

```ts
  it('fills a syncing member’s column with skeleton cells and says so once to screen readers', () => {
    const html = render([member({ name: 'Sólrún', key: 'eu.argent-dawn.sólrún', state: 'syncing', hasRows: false })], [{ slot: 'HEAD', label: 'Head', cells: [null] }]);
    expect(html).toContain('animate-pulse');
    expect(html).not.toContain('Syncing…<');
    expect(html.match(/Syncing Sólrún…/g)).toHaveLength(1);
  });

  it('fills a member’s column with skeleton cells while their BiS list loads, with the words in the notice row', () => {
    const html = render([member({ state: 'ready', hasRows: false, bisLoading: true, character: summary(3, 'Birkibjörn') })], [{ slot: 'HEAD', label: 'Head', cells: [null] }]);
    expect(html).toContain('animate-pulse');
    expect(html.match(/Loading BiS list…/g)).toHaveLength(1);
  });
```

`GroupGridSkeleton.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GroupGridSkeleton } from './GroupGridSkeleton';

const render = (members: number, status?: string) => renderToStaticMarkup(createElement(GroupGridSkeleton, { members, status }));

describe('GroupGridSkeleton', () => {
  it('has one column per requested member and one row per slot, slot names real', () => {
    const html = render(3);
    expect(html).toContain('--members:3');
    expect(html.match(/data-skeleton-cell/g)).toHaveLength(3 * 16);
    expect(html).toContain('Main Hand');
  });

  it('never draws fewer than one column', () => {
    expect(render(0)).toContain('--members:1');
  });

  it('carries a status only when given one', () => {
    expect(render(2)).not.toContain('role="status"');
    expect(render(2, 'Loading group…').match(/role="status"/g)).toHaveLength(1);
  });
});
```

`GroupPriority.test.ts`, add inside its `describe` (read the file first for its `render` helper and base fixture names, and use them):

```ts
  it('shows skeleton rows under the real heading while the season loads', () => {
    const html = render({ ...base, season: 'loading' });
    expect(html).toContain('Dungeon priority</h2>');
    expect(html).toContain('animate-pulse');
    expect(html).toMatch(/<span role="status" class="sr-only">Loading this season’s loot…<\/span>/);
  });
```

`GroupLayout.test.ts`, add:

```ts
  it('hides the dungeon count when it is unknown', () => {
    const html = renderToStaticMarkup(createElement(GroupLayout, { legend: null, gear: null, dungeons: null, vault: null, dungeonCount: null }));
    expect(html).not.toContain('font-mono text-xs text-muted');
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/group-grid src/components/group-priority src/components/group-layout`
Expected: FAIL on the new cases; `GroupLayout` also fails typecheck on `null`.

- [ ] **Step 3: Implement**

`cell-note.ts`:

```ts
/** What a member's cells show when there are no rows: a skeleton while waiting on data, else a short note. */
export function cellNote(state: GroupMemberState, hasRows: boolean, bisLoading = false): { text: string; dim: boolean } | { skeleton: true } | null {
  switch (state) {
    case 'ready': return hasRows ? null : bisLoading ? { skeleton: true } : { text: 'No BiS list', dim: false };
    case 'untracked': return { text: 'Not tracked', dim: true };
    case 'syncing': return { skeleton: true };
    case 'noGear': return { text: 'No gear yet', dim: true };
    case 'notFound': return { text: 'Not found', dim: true };
  }
}
```

Drop the now-unused `BIS_LOADING` import from `cell-note.ts`.

`CellSkeleton.tsx`:

```tsx
import { Skeleton } from '@/components/skeleton/Skeleton';

/** A cell's placeholder, the height of a real cell. */
export function CellSkeleton() {
  return <div data-skeleton-cell className="contents"><Skeleton className="min-h-[80px] rounded-lg sm:min-h-[68px]" /></div>;
}
```

`GroupGrid.tsx`: import `CellSkeleton` and `syncingText`. In the cell map:

```tsx
              if (note && 'skeleton' in note) return <CellSkeleton key={i} />;
              if (note) return <div key={i} className={`p-1 text-xs ${note.dim ? 'text-muted opacity-60' : 'text-muted'}`}>{note.text}</div>;
```

and after `<MemberNotices members={members} />`:

```tsx
        {members.filter((m) => m.state === 'syncing').map((m) => <span key={m.key} role="status" className="sr-only">{syncingText(m.name)}</span>)}
```

(`sr-only` is absolutely positioned, so these take no grid cell.)

`GroupGridSkeleton.tsx`:

```tsx
import type { CSSProperties } from 'react';
import { Skeleton } from '@/components/skeleton/Skeleton';
import { SLOT_TYPES } from '@/core/types';
import { SLOT_LABELS } from '@/server/views/group-grid';
import { CellSkeleton } from './CellSkeleton';
import { COLUMNS } from './columns';
import { SLOT_SHORT } from './slot-short';

/** The grid's shape for a membership the server hasn't rendered yet. */
export function GroupGridSkeleton({ members, status }: { members: number; status?: string }) {
  const count = Math.max(1, members);
  const columns = Array.from({ length: count }, (_, i) => i);
  return (
    <section aria-label="Gear by slot" className="rounded-2xl border border-line bg-surface p-1 sm:p-2">
      {status && <span role="status" className="sr-only">{status}</span>}
      <div className={`grid gap-[3px] sm:gap-1.5 ${COLUMNS}`} style={{ '--members': count } as CSSProperties}>
        <span className="self-end p-1 text-xs font-semibold uppercase tracking-wider text-muted"><span className="sr-only sm:not-sr-only">Slot</span></span>
        {columns.map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 p-1 sm:items-start sm:p-2">
            <Skeleton className="h-[26px] w-full max-w-28 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
        {SLOT_TYPES.map((slot) => (
          <div key={slot} className="contents">
            <span className="flex items-center text-xs font-semibold text-muted sm:text-sm">
              <span aria-hidden="true" className="sm:hidden">{SLOT_SHORT[slot]}</span>
              <span className="sr-only sm:not-sr-only">{SLOT_LABELS[slot]}</span>
            </span>
            {columns.map((i) => <CellSkeleton key={i} />)}
          </div>
        ))}
      </div>
    </section>
  );
}
```

Move `COLUMNS` out of `GroupGrid.tsx` into `src/components/group-grid/columns.ts` (`export const COLUMNS = '...'`, same string) and import it in both.

Note the `--members:3` assertion: React renders the style as `--members:3`. If it renders differently, match what it renders.

`PriorityRowsSkeleton.tsx`:

```tsx
import { Skeleton } from '@/components/skeleton/Skeleton';

/** Five ranked dungeon rows. */
export function PriorityRowsSkeleton() {
  return (
    <ol aria-hidden="true" className="flex flex-col gap-1.5">
      {[0, 1, 2, 3, 4].map((i) => <li key={i}><Skeleton className="h-[52px] rounded-lg" /></li>)}
    </ol>
  );
}
```

`GroupPrioritySkeleton.tsx`:

```tsx
import { PriorityRowsSkeleton } from './PriorityRowsSkeleton';

export function GroupPrioritySkeleton({ status }: { status?: string }) {
  return (
    <section aria-label="Dungeon priority" className="flex flex-col gap-3">
      {status && <span role="status" className="sr-only">{status}</span>}
      <h2 className="font-display text-xl font-bold whitespace-nowrap">Dungeon priority</h2>
      <PriorityRowsSkeleton />
    </section>
  );
}
```

Compare the `h-[52px]` with a real `DungeonRow` in Task 9 and adjust.

`GroupPriority.tsx`, first line of `Ranking`:

```tsx
  if (priority.season === 'loading') return <><span role="status" className="sr-only">{SEASON_LOADING}</span><PriorityRowsSkeleton /></>;
```

`GroupVaultSkeleton.tsx`:

```tsx
import { Skeleton } from '@/components/skeleton/Skeleton';

export function GroupVaultSkeleton() {
  return (
    <section aria-label="Great Vault" className="flex flex-col gap-5">
      <h2 className="font-display text-xl font-bold whitespace-nowrap">Great Vault</h2>
      {[0, 1].map((i) => (
        <div key={i} aria-hidden="true" className="flex flex-col gap-2">
          <div className="flex items-center gap-2"><Skeleton className="size-6 rounded-full" /><Skeleton className="h-4 w-32 rounded-md" /></div>
          <Skeleton className="h-[62px] rounded-lg" />
          <Skeleton className="h-[62px] rounded-lg" />
        </div>
      ))}
    </section>
  );
}
```

`GroupLayout.tsx`: `dungeonCount: number | null` in `Props`, and render the count only when it isn't null:

```tsx
            {id === 'dungeons' && dungeonCount !== null && <span className="font-mono text-xs text-muted">{dungeonCount}</span>}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/components/group-grid src/components/group-priority src/components/group-vault src/components/group-layout`
Expected: PASS.

- [ ] **Step 5: Commit**

`feat: skeleton group cells and panels while they load`

---

### Task 5: List-tab switches skeleton their sections

**Files:**
- Create: `src/components/list-switch/ListSwitchProvider.tsx`, `src/components/list-switch/WhileListSettled.tsx`, `src/components/list-switch/list-switch.test.ts`
- Modify: `src/components/character-page/ListTabs.tsx`
- Modify: `src/app/characters/[region]/[realm]/[name]/page.tsx`

**Interfaces:**
- Consumes: `GearTableSkeleton`, `DungeonPrioritySkeleton`, `VaultSectionSkeleton` (Task 3), `LIST_LOADING` (Task 2).
- Produces: `ListSwitchProvider({ listType, children }: { listType: ListType; children?: ReactNode })`, `useListSwitch(): { listType: ListType; pending: boolean; select: (listType: ListType, href: string) => void }`, `WhileListSettled({ fallback, children }: { fallback: ReactNode; children?: ReactNode })`. `ListTabs` props become `Pick<CharacterPageView, 'href' | 'counts'>`.

- [ ] **Step 1: Write the failing test**

`src/components/list-switch/list-switch.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ListTabs } from '@/components/character-page/ListTabs';
import { ListSwitchProvider } from './ListSwitchProvider';
import { WhileListSettled } from './WhileListSettled';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }) }));

const counts = { overall: { bis: 4, total: 16 }, raid: { bis: 2, total: 16 }, mythicPlus: { bis: 9, total: 16 } };
const href = '/characters/eu/argent-dawn/birkibj%C3%B6rn';

describe('list switch', () => {
  it('renders each tab as a link to its list and marks the rendered list', () => {
    const html = renderToStaticMarkup(createElement(ListSwitchProvider, { listType: 'raid' }, createElement(ListTabs, { href, counts })));
    expect(html).toContain(`href="${href}?list=overall"`);
    expect(html).toContain(`href="${href}?list=mythicPlus"`);
    expect(html).toMatch(/<a[^>]*href="[^"]*\?list=raid"[^>]*aria-current="page"/);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it('shows the settled content when nothing is pending', () => {
    const html = renderToStaticMarkup(createElement(ListSwitchProvider, { listType: 'raid' },
      createElement(WhileListSettled, { fallback: createElement('p', null, 'skeleton') }, createElement('p', null, 'gear'))));
    expect(html).toBe('<p>gear</p>');
  });
});
```

If the attribute order in `<a>` differs, loosen the regex to check the raid link's own tag for `aria-current="page"`.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/list-switch`
Expected: FAIL, cannot resolve `./ListSwitchProvider`.

- [ ] **Step 3: Implement**

`ListSwitchProvider.tsx`:

```tsx
'use client';

import { createContext, useContext, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { ListType } from '@/core/types';

interface ListSwitch {
  /** The list asked for, which runs ahead of the rendered one while it loads. */
  listType: ListType;
  pending: boolean;
  select: (listType: ListType, href: string) => void;
}

const ListSwitchContext = createContext<ListSwitch | null>(null);

export function useListSwitch(): ListSwitch {
  const value = useContext(ListSwitchContext);
  if (!value) throw new Error('useListSwitch needs a ListSwitchProvider above it.');
  return value;
}

/** Owns a list-tab switch, so the sections that depend on the list can show skeletons while it loads. */
export function ListSwitchProvider({ listType: rendered, children }: { listType: ListType; children?: ReactNode }) {
  const router = useRouter();
  const [requested, setRequested] = useState(rendered);
  const [pending, startTransition] = useTransition();
  function select(listType: ListType, href: string) {
    setRequested(listType);
    // A transition holds the page instead of showing the route's loading.tsx, and its pending flag lasts until the new list renders.
    startTransition(() => router.push(href, { scroll: false }));
  }
  return <ListSwitchContext.Provider value={{ listType: pending ? requested : rendered, pending, select }}>{children}</ListSwitchContext.Provider>;
}
```

`WhileListSettled.tsx`:

```tsx
'use client';

import type { ReactNode } from 'react';
import { useListSwitch } from './ListSwitchProvider';

/** Shows `fallback` while a list switch is loading. */
export function WhileListSettled({ fallback, children }: { fallback: ReactNode; children?: ReactNode }) {
  return <>{useListSwitch().pending ? fallback : children}</>;
}
```

`ListTabs.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useListSwitch } from '@/components/list-switch/ListSwitchProvider';
import { LIST_TYPES, type ListType } from '@/core/types';
import type { CharacterPageView } from '@/server/views/types';

const LIST_NAMES: Record<ListType, string> = { overall: 'Overall', raid: 'Raid', mythicPlus: 'Mythic+' };

export function ListTabs({ href, counts }: Pick<CharacterPageView, 'href' | 'counts'>) {
  const { listType, select } = useListSwitch();
  return (
    <nav aria-label="BiS lists" className="flex gap-2 border-b border-line">
      {LIST_TYPES.map((l) => {
        const tabHref = `${href}?list=${l}`;
        return (
          // onNavigate runs only for a plain client-side click, so middle-click and modifier clicks still open new tabs.
          <Link key={l} href={tabHref} aria-current={l === listType ? 'page' : undefined}
            onNavigate={(e) => { e.preventDefault(); select(l, tabHref); }}
            className={`-mb-px border-b-2 px-4 py-3 font-semibold no-underline ${l === listType ? 'border-gold text-ink' : 'border-transparent text-muted'}`}>
            {LIST_NAMES[l]} <span className="font-mono text-sm">{counts[l].bis}/{counts[l].total}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

Character `page.tsx`, tracked branch: wrap everything after the back link in `<ListSwitchProvider listType={view.listType}>`, render `<ListTabs href={view.href} counts={view.counts} />`, and wrap the three sections:

```tsx
        <WhileListSettled fallback={<GearTableSkeleton status={LIST_LOADING} />}>
          <GearTable rows={view.rows} tracksKnown={view.tracksKnown} bisLoading={view.bisLoading} />
        </WhileListSettled>
        <div className="flex flex-col gap-8">
          <WhileListSettled fallback={<DungeonPrioritySkeleton />}>
            <DungeonPriority priority={view.priority} specLabel={`${view.spec} ${view.className}`} />
          </WhileListSettled>
          <WhileListSettled fallback={<VaultSectionSkeleton />}>
            <VaultSection vault={view.vault} vaultChoices={view.vaultChoices} vaultChoicesAt={view.vaultChoicesAt} now={now} />
          </WhileListSettled>
        </div>
```

Keep `StaleSync` and both `BackgroundSync` elements inside `main`, outside the provider or inside it; either works. Only the gear fallback carries a status, so a switch announces once.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/components/list-switch src/components/character-page && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

`feat: skeleton list sections while a tab switch loads`

---

### Task 6: Group edits skeleton the panels for the requested membership

**Files:**
- Create: `src/components/group-body/group-body-mode.ts`, `group-body-mode.test.ts`, `panel-box.ts`, `GroupBody.tsx`, `GroupBody.test.ts`
- Modify: `src/app/group/page.tsx`
- Modify: `src/components/group-members/GroupMembers.tsx`

**Interfaces:**
- Consumes: `useGroupEdits()` from `src/components/group-edits/GroupEditsProvider.tsx` (`{ keys: string[]; pending: boolean; ... }`), `GroupGridSkeleton`, `GroupPrioritySkeleton`, `GroupVaultSkeleton`, `GroupLayout` with `dungeonCount: number | null` (Task 4), `GROUP_UPDATING` (Task 2).
- Produces: `groupBodyMode(pending: boolean, requestedCount: number, hasContent: boolean): 'empty' | 'skeleton' | 'content'`; `PANEL_BOX: string`; `GroupBody({ legend, empty, content })` with `content: GroupBodyContent | null`, where `GroupBodyContent = { notice: ReactNode; gear: ReactNode; dungeons: ReactNode; vault: ReactNode; dungeonCount: number }`.

- [ ] **Step 1: Write the failing tests**

`group-body-mode.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { groupBodyMode } from './group-body-mode';

describe('groupBodyMode', () => {
  it('shows the empty state whenever nobody is requested, even mid-edit', () => {
    expect(groupBodyMode(false, 0, false)).toBe('empty');
    expect(groupBodyMode(true, 0, true)).toBe('empty');
    expect(groupBodyMode(true, 0, false)).toBe('empty');
  });

  it('shows skeletons while an edit to a non-empty group is pending, with or without rendered content', () => {
    expect(groupBodyMode(true, 1, false)).toBe('skeleton');
    expect(groupBodyMode(true, 3, true)).toBe('skeleton');
  });

  it('shows the rendered panels once settled', () => {
    expect(groupBodyMode(false, 2, true)).toBe('content');
  });

  it('falls back to the empty state if settled without content', () => {
    expect(groupBodyMode(false, 2, false)).toBe('empty');
  });
});
```

`GroupBody.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GroupEditsProvider } from '@/components/group-edits/GroupEditsProvider';
import { GroupBody } from './GroupBody';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }) }));

const p = (text: string) => createElement('p', null, text);
const render = (keys: string[], hasContent: boolean) => renderToStaticMarkup(createElement(GroupEditsProvider, { keys },
  createElement(GroupBody, {
    legend: p('legend'), empty: p('Pick up to five characters'),
    content: hasContent ? { notice: null, gear: p('real grid'), dungeons: p('real dungeons'), vault: p('real vault'), dungeonCount: 7 } : null,
  })));

describe('GroupBody', () => {
  it('renders the server panels once settled', () => {
    const html = render(['eu.argent-dawn.birkibjörn'], true);
    expect(html).toContain('real grid');
    expect(html).toContain('legend');
    expect(html).toContain('>7</span>');
    expect(html).not.toContain('animate-pulse');
  });

  it('renders the empty text for an empty group', () => {
    const html = render([], false);
    expect(html).toBe('<p>Pick up to five characters</p>');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/group-body`
Expected: FAIL, modules missing.

- [ ] **Step 3: Implement**

`group-body-mode.ts`:

```ts
export type GroupBodyMode = 'empty' | 'skeleton' | 'content';

/** What the group page shows below the picker, from the membership asked for and whether the server has rendered it. */
export function groupBodyMode(pending: boolean, requestedCount: number, hasContent: boolean): GroupBodyMode {
  if (requestedCount === 0) return 'empty';
  if (pending) return 'skeleton';
  return hasContent ? 'content' : 'empty';
}
```

`panel-box.ts`, moved from `src/app/group/page.tsx`:

```ts
// Below xl the Dungeons and Vault panels are boxes of their own; at xl they sit inside the rail's box.
export const PANEL_BOX = 'rounded-2xl border border-line bg-surface p-4 xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0';
```

`GroupBody.tsx`:

```tsx
'use client';

import type { ReactNode } from 'react';
import { useGroupEdits } from '@/components/group-edits/GroupEditsProvider';
import { GroupGridSkeleton } from '@/components/group-grid/GroupGridSkeleton';
import { GroupLayout } from '@/components/group-layout/GroupLayout';
import { GroupPrioritySkeleton } from '@/components/group-priority/GroupPrioritySkeleton';
import { GroupVaultSkeleton } from '@/components/group-vault/GroupVaultSkeleton';
import { groupBodyMode } from './group-body-mode';
import { PANEL_BOX } from './panel-box';

export interface GroupBodyContent { notice: ReactNode; gear: ReactNode; dungeons: ReactNode; vault: ReactNode; dungeonCount: number }

/**
 * The group page below the picker. It reads the membership asked for, which runs ahead of the server's render
 * during an edit, so the skeleton has one column per requested member. Both branches render GroupLayout at the
 * same place, so the selected phone tab survives an edit.
 */
export function GroupBody({ legend, empty, content }: { legend: ReactNode; empty: ReactNode; content: GroupBodyContent | null }) {
  const { keys, pending } = useGroupEdits();
  const mode = groupBodyMode(pending, keys.length, content !== null);
  if (mode === 'empty') return <>{empty}</>;
  const live = mode === 'content' ? content : null;
  return (
    <>
      {live?.notice ?? null}
      <GroupLayout
        dungeonCount={live ? live.dungeonCount : null}
        legend={legend}
        gear={live ? live.gear : <GroupGridSkeleton members={keys.length} />}
        dungeons={live ? live.dungeons : <div className={PANEL_BOX}><GroupPrioritySkeleton /></div>}
        vault={live ? live.vault : <div className={PANEL_BOX}><GroupVaultSkeleton /></div>}
      />
    </>
  );
}
```

`src/app/group/page.tsx`: delete the local `PANEL_BOX` and import it from `@/components/group-body/panel-box`. Replace the `view.members.length === 0 ? ... : ...` block with:

```tsx
        <GroupBody
          legend={<StateLegend />}
          empty={<p className="text-muted">Pick up to five characters to compare their gear and rank dungeons for the group.</p>}
          content={view.members.length === 0 ? null : {
            notice: view.tracksLoading ? <p role="status" className="text-muted">{TRACKS_LOADING}</p> : null,
            gear: <GroupGrid members={view.members} grid={view.grid} tracksKnown={view.tracksKnown} />,
            dungeons: <div className={PANEL_BOX}><GroupPriority priority={view.priority} /></div>,
            vault: <div className={PANEL_BOX}><GroupVault vault={view.vault} now={now} /></div>,
            dungeonCount: view.priority.ranking?.dungeons.length ?? 0,
          }}
        />
```

Drop the now-unused `GroupLayout` import from the page.

`GroupMembers.tsx`: import `GROUP_UPDATING` and make the pending line screen-reader-only:

```tsx
        {pending && <span role="status" className="sr-only">{GROUP_UPDATING}</span>}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/components/group-body src/components/group-members src/components/group-grid && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

`feat: skeleton group panels for the requested members while an edit loads`

---

### Task 7: Route loading skeletons

**Files:**
- Create: `src/app/loading.tsx`, `src/app/group/loading.tsx`, `src/app/characters/[region]/[realm]/[name]/loading.tsx`, `src/app/loading.test.ts`

**Interfaces:**
- Consumes: `CharacterCardSkeleton`, `CharacterPageSkeleton`, `GroupGridSkeleton`, `GroupPrioritySkeleton`, `GroupVaultSkeleton`, `GroupLayout`, `PANEL_BOX`, `Skeleton`, copy constants.

- [ ] **Step 1: Write the failing test**

`vitest.config.ts` includes `src/**/*.test.ts`, so a test under `src/app` runs.

`src/app/loading.test.ts`:

```ts
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CharacterLoading from './characters/[region]/[realm]/[name]/loading';
import GroupLoading from './group/loading';
import HomeLoading from './loading';

const render = (C: () => ReactElement) => renderToStaticMarkup(createElement(C)).replace(/<link[^>]*\/>/g, '');

describe('route skeletons', () => {
  it.each([
    ['home', HomeLoading, 'Loading characters…', '>Characters</h1>'],
    ['group', GroupLoading, 'Loading group…', '>Group</h1>'],
    ['character', CharacterLoading, 'Loading character…', 'All characters'],
  ])('%s announces once and keeps its static parts real', (_, C, status, real) => {
    const html = render(C);
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).toContain(`<p role="status" class="sr-only">${status}</p>`);
    expect(html).toContain(real);
    expect(html).toContain('animate-pulse');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/app/loading.test.ts`
Expected: FAIL, modules missing.

- [ ] **Step 3: Implement**

`src/app/loading.tsx`:

```tsx
import { CharacterCardSkeleton } from '@/components/character-card/CharacterCardSkeleton';
import { CHARACTERS_LOADING } from '@/components/shared/loading-copy';
import { Skeleton } from '@/components/skeleton/Skeleton';
import { StateLegend } from '@/components/state-legend/StateLegend';

export default function Loading() {
  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-12 sm:px-16">
      <p role="status" className="sr-only">{CHARACTERS_LOADING}</p>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-4xl font-bold tracking-wide">Characters</h1>
        <p className="text-[17px] text-muted">BiS progress against Method&rsquo;s lists</p>
      </div>
      <Skeleton className="h-[114px] rounded-2xl" />
      <StateLegend />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <CharacterCardSkeleton key={i} />)}
      </div>
    </main>
  );
}
```

`src/app/group/loading.tsx`:

```tsx
import { PANEL_BOX } from '@/components/group-body/panel-box';
import { GroupGridSkeleton } from '@/components/group-grid/GroupGridSkeleton';
import { GroupLayout } from '@/components/group-layout/GroupLayout';
import { GroupPrioritySkeleton } from '@/components/group-priority/GroupPrioritySkeleton';
import { GroupVaultSkeleton } from '@/components/group-vault/GroupVaultSkeleton';
import { GROUP_LOADING } from '@/components/shared/loading-copy';
import { Skeleton } from '@/components/skeleton/Skeleton';
import { StateLegend } from '@/components/state-legend/StateLegend';

export default function Loading() {
  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-12 sm:px-8 2xl:px-16">
      <p role="status" className="sr-only">{GROUP_LOADING}</p>
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-4xl font-bold tracking-wide">Group</h1>
        <div className="flex flex-wrap gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-40 rounded-full" />)}</div>
      </div>
      <GroupLayout dungeonCount={null} legend={<StateLegend />}
        gear={<GroupGridSkeleton members={5} />}
        dungeons={<div className={PANEL_BOX}><GroupPrioritySkeleton /></div>}
        vault={<div className={PANEL_BOX}><GroupVaultSkeleton /></div>} />
    </main>
  );
}
```

`src/app/characters/[region]/[realm]/[name]/loading.tsx`:

```tsx
import Link from 'next/link';
import { CharacterPageSkeleton } from '@/components/character-page/CharacterPageSkeleton';
import { CHARACTER_LOADING } from '@/components/shared/loading-copy';

export default function Loading() {
  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-10 sm:px-16">
      <p role="status" className="sr-only">{CHARACTER_LOADING}</p>
      <Link href="/" className="text-sm">&larr; All characters</Link>
      <CharacterPageSkeleton />
    </main>
  );
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/app/loading.test.ts`
Expected: PASS. If `GroupLayout` (a client component with `useState`) fails to render statically, it shouldn't: `GroupLayout.test.ts` already renders it.

- [ ] **Step 5: Check the search-param behavior with the real code**

With dev running: open a character, switch tabs, and confirm the route skeleton never shows, only the three section skeletons. Edit the group and confirm the picker stays. If the route skeleton shows on either, stop and tell the owner (see Task 1).

- [ ] **Step 6: Commit**

`feat: show page skeletons while a route loads`

---

### Task 8: Named skeleton card while adding, and the auto-add page skeleton

**Files:**
- Create: `src/components/pending-character/PendingCharacterProvider.tsx`
- Create: `src/components/character-grid/CharacterGrid.tsx`, `src/components/character-grid/CharacterGrid.test.ts`
- Modify: `src/components/add-character-bar/AddCharacterBar.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/components/auto-add-character/AutoAddCharacter.tsx`

**Interfaces:**
- Consumes: `CharacterCardSkeleton({ name })` (Task 2), `CharacterPageSkeleton({ heading })` (Task 3), `addingText` (Task 2).
- Produces: `PendingCharacterProvider({ children })`, `usePendingCharacter(): { name: string | null; setName: (name: string | null) => void } | null`, `CharacterGrid({ count, empty, children }: { count: number; empty: ReactNode; children?: ReactNode })`.

- [ ] **Step 1: Write the failing test**

`CharacterGrid.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PendingCharacterProvider } from '@/components/pending-character/PendingCharacterProvider';
import { CharacterGrid } from './CharacterGrid';

const render = (count: number, withProvider = true) => {
  const grid = createElement(CharacterGrid, { count, empty: createElement('p', null, 'No characters yet.') }, createElement('article', null, 'Birkibjörn'));
  return renderToStaticMarkup(withProvider ? createElement(PendingCharacterProvider, null, grid) : grid);
};

describe('CharacterGrid', () => {
  it('shows the empty text when there are no cards and nothing is being added', () => {
    expect(render(0)).toBe('<p>No characters yet.</p>');
  });

  it('lays the cards out in the grid', () => {
    const html = render(1);
    expect(html).toContain('xl:grid-cols-4');
    expect(html).toContain('<article>Birkibjörn</article>');
    expect(html).not.toContain('Adding');
  });

  it('works without a provider', () => {
    expect(render(1, false)).toContain('<article>Birkibjörn</article>');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/character-grid`
Expected: FAIL, modules missing.

- [ ] **Step 3: Implement**

`PendingCharacterProvider.tsx`:

```tsx
'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface PendingCharacter { name: string | null; setName: (name: string | null) => void }

const PendingCharacterContext = createContext<PendingCharacter | null>(null);

/** The name being added from the bar, or null. Null outside a provider: the bar then shows its own line. */
export function usePendingCharacter(): PendingCharacter | null {
  return useContext(PendingCharacterContext);
}

export function PendingCharacterProvider({ children }: { children?: ReactNode }) {
  const [name, setName] = useState<string | null>(null);
  return <PendingCharacterContext.Provider value={{ name, setName }}>{children}</PendingCharacterContext.Provider>;
}
```

`CharacterGrid.tsx`:

```tsx
'use client';

import type { ReactNode } from 'react';
import { CharacterCardSkeleton } from '@/components/character-card/CharacterCardSkeleton';
import { usePendingCharacter } from '@/components/pending-character/PendingCharacterProvider';

/** The card grid, with a named skeleton card at the end while one is being added. */
export function CharacterGrid({ count, empty, children }: { count: number; empty: ReactNode; children?: ReactNode }) {
  const adding = usePendingCharacter()?.name ?? null;
  if (count === 0 && !adding) return <>{empty}</>;
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {children}
      {adding && <CharacterCardSkeleton name={adding} />}
    </div>
  );
}
```

`AddCharacterBar.tsx`: import `useLayoutEffect` and `usePendingCharacter`. After `const pending = busy || navigating;`:

```tsx
  const shared = usePendingCharacter();
  const setSharedName = shared?.setName;
  // One value says whether a card is being added; it clears with the error on a failed add and with the refresh on success.
  const showing = pending && addingName ? addingName : null;
  // Layout effect: the skeleton card leaves in the same paint the real card arrives, never beside it.
  useLayoutEffect(() => {
    setSharedName?.(showing);
    return () => setSharedName?.(null);
  }, [setSharedName, showing]);
```

and change the bar's own line to show only without a provider:

```tsx
      {!shared && showing && <p role="status" className="w-full text-sm text-muted">Adding {showing}…</p>}
```

Update the comment above the three paragraphs to say the "Adding…" line moves to the card when the page provides one.

`src/app/page.tsx`: wrap the `<main>` content in `<PendingCharacterProvider>` (the `AddCharacterBar` and the grid both inside), and replace the empty/grid ternary with:

```tsx
      <CharacterGrid count={cards.length} empty={<p className="text-muted">No characters yet. Search for one above.</p>}>
        {cards.map((card) => <CharacterCard key={card.id} card={card} now={now} />)}
      </CharacterGrid>
```

`AutoAddCharacter.tsx`: import `CharacterPageSkeleton` and `addingText`, and replace the return:

```tsx
  return error
    ? <p role="alert" className="text-[#f3c9a2]">{error}</p>
    : <CharacterPageSkeleton heading={<p role="status" className="text-muted">{addingText(`${name} – ${realmSlug}`)}</p>} />;
```

The page renders this inside its `<main>` with `gap-8`, and `CharacterPageSkeleton` returns a fragment, so its parts space out like the real page.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/components/character-grid src/components/add-character-bar && npm run typecheck`
Expected: PASS, the existing add-bar tests included.

- [ ] **Step 5: Commit**

`feat: show a named skeleton card while a character is added`

---

### Task 9: Full gate, build and hand checks

- [ ] **Step 1: Gate**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all clean. Record the test count.

- [ ] **Step 2: Build**

Stop `npm run dev` first. Run: `npm run build`
Expected: success.

- [ ] **Step 3: Hand checks (local, Chrome dev tools, Network throttled to Slow 4G)**

Run each check on the dev server, and repeat the tab-switch and group-edit checks on `npx next start -p 3001` after the build. Restart dev afterwards.

- Open `/`, `/group` and a character from the nav and from a card: the route skeleton shows, then the page.
- On a character whose BiS and season data are loaded, switch list tabs: the clicked tab is marked at once; the gear table, dungeons and vault skeleton, then the new list renders. Header, settings and tabs never blank.
- Click three tabs quickly: the page settles on the last one.
- Middle-click a tab: it opens in a new browser tab, and the current page doesn't skeleton.
- Group, empty, add one member: one skeleton column shows before the server answers.
- Group with one member, remove it: the empty text shows at once.
- Group with two members, add a third and a fourth before the first edit settles: three, then four skeleton columns; the picker stays usable.
- Phone width (375 px), pick the Vault tab, edit the group: the Vault tab stays selected.
- On `/`, add a character from the bar: a named skeleton card appears at the end of the grid, then the real card, never both at once.
- On `/`, add a misspelled name: the error shows and no skeleton card stays.
- Open an untracked character's path: the "Adding…" line and the page skeleton show, then the page.
- OS reduced motion on: skeletons don't pulse.
- Compare each skeleton with its loaded page at 375 px, 1024 px and 1440 px: no jump of more than about a line when content lands. Adjust heights in the skeleton files if needed, and commit as `fix: match skeleton heights to loaded sections`.

Record who checked what, on which commit, in the pull request's Testing section. Name anything not checked.

- [ ] **Step 4: Push and open the pull request**

Push `feat/skeleton-loaders`. Open the pull request per `AGENTS.md`: opens with `Closes #87.`, then `## What changes`, `## Testing` (test count, typecheck, lint and build status, hand checks done, gaps such as "no browser tests: transitions checked by hand"), then `Spec: docs/superpowers/specs/2026-10-10-skeleton-loaders-design.md`. Move #87 to In review.
