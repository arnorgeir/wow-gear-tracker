# Character Page Loader Implementation Plan

> **For agentic workers:** Implement inline, task by task, with TDD. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every click on a link to a character's page gives visible feedback: the route skeleton when Next has it prefetched, otherwise a pending cue on the clicked link until the skeleton or the page arrives.

**Architecture:** A route `loading.tsx` beside the character page renders the existing `CharacterPageSkeleton` under a real back link. A tiny client component, `LinkPending`, reads `useLinkStatus()` inside each link to a character page and fades in a spinner ring after 100 ms while that navigation is blocked. Its class choice is a pure function with unit tests.

**Tech Stack:** Next.js 16 App Router (read `node_modules/next/dist/docs/` before relying on any API; `useLinkStatus` is in `01-app/03-api-reference/04-functions/use-link-status.md`), React 19, Tailwind v4, Vitest with `renderToStaticMarkup`.

**Spec:** `docs/superpowers/specs/2026-10-13-character-page-loader-design.md`. The spec wins where this plan disagrees.

## Global Constraints

- Branch: `feat/character-page-loader`, cut from fetched `origin/main`. If the spec and plan haven't reached `main` yet, cut it from `claude/project-thread-cuuh1m` and say so in the pull request.
- One `role="status"` in the route skeleton. The link cue is `aria-hidden` and carries no status.
- The cue's box is always rendered; only opacity changes. No layout shift.
- Spin classes: `animate-spin motion-reduce:animate-none`. No new color token: the ring uses `currentColor`.
- Links stay server-rendered. Only `LinkPending` is `'use client'`.
- No change to any link's `prefetch`. No new dependency. No schema change, migration or cache version bump.
- Tests are `*.test.ts` beside the code, rendering with `createElement` and `renderToStaticMarkup`. Outside the Next runtime `useLinkStatus` returns its idle default (`{ pending: false }`), so static renders work without mocks.
- Fixtures use made-up names such as Birkibjörn.
- Commits: `type: lowercase imperative summary`, through the repo's `commit` skill. No AI attribution.
- Before calling work done: `npm run typecheck && npm run lint && npm test`, and `npm run build` with dev stopped.

## Clarifications of the spec

These follow the spec's intent and change no behavior:

- **Probe timing in a cloud session.** The spec's probe needs `.env` and a local database. A local implement session runs Task 1 before Task 2. A cloud session skips Task 1, builds Tasks 2 to 5, and lists all six probe cases as owner hand checks in the pull request's Testing section. If a probe case then fails, the pull request stops for the owner, as the spec says. The changes are small and additive, so building first costs little.
- **The ring.** `inline-block size-[0.8em] rounded-full border-2 border-current border-r-transparent`. `em` sizing keeps it matched to each link's text size without per-link props. With reduced motion it is a static three-quarter ring.
- **Fade timing.** Pending: `opacity-100 delay-100`. Idle: `opacity-0 delay-0`. Both carry `transition-opacity`. So the cue appears 100 ms after a blocked click and disappears at once when the navigation commits.

## Review Focus

1. **A warm click must not flash the cue.** A prefetched route commits to the fallback at once, so `pending` lasts less than the 100 ms delay. Probe case 1 checks it by hand.
2. **The card name still truncates.** The link becomes a flex row; the name moves into its own `truncate min-w-0` span. Task 4 tests the markup; check a long name by hand.
3. **Phones on `/group`:** the member name is `sr-only` there, so the cue sits beside the avatar. Check that the header doesn't grow.
4. **Refreshes never show the route skeleton** (probe case 5).

## File Structure

| File | Job |
|---|---|
| `src/components/shared/loading-copy.ts` | Adds `CHARACTER_LOADING` |
| `src/app/characters/[region]/[realm]/[name]/loading.tsx`, `loading.test.ts` | The route skeleton |
| `src/components/link-pending/link-pending-class.ts`, `.test.ts` | Idle or pending classes |
| `src/components/link-pending/LinkPending.tsx`, `LinkPending.test.ts` | The cue |
| `src/components/character-card/CharacterCard.tsx` | Cue on the card name |
| `src/components/group-grid/MemberHeader.tsx` | Cue on the member name and "Import SimC" |
| `src/components/bis-editor/EditorHeader.tsx` | Cue on the "Used by" chips |
| `src/app/(home)/loading.tsx` | Comment no longer names the character page |

---

### Task 1: Probe the route skeleton and the cue (local only)

Throwaway. Needs the local server with `.env` and a database holding at least one tracked character. **In a cloud session, skip this task** (see Clarifications).

