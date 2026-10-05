# Forged Wayfinder visual identity

Status: approved. The owner moved the spec to review and planning on 2026-10-04. The spec review's finding is resolved here (decision 3, "Group view tabs size to their content"), and the owner's request recorded in that review is added as decision 8.
Date: 2026-10-04
Issues: #77 — Apply the Forged Wayfinder visual identity; #69 — Add a favicon (sub-issue of #77)
Assets: `output/brand/forged-wayfinder-v1/` (staged on this branch, moved by this work; see decision 7)
Parent spec for decision 8: `docs/superpowers/specs/2026-10-04-group-page-layout-design.md`

## Goal

The app still wears a placeholder: a generic stroked shield in the header and the browser's default tab icon. The owner approved a visual identity, Forged Wayfinder, with the Open Crest emblem and a heavy, angular family of utility icons. This change brings that identity into the existing UI so the app looks like one considered thing, without changing what it shows or how it works.

"Forged Wayfinder" names the visual direction, not the site. The displayed name stays "Gear Tracker" until a naming decision is made.

**One presentation change rides along, at the owner's request.** The compact group cells from the group-page layout spec never show the equipped item's name, even when three members leave each cell wide. Decision 8 shows the name whenever the cell is wide enough, and keeps the compact cell everywhere else. It changes what the group grid shows, so it is the one exception to "layouts and data presentation are unchanged" below. From the group-page layout spec it supersedes only decision 4's rule that the cell's text column holds item level, track and state word and nothing else; that spec stays authoritative for everything else about the cell, the details card and the grid.

## What success looks like

- The header shows the flat Open Crest beside "Gear Tracker" on every page.
- The browser tab and an iOS home-screen bookmark show the Open Crest, readable on both light and dark browser chrome.
- Main navigation, the group page's view switches and the character page's two side panels carry the matching utility icon beside their visible label, and every one keeps its text as its accessible name.
- Nothing overflows at 1440, 768, 375 or 320 px that didn't before. The only layout shift is the group page's phone tabs sizing to their content (decision 3).
- Group cells at least 180 px wide show the equipped item's name; narrower cells look as they do today (decision 8).
- Gear rarity, class, state and upgrade-track colours, Blizzard artwork, data and interactions are unchanged. Apart from decisions 3 and 8, so are layouts.

## Constraints from the owner

- Open Crest is the logo. Preserve its geometry: the SVG paths are used as delivered, scaled uniformly, never stretched or clipped.
- Use the heavier angular icon family, including Group's octagonal heads and angular shoulders. The rounded variation was rejected.
- Mature and restrained, drawn from World of Warcraft's materials and colours.
- Keep Cinzel, Barlow and IBM Plex Mono and the existing semantic colour tokens.
- Brand ornament never competes with, or borrows the meaning of, gear rarity, class or state colours.
- No new navigation destinations, homepage, manifest or PWA added just to use an asset. Blizzard item, class, character and currency artwork stays.

## Decisions and reasons

### 1. Header logo: flat Open Crest, inline, 32 px

A new `src/components/brand-mark/BrandMark.tsx` renders the Open Crest as inline SVG: `viewBox="0 0 256 256"`, the four paths of `logos/open-crest-mono.svg` with `fill="currentColor"`, a `size` prop that sets both width and height, `aria-hidden="true"` and `focusable="false"`. The header passes `size={32}` and `className="text-gold"`, replacing the 28 px stroked shield in `src/app/layout.tsx`. The link keeps "Gear Tracker" as its visible text and accessible name.

Inline SVG with `currentColor` lets the gold come from the `--color-gold` token instead of a hardcoded hex in an image file. At 32 px the full-geometry master is used; the pack's small-size variant is only advised below 32 px, and nothing in the UI renders the logo that small (the favicon is a file, decision 2), so the component carries one geometry.

The header height (72 px) and spacing stay the same. Checked in the browser mockup on 2026-10-04: the 32 px crest sits on the same centre line as the Cinzel name.

### 2. Favicon and Apple touch icon through Next's file conventions

