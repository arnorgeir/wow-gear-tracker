# Top Menu Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the header's floating nav pills into tabs that stand on the header's bottom line, with the current page in gold and a second row of tabs on phones.

**Architecture:** Two files change. `src/app/layout.tsx` (server component) lays out the header: one 64 px row from `sm` up, and a brand row above a tab row below `sm`. `src/components/main-nav/MainNav.tsx` (the only client component, for `usePathname`) renders one set of links whose layout switches with Tailwind responsive classes, so the nav is never rendered twice. `isActiveLink`, `LINKS`, `BrandMark` and `BrandIcon` don't change.

**Tech Stack:** Next 16 App Router, React, Tailwind v4 (tokens in `src/app/globals.css` `@theme`), Vitest with `renderToStaticMarkup`.

**Spec:** `docs/superpowers/specs/2026-10-05-top-menu-tabs-design.md`

## Global Constraints

- Breakpoint: one-row layout at 640 px (`sm`) and wider; two rows below.
- Desktop bar 64 px tall (was 72), container `max-w-[1440px]`, `px-4 sm:px-16`.
- Brand: crest 32 px, name 21 px on desktop; crest 26 px, name 17 px in a 52 px row on phones.
- Tabs: 40 px after the brand, 4 px apart, 16 px side padding, 24 px icon, 15 px semibold label, 8 px icon gap. Phone tabs: equal width, icon above a 13 px label, 8 px padding above and 10 px below.
- Current tab: label and icon `text-gold`, 2 px gold inset underline, 11 px solid gold diamond centred on the bottom line (desktop only, `hidden sm:block`). Other tabs `text-muted`, `hover:text-ink`, no pill background.
- Focus: `focus-visible:outline-2 focus-visible:outline-gold` on the brand and each tab; tabs add `focus-visible:-outline-offset-2`.
- The centred header diamond is removed. The right end of the bar stays empty.
- No new tokens. No Dungeons tab.
- Page content may move only by the header's height change: −8 px on desktop, and the phone header's increase (about +39 px) on phones.

## Review Focus

- **The character page (`/characters/<id>`) marks Characters as current.** `isActiveLink` already covers it. The test mocks `usePathname` as `/group` only, so check by hand on a character page.
- **A long label at 640 px.** The brand and two tabs need about 420 px of the 512 px available. Check at exactly 640 px that nothing wraps or overflows.
- **The diamond is hidden under page content.** It hangs half below the header. Any positioned element at the top of `main` would paint over it. Check on `/`, `/group` and a character page.
- **Keyboard focus on phones.** Each phone tab fills its share of the row edge to edge, so an outside outline would be clipped. The inset offset must keep the outline visible.
- **Hover on the current tab.** It must stay gold, not turn `text-ink`. The hover class goes only on inactive tabs.

---

### Task 1: Tabs on the header line

The header and the nav change together. Splitting them would leave a commit with two diamonds and 72 px tabs, so this is one task and one commit.

**Files:**
- Modify: `src/components/main-nav/MainNav.test.ts` (whole file)
- Modify: `src/components/main-nav/MainNav.tsx` (whole file)
- Modify: `src/app/layout.tsx:21-31` (the `<header>` element)

**Interfaces:**
- Consumes: `BrandIcon({ name, size = 24, className })` from `@/components/brand-icon/BrandIcon`. With no `className` its `<svg>` has `class="shrink-0"`. `BrandMark({ size, className })` from `@/components/brand-mark/BrandMark`. `isActiveLink(href, pathname)` from `./active-link`.
- Produces: `MainNav()`, unchanged signature, still exported from `src/components/main-nav/MainNav.tsx`.

- [ ] **Step 0: Put the work on a feature branch**

The spec and plan commits are on `docs/top-menu-tabs`. As in PR #78, the feature lands on one branch with them. The branch is local and was never pushed, so rename it:

