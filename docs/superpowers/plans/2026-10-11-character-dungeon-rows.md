# Character Dungeon Rows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, inline, as `docs/workflow.md` step 4 says. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The character page's Dungeon priority rows become the group page's collapsible rows (rank, thumbnail, name, score), through one shared component.

**Architecture:** The character page view gains `shortName` and `imageUrl` per dungeon from `dungeonArt()`. The `<details>` shell moves out of `group-priority/DungeonRow.tsx` into a new `dungeon-disclosure/DungeonDisclosure.tsx`, and `DungeonThumbnail` moves to `dungeon-thumbnail/`. Both pages render `DungeonDisclosure`. The group page's markup does not change.

**Tech Stack:** Next.js server components, React 19, Tailwind v4, Vitest with `renderToStaticMarkup`, in-memory SQLite through `openTestDb()`.

**Spec:** `docs/superpowers/specs/2026-10-11-character-dungeon-rows-design.md`. Spec review: `docs/reviews/2026-10-11-character-dungeon-rows-design.md`, passed. The spec wins over this plan.

## Global Constraints

- Branch: `feat/character-dungeon-rows`. The spec commit is already on it. Rebase on `origin/main` before the pull request if `main` moved.
- Rank 1 starts open (`open={rank === 1}`). Every other dungeon starts closed.
- Credits, scores, ordering, notices and wording do not change on either page.
- The group page's rendered markup does not change. Existing `GroupPriority.test.ts` passes without edits.
- Every component lives in its own kebab-case directory. Imports go through `@/`, relative only inside a component's own directory.
- `DungeonDisclosure` stays a server component. Only `DungeonThumbnail` has `'use client'`.
- Commits: `type: lowercase imperative summary`, written with the `commit` skill. No AI attribution.
- Gate before done: `npm run typecheck && npm run lint && npm test`, then `npm run build` (pages and components change). Don't build while `npm run dev` serves this folder.

## Review Focus

No task's unit tests cover these. Each one goes in the hand-check list in Task 6, and where a static test can pin it, the owning task adds one.

1. **Long dungeon name at 375 px:** the name truncates and the score stays visible on the same line. Task 4 pins the `min-w-0 truncate` class on the character page's `h3`.
2. **Screen reader:** the summary announces the name, the score with its "Score" prefix, and expanded or collapsed. Static markup can't prove this. Hand check (review note 2).
3. **List switch (`?list=`):** after switching lists, rank 1 of the new list is open. A row the user closed on the old list doesn't leak its state into an unrelated dungeon. Rows are keyed by `challengeModeId`. Hand check.
4. **Broken image URL:** the short-name tile replaces it, including when the image fails before hydration. The thumbnail component already handles this; the move must not break it. Hand check with the image blocked.
5. **Wowhead tooltips inside an open row:** `ItemCard` links still show the tooltip after a row is opened. `WowheadRefresh` scans the DOM once, and the closed rows' links already exist in it. Hand check.

---

### Task 1: Dungeon art on the character page view

**Files:**
- Modify: `src/server/views/types.ts:83` (`DungeonPriorityView`)
- Modify: `src/server/views/character-page.ts:78-84`
- Test: `src/server/views/views.test.ts` (`describe('dungeon priority')`)
- Modify fixtures: `src/components/character-page/DungeonPriority.test.ts` (type only)

**Interfaces:**
- Produces: `DungeonPriorityView { challengeModeId: number; name: string; shortName: string; imageUrl: string | null; score: number; split: boolean; credits: PriorityCreditView[] }`

- [ ] **Step 1: Write the failing tests**

In `views.test.ts`, the first test in `describe('dungeon priority')` uses `toEqual`, so it fails until the fields exist. Give Alpha Hollow an image in `withSeason` and expect both fields:

```ts
const AH_ART = 'https://cdn.raiderio.net/images/dungeons/alpha-hollow.jpg';
// in withSeason: Alpha Hollow gets imageUrl: AH_ART; Beta Spire keeps imageUrl: null
```

```ts
    expect(page!.priority.dungeons).toEqual([{
      challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', imageUrl: AH_ART, score: 3, split: false,
      credits: [{ kind: 'item', slotLabel: 'Cloak', weight: 3, item: expect.objectContaining({ itemId: 30, iconUrl: 'https://i/30.jpg' }) }],
    }]);
```

In the tier test ("credits a tier need with each dungeon’s own drop"), both dungeons rank. Give 501 `imageUrl: AH_ART`, keep 502 `null`, and add:

```ts
    const art = (name: string) => { const d = page!.priority.dungeons.find((x) => x.name === name)!; return { shortName: d.shortName, imageUrl: d.imageUrl }; };
    expect(art('Alpha Hollow')).toEqual({ shortName: 'AH', imageUrl: AH_ART });
    expect(art('Beta Spire')).toEqual({ shortName: 'BS', imageUrl: null });
```

Review note 1: this covers a known dungeon with art and one without an image. Don't mock ranking to reach the unmatched-ID fallback; `dungeon-art.test.ts` already covers it.

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run src/server/views/views.test.ts -t "dungeon priority"`
Expected: FAIL. The received objects lack `shortName` and `imageUrl`.

- [ ] **Step 3: Implement**

`types.ts`:

```ts
export interface DungeonPriorityView { challengeModeId: number; name: string; shortName: string; imageUrl: string | null; score: number; split: boolean; credits: PriorityCreditView[] }
```

`character-page.ts`: import `dungeonArt` from `./dungeon-art` and spread it after `name`, as `group-page.ts:95` does:

```ts
      dungeons: ranks.filter((d) => d.score > 0).map((d) => ({
        challengeModeId: d.challengeModeId,
        name: d.name,
        ...dungeonArt(season.dungeons, d.challengeModeId),
        score: d.score,
        split: d.split,
        credits: d.characters.flatMap((c) => c.credits).map((cr) => creditView(cr, icons)),
      })),
```

`season` is already in scope: `character-page.ts:40` reads it, and line 41 ranks `season.dungeons`.

In `DungeonPriority.test.ts`, add `shortName: 'AH', imageUrl: null` to the Alpha Hollow fixture and `shortName: 'STRT', imageUrl: null` to the Streets of Beta fixture, so typecheck passes.

- [ ] **Step 4: Run the tests and the typecheck**

Run: `npx vitest run src/server/views src/components/character-page && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

`feat: give character page dungeons their art`. Files: the four above.

---

### Task 2: Move DungeonThumbnail to its own directory

**Files:**
- Move: `src/components/group-priority/DungeonThumbnail.tsx` → `src/components/dungeon-thumbnail/DungeonThumbnail.tsx`
- Move: `src/components/group-priority/thumbnail-label.ts` → `src/components/dungeon-thumbnail/thumbnail-label.ts`
- Move: `src/components/group-priority/thumbnail-label.test.ts` → `src/components/dungeon-thumbnail/thumbnail-label.test.ts`
- Modify: `src/components/group-priority/DungeonRow.tsx:6`

**Interfaces:**
- Produces: `DungeonThumbnail({ imageUrl, shortName }: { imageUrl: string | null; shortName: string })` at `@/components/dungeon-thumbnail/DungeonThumbnail`.

A pure move, so there's no new failing test. The moved test and `GroupPriority.test.ts` are the guard.

- [ ] **Step 1: Move the files**

```sh
mkdir -p src/components/dungeon-thumbnail
git mv src/components/group-priority/DungeonThumbnail.tsx src/components/dungeon-thumbnail/DungeonThumbnail.tsx
git mv src/components/group-priority/thumbnail-label.ts src/components/dungeon-thumbnail/thumbnail-label.ts
git mv src/components/group-priority/thumbnail-label.test.ts src/components/dungeon-thumbnail/thumbnail-label.test.ts
```

The file contents stay the same. Their relative `./thumbnail-label` imports still resolve.

- [ ] **Step 2: Update the import**

In `DungeonRow.tsx`:

```ts
import { DungeonThumbnail } from '@/components/dungeon-thumbnail/DungeonThumbnail';
```

- [ ] **Step 3: Verify**

Run: `npx vitest run src/components/dungeon-thumbnail src/components/group-priority && npm run typecheck && npm run lint`
Expected: PASS, both clean. `grep -rn "group-priority/DungeonThumbnail\|group-priority/thumbnail-label" src` prints nothing.

- [ ] **Step 4: Commit**

`chore: move dungeon thumbnail to its own directory`, with the body line: "Character page will import it too."

---

### Task 3: Extract the shared DungeonDisclosure

**Files:**
- Create: `src/components/dungeon-disclosure/DungeonDisclosure.tsx`
- Create: `src/components/dungeon-disclosure/DungeonDisclosure.test.ts`
- Modify: `src/components/group-priority/DungeonRow.tsx`

**Interfaces:**
- Consumes: `DungeonThumbnail` from Task 2.
- Produces:

```ts
export function DungeonDisclosure(props: {
  rank: number; name: string; score: number; imageUrl: string | null; shortName: string;
  summaryExtra?: ReactNode; children: ReactNode;
}): JSX.Element
```

- [ ] **Step 1: Write the failing test**

`DungeonDisclosure.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DungeonDisclosure } from './DungeonDisclosure';

const render = (rank: number, summaryExtra?: string) => renderToStaticMarkup(createElement(DungeonDisclosure,
  { rank, name: 'Alpha Hollow', score: 8, imageUrl: null, shortName: 'AH', summaryExtra }, 'Body text'))
  .replace(/<link[^>]*\/>/g, '');

describe('DungeonDisclosure', () => {
  it('opens only rank 1', () => {
    expect(render(1)).toMatch(/^<details open=""/);
    expect(render(2)).not.toContain('open=""');
  });

  it('puts rank, name, score and the extra line in the summary, and children in the body', () => {
    const html = render(3, 'Chips here');
    const summary = html.slice(html.indexOf('<summary'), html.indexOf('</summary>'));
    expect(summary).toContain('>3<');
    expect(summary).toMatch(/<h3 class="min-w-0 truncate[^"]*">Alpha Hollow<\/h3>/);
    expect(summary).toContain('<span class="sr-only">Score </span>8');
    expect(summary).toContain('Chips here');
    expect(html.indexOf('Body text')).toBeGreaterThan(html.indexOf('</summary>'));
  });

  it('leaves out the extra line when none is given', () => {
    expect(render(1)).not.toContain('flex flex-wrap gap-1');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/dungeon-disclosure`
Expected: FAIL, `Cannot find module './DungeonDisclosure'`.

- [ ] **Step 3: Implement DungeonDisclosure**

This is the shell from `DungeonRow.tsx`, with the classes copied exactly:

```tsx
import type { ReactNode } from 'react';
import { DungeonThumbnail } from '@/components/dungeon-thumbnail/DungeonThumbnail';

type Props = { rank: number; name: string; score: number; imageUrl: string | null; shortName: string; summaryExtra?: ReactNode; children: ReactNode };

/** One ranked dungeon as a native disclosure: rank, art, name and score in the summary. Rank 1 starts open. */
export function DungeonDisclosure({ rank, name, score, imageUrl, shortName, summaryExtra, children }: Props) {
  return (
    <details open={rank === 1} className="group rounded-xl border border-line-strong bg-raised">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-xl p-2.5 focus-visible:outline-2 focus-visible:outline-gold [&::-webkit-details-marker]:hidden">
        <span className="w-7 shrink-0 text-center font-mono text-lg font-bold">{rank}</span>
        <DungeonThumbnail imageUrl={imageUrl} shortName={shortName} />
        <span className="flex min-w-0 grow flex-col gap-1">
          <span className="flex items-baseline justify-between gap-2">
            <h3 className="min-w-0 truncate font-display text-base font-bold">{name}</h3>
            <span className="shrink-0 font-mono text-gold" title="Score = weighted upgrades"><span className="sr-only">Score </span>{score}</span>
          </span>
          {summaryExtra && <span className="flex flex-wrap gap-1">{summaryExtra}</span>}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true" className="shrink-0 text-muted transition group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
      </summary>
      <div className="flex flex-col gap-2.5 px-2.5 pb-3">{children}</div>
    </details>
  );
}
```

- [ ] **Step 4: Make DungeonRow use it**

