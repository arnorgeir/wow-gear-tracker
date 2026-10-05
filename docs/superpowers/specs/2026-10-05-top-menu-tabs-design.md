# Top menu: tabs on the header line

Status: approved by the owner on 2026-10-05. The spec review's one finding is resolved: the success criteria and hand checks now allow the content shift caused by the header's new height, including the taller phone header (decision 3).
Date: 2026-10-05
Issue: #88 — Redesign the top menu as tabs on the header line
Design: the "WoW Gear Tracker" canvas, board "Top menu: variations of A, tabs on the line", variation A1. The board "Top menu: four directions" holds the directions that were not chosen.
Builds on: `docs/superpowers/specs/2026-10-04-forged-wayfinder-identity-design.md` (the Open Crest, the utility icons and the header divider)

## Goal

The Forged Wayfinder identity gave the header the right parts, but their layout still bothers the owner. The brand sits at the far left and two pills float at the far right, leaving an empty middle. The gold diamond sits in the middle of the header's bottom line and points at nothing. On phones the nav icons are hidden, and at 320 px the header overflows by 29 px.

This change rearranges the same parts into tabs that stand on the header's bottom line. The tab for the current page is gold, so the diamond now marks where you are.

## What success looks like

- On every page the header shows the brand, then the Characters and Group tabs, on one line at 640 px and wider.
- The tab for the current page shows its label, icon, underline and a diamond in gold. The other tab is muted. The single character page still counts as Characters.
- On phones the tabs sit on a second row with their icons visible, and nothing overflows at 390 or 320 px.
- The right end of the bar is empty.
- Keyboard focus on a tab or the brand is visible.
- Nothing below the header changes. The page content moves vertically only by the header's change in height: 8 px up on desktop and tablet, and down by the phone header's extra height on phones (decision 3). Page spacing, layout, data and behaviour stay the same.

## Constraints from the owner

- Keep the Open Crest and the utility icons as they are.
- The current page is gold: label as well as icon and underline ("A1 but with yellow text as well").
- Leave the right end of the bar empty. Login and My Pages go there once accounts arrive (#48), and that work places them.
- No Dungeons tab until the Dungeons page exists (#45). The mockups show one only to judge how the bar grows.

## Decisions and reasons

### 1. Tabs follow the brand and stand on the bottom line

At 640 px (`sm`) and wider the header is one row, 64 px tall instead of 72, inside the existing `max-w-[1440px]` container with `px-4 sm:px-16`. The brand link comes first, unchanged: the 32 px crest in `text-gold` and "Gear Tracker" in `font-display`, 22 px. Its font size drops from 22 to 21 px to sit in the lower bar, as on the canvas.

The nav follows the brand with a 40 px gap. Each tab fills the bar's full height and has 16 px of padding on each side, a 24 px `BrandIcon` and a 15 px semibold label, with an 8 px gap between them. Tabs sit 4 px apart. Nothing follows the nav.

Tabs placed beside the brand read as one unit and leave the rest of the bar for what comes later, such as more pages and the account buttons at the right. The bar is 8 px shorter because a tab doesn't need the padding a pill did.

### 2. The current tab is gold and carries the diamond

The current tab (`aria-current="page"`, decided by `isActiveLink` as today) has:

- its label and icon in `text-gold`;
- a 2 px gold underline drawn on the bottom line as an inset shadow;
- an 11 px solid gold diamond, a square rotated 45°, centred under the tab on the bottom line, so half of it hangs below the header.

The other tab is `text-muted` and turns `text-ink` on hover. No pill background.

The diamond in the middle of the bottom line goes away. The diamond now moves with the current page, which gives it a meaning. It is solid rather than hollow, so it reads at a glance. Gold is the brand colour, not a gear rarity, class or state colour, so this keeps the identity spec's rule that ornament doesn't borrow those meanings.

Colour is not the only signal: the current tab also has the underline and the diamond, and `aria-current` for assistive tech.

### 3. Phones: a second row of equal tabs

Below 640 px the header becomes two rows inside the same `header` element:

1. A 52 px row with the brand: the crest at 26 px and the name at 17 px.
2. The nav: one tab per page, each taking an equal share of the width (`flex-1`), with the 24 px icon above a 13 px label. Each tab has 8 px of padding above and 10 px below, so the row is about 59 px tall. The exact height depends on the label's line height and is not pinned. The phone header is about 111 px against today's 72, so on phones the page content starts about 39 px lower. That shift is expected, and pages don't compensate for it.

The current tab has the same gold label, icon and underline as on desktop, without the diamond. The diamond stays in the markup and is hidden below `sm` (`hidden sm:block`). Equal-width tabs leave no space beside the underline, so the diamond would crowd the line. The canvas phone mockup has no diamond either.

This shows the icons that are hidden on phones today, and removes the 320 px overflow, because the brand and the tabs no longer share a row. Tablets at 768 px use the desktop layout. The one-row layout fits at 640 px, since the brand and two tabs need about 420 px.

### 4. Focus is a gold outline

The brand link and each tab get `focus-visible:outline-2 focus-visible:outline-gold`, with an inset offset (`focus-visible:-outline-offset-2`) on both. The brand and the tabs fill the bar from its top edge, so an outside outline would lose its top edge to the viewport. The brand link also gets 8 px of side padding cancelled by a negative margin (`-mx-2 px-2`), so the inset outline clears the name without moving it. This is the outline the app already uses on other controls, such as `ItemCard` and `GroupCell`.

### 5. Where the code goes

- `src/app/layout.tsx`: the header markup. It stays a server component. It loses the centred diamond `span` and the `justify-between` row. It gains the responsive rows: the brand row and the nav stack below `sm` and sit in one row from `sm` up.
- `src/components/main-nav/MainNav.tsx`: the tab styles and the active diamond. It stays the only client component, because it needs `usePathname`. The icon is always shown, so the `hidden sm:block` class goes. The phone and desktop tab layouts differ only in Tailwind responsive classes (`flex-col sm:flex-row` and similar), so one set of links serves both. The nav is not rendered twice.
- `isActiveLink` and `LINKS` don't change.
- No new tokens. `--color-header`, `--color-line`, `--color-gold`, `--color-muted` and `--color-ink` cover every colour.

## Testing

- `MainNav.test.ts` changes its expectations: the icon is no longer hidden on phones (no `hidden sm:block`), each link still ends with its label as the link text, and only the current link has `aria-current="page"` and the diamond element. Write that test first and watch it fail.
- `active-link.test.ts` is unchanged and must pass.
- The project has no browser-level tests (#35), so the layout is checked by hand in Chrome at 1440, 768, 640, 390 and 320 px on `/`, `/group` and a character page:
  - which tab is current;
  - no horizontal overflow;
  - the diamond centred under the current tab and cut by the bottom line;
  - the phone tabs equal in width, with icons visible;
  - Tab moves focus through the brand and both tabs, and each shows the gold outline;
  - the content moves only by the header's height change. Measure the header height and the top of `main` before and after at 1440 and 390 px. The content's shift must equal the header's change in height: −8 px on desktop, and +the phone header's measured increase on phones. Nothing else in the page layout may move.
- Typecheck, lint, tests and `npm run build` must be clean, with the build run in a separate worktree or with dev stopped.

## Out of scope

- The Dungeons tab, and any icon for Transmog.
- Login and My Pages buttons, and anything else in the right end of the bar.
- A sticky header.
- Updating the canvas's page artboards to the new header. The A1 board is the reference.