```bash
git switch docs/top-menu-tabs
git fetch origin
git branch -m feat/top-menu-tabs
git rebase origin/main
```

- [ ] **Step 1: Write the failing test**

Replace `src/components/main-nav/MainNav.test.ts` with:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MainNav } from './MainNav';

// usePathname needs the App Router context, which a static render doesn't have. vi.mock is hoisted above the imports.
vi.mock('next/navigation', () => ({ usePathname: () => '/group' }));

describe('MainNav', () => {
  const html = renderToStaticMarkup(createElement(MainNav));
  const links = html.split('<a ').slice(1);

  it('shows each decorative icon at every width, with the label as the link text', () => {
    expect(links).toHaveLength(2);
    for (const [link, label] of [[links[0]!, 'Characters'], [links[1]!, 'Group']] as const) {
      expect(link).toMatch(/<svg[^>]*aria-hidden="true"[^>]*class="shrink-0"/);
      expect(link).toContain(`</svg>${label}`);
    }
  });

  it('marks only the current page, in gold, with the diamond', () => {
    const [characters, group] = [links[0]!, links[1]!];
    expect(group).toContain('aria-current="page"');
    expect(group).toContain('text-gold');
    expect(group).toMatch(/<span aria-hidden="true" class="[^"]*rotate-45[^"]*"><\/span><\/a>/);
    expect(characters).not.toContain('aria-current');
    expect(characters).not.toContain('text-gold');
    expect(characters).not.toContain('rotate-45');
    expect(characters).toContain('hover:text-ink');
    expect(group).not.toContain('hover:text-ink');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/main-nav/MainNav.test.ts`
Expected: FAIL. The icon's class is `shrink-0 hidden sm:block`, and the current link has `text-ink` and no diamond.

- [ ] **Step 3: Write the nav**

Replace `src/components/main-nav/MainNav.tsx` with:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandIcon } from '@/components/brand-icon/BrandIcon';
import { isActiveLink } from './active-link';

const LINKS = [{ href: '/', label: 'Characters', icon: 'characters' }, { href: '/group', label: 'Group', icon: 'group' }] as const;

// Phones: equal tabs in their own row, icon above label. From sm up: tabs beside the brand, standing on the header line.
const TAB = 'relative flex flex-1 flex-col items-center gap-1 pb-2.5 pt-2 text-[13px] font-semibold no-underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold sm:flex-none sm:flex-row sm:gap-2 sm:px-4 sm:py-0 sm:text-[15px]';

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex sm:gap-1">
      {LINKS.map(({ href, label, icon }) => {
        const active = isActiveLink(href, pathname);
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}
            className={`${TAB} ${active ? 'text-gold shadow-[inset_0_-2px_0_var(--color-gold)]' : 'text-muted hover:text-ink'}`}>
            <BrandIcon name={icon} />
            {label}
            {/* The diamond sits on the header line under the current tab. Phone tabs have no room beside the underline. */}
            {active && <span aria-hidden="true" className="absolute bottom-[-0.5px] left-1/2 hidden size-[11px] -translate-x-1/2 translate-y-1/2 rotate-45 bg-gold sm:block" />}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/main-nav/MainNav.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Rebuild the header around the tabs**

In `src/app/layout.tsx`, replace the whole `<header>…</header>` element (lines 21–31, including the centred diamond `span` and its comment) with:

```tsx
        <header className="border-b border-line bg-header">
          {/* Phones: the brand row above a row of tabs. From sm up: one 64 px row, tabs right after the brand. The right end stays free for account buttons. */}
          <div className="mx-auto flex max-w-[1440px] flex-col px-4 sm:h-16 sm:flex-row sm:gap-10 sm:px-16">
            <Link href="/" className="flex h-[52px] items-center gap-2 self-start font-display text-[17px] font-bold tracking-wide text-ink no-underline focus-visible:outline-2 focus-visible:outline-gold sm:h-auto sm:gap-3 sm:self-auto sm:text-[21px]">
              <BrandMark size={32} className="size-[26px] shrink-0 text-gold sm:size-8" />
              Gear Tracker
            </Link>
            <MainNav />
          </div>
        </header>
```

`BrandMark` sets `width` and `height` attributes from `size`. The `size-*` classes override them, because CSS wins over SVG presentation attributes. That gives 26 px on phones and 32 px from `sm` up.

- [ ] **Step 6: Run the gate**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all tests pass (409 before this change, so 410 after: one test became two).

Run: `npm run lint`
Expected: no errors in `src/`. The local, git-ignored `.cache/pr78-temp/header-compare.cjs` gives 3 errors and 1 warning that CI never sees. They are tracked in #84 and are not part of this change. Leave that file alone.

- [ ] **Step 7: Build without disturbing a dev server**

`npm run build` must not run in a folder where `npm run dev` is serving (see `AGENTS.md`). Either stop dev first, or build in a separate worktree:

```bash
git worktree add ../wgt-build feat/top-menu-tabs
cd ../wgt-build && npm ci && npm run build
cd - && git worktree remove ../wgt-build
```

Expected: build succeeds.

- [ ] **Step 8: Check by hand in Chrome**

Run `npm run dev`. Before changing the code, or on `main` in a second checkout, note the header height and the top of `main` on `/` at 1440 and 390 px (DevTools: `document.querySelector('header').offsetHeight`, `document.querySelector('main').getBoundingClientRect().top`). Then check `/`, `/group` and a character page at 1440, 768, 640, 390 and 320 px:

- the right tab is current: Characters on `/` and on the character page, Group on `/group`;
- no horizontal overflow (`document.documentElement.scrollWidth === innerWidth`);
- from 640 px up: one 64 px row; the diamond is centred under the current tab and cut by the bottom line, and nothing paints over its lower half;
- below 640 px: the brand row above equal-width tabs with icons; the current tab has the gold underline and no diamond;
- hovering the inactive tab turns it `ink`; hovering the current tab leaves it gold;
- Tab moves through the brand and both tabs, and each shows a whole gold outline, including the phone tabs;
- the content's shift equals the header's change in height: −8 px at 1440, and the phone header's increase at 390. Nothing else moves.

Record each result for the pull request's Testing section.

- [ ] **Step 9: Commit**

```bash
git add src/components/main-nav/MainNav.tsx src/components/main-nav/MainNav.test.ts src/app/layout.tsx
git commit -F - <<'EOF'
feat: turn the top menu into tabs on the header line

The brand sat at one end and two pills floated at the other, and the
diamond in the middle of the line pointed at nothing. The tabs now
follow the brand and stand on the line, and the current page is gold,
with the diamond under it. On phones the tabs get their own row, which
shows their icons again and stops the header overflowing at 320 px.
EOF
```

### Task 2: Pull request

**Files:** none changed.

- [ ] **Step 1: Push and open the pull request**

```bash
git push -u origin feat/top-menu-tabs
```

Open the pull request against `main` with the title `feat: turn the top menu into tabs on the header line`. The body follows `AGENTS.md`:

- First line: `Closes #88.`
- `## What changes`: one bullet each for the tabs on the line (#88), the gold current tab with its diamond and the centred diamond's removal, the phone tab row, and keyboard focus.
- No `## Data` section: no schema, migration or cache version moved.
- `## Testing`: the test count, typecheck, lint (naming the local `.cache` errors from #84), build, each hand check from Task 1 Step 8 with its result, and the gap: no browser-level tests (#35), so layout and focus are hand-checked only.
- Last line: `Spec: docs/superpowers/specs/2026-10-05-top-menu-tabs-design.md`
- No AI attribution.

- [ ] **Step 2: Move the issue**

```bash
gh project item-edit 1 --owner arnorgeir --url https://github.com/arnorgeir/wow-gear-tracker/issues/88 --field Status --value "In review"
```
