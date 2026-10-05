# Forged Wayfinder Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In this project, `docs/workflow.md` says implementation runs inline with superpowers:executing-plans.

**Goal:** Put the approved Forged Wayfinder identity (Open Crest logo, favicons, angular utility icons, divider and corner motifs, metallic logo) into the existing UI, and show equipped item names in group cells that are at least 180 px wide.

**Architecture:** Two small inline-SVG components, `BrandMark` and `BrandIcon`, carry the artwork as `currentColor` paths, so colour comes from the semantic tokens. Favicons use Next 16's `app/` file conventions. The item-name rule is pure CSS: each group cell becomes a Tailwind v4 size container, and the name line shows at `@min-[180px]`.

**Tech Stack:** Next.js 16.3 App Router (`favicon.ico`, `icon.svg`, `apple-icon.png` conventions; `next/image` with `loading="eager"`, since `priority` is deprecated in 16), React 19.3, Tailwind v4.3 (`@theme` tokens, built-in `@container` and `@min-[…]` variants), Vitest with `renderToStaticMarkup` component tests.

**Spec:** `docs/superpowers/specs/2026-10-04-forged-wayfinder-identity-design.md` (issues #77 and #69). The spec wins when it and this plan disagree.

## Global Constraints

- Branch: `feat/forged-wayfinder-identity`, local only. It already holds the spec commits. Do not push or open a pull request until the owner asks.
- The asset pack is **staged, not committed**, under `output/brand/forged-wayfinder-v1/` (69 files). Task 1 commits it as a move. Never unstage, delete or re-create it by hand.
- `output/brand/forged-wayfinder-v1.zip` is untracked. Never add, move or delete it.
- Before writing Next.js code, read the guide in `node_modules/next/dist/docs/` for what you touch: `01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`, `01-app/03-api-reference/02-components/image.md`.
- Logo geometry is used as delivered: same paths, uniform scale, never stretched or clipped.
- Brand icons: never below 24 px, always `aria-hidden="true"` `focusable="false"` and `shrink-0`, always beside a visible text label. Never take a state, rarity, class or track colour.
- Displayed name stays "Gear Tracker". No manifest, PWA, Open Graph image, new routes or new navigation.
- Only token change: add `--color-header: #1a1713`.
- Item-name threshold: cell width **180 px**, written `@min-[180px]:`. Name text 12 px semibold, quality text colour, one line, truncated. Upgrade-arrow clearance `pr-3.5` (14 px).
- Phone group tabs: `flex-auto`. Rail switch buttons: `flex-1`.
- Components live in their own kebab-case directory; tests sit beside code as `<name>.test.ts` using `createElement` (test files are `.ts`, not `.tsx`).
- Fixtures use made-up names such as Birkibjörn; never real players.
- Commit subjects `type: lowercase imperative summary`, bodies say why, no AI attribution or co-author trailers.
- **Never run `npm run build` while `npm run dev` serves this folder.** The owner usually has dev running.

## Review Focus

1. **Phone Dungeons tab at 320–375 px with a two-digit count** — icon stays 24 × 24, label and count fully visible, no horizontal scroll. Task 4 pins `flex-auto` and the count in a test; Task 8 measures the rendered box.
2. **A wide cell with the upgrade arrow and a long item name** — the name truncates before the arrow. Task 7 tests `pr-3.5` on the name line when `cell.upgrade` is set.
3. **An empty slot in a wide cell** — no name, never the BiS item's name. Task 7 tests an `equipped: null` cell.
4. **The header at 375 px** — nav icons hidden, no overflow. Task 3 tests `hidden sm:block` on the nav icons; Task 8 measures.
5. **Character page "Dungeon priority" heading beside its list name** — the heading becomes a flex row, which breaks baseline alignment with "Mythic+ list"; Task 5 switches the row to `items-center` and tests the heading still holds its text.

---

### Task 1: Move the source pack to docs and install the favicons

**Files:**
- Move (staged): `output/brand/forged-wayfinder-v1/` → `docs/brand/forged-wayfinder-v1/`
- Create: `src/app/favicon.ico`, `src/app/icon.svg`, `src/app/apple-icon.png`

**Interfaces:**
- Produces: `docs/brand/forged-wayfinder-v1/` as the source of every later copy.

- [ ] **Step 1: Confirm the starting state**

```bash
git branch --show-current            # feat/forged-wayfinder-identity
git status --short | grep -c '^A  output/brand/forged-wayfinder-v1/'   # 69
git status --short | grep '^??'      # ?? output/brand/forged-wayfinder-v1.zip
```

Stop and ask the owner if any of these differ.

- [ ] **Step 2: Move the staged pack**

```bash
mkdir -p docs/brand
git mv output/brand/forged-wayfinder-v1 docs/brand/forged-wayfinder-v1
git status --short | grep -c '^A  docs/brand/forged-wayfinder-v1/'     # 69
git status --short | grep '^??'      # still only the zip
```

- [ ] **Step 3: Copy the three favicon files**

```bash
cp docs/brand/forged-wayfinder-v1/favicon/favicon.ico src/app/favicon.ico
cp docs/brand/forged-wayfinder-v1/favicon/favicon.svg src/app/icon.svg
cp docs/brand/forged-wayfinder-v1/app-icons/apple-touch-icon.png src/app/apple-icon.png
```

- [ ] **Step 4: Check the head tags in dev**

With `npm run dev` running (start it if it isn't):

```bash
curl -s http://localhost:3000/ | grep -o '<link rel="\(icon\|apple-touch-icon\)"[^>]*>'
```

Expected: three links — `/favicon.ico` with `sizes="any"`, `/icon.svg?…` with `type="image/svg+xml"` and `sizes="any"`, `/apple-icon.png?…` with `sizes="180x180"`. Then `curl -s -o /dev/null -w "%{http_code}\n"` each href: `200`.

- [ ] **Step 5: Run the gate**

```bash
npm run typecheck && npm run lint && npm test
```

Expected: all pass (no code changed yet).

- [ ] **Step 6: Commit**

```bash
git add src/app/favicon.ico src/app/icon.svg src/app/apple-icon.png
git commit -m "feat: add the open crest favicon and apple touch icon" -m "The tab showed the browser's default icon. Next serves the three files
from app/ and writes the link tags itself. The source pack moves from
output/ to docs/brand/, where its editable masters and usage notes stay."
git status --short    # only ?? output/brand/forged-wayfinder-v1.zip
```

---

### Task 2: BrandIcon and BrandMark components

**Files:**
- Create: `src/components/brand-icon/BrandIcon.tsx`, `src/components/brand-icon/BrandIcon.test.ts`
- Create: `src/components/brand-mark/BrandMark.tsx`, `src/components/brand-mark/BrandMark.test.ts`

**Interfaces:**
- Produces: `export type BrandIconName = 'characters' | 'group' | 'dungeons' | 'vault'`; `export function BrandIcon(props: { name: BrandIconName; size?: number; className?: string })` (size defaults to 24); `export function BrandMark(props: { size: number; className?: string })`.

- [ ] **Step 1: Write the failing tests**

`src/components/brand-icon/BrandIcon.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BrandIcon } from './BrandIcon';

const render = (props: Parameters<typeof BrandIcon>[0]) => renderToStaticMarkup(createElement(BrandIcon, props));

describe('BrandIcon', () => {
  it('is a decorative 24 px icon that never shrinks, drawn in the current colour', () => {
    const html = render({ name: 'group' });
    expect(html).toMatch(/^<svg /);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
    expect(html).toContain('viewBox="0 0 64 64"');
    expect(html).toContain('width="24" height="24"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('stroke-width="3.2"');
    expect(html).toContain('class="shrink-0"');
  });

  it('takes a size and extra classes', () => {
    const html = render({ name: 'dungeons', size: 28, className: 'text-gold' });
    expect(html).toContain('width="28" height="28"');
    expect(html).toContain('class="shrink-0 text-gold"');
  });

  it('fills the diamond inside the vault and nowhere else', () => {
    expect(render({ name: 'vault' })).toContain('<path d="m32 23 4 5-4 6-4-6Z" fill="currentColor" stroke="none"></path>');
    expect(render({ name: 'characters' })).not.toContain('fill="currentColor"');
  });
});
```

`src/components/brand-mark/BrandMark.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BrandMark } from './BrandMark';

describe('BrandMark', () => {
  it('draws the four Open Crest shapes in the current colour at the given size', () => {
    const html = renderToStaticMarkup(createElement(BrandMark, { size: 32, className: 'text-gold' }));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
    expect(html).toContain('viewBox="0 0 256 256"');
    expect(html).toContain('width="32" height="32"');
    expect(html).toContain('fill="currentColor"');
    expect(html).toContain('class="text-gold"');
    expect(html.match(/<path /g)).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/brand-icon src/components/brand-mark`
Expected: FAIL, cannot resolve `./BrandIcon` and `./BrandMark`.

- [ ] **Step 3: Write the components**

`src/components/brand-icon/BrandIcon.tsx` (paths copied from `docs/brand/forged-wayfinder-v1/icons/current-color/`):

```tsx
// Copied from docs/brand/forged-wayfinder-v1/icons/current-color/. Update both when the artwork changes.
const PATHS = {
  characters: 'M32 6 15 18 10 27v20l15 12V36l-9-5 12 5v24M32 6l17 12 5 9v20L39 59V36l9-5-12 5v24M32 6v24',
  group: 'M28 6h8l6 6v8l-6 6h-8l-6-6v-8ZM8 20h6l4 4v6l-4 4H8l-4-4v-6ZM50 20h6l4 4v6l-4 4h-6l-4-4v-6ZM19 58V44l9-8h8l9 8v14ZM14 58H3V46l9-7h5M50 58h11V46l-9-7h-5',
  dungeons: 'M7 53V26L17 15 32 6l15 9 10 11v27M17 15v30H7M47 15v30h10M32 6v14M20 49V32l5-9 7-3 7 3 5 9v17ZM17 56h30M12 62h40M7 53l-5 7M57 53l5 7',
  vault: 'M5 23v-8l7-7h40l7 7v8H39M25 23H5M5 30h20M39 30h20M9 30v25h7l4-5h24l4 5h7V30M32 17l10 10-10 13-10-13Z',
} as const;

export type BrandIconName = keyof typeof PATHS;

/** A Forged Wayfinder utility icon. Always decorative: it sits beside a visible label, which names it. */
export function BrandIcon({ name, size = 24, className }: { name: BrandIconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false"
      className={className ? `shrink-0 ${className}` : 'shrink-0'}
      fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinejoin="miter" strokeLinecap="butt">
      <path d={PATHS[name]} />
      {name === 'vault' && <path d="m32 23 4 5-4 6-4-6Z" fill="currentColor" stroke="none" />}
    </svg>
  );
}
```

`src/components/brand-mark/BrandMark.tsx` (paths copied from `docs/brand/forged-wayfinder-v1/logos/open-crest-mono.svg`):

```tsx
// Copied from docs/brand/forged-wayfinder-v1/logos/open-crest-mono.svg. Update both when the artwork changes.
/** The flat Open Crest. Decorative: the site name beside it is the accessible name. */
export function BrandMark({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" aria-hidden="true" focusable="false" className={className} fill="currentColor">
      <path d="M128 12 202 154 181 176 149 143 128 82 107 143 75 176 54 154Z" />
      <path d="M89 42 42 103 40 163 91 216 27 180 22 145 17 135 23 128 23 93Z" />
      <path d="M167 42 214 103 216 163 165 216 229 180 234 145 239 135 233 128 233 93Z" />
      <path d="M128 112 136 140 129 146 131 154 158 170 154 184 125 200 151 219 128 244 100 202 139 176 120 157 123 145 120 140Z" />
    </svg>
  );
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/components/brand-icon src/components/brand-mark`
Expected: PASS, 4 tests. If an attribute order differs from a `toContain` string (for example `width` and `height`), assert the two attributes separately rather than changing the component.

- [ ] **Step 5: Commit**

```bash
git add src/components/brand-icon src/components/brand-mark
git commit -m "feat: add the open crest and utility icon components" -m "Inline SVG in the current colour lets the gold and muted tones come
from the theme tokens instead of colours baked into image files."
```

---

### Task 3: Header logo, divider and nav icons

**Files:**
- Modify: `src/app/globals.css` (the `@theme` block)
- Modify: `src/app/layout.tsx:20-30`
- Modify: `src/components/main-nav/MainNav.tsx`
- Create: `src/components/main-nav/MainNav.test.ts`

**Interfaces:**
- Consumes: `BrandMark`, `BrandIcon`, `BrandIconName` from Task 2.

- [ ] **Step 1: Write the failing MainNav test**

`src/components/main-nav/MainNav.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MainNav } from './MainNav';

// usePathname needs the App Router context, which a static render doesn't have. vi.mock is hoisted above the imports.
vi.mock('next/navigation', () => ({ usePathname: () => '/group' }));

describe('MainNav', () => {
  it('keeps each label as the link text, with a decorative icon hidden on phones', () => {
    const html = renderToStaticMarkup(createElement(MainNav));
    const links = html.split('<a ').slice(1);
    expect(links).toHaveLength(2);
    for (const [link, label] of [[links[0]!, 'Characters'], [links[1]!, 'Group']] as const) {
      expect(link).toMatch(/<svg[^>]*aria-hidden="true"[^>]*class="shrink-0 hidden sm:block"/);
      expect(link).toContain(`</svg>${label}</a>`);
    }
    expect(links[1]).toContain('aria-current="page"');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/main-nav`
Expected: FAIL on the `<svg` match (no icons yet).

- [ ] **Step 3: Add icons to MainNav**

Replace `src/components/main-nav/MainNav.tsx` with:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandIcon } from '@/components/brand-icon/BrandIcon';
import { isActiveLink } from './active-link';

const LINKS = [{ href: '/', label: 'Characters', icon: 'characters' }, { href: '/group', label: 'Group', icon: 'group' }] as const;

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-2">
      {LINKS.map(({ href, label, icon }) => {
        const active = isActiveLink(href, pathname);
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[15px] font-semibold no-underline ${active ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}>
            {/* Hidden on phones: with icons the header overflows a 375 px screen by 33 px. */}
            <BrandIcon name={icon} className="hidden sm:block" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/components/main-nav`
Expected: PASS (the new test and `active-link.test.ts`).

- [ ] **Step 5: Add the header token**

In `src/app/globals.css`, inside `@theme`, after `--color-line-strong: #4a4237;`:

```css
  --color-header: #1a1713;
```

- [ ] **Step 6: Swap the logo and add the divider in the layout**

In `src/app/layout.tsx`, add `import { BrandMark } from '@/components/brand-mark/BrandMark';` with the other component imports, and replace the `<header>…</header>` block with:

```tsx
        <header className="relative border-b border-line bg-header">
          <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-16">
            <Link href="/" className="flex items-center gap-3 font-display text-[22px] font-bold tracking-wide text-ink no-underline">
              <BrandMark size={32} className="shrink-0 text-gold" />
              Gear Tracker
            </Link>
            <MainNav />
          </div>
          {/* The divider motif: a gold diamond centred on the header's bottom line. */}
          <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/2 size-3 -translate-x-1/2 translate-y-1/2 rotate-45 border border-gold bg-header" />
        </header>
```

- [ ] **Step 7: Look at it in dev**

Open http://localhost:3000/ at desktop width. Expected: the gold crest beside "Gear Tracker", icons beside Characters and Group, the diamond centred on the header's bottom line. In DevTools device mode at 375 px: no nav icons, `document.documentElement.scrollWidth === 375`.

- [ ] **Step 8: Run the gate and commit**

```bash
npm run typecheck && npm run lint && npm test
git add src/app/globals.css src/app/layout.tsx src/components/main-nav
git commit -m "feat: put the open crest and divider in the header" -m "The flat crest replaces the placeholder shield, and the header's bottom
line carries the divider's gold diamond. Nav icons hide below sm,
because with them the header overflows a 375 px screen by 33 px."
```

---

### Task 4: Group view tabs and rail switch icons

**Files:**
- Modify: `src/components/group-layout/GroupLayout.tsx`
- Create: `src/components/group-layout/GroupLayout.test.ts`

**Interfaces:**
- Consumes: `BrandIcon`, `BrandIconName` from Task 2; `GroupView` from `./panel-classes` (`'gear' | 'dungeons' | 'vault'`).

- [ ] **Step 1: Write the failing test**

`src/components/group-layout/GroupLayout.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GroupLayout } from './GroupLayout';

const buttons = (dungeonCount: number) =>
  renderToStaticMarkup(createElement(GroupLayout, { legend: null, gear: null, dungeons: null, vault: null, dungeonCount }))
    .split('<button ').slice(1).map((b) => b.slice(0, b.indexOf('</button>')));

describe('GroupLayout', () => {
  it('sizes the phone tabs to their content, each with an icon, its label and the dungeon count', () => {
    const [gear, dungeons, vault] = buttons(12);
    for (const [tab, label] of [[gear!, 'Gear'], [dungeons!, 'Dungeons'], [vault!, 'Vault']] as const) {
      expect(tab).toContain('flex-auto');
      expect(tab).not.toContain('flex-1');
      expect(tab).toMatch(/<svg[^>]*aria-hidden="true"/);
      expect(tab).toContain(`</svg>${label}`);
    }
    expect(dungeons).toContain('>12</span>');
  });

  it('keeps the rail switch halves equal, each with an icon and its label', () => {
    const [, , , railDungeons, railVault] = buttons(8);
    for (const [button, label] of [[railDungeons!, 'Dungeons'], [railVault!, 'Great Vault']] as const) {
      expect(button).toContain('flex-1');
      expect(button).toMatch(/<svg[^>]*aria-hidden="true"/);
      expect(button).toMatch(new RegExp(`</svg>${label}$`));
    }
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/group-layout`
Expected: FAIL on `flex-auto` (today every tab is `flex-1`).

- [ ] **Step 3: Update GroupLayout**

In `src/components/group-layout/GroupLayout.tsx`:

Add the import:

```tsx
import { BrandIcon, type BrandIconName } from '@/components/brand-icon/BrandIcon';
```

Replace the `TAB` constant with:

```tsx
// No min-w-0: a tab never shrinks below its icon, label and count. Phone tabs size to that content (flex-auto),
// because an equal third of a 375 px screen is 108 px and the Dungeons tab needs 114.
const TAB = 'flex h-11 items-center justify-center gap-1.5 rounded-lg font-bold';
const ICONS: Record<GroupView, BrandIconName> = { gear: 'characters', dungeons: 'dungeons', vault: 'vault' };
```

Replace the phone tab button with:

```tsx
          <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className={`${TAB} flex-auto ${tabTone(view === id)}`}>
            <BrandIcon name={ICONS[id]} />
            {label}
            {id === 'dungeons' && <span className="font-mono text-xs text-muted">{dungeonCount}</span>}
          </button>
```

Replace the two rail buttons with:

```tsx
            <button type="button" aria-pressed={c.railDungeonsPressed} onClick={() => setView('dungeons')} className={`${TAB} flex-1 ${tabTone(c.railDungeonsPressed)}`}>
              <BrandIcon name="dungeons" />Dungeons
            </button>
            <button type="button" aria-pressed={!c.railDungeonsPressed} onClick={() => setView('vault')} className={`${TAB} flex-1 ${tabTone(!c.railDungeonsPressed)}`}>
              <BrandIcon name="vault" />Great Vault
            </button>
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/components/group-layout`
Expected: PASS (new tests and `panel-classes.test.ts`). If React renders the rail label with a trailing comment or whitespace that breaks the `$`-anchored match, check the markup with `console.log` and relax the anchor to `toContain`, not the component.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run typecheck && npm run lint && npm test
git add src/components/group-layout
git commit -m "feat: add icons to the group view tabs" -m "With an icon, the Dungeons tab needs 114 px but an equal third of a
375 px screen is 108, so the phone tabs now size to their content and
share what is left. The rail's two halves stay equal; each has room."
```

---

### Task 5: Character page heading icons

**Files:**
- Modify: `src/components/character-page/DungeonPriority.tsx:52-55`
- Modify: `src/components/character-page/VaultSection.tsx:10`
- Modify: `src/components/character-page/DungeonPriority.test.ts`
- Create: `src/components/character-page/VaultSection.test.ts`

**Interfaces:**
- Consumes: `BrandIcon` from Task 2.

- [ ] **Step 1: Write the failing tests**

Append inside the `describe('DungeonPriority', …)` block of `src/components/character-page/DungeonPriority.test.ts`:

```ts
  it('puts a gold dungeons icon in the heading, beside its text', () => {
    const html = render(base);
    expect(html).toMatch(/<h2 class="flex items-center gap-2\.5[^"]*"><svg[^>]*aria-hidden="true"[^>]*class="shrink-0 text-gold"[^>]*>.*<\/svg>Dungeon priority<\/h2>/);
  });
```

`src/components/character-page/VaultSection.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VaultSection } from './VaultSection';

describe('VaultSection', () => {
  it('puts a gold vault icon in the heading and keeps the empty-paste wording', () => {
    const html = renderToStaticMarkup(createElement(VaultSection, { vault: [], vaultChoices: [], vaultChoicesAt: null, now: 0 }));
    expect(html).toMatch(/<h2 class="flex items-center gap-2\.5[^"]*"><svg[^>]*aria-hidden="true"[^>]*class="shrink-0 text-gold"[^>]*>.*<\/svg>Great Vault<\/h2>/);
    expect(html).toContain('Paste SimC to see your Great Vault choices.');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/character-page`
Expected: the two new tests FAIL; the existing DungeonPriority tests pass.

- [ ] **Step 3: Add the icons**

In `src/components/character-page/DungeonPriority.tsx`, import `BrandIcon` from `@/components/brand-icon/BrandIcon` and replace the heading row:

```tsx
      {/* items-center, not items-baseline: the heading is a flex row with an icon, so it has no text baseline to share. */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold"><BrandIcon name="dungeons" size={28} className="text-gold" />Dungeon priority</h2>
        <span className="text-sm text-muted">{LIST_NAMES[priority.listType]}</span>
      </div>
```

In `src/components/character-page/VaultSection.tsx`, import `BrandIcon` the same way and replace the heading:

```tsx
      <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold"><BrandIcon name="vault" size={28} className="text-gold" />Great Vault</h2>
```

Leave `GroupPriority.tsx` and `GroupVault.tsx` headings unchanged (spec decision 3).

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/components/character-page`
Expected: PASS.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run typecheck && npm run lint && npm test
git add src/components/character-page
git commit -m "feat: add icons to the character page panel headings" -m "The dungeon and vault panels have no switch above them, so their
headings carry the icon. The group page's panel headings sit under a
tab with the same icon and stay plain."
```

---

### Task 6: Setup notice with the metallic crest and corner frame

**Files:**
- Create: `public/brand/open-crest-metallic.png` (copy)
- Create: `src/components/setup-notice/CornerFrame.tsx`
- Modify: `src/components/setup-notice/SetupNotice.tsx`
- Create: `src/components/setup-notice/SetupNotice.test.ts`

**Interfaces:**
- Produces: `CornerFrame(props: { className: string; children: ReactNode })`, used only by `SetupNotice`.

- [ ] **Step 1: Copy the image**

```bash
mkdir -p public/brand
cp docs/brand/forged-wayfinder-v1/logos/open-crest-metallic.png public/brand/open-crest-metallic.png
```

- [ ] **Step 2: Write the failing test**

`src/components/setup-notice/SetupNotice.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SetupNotice } from './SetupNotice';

// React 19 hoists <link rel="preload"> tags for images ahead of the markup.
const render = () => renderToStaticMarkup(createElement(SetupNotice, { missing: ['BLIZZARD_CLIENT_ID', 'BLIZZARD_CLIENT_SECRET'] })).replace(/<link[^>]*\/>/g, '');

describe('SetupNotice', () => {
  it('still names the missing settings', () => {
    expect(render()).toContain('BLIZZARD_CLIENT_ID, BLIZZARD_CLIENT_SECRET');
  });

  it('shows the metallic crest as decoration above the heading', () => {
    const html = render();
    expect(html).toMatch(/<img alt=""[^>]*width="160"[^>]*height="160"[^>]*src="[^"]*open-crest-metallic\.png[^"]*"/);
    expect(html.indexOf('open-crest-metallic')).toBeLessThan(html.indexOf('Finish setup'));
  });

  it('frames the panel with four decorative corners', () => {
    expect(render().match(/<svg aria-hidden="true"[^>]*><path d="M1 49V25L25 1h24"/g)).toHaveLength(4);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run src/components/setup-notice`
Expected: the first test PASSES, the other two FAIL.

- [ ] **Step 4: Write CornerFrame**

`src/components/setup-notice/CornerFrame.tsx`:

```tsx
import type { ReactNode } from 'react';

// The corner of docs/brand/forged-wayfinder-v1/motifs/corner-frame.svg, drawn once and mirrored into each
// corner. Stretching the whole frame over the panel would distort the chamfers.
const CORNERS = ['-left-px -top-px', '-right-px -top-px -scale-x-100', '-bottom-px -left-px -scale-y-100', '-bottom-px -right-px -scale-100'];

export function CornerFrame({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div className={`relative ${className}`}>
      {CORNERS.map((position) => (
        <svg key={position} aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 50 50"
          className={`pointer-events-none absolute text-gold opacity-55 ${position}`}>
          <path d="M1 49V25L25 1h24" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      ))}
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Update SetupNotice**

Replace `src/components/setup-notice/SetupNotice.tsx` with:

```tsx
import Image from 'next/image';
import { CornerFrame } from './CornerFrame';

export function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col px-4 py-16">
      <CornerFrame className="flex flex-col gap-4 border border-line bg-surface p-6 sm:p-10">
        {/* The first screen a new contributor sees: the one place the large metallic crest has room and a purpose. */}
        <Image src="/brand/open-crest-metallic.png" alt="" width={160} height={160} loading="eager" className="mx-auto" />
        <h1 className="font-display text-3xl font-bold">Finish setup</h1>
        <p className="text-muted">The app needs Battle.net API credentials before it can load characters.</p>
        <ol className="list-decimal space-y-2 pl-6">
          <li>Create a client at <a href="https://community.developer.battle.net/access/clients">community.developer.battle.net</a>.</li>
          <li>Copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env</code>.</li>
          <li>Fill in: <code className="font-mono">{missing.join(', ')}</code>.</li>
          <li>Restart <code className="font-mono">npm run dev</code>.</li>
        </ol>
        <p className="text-muted">The README has the full steps.</p>
      </CornerFrame>
    </main>
  );
}
```

- [ ] **Step 6: Run it to see it pass**

Run: `npx vitest run src/components/setup-notice`
Expected: PASS. `next/image` renders `src="/_next/image?url=%2Fbrand%2Fopen-crest-metallic.png&w=…"`, which the `[^"]*open-crest-metallic\.png` match allows. If the attribute order differs, assert `alt=""`, `width="160"`, `height="160"` and the file name separately.

- [ ] **Step 7: Look at it**

Start a second server on another port with the credential blanked; Next does not override a variable that is already set, even when empty:

```bash
BLIZZARD_CLIENT_ID= npx next dev -p 3002
```

If Next refuses a second dev server in the same folder, stop the first one, run this, then restart `npm run dev`. Open http://localhost:3002/ at desktop and at 375 px. Expected: the metallic crest centred above "Finish setup", four gold corners at the panel's corners, nothing overflows at 375 px. In the Network panel the image is served from `/_next/image`, well under the 1.46 MB source. Stop the server.

- [ ] **Step 8: Run the gate and commit**

```bash
npm run typecheck && npm run lint && npm test
git add public/brand src/components/setup-notice
git commit -m "feat: frame the setup notice with the metallic crest" -m "The setup screen is the first thing a new contributor sees and holds
no gear data, so it is where the large metallic crest and the corner
motif have room without competing with rarity or state colours."
```

---

### Task 7: Item names in group cells at least 180 px wide

**Files:**
- Modify: `src/components/group-grid/GroupCell.tsx:37-50`
- Modify: `src/components/group-grid/GroupGrid.test.ts`

**Interfaces:**
- Consumes: `QUALITY_STYLES` (`{ text: string }` per quality) already imported in `GroupCell.tsx`; test helpers `render`, `member`, `summary`, `cell`, `equipped` already in `GroupGrid.test.ts`.

- [ ] **Step 1: Write the failing tests**

Append inside the `describe('GroupGrid', …)` block of `src/components/group-grid/GroupGrid.test.ts`:

```ts
  it('makes each cell a size container whose name line shows only from 180 px, in the quality colour', () => {
    const html = render([member({ character: summary(3, 'Birkibjörn') })], [{ slot: 'HEAD', label: 'Head', cells: [cell({})] }]);
    expect(html).toContain('class="@container relative flex');
    expect(html).toContain('<span class="hidden max-w-full truncate text-xs font-semibold @min-[180px]:block" style="color:#c58cf5">Enigmatic Dreamwatcher’s Somnolent Stare</span>');
  });

  it('keeps a wide cell name clear of the upgrade arrow', () => {
    const upgrade = { steps: 4, currencyId: 3446, currencyName: 'Myth Mistcrest', costPerStep: 20, iconUrl: null };
    const html = render([member({ character: summary(3, 'Birkibjörn') })], [{ slot: 'HEAD', label: 'Head', cells: [cell({ upgrade })] }]);
    expect(html).toContain('@min-[180px]:block pr-3.5"');
  });

  it('shows no name for an empty slot, not even the BiS item', () => {
    const html = render([member({ character: summary(3, 'Birkibjörn') })], [{ slot: 'HEAD', label: 'Head', cells: [cell({ equipped: null, state: 'missing' })] }]);
    expect(html).not.toContain('@min-[180px]:block');
  });

  it('puts item level and track on one line in a wide cell', () => {
    const html = render([member({ character: summary(3, 'Birkibjörn') })], [{ slot: 'HEAD', label: 'Head', cells: [cell({})] }]);
    expect(html).toMatch(/<span class="flex max-w-full min-w-0 flex-col items-center gap-px sm:items-start @min-\[180px\]:flex-row @min-\[180px\]:gap-1\.5"><span class="font-mono[^"]*">321<\/span><span class="[^"]*">Myth 2\/6<\/span><\/span>/);
  });
```

If `cell({ equipped: null, … })` fails typecheck, check `GearRowView['equipped']` in `src/server/views/types.ts`: it is nullable, since `GroupCell` already branches on `eq`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/group-grid/GroupGrid.test.ts`
Expected: the new tests FAIL (except "no name for an empty slot", which passes trivially today and pins the rule once the name exists); existing tests pass.

- [ ] **Step 3: Update GroupCell**

In `src/components/group-grid/GroupCell.tsx`, update the doc comment's first sentence to: `One compact cell: icon, item level, track and a state word, plus the item name when the cell is at least 180 px wide.`

Add `@container ` to the start of the cell `<div>`'s class:

```tsx
      <div className="@container relative flex min-h-[80px] min-w-0 flex-col items-center gap-1 rounded-lg border border-line bg-surface-2 px-0.5 py-1.5 sm:min-h-[68px] sm:flex-row sm:gap-2 sm:px-2 sm:py-2"
```

Replace the text column (`<span aria-hidden="true" className="pointer-events-none flex …">…</span>`) with:

```tsx
        {/* The cell is a size container: from 180 px wide it shows the item name and joins item level and track,
            so a wide cell keeps three lines and the row keeps its height. */}
        <span aria-hidden="true" className="pointer-events-none flex min-w-0 max-w-full flex-col items-center gap-px leading-snug sm:items-start">
          {eq && (
            <span className={`hidden max-w-full truncate text-xs font-semibold @min-[180px]:block${cell.upgrade ? ' pr-3.5' : ''}`} style={{ color: q!.text }}>
              {eq.name}
            </span>
          )}
          <span className="flex max-w-full min-w-0 flex-col items-center gap-px sm:items-start @min-[180px]:flex-row @min-[180px]:gap-1.5">
            <span className="font-mono text-[11px] text-ink sm:text-xs">{eq?.itemLevel ?? '–'}</span>
            {eq && <span className={`hidden max-w-full truncate text-xs sm:block ${track.className}`}>{track.text}</span>}
          </span>
          <span className={`text-[10px] font-bold sm:text-xs ${word.className}`}>{word.word}</span>
        </span>
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/components/group-grid`
Expected: PASS, including every existing GroupGrid test (the accessible name and details card are unchanged).

- [ ] **Step 5: Check it in dev**

At a desktop window of about 1440 px, open the group page with three members, then five (use made-up or local characters; never commit them). Expected: names with three members (cells about 286 px), none with five (about 169 px). In DevTools, the cell's computed `container-type` is `inline-size`, and with five members the name span's `display` is `none`. Rows with three members are no taller than with five.

- [ ] **Step 6: Run the gate and commit**

```bash
npm run typecheck && npm run lint && npm test
git add src/components/group-grid
git commit -m "feat: show item names in group cells that have room" -m "With three members the group cells are wide but showed no names. Each
cell is now a size container and shows the name from 180 px, which
keeps the five-member desktop grid (169 px cells) and phones compact.
Item level and track share a line then, so rows stay the same height."
```

---

### Task 8: Record the installs in the brand README, then hand checks and build

**Files:**
- Modify: `docs/brand/forged-wayfinder-v1/README.md` (replace the "Future Next.js integration" section)

- [ ] **Step 1: Replace the README section**

In `docs/brand/forged-wayfinder-v1/README.md`, replace everything from `## Future Next.js integration` to the end of the file with:

```markdown
## Installed in the app

The pack moved here from `output/brand/` when it was installed (issue #77).
These files and components hold copies of its artwork. Update them with the
masters here when the artwork changes.

| In the app | Copied from |
|---|---|
| `src/app/favicon.ico` | `favicon/favicon.ico` |
| `src/app/icon.svg` | `favicon/favicon.svg` |
| `src/app/apple-icon.png` | `app-icons/apple-touch-icon.png` |
| `public/brand/open-crest-metallic.png` (setup notice) | `logos/open-crest-metallic.png` |
| `src/components/brand-mark/BrandMark.tsx` (inline paths) | `logos/open-crest-mono.svg` |
| `src/components/brand-icon/BrandIcon.tsx` (inline paths: characters, group, dungeons, vault) | `icons/current-color/` |
| `src/components/setup-notice/CornerFrame.tsx` (one corner, mirrored) | `motifs/corner-frame.svg` |
| Header bottom line with a gold diamond, `src/app/layout.tsx` (drawn in CSS) | `motifs/divider.svg` |

Not installed yet: the regular and maskable app icons (they belong to a web
app manifest, which waits for the site's name), the Upgrades and Bags icons,
the gold, parchment and charcoal logo files, and the social background.

The design decisions are in
`docs/superpowers/specs/2026-10-04-forged-wayfinder-identity-design.md`.
```

Also change the README's opening paragraph sentence "Inspect the vector preview before integrating; artwork has not been installed into the app." to "Inspect the vector preview before changing the artwork." Leave everything else as delivered.

- [ ] **Step 2: Commit**

```bash
git add docs/brand/forged-wayfinder-v1/README.md
git commit -m "docs: record where the brand pack is installed" -m "The logo and icon paths are copied inline into components, so the pack
names each copy for whoever next changes the artwork."
```

- [ ] **Step 3: Full gate**

```bash
npm run typecheck && npm run lint && npm test
```

Expected: all pass. Record the test count.

- [ ] **Step 4: Build without wedging dev**

Never build while `npm run dev` serves this folder. Either stop the dev server, then:

```bash
npm run build && npx next start -p 3001
```

check http://localhost:3001/, stop it, and restart `npm run dev`; or, if the owner wants dev left running, ask them first. Expected: build succeeds; the setup notice page and the three icon routes prerender.

- [ ] **Step 5: Hand checks**

Do these in Chrome. The browser window may not resize in this environment (it reported a 2560 px viewport); if so, load the page in same-origin iframes of the target width, which give a 15 px narrower client width with a scrollbar, so use 390 px frames for 375 px, or DevTools device mode.

1. Tab shows the crest on `/`, `/group` and a character page; `<head>` has the three icon links.
2. Header at 1440, 768 and 375 px: `scrollWidth` equals client width; nav icons only from 640 px; diamond centred and overlapping nothing.
3. Group tabs at 768, 375 and 320 px with a populated group: in the console, each tab's `svg.getBoundingClientRect()` is 24 × 24; the Dungeons label and count fully visible; no horizontal scroll. Rail switch at 1440 px: icons beside "Dungeons" and "Great Vault".
4. Character page at 1440 and 375 px: heading icons centred on the Cinzel headings; "Mythic+ list" aligned in its row.
5. Setup notice (Task 6, Step 7) at desktop and 375 px.
6. Icons at 24 px at 100% zoom: no clipped strokes at the edges (spec risk: `overflow="visible"` is the fix).
7. Item names (spec decision 8): five to three members at 1440 px (names appear), back to five (gone); three and four members at 768 px (names, compact); one and two members at 375 px (name centred, compact); a long name truncates before the upgrade arrow and state word; an empty slot shows no name; pressing a wide cell opens the details card with the full name; Wowhead tooltip on the icon; row heights unchanged.

The group page remembers its members in the `group` cookie. Note its value before changing members (`document.cookie`) and restore it afterwards.

- [ ] **Step 6: Move the issues to In review only when the pull request opens**

The owner asks for the push and pull request. When they do, the pull request description opens with `Closes #77, closes #69.`, lists the changes, has a `## Testing` section with the test count, gate and build results, each hand check above with its result, and the gaps (no browser test setup; iOS home-screen icon not checked on a device), and ends with `Spec: docs/superpowers/specs/2026-10-04-forged-wayfinder-identity-design.md`. Then set both issues to In review.