```tsx
import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { DungeonDisclosure } from '@/components/dungeon-disclosure/DungeonDisclosure';
import { classTextColor } from '@/components/shared/class-colors';
import { SPLIT_DUNGEON } from '@/components/shared/priority-copy';
import type { GroupDungeonView } from '@/server/views/types';
import { CreditChip } from './CreditChip';

/** One ranked dungeon: who benefits in the summary, their needs inside. */
export function DungeonRow({ dungeon, rank }: { dungeon: GroupDungeonView; rank: number }) {
  const chips = dungeon.members.map((m) => (
    <span key={m.key} title={`${m.name}: ${m.credits.length} ${m.credits.length === 1 ? 'need' : 'needs'}`}
      className="inline-flex h-[22px] items-center gap-1 rounded-full border border-line bg-surface pl-0.5 pr-1.5 font-mono text-xs">
      <CharacterAvatar name={m.name} className={m.className} avatarUrl={m.avatarUrl} classIconUrl={m.classIconUrl} size={18} />
      <span className="sr-only">{m.name}: </span>{m.credits.length}
    </span>
  ));
  return (
    <DungeonDisclosure rank={rank} name={dungeon.name} score={dungeon.score} imageUrl={dungeon.imageUrl} shortName={dungeon.shortName} summaryExtra={chips}>
      {dungeon.split && <p className="text-xs text-muted">{SPLIT_DUNGEON}</p>}
      {dungeon.members.map((m) => (
        <div key={m.key} className="flex items-start gap-2">
          <span className="flex w-24 min-w-0 shrink-0 items-center gap-1.5 pt-1.5">
            <CharacterAvatar name={m.name} className={m.className} avatarUrl={m.avatarUrl} classIconUrl={m.classIconUrl} size={20} />
            <span className="truncate text-sm font-semibold" style={{ color: classTextColor(m.className) }}>{m.name}</span>
          </span>
          <ul className="flex flex-wrap gap-1">
            {m.credits.map((c, j) => <li key={j}><CreditChip credit={c} /></li>)}
          </ul>
        </div>
      ))}
    </DungeonDisclosure>
  );
}
```

`dungeon.members` is never empty for a ranked dungeon, so `summaryExtra` is always a non-empty array and the chip line renders as before.

- [ ] **Step 5: Prove the group markup didn't change**

Before Step 4, add a temporary inline snapshot to `GroupPriority.test.ts` and run it on the old `DungeonRow` to record the markup:

```ts
  it('TEMP: group row markup', () => {
    expect(render({ ...base, ranking: { nothingFrom: [], dungeons: [dungeon({}), dungeon({ challengeModeId: 502, name: 'Streets of Beta', split: true })] } })).toMatchInlineSnapshot();
  });
```

Run `npx vitest run src/components/group-priority -u`, then apply Step 4 and run `npx vitest run src/components/group-priority src/components/dungeon-disclosure` without `-u`. Expected: PASS. A failure means the markup changed, so fix `DungeonDisclosure` until it is byte-identical. Then delete the temporary test, so `GroupPriority.test.ts` ends unedited.

- [ ] **Step 6: Commit**

`feat: share the dungeon disclosure row`. Files: `dungeon-disclosure/*`, `group-priority/DungeonRow.tsx`.

---

### Task 4: Character page rows use DungeonDisclosure

**Files:**
- Modify: `src/components/character-page/DungeonPriority.tsx` (`Ranking`)
- Test: `src/components/character-page/DungeonPriority.test.ts`

**Interfaces:**
- Consumes: `DungeonDisclosure` (Task 3), `DungeonPriorityView.shortName`/`imageUrl` (Task 1).

- [ ] **Step 1: Write the failing test**

Add to `DungeonPriority.test.ts`:

```ts
  it('makes each dungeon a details row like the group page, the first one open', () => {
    const d = (challengeModeId: number, name: string, score: number, split = false) =>
      ({ challengeModeId, name, shortName: '', imageUrl: null, score, split, credits: [{ kind: 'any' as const, slotLabel: 'Boots', weight: score, minItemLevel: 334 }] });
    const html = render({ ...base, dungeons: [d(501, 'Alpha Hollow', 8), d(502, 'Streets of Beta', 3, true)] });
    expect(html.match(/<details/g)).toHaveLength(2);
    expect(html.match(/<details open=""/g)).toHaveLength(1);
    expect(html.indexOf('<details open=""')).toBeLessThan(html.indexOf('Alpha Hollow'));
    expect(html).toMatch(/<h3 class="min-w-0 truncate[^"]*">Alpha Hollow<\/h3>/);
    expect(html).toContain('<span class="sr-only">Score </span>8');
    expect(html).toMatch(/>2<\/span>/);
    const second = html.slice(html.lastIndexOf('<details'));
    expect(second.indexOf('Split dungeon')).toBeGreaterThan(second.indexOf('</summary>'));
    expect(second.indexOf('Any item, level 334+')).toBeGreaterThan(second.indexOf('</summary>'));
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/character-page/DungeonPriority.test.ts`
Expected: FAIL, because there's no `<details` in the output.

- [ ] **Step 3: Implement**

In `DungeonPriority.tsx`, import `DungeonDisclosure` from `@/components/dungeon-disclosure/DungeonDisclosure` and replace the ready-state `ol`:

```tsx
      <ol className="flex flex-col gap-1.5">
        {priority.dungeons.map((d, i) => (
          <li key={d.challengeModeId} className="min-w-0">
            <DungeonDisclosure rank={i + 1} name={d.name} score={d.score} imageUrl={d.imageUrl} shortName={d.shortName}>
              {d.split && <p className="text-xs text-muted">{SPLIT_DUNGEON}</p>}
              {d.credits.map((credit, j) => <Credit key={j} credit={credit} />)}
            </DungeonDisclosure>
          </li>
        ))}
      </ol>
```

The split note changes from a `span` to a `p` with the same classes and text, matching the group body. Leave everything else in the file as it is.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/character-page`
Expected: PASS, including the existing wording tests ("Split dungeon", "Any item, level 334+", "Nothing you need from").

- [ ] **Step 5: Commit**

`feat: collapsible dungeon rows on the character page`, with the body line: "Matches group page: rank, art, score, rank 1 open. Closes #80 scope."

---

### Task 5: Skeleton matches the new rows

**Files:**
- Modify: `src/components/character-page/DungeonRowsSkeleton.tsx`
- Test: `src/components/character-page/skeletons.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `skeletons.test.ts`, importing `DungeonRowsSkeleton` from `./DungeonRowsSkeleton`:

```ts
  it('draws one open dungeon row and three closed ones', () => {
    const rows = html(createElement(DungeonRowsSkeleton));
    expect(rows).toContain('flex flex-col gap-1.5');
    expect(rows.match(/<li/g)).toHaveLength(4);
    expect(rows.match(/h-\[58px\]/g)).toHaveLength(4);
    expect(rows.match(/h-\[62px\]/g)).toHaveLength(2);
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/character-page/skeletons.test.ts`
Expected: FAIL. The old gap is `gap-4`, and there are no 58 px blocks.

- [ ] **Step 3: Implement**

```tsx
import { Skeleton } from '@/components/skeleton/Skeleton';

/** Four ranked dungeons like the loaded rows: the first open with two items, three closed. */
export function DungeonRowsSkeleton() {
  return (
    <ol aria-hidden="true" className="flex flex-col gap-1.5">
      <li className="flex flex-col gap-2.5 rounded-xl border border-line-strong pb-3">
        <Skeleton className="h-[58px] rounded-xl" />
        <div className="flex flex-col gap-2.5 px-2.5">
          <Skeleton className="h-[62px] rounded-lg" />
          <Skeleton className="h-[62px] rounded-lg" />
        </div>
      </li>
      {[1, 2, 3].map((i) => <li key={i}><Skeleton className="h-[58px] rounded-xl" /></li>)}
    </ol>
  );
}
```

58 px is approximate (review note 3): a 36 px thumbnail, 20 px of padding and the 2 px border. The hand check in Task 6 confirms it against the loaded rows. Adjust the number there if the measured jump is visible, and update the test with it.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/character-page`
Expected: PASS.

- [ ] **Step 5: Commit**

`feat: shape character dungeon skeleton like the new rows`

---

### Task 6: Gate, hand checks and pull request

- [ ] **Step 1: Full gate**

Stop `npm run dev` if it serves this folder, or build in a separate worktree. Then:

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all clean. Record the test count.

- [ ] **Step 2: Hand checks**

Run them on `npm start` (production) or dev, with a real viewport at 375 px and at 1440 px. Record the browser, the screen reader and the measured `innerWidth` for each (review note 2).

- Rank 1 open, others closed. Tab reaches each summary with the gold outline. Enter and Space toggle it.
- **Screen reader** (NVDA or Narrator on Windows): on each summary it reads the dungeon name, "Score N", and expanded or collapsed. Compare with the group page's rows; they should read the same way.
- Long name at 375 px truncates, and the score stays on the line (Review Focus 1).
- Switch `?list=`: rank 1 of the new list is open (Review Focus 3).
- Block one thumbnail URL (devtools request blocking): the short-name tile shows (Review Focus 4).
- Open a closed row and hover an item: the Wowhead tooltip shows (Review Focus 5).
- Slow the season or list load. Compare the skeleton with the loaded section at both widths and record the document heights. There should be no large jump (review note 3).
- The group page looks unchanged.

- [ ] **Step 3: Pull request**

Push, open the pull request against `main`, and set #80 to In review. Follow the format in `AGENTS.md`: `Closes #80.`, `## What changes`, `## Testing` with the test count, gate results, hand checks done and gaps (screen reader if not run), and `Spec: docs/superpowers/specs/2026-10-11-character-dungeon-rows-design.md`. No AI attribution.