**Files (all reverted at the end, except the ones Tasks 2 to 4 keep):**
- Create: `src/app/characters/[region]/[realm]/[name]/loading.tsx` (Task 2's version)
- Create: `src/components/link-pending/` (Task 3's version)
- Modify: `src/components/character-card/CharacterCard.tsx` (Task 4's card change only)
- Modify: `src/app/characters/[region]/[realm]/[name]/page.tsx` (temporary delay)

- [ ] **Step 1:** Write Task 2's `loading.tsx`, Task 3's `LinkPending` and Task 4's card change, without tests yet.
- [ ] **Step 2:** Add a temporary delay at the top of `CharacterPage`: `await new Promise((r) => setTimeout(r, 2000));`.
- [ ] **Step 3:** Stop dev. `npm run build`, then `npx next start -p 3001`. Run the spec's probe cases 1 to 6 ("Probe first"). For each, record the time from click to first visible feedback, what it was, and whether the document reloaded (the network panel shows a document request).
- [ ] **Step 4:** Start dev (`npm run dev`). Repeat cases 2 and 5.
- [ ] **Step 5:** Remove the delay. `git diff -- 'src/app/characters/[region]/[realm]/[name]/page.tsx'` must print nothing.
- [ ] **Step 6:** If any case missed its expectation, stop and report the table to the owner. Otherwise keep the files from Step 1 and go on to Task 2, writing their tests first and watching them pass against the kept code.

Put the results table in the pull request's Testing section.

### Task 2: Route skeleton

**Files:**
- Modify: `src/components/shared/loading-copy.ts`
- Create: `src/app/characters/[region]/[realm]/[name]/loading.tsx`
- Test: `src/app/characters/[region]/[realm]/[name]/loading.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Loading from './loading';

describe('character route skeleton', () => {
  it('announces once, keeps the back link real and shows every section', () => {
    const html = renderToStaticMarkup(createElement(Loading));
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).toContain('<p role="status" class="sr-only">Loading character…</p>');
    expect(html).toMatch(/<a [^>]*href="\/"[^>]*>← All characters<\/a>/);
    expect(html).toContain('aria-label="Gear by slot"');
    expect(html).toContain('aria-label="Dungeon priority"');
    expect(html).toContain('aria-label="Great Vault"');
  });
});
```

- [ ] **Step 2:** `npx vitest run 'src/app/characters/[region]/[realm]/[name]/loading.test.ts'`. Expected: FAIL, cannot resolve `./loading`.

- [ ] **Step 3: Add the copy.** In `loading-copy.ts`, after `CHARACTERS_LOADING`:

```ts
export const CHARACTER_LOADING = 'Loading character…';
```

- [ ] **Step 4: Write `loading.tsx`**

```tsx
import Link from 'next/link';
import { CharacterPageSkeleton } from '@/components/character-page/CharacterPageSkeleton';
import { CHARACTER_LOADING } from '@/components/shared/loading-copy';

// Safe beside the character page: it reads no search params, and its actions only refresh,
// which keeps the current UI. /group still can't have one (see the skeleton loaders spec).
export default function Loading() {
  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-10 sm:px-16">
      <Link href="/" className="text-sm">&larr; All characters</Link>
      <p role="status" className="sr-only">{CHARACTER_LOADING}</p>
      <CharacterPageSkeleton />
    </main>
  );
}
```

- [ ] **Step 5:** Run the test. Expected: PASS. If the back-link regex misses because of how `&larr;` serializes, match on `>← All characters</a>` and `href="/"` separately.
- [ ] **Step 6:** Commit: `feat: show character page skeleton while it loads`.

### Task 3: The link cue

**Files:**
- Create: `src/components/link-pending/link-pending-class.ts`, `link-pending-class.test.ts`
- Create: `src/components/link-pending/LinkPending.tsx`, `LinkPending.test.ts`

- [ ] **Step 1: Write the failing unit test**

```ts
import { describe, expect, it } from 'vitest';
import { linkPendingClass } from './link-pending-class';

describe('linkPendingClass', () => {
  const words = (s: string) => s.split(' ');

  it('hides the ring at once when idle', () => {
    expect(words(linkPendingClass(false))).toEqual(expect.arrayContaining(['opacity-0', 'delay-0']));
    expect(words(linkPendingClass(false))).not.toContain('opacity-100');
  });

  it('fades the ring in after 100 ms when pending', () => {
    expect(words(linkPendingClass(true))).toEqual(expect.arrayContaining(['opacity-100', 'delay-100']));
    expect(words(linkPendingClass(true))).not.toContain('opacity-0');
  });

  it('keeps the same box and stops spinning under reduced motion either way', () => {
    for (const pending of [false, true]) {
      expect(words(linkPendingClass(pending))).toEqual(expect.arrayContaining(['size-[0.8em]', 'shrink-0', 'animate-spin', 'motion-reduce:animate-none', 'transition-opacity']));
    }
  });
});
```

- [ ] **Step 2:** Run it. Expected: FAIL, module not found.

- [ ] **Step 3: Write `link-pending-class.ts`**

```ts
const RING = 'inline-block size-[0.8em] shrink-0 rounded-full border-2 border-current border-r-transparent animate-spin motion-reduce:animate-none transition-opacity';

/** The ring is always in the layout; only its opacity says whether the link's navigation is still blocked. */
export function linkPendingClass(pending: boolean): string {
  return `${RING} ${pending ? 'opacity-100 delay-100' : 'opacity-0 delay-0'}`;
}
```

- [ ] **Step 4:** Run it. Expected: PASS.

- [ ] **Step 5: Write the failing render test** `LinkPending.test.ts`:

```ts
import { createElement } from 'react';
import Link from 'next/link';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LinkPending } from './LinkPending';

describe('LinkPending', () => {
  it('renders one hidden, idle ring inside a link, with no status', () => {
    const html = renderToStaticMarkup(createElement(Link, { href: '/characters/eu/argent-dawn/birkibj%C3%B6rn' }, 'Birkibjörn', createElement(LinkPending)));
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(1);
    expect(html).toContain('opacity-0');
    expect(html).not.toContain('role="status"');
  });
});
```

- [ ] **Step 6:** Run it. Expected: FAIL, module not found.

- [ ] **Step 7: Write `LinkPending.tsx`**

```tsx
'use client';

import { useLinkStatus } from 'next/link';
import { linkPendingClass } from './link-pending-class';

/** Goes inside a Link. Shows only while that link's navigation waits on a route Next hasn't prefetched. */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return <span aria-hidden="true" className={linkPendingClass(pending)} />;
}
```

- [ ] **Step 8:** Run both tests. Expected: PASS.
- [ ] **Step 9:** Commit: `feat: add pending cue for slow link navigations`.

### Task 4: Put the cue on every link to a character page

**Files:**
- Modify: `src/components/character-card/CharacterCard.tsx`, test `CharacterCard.test.ts`
- Modify: `src/components/group-grid/MemberHeader.tsx`, test in `GroupGrid.test.ts` (or a new `MemberHeader.test.ts` if `GroupGrid.test.ts` doesn't render headers with and without crests)
- Modify: `src/components/bis-editor/EditorHeader.tsx`, test in `BisEditor.test.ts`

- [ ] **Step 1: Write the failing tests.** For each, find the character link by its `href` and assert the cue's ring is inside it:

```ts
// CharacterCard.test.ts
it('puts the pending cue inside the name link, with the name in its own truncating span', () => {
  const html = render(card({}));
  expect(html).toMatch(/<a [^>]*href="\/characters\/eu\/argent-dawn\/birkibj%C3%B6rn"[^>]*><span class="[^"]*truncate[^"]*">Birkibjörn<\/span><span aria-hidden="true" class="[^"]*animate-spin/);
});
```

```ts
// member header: a member with crests (name link) and one without (name link and Import SimC link)
// each link to c.href contains exactly one `animate-spin` ring
```

```ts
// BisEditor.test.ts: a view with one "Used by" character; its chip link contains one `animate-spin` ring
```

Write the member header and editor tests out in full with the fixtures those files already use.

- [ ] **Step 2:** Run the three test files. Expected: the new tests FAIL, no ring.

- [ ] **Step 3: Card.** In `CharacterCard.tsx`, replace the name link:

```tsx
<Link href={card.href} className="inline-flex min-w-0 items-center gap-1.5 text-xl font-bold no-underline hover:underline" style={{ color }}>
  <span className="truncate">{card.name}</span><LinkPending />
</Link>
```

Import `LinkPending` from `@/components/link-pending/LinkPending`.

- [ ] **Step 4: Member header.** In `MemberHeader.tsx`, add `<LinkPending />` as the last child of the name link (after the name span) and after the "Import SimC" text:

```tsx
<span className="sr-only truncate sm:not-sr-only">{c.name}</span>
<LinkPending />
```

```tsx
) : <Link href={c.href} className="inline-flex items-center gap-1 text-xs">Import SimC<LinkPending /></Link>}
```

- [ ] **Step 5: Editor chips.** In `EditorHeader.tsx`, add `<LinkPending />` after `{c.name}` inside the chip link. The chip already has `inline-flex items-center gap-2`.

- [ ] **Step 6:** Run the three test files. Expected: PASS. Run `npm test` to catch markup assertions elsewhere that the new span breaks, and update them only where they pinned the old link markup.
- [ ] **Step 7:** Commit: `feat: show pending cue on character links`.

### Task 5: Comment and gate

**Files:**
- Modify: `src/app/(home)/loading.tsx`

- [ ] **Step 1:** Replace its comment with:

```tsx
// Scoped to `/` by the (home) route group: a loading boundary above /group makes its
// search-param navigations reload the whole document (see the skeleton loaders spec).
```

- [ ] **Step 2:** `npm run typecheck && npm run lint && npm test`. All clean.
- [ ] **Step 3:** Stop dev. `npm run build`. Clean.
- [ ] **Step 4:** Commit: `docs: drop character page from home loading note`.

### Task 6: Hand checks and pull request

- [ ] **Step 1:** Run the spec's hand checks ("Testing"), locally, or list them as owner checks in a cloud session.
- [ ] **Step 2:** Open the pull request per `AGENTS.md`: `Closes #112.`, `## What changes` (route skeleton, link cue, comment), `## Testing` with the test count, gate results, the probe table or "Probe not run: cloud session, owner check", and the gaps the spec lists under "Not covered". Close with `Spec: docs/superpowers/specs/2026-10-13-character-page-loader-design.md`.
- [ ] **Step 3:** Move #112 to In review and continue with the `review-loop` skill.
