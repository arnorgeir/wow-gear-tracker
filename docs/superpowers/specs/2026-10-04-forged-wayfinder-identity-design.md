# Forged Wayfinder visual identity

Status: approved in conversation on 2026-10-04; written spec awaiting the owner's review.
Date: 2026-10-04
Issues: #77 — Apply the Forged Wayfinder visual identity; #69 — Add a favicon (sub-issue of #77)
Assets: `output/brand/forged-wayfinder-v1/` (staged on this branch, moved by this work; see decision 7)

## Goal

The app still wears a placeholder: a generic stroked shield in the header and the browser's default tab icon. The owner approved a visual identity, Forged Wayfinder, with the Open Crest emblem and a heavy, angular family of utility icons. This change brings that identity into the existing UI so the app looks like one considered thing, without changing what it shows or how it works.

"Forged Wayfinder" names the visual direction, not the site. The displayed name stays "Gear Tracker" until a naming decision is made.

## What success looks like

- The header shows the flat Open Crest beside "Gear Tracker" on every page.
- The browser tab and an iOS home-screen bookmark show the Open Crest, readable on both light and dark browser chrome.
- Main navigation, the group page's view switches and the character page's two side panels carry the matching utility icon beside their visible label, and every one keeps its text as its accessible name.
- Nothing moves, wraps or overflows at 1440, 768 or 375 px that didn't before.
- Gear rarity, class, state and upgrade-track colours, Blizzard artwork, layouts, data and interactions are unchanged.

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

Icons are never placed below 24 px. Tab heights (44 px), nav link padding and heading line heights already fit them; the tabs' existing `gap-1.5` spaces icon and label, and nav links gain `inline-flex items-center gap-2`.

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

## Component boundaries

| Unit | Job | Used by |
|---|---|---|
| `brand-mark/BrandMark.tsx` | Flat Open Crest SVG at a given size | `app/layout.tsx` |
| `brand-icon/BrandIcon.tsx` | One utility icon SVG by name and size | `MainNav`, `GroupLayout`, `DungeonPriority`, `VaultSection` |
| `setup-notice/CornerFrame.tsx` | Four corner pieces around its children | `SetupNotice` only |

All three are server-safe (no state, no effects). `MainNav` and `GroupLayout` are already client components and import `BrandIcon` like any other component.

## Acceptance tests

### Automated

- `BrandIcon` renders an `<svg>` with `aria-hidden="true"`, `focusable="false"`, `viewBox="0 0 64 64"`, the given size as width and height, and the given class; Vault includes its filled diamond.
- `BrandMark` renders an `<svg>` with `aria-hidden="true"`, `viewBox="0 0 256 256"`, four paths, and the given size.
- `GroupLayout`'s tab buttons and rail buttons still render their labels as text ("Gear", "Dungeons", "Vault", "Great Vault"), with an `aria-hidden` icon inside each.
- `MainNav` renders each link with its label text and an `aria-hidden` icon that carries `hidden sm:block`.
- `DungeonPriority` and `VaultSection` headings still contain their heading text, plus an `aria-hidden` icon.
- `SetupNotice` still lists the missing variables, and its metallic image has an empty `alt`.

### By hand

- The browser tab shows the crest on `/`, `/group` and a character page in Chrome; `<head>` holds the `favicon.ico`, `icon.svg` and `apple-icon.png` links.
- The header at 1440, 768 and 375 px: no horizontal scroll; at 375 px the nav shows labels only.
- Group page tabs at 768 and 375 px, and the rail switch at 1440 px: icons beside labels, nothing wraps that didn't before.
- Character page at 1440 and 375 px: heading icons aligned with Cinzel headings.
- The header diamond is centred and overlaps nothing at all three widths.
- The setup notice, by running a server with `BLIZZARD_CLIENT_ID` set empty: the metallic crest and corners render, the panel fits at 375 px.
- Icons at 24 px look crisp at 100% zoom; no clipped strokes at the viewBox edges.

The project has no browser test setup, so layout, overflow and visual checks are by hand.

## Risks

- **Stroke clipping at the viewBox edge.** Some icon paths touch 2–62 on a 64-unit grid with a 3.2-unit stroke, so half the stroke reaches 0.4 units from the edge. The browser check at 24 px showed no clipping; `overflow="visible"` on the SVG is the fix if a renderer clips.
- **Inline path copies drift from the pack.** Decision 7's README section names the components that hold copies.

## Out of scope

- A site name, wordmark, web app manifest, PWA install or Open Graph image. They wait for the naming decision; the social background stays in the pack.
- A light theme. The app is dark only; the charcoal logo variant stays in the pack.
- Brand icons in state badges, the legend or the upgrade badge (decision 3).
- Any change to tokens other than adding `--color-header`, to fonts, or to gear, class, state or track colours.