Next 16 (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`) generates the `<link>` tags from files in `app/`:

| File | Source in the pack | Head output |
|---|---|---|
| `src/app/favicon.ico` | `favicon/favicon.ico` (16, 32, 48 px frames) | `<link rel="icon" href="/favicon.ico" sizes="any">` |
| `src/app/icon.svg` | `favicon/favicon.svg` (dark rounded tile, small-size crest) | `<link rel="icon" type="image/svg+xml" sizes="any">` |
| `src/app/apple-icon.png` | `app-icons/apple-touch-icon.png` (180 px, opaque) | `<link rel="apple-touch-icon" sizes="180x180">` |

No `metadata.icons` entry and no manifest. The favicon artwork sits on its own dark tile, so it reads on light and dark tab strips alike; this was checked at 16 and 32 px on white, Chrome light grey, Chrome dark and the app background.

The regular and maskable app icons (192, 512, 1024) stay in the pack. They belong to a web app manifest, which waits for the naming decision.

### 3. Utility icons beside existing labels

A new `src/components/brand-icon/BrandIcon.tsx` renders one icon by `name`: `'characters' | 'group' | 'dungeons' | 'vault'`. It uses the `icons/current-color/` artwork: `viewBox="0 0 64 64"`, `stroke="currentColor"`, `stroke-width="3.2"`, `stroke-linejoin="miter"`, `stroke-linecap="butt"`, `fill="none"`, and Vault's filled inner diamond. Props are `name`, `size` (default 24) and `className`. It is always `aria-hidden="true"` and `focusable="false"`: every place it appears has a visible text label that stays the accessible name. The path data lives in the component as a record keyed by name.

Icons follow `currentColor`, so they take the label's colour: muted when inactive, ink when active, gold beside headings. They never take a state colour.

Where they go:

| Place | Labels | Icon | Size |
|---|---|---|---|
| Main nav (`main-nav/MainNav.tsx`) | Characters, Group | characters, group | 24, **hidden below `sm`** |
| Group view tabs, below `xl` (`group-layout/GroupLayout.tsx`) | Gear, Dungeons, Vault | characters (the helm), dungeons, vault | 24 |
| Group rail switch, at `xl` (same file) | Dungeons, Great Vault | dungeons, vault | 24 |
| Character page headings (`character-page/DungeonPriority.tsx`, `character-page/VaultSection.tsx`) | Dungeon priority, Great Vault | dungeons, vault | 28, `text-gold` |

**Main nav hides its icons below `sm`.** Measured in the mockup at a 375 px viewport, the header overflowed by 33 px with the icons shown; hidden, it fits exactly as today. The labels stay at every width.

**Gear uses the helm.** The Characters icon is a helm, which reads as gear; the owner chose it so the three group tabs match.

**The group panels' own headings get no icon.** On the group page, "Dungeon priority" and "Great Vault" headings (`GroupPriority.tsx`, `GroupVault.tsx`) sit directly under a tab or rail switch that already shows the same icon, so a second copy would only repeat it. The character page has no switch above its panels, so its headings carry the icon.

**Upgrades and Bags are not used.** The only places they would fit are the state legend, the state words and the upgrade badge. Those render at 12–13 px, below the 24 px floor the icon family is drawn for, and they are coloured by state, so a brand icon there would blur brand and state meaning. Both icons stay in the pack for a future control that needs them.

Icons are never placed below 24 px. Every `BrandIcon` carries `shrink-0`, so a flex row can never compress it. Tab heights (44 px), nav link padding and heading line heights already fit them vertically; the tabs' existing `gap-1.5` spaces icon, label and count, and nav links gain `inline-flex items-center gap-2`.

**Group view tabs size to their content.** Today the three phone tabs share the width equally (`flex-1`). Measured in Chrome on 2026-10-04 with a populated group: bold 16 px "Dungeons" is 70.6 px wide and the one-digit mono count 7.2 px. With the icon, the Dungeons tab needs 24 + 6 + 70.6 + 6 + 7.2 = 113.8 px of content, but an equal share at a 375 px viewport is (375 − 32 page padding − 2 border − 8 padding − 8 gaps) / 3 = 108.3 px, so it would overflow or squeeze the icon.

The tabs change from `flex-1` to `flex-auto` (`flex: 1 1 auto`): each starts at its content width and the spare width is shared equally. Content widths are about 66 px for Gear, 70 px for Vault and 114 px for Dungeons, 250 px together, against 325 px available at 375 px and 270 px at 320 px. At 375 px each tab grows by about 25 px, so Dungeons is about 139 px wide and every tab keeps its icon, label and count and its 44 px height. A two-digit count (7 px more) still fits at 320 px. The count and label never shrink or drop. Tabs at `sm` and up have far more room and look the same as today apart from uneven widths, which the 4 px gaps and shared background make hard to notice. The xl rail switch keeps `flex-1`: each of its two buttons is 168 px wide, and "Great Vault" with its icon needs about 115.

### 4. Divider motif: the header's bottom edge

The header's `border-b border-line` becomes the divider motif: the same 1 px bronze line (`--color-line`), with a small gold diamond centred on it, drawn as a 12 px square rotated 45°, 1 px `border-gold` outline, filled with the header's background so the line appears to pass behind it. It is decorative (`aria-hidden`). The header keeps its height; the diamond overlaps the line, not the content.

One instance, on the element every page shares, is the "sparing" the owner asked for. The divider is not repeated under page titles or between panels, where it would compete with the gear grid.

The header's background is currently a hardcoded `bg-[#1a1713]`. The diamond's fill needs the same colour, so this work adds a `--color-header: #1a1713` token in `globals.css` and uses `bg-header` for both.

### 5. Corner motif: the setup notice only

The corner frame decorates one panel: the setup notice (`setup-notice/SetupNotice.tsx`), which already is a standalone card-like screen with no gear data on it. Its content is wrapped in a panel with `border border-line bg-surface`, square corners, and four gold corner pieces at 55% opacity.

The corner pieces are drawn from `motifs/corner-frame.svg`'s corner path (`M1 49V25L25 1h24`, a chamfered L 48 units long) as a 24 px SVG, mirrored for each corner with CSS transforms and positioned absolutely. The full 1200 × 240 frame is not stretched over the panel, because stretching distorts the chamfers. The corners live in a file inside the setup notice's directory, since nothing else uses them.

Gear panels keep their rounded corners and no corner pieces: chamfered ornaments on rounded boxes clash, and those panels hold rarity and state colour that ornament would compete with.

### 6. Metallic logo: large artwork on the setup notice

The metallic Open Crest appears once, at 160 px, centred at the top of the setup notice panel, through `next/image` (`width={160} height={160}`, `alt=""`, since the "Finish setup" heading names the screen). The setup notice is the first screen a new contributor sees, before any data exists, and the one place where a large emblem has room and purpose.

`next/image` serves a resized copy, so the 1.46 MB source PNG is never sent at full size. Everywhere else the flat logo is used.

### 7. Where the files live

- **Runtime files Next serves by convention:** `src/app/favicon.ico`, `src/app/icon.svg`, `src/app/apple-icon.png` (decision 2).
- **Runtime image:** `public/brand/open-crest-metallic.png` (decision 6).
- **Logo and icons:** inline in `BrandMark.tsx` and `BrandIcon.tsx`, so no public files.
- **Source pack:** moves from `output/brand/forged-wayfinder-v1/` to `docs/brand/forged-wayfinder-v1/` with history intact, as the editable masters and usage notes. Its README's "Future Next.js integration" section is replaced by an "Installed in the app" section that maps each installed file to its source, and names the components that carry inline copies of the paths, so a future change to the artwork updates both.
- **Not committed:** `output/brand/forged-wayfinder-v1.zip`, a duplicate of the pack. It stays untracked and is left in place.

### 8. Item names in group cells that have room (owner request)

The owner asked, during spec review on 2026-10-04, for the group overview to show equipped item names when cells have room: with three members the cells are wide, yet they still show only icon, item level, track and state word.

**The rule follows the cell's own width, not the member count or the viewport.** Each `GroupCell` becomes a CSS size container (Tailwind v4's built-in `@container`, which sets `container-type: inline-size`). The name shows when the cell is at least **180 px** wide. A container query measures the container's content box, which at `sm` and up is the cell minus its 1 px borders and 8 px side padding (18 px), so the class is `@min-[162px]:` (162 + 18 = 180). Written as `@min-[180px]` it would hide the name in a 196 px cell (178 px of content), which the implementation measured. The grid's columns are `minmax(0, 1fr)`, so the cell's width comes from the grid track, never from its content, and inline-size containment is safe.

Measured cell widths on 2026-10-04 (Chrome, populated groups; viewport width, then cell width per member count):

| Viewport | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| 1440 (rail beside grid) | 869 | 432 | 286 | 213 | 169 |
| 1024 | 857 | 426 | 282 | 210 | 167 |
| 768 | 601 | 298 | 196 | 146 | 115 |
| 375 | 271 | 134 | 88 | 66 | 52 |

At 180 px the five-member desktop grid (167–169) and every five-member phone or tablet layout stay compact, with a margin of 11 px or more, while three members at 768 px and up (196 and wider) and four members on desktop (210 and wider) show names. A 180 px cell at `sm` and up leaves 180 − 2 border − 16 padding − 36 icon − 8 gap = 118 px for text, about 19 characters of 12 px Barlow: enough to recognise an item.

**What a wide cell shows, at `sm` and up (the row layout):**

- **Line 1, new:** the equipped item's name, 12 px semibold in its quality's text colour from `QUALITY_STYLES`, one line, truncated with an ellipsis. When the upgrade arrow is shown, the name line keeps 14 px of right padding so the arrow in the top-right corner never covers it.
- **Line 2:** item level (mono) and track label on one line, separated by 6 px. In a compact cell they stay on two lines as today. Joining them keeps a wide cell at three lines, so names don't make rows taller than today's 68 px minimum.
- **Line 3:** the state word, unchanged.

**Below `sm` (the stacked layout)** a cell is 180 px or wider only for one member on a phone (256–271 px). There the name shows as the first text line under the icon, centred and truncated; item level and state word stay as they are, and the track stays hidden as today.

**Unchanged in every cell:** icon and quality border, row tone, state word and its colour, upgrade arrow, Wowhead tooltip link, the button covering the cell, its accessible name (which already includes the full item name), and the details card, which still shows the full name, wrapping and never truncated.

**Empty and unknown cases.**
- A slot with nothing equipped shows no name, never a placeholder or the BiS item's name.
- An unknown track (`tracksKnown` false or no track label) leaves line 2 as the item level plus whatever `trackDisplay` returns today.
- Member columns showing a `cellNote` instead of cells are unchanged.

The name is visual only: the text column stays `aria-hidden`, as today, because the button's accessible name already says everything.

## Component boundaries

| Unit | Job | Used by |
|---|---|---|
| `brand-mark/BrandMark.tsx` | Flat Open Crest SVG at a given size | `app/layout.tsx` |
| `brand-icon/BrandIcon.tsx` | One utility icon SVG by name and size | `MainNav`, `GroupLayout`, `DungeonPriority`, `VaultSection` |
| `setup-notice/CornerFrame.tsx` | Four corner pieces around its children | `SetupNotice` only |

All three are server-safe (no state, no effects). `MainNav` and `GroupLayout` are already client components and import `BrandIcon` like any other component.

Decision 8 changes `group-grid/GroupCell.tsx` markup only: the container class, the name line and the line-2 wrapper. Nothing in the cell's rules (`rowTone`, `stateWord`, `trackDisplay`, `cellLabel`) changes, and the width rule lives in CSS, so there is no new pure function to extract.

## Acceptance tests

### Automated

- `BrandIcon` renders an `<svg>` with `aria-hidden="true"`, `focusable="false"`, `viewBox="0 0 64 64"`, the given size as width and height, and the given class; Vault includes its filled diamond.
- `BrandMark` renders an `<svg>` with `aria-hidden="true"`, `viewBox="0 0 256 256"`, four paths, and the given size.
- `GroupLayout`'s tab buttons and rail buttons still render their labels as text ("Gear", "Dungeons", "Vault", "Great Vault"), with an `aria-hidden` icon inside each. The Dungeons tab still renders its count. Phone tabs carry `flex-auto`, rail buttons `flex-1`.
- `GroupGrid`: a cell with an equipped item renders the item name inside the `aria-hidden` text column, in a span that carries `hidden @min-[180px]:block` and `truncate`, in its quality's text colour; the cell carries `@container`. A cell with nothing equipped renders no name. A cell with an upgrade gives the name line its right padding. The button's accessible name is unchanged.
- `MainNav` renders each link with its label text and an `aria-hidden` icon that carries `hidden sm:block`.
- `DungeonPriority` and `VaultSection` headings still contain their heading text, plus an `aria-hidden` icon.
- `SetupNotice` still lists the missing variables, and its metallic image has an empty `alt`.

### By hand

- The browser tab shows the crest on `/`, `/group` and a character page in Chrome; `<head>` holds the `favicon.ico`, `icon.svg` and `apple-icon.png` links.
- The header at 1440, 768 and 375 px: no horizontal scroll; at 375 px the nav shows labels only.
- Group page tabs at 768, 375 and 320 px with a populated group, and the rail switch at 1440 px: icons beside labels, nothing wraps that didn't before. At 375 and 320 px, read each tab icon's rendered bounding box (`getBoundingClientRect`), not its width attribute: 24 × 24, with the Dungeons label and count fully visible and no horizontal scroll.
- Item names (decision 8), with made-up or local characters only, never committed:
  - At 1440 px, go from five members to three: names appear (cells 169 → 286 px); add members back to five and they disappear.
  - At 768 px with three members (196 px), names show; with four (146 px), compact.
  - At 375 px with one member, the name shows centred under the icon; with two or more, compact.
  - Long names truncate with an ellipsis and never cover the upgrade arrow or the state word, or cause horizontal scroll.
  - An empty slot shows no name; with tracks unknown, line 2 shows the item level and today's track text.
  - Pressing a wide cell still opens the details card with the full name; the Wowhead tooltip still shows on the icon.
  - Rows are no taller than today at three members.
- Character page at 1440 and 375 px: heading icons aligned with Cinzel headings.
- The header diamond is centred and overlaps nothing at all three widths.
- The setup notice, by running a server with `BLIZZARD_CLIENT_ID` set empty: the metallic crest and corners render, the panel fits at 375 px.
- Icons at 24 px look crisp at 100% zoom; no clipped strokes at the viewBox edges.

The project has no browser test setup, so layout, overflow and visual checks are by hand.

## Risks

- **Stroke clipping at the viewBox edge.** Some icon paths touch 2–62 on a 64-unit grid with a 3.2-unit stroke, so half the stroke reaches 0.4 units from the edge. The browser check at 24 px showed no clipping; `overflow="visible"` on the SVG is the fix if a renderer clips.
- **Inline path copies drift from the pack.** Decision 7's README section names the components that hold copies.
- **Measured widths drift.** The 180 px threshold and the tab budget rest on Chrome measurements of today's fonts and padding. A later change to cell padding, the icon size or the rail width moves them; the hand checks above re-measure.
- **Container queries in old browsers.** Size container queries need Chrome 105, Safari 16 or Firefox 110. Where they are unsupported, `hidden` keeps every cell compact, which is today's behaviour.

## Out of scope

- A site name, wordmark, web app manifest, PWA install or Open Graph image. They wait for the naming decision; the social background stays in the pack.
- A light theme. The app is dark only; the charcoal logo variant stays in the pack.
- Brand icons in state badges, the legend or the upgrade badge (decision 3).
- Any change to tokens other than adding `--color-header`, to fonts, or to gear, class, state or track colours.
- Item names wrapping onto two lines, or a user setting for names. One truncated line keeps row heights fixed; the full name is one press away in the details card.
- Any other change to the group grid, its header, notices or details card.
