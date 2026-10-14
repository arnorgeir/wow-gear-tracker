# Item card polish: class icons, whole-card tooltips and rarity links

Status: recommendations pre-approved by the owner on 2026-10-14. Builds on PR #143 (`feat/minor-polish-batch`, #136 and #142), which merges first: its `pickQuality`, `RarityBox`, `ItemName` and three-line card are taken as the starting point. Spec review round 1 (Opus reviewer) folded in: S1.1-S1.8. S1.1 the no-track hint becomes visible text in the details card; S1.2 a click on the overlay closes an open card instead of reopening it; S1.3 the caller picks the badge ring color; S1.4 the badge wrapper is a sized block; S1.5 editor and search links size to their content; S1.6 replaced picks rise to 80% opacity for 4.5:1; S1.7 `ItemLink` takes the quality to show, and an unusable item shows its base quality; S1.8 `ItemLink` gets its own file and tests, and the `GroupCell` test checks the overlay's and button's attributes. Round 2 folded in: S2.1 the `PickLine` link is `w-fit max-w-full`, since `inline-flex` alone still stretches as a grid item and a column-flex child; S2.2 "Choose" and "Can't choose" take `ml-auto`, so they line up at the row's right edge now that nothing grows.
Date: 2026-10-14
Issues: #25, #65, #89

## Goal

Three small UI issues, all about how characters and items show, in one spec, one plan and one pull request with one commit series per issue. Each section answers its issue's open questions with the recommended choice.

## Scope

In scope: the three changes below.

Out of scope:

- Any schema change, migration or new view field. `classIconUrl` and every item's `quality` are already on the view models.
- A new rarity palette. `QUALITY_STYLES` (`src/components/item-card/quality-styles.ts`) already brightens each text color for the dark theme (see #65).
- Looking up a BiS item's catalog quality on the character and group pages. No current-season BiS item is above Epic, so the rule alone gives the right answer (see #65).
- Native `title` hover text. A browser tooltip can't hold a link, so the "Need: …" hint on a group cell stays text; the linked item is in the cell's details card.
- Class icons anywhere but the character card and the character page header. Smaller avatars (group grid, chips, vault) are too small for a badge.

## #25 Class icon on the character card and the character page header

**Problem.** `CharacterAvatar` (`src/components/character-avatar/CharacterAvatar.tsx`) only shows the class icon when the character has no avatar. With an avatar, which is the usual case, the class shows only as the ring color and the word in the identity line.

**Open question answered: placement.** A corner badge on the avatar, bottom right, the way `EditorHeader` (`src/components/bis-editor/EditorHeader.tsx`) badges a spec icon with its class icon. It adds no line to the card's three-line identity block (#142) and none to the header. When the avatar is missing and the class icon already fills the ring, no badge shows.

**Design.**

- `CharacterAvatar` gains `classBadge?: 'surface' | 'bg'`, the surface the avatar sits on. When it is set and both `avatarUrl` and `classIconUrl` are set, the avatar sits in a `relative block shrink-0` span sized `size` × `size` px, the way `EditorHeader` sizes its box, and the avatar `<img>` gets `block` so no line-box gap opens under it. The class icon is a second `<img alt="">`, `block absolute -bottom-1 -right-1 rounded-md border-2`, sized `Math.round(size * 0.4)` px: 21 px on the 52 px card avatar, 30 px on the 76 px header avatar. Its ring is `border-surface` for `'surface'` and `border-bg` for `'bg'`, so it reads as a cutout in the surface behind it, as `TrackedCard`'s `border-surface` does. Without `classBadge` the markup is unchanged.
- `src/components/character-card/CharacterCard.tsx` passes `classBadge="surface"` (the card is `bg-surface`) and `src/components/character-page/CharacterHeader.tsx` passes `classBadge="bg"` (the header sits on the page). No other caller does.
- The badge is decorative, like the avatar: the class is written out in the identity line ("Troll Guardian Druid") on both, so the icon is never the only signal.
- #112's link cue also edits `CharacterCard.tsx`, on the name link, not the avatar. Whichever merges second rebases onto the other.

**Testing.** `CharacterAvatar.test.ts`: with `classBadge="surface"` and both URLs, two `<img>`, the badge at 21 px for size 52 with `border-surface`, and a wrapper with `width:52px;height:52px`; `classBadge="bg"` gives `border-bg`; with `classBadge` and no avatar, one `<img>` (the class icon) and no badge; without `classBadge`, one `<img>`. By hand at 375 and 1440 px: the badge sits on the ring's lower right on the overview card and the character page header, and doesn't overlap the name.

## #89 Hovering the whole item card shows the Wowhead tooltip

**Problem.** `ItemCard` (`src/components/item-card/ItemCard.tsx`) is already one link, so the character page's cards show the tooltip anywhere. Elsewhere only part of the item is a link. Wowhead's script only scans links, so the rest shows nothing:

- `GroupCell` (`src/components/group-grid/GroupCell.tsx`): only the 34 px icon is a link. The rest of the cell is the button that opens the details card.
- `CellDetails` (`src/components/cell-details/CellDetails.tsx`): the equipped item's name is a link, its icon and detail line aren't.
- `PickLine` (`src/components/bis-editor/PickLine.tsx`): the name is a link, the icon and detail line aren't.
- `ItemSearch` (`src/components/item-search/ItemSearch.tsx`, as of #143): `ItemName` is a link, the `RarityBox` and result detail aren't.

**Open question answered.** The whole item is the link wherever an item shows with its icon: hover anywhere on it shows the tooltip.

**Design.**

- **GroupCell.** The link moves off the icon and becomes an empty overlay over the whole cell: `<a ... className="absolute inset-0 z-10 rounded-lg">`, rendered only when an item is equipped. It keeps today's attributes: `href`, `data-wowhead={wowheadData(...)}`, `target="_blank"`, `rel="noreferrer"`, `tabIndex={-1}`, `aria-hidden="true"`, and the `onClick` that prevents navigation and clicks the button, so a click or tap anywhere still opens the details card and Wowhead stays one tap further in the card. The icon renders without a wrapper. The button stays the only tab stop and keeps its `aria-label` and focus ring. Its `title` now only shows on a cell with nothing equipped, since the overlay covers it otherwise. The need is in the details card as the "Needed" item, "Stats unverified" is on its item line (#143), and the no-track hint becomes visible text there (below). The comment above the component says so.
- **GroupCell toggle.** The details card is `popover="auto"`, so a pointerdown outside it, on the overlay, light-dismisses an open card before `onClick` runs, and the overlay's `button.click()` would reopen it. The overlay's `onPointerDown` records in a ref whether the card was open (`document.getElementById(id)?.matches(':popover-open')`), and `onClick` skips `button.click()` when it was. A click on the cell of an open card closes it, as a click on the button does today.
- **CellDetails.** The equipped item's icon, name and detail line become one link: the `div` that holds them is an `<a>` with the same attributes the name link has now, and the name is a plain colored span inside it. The detail line's `title={track.hint}` is removed, since the link's Wowhead tooltip shadows it. Instead, when `trackLabel === null && tracksKnown` (exactly when `trackDisplay` gives a hint), `NO_TRACK_HINT` shows as a muted `text-[13px]` line under the link, outside it.
- **PickLine.** When `itemId` is set, the root `div` is the `<a>` (with `group`), and the name a span with `group-hover:underline`; an "Any" pick (`itemId === null`) stays a `div` with no link. The link is `inline-flex w-fit max-w-full` with no `grow`: `w-fit` because the link is a direct grid item in the desktop slot row and a column-flex child on phones, where `inline-flex` alone still stretches. It ends where its content ends, and a click on the blank space of the row does nothing. `badge` must stay non-interactive (today it's `EditedPill`), since nothing interactive can sit in a link.
- **ItemSearch.** `ItemName` becomes `ItemLink({ item, quality, children })` in its own file, `src/components/item-search/ItemLink.tsx`: one `<a>` holding the `RarityBox`, the name and `children` (the result detail). `quality` is the quality to show (see #65). The link is `inline-flex max-w-full` with no `grow`, so blank row space stays unclickable. The result rows and the chosen-item card use it; the "Choose", "Save" and "Cancel" buttons stay outside the link. Since nothing in a row grows any more, the "Choose" button and the unusable row's "Can't choose" text take `ml-auto`, so they line up at the row's right edge whatever the item's name length.

**Testing.** Markup tests:

- New `GroupCell.test.ts`: with an equipped item, an `absolute inset-0` link with `data-wowhead`, `tabindex="-1"` and `aria-hidden="true"`, no link around the icon, and the button still carrying its `aria-label` and `title`. With nothing equipped, no link.
- `CellDetails.test.ts`: the icon's `<img>` is inside the `data-wowhead` link. A no-track item with `tracksKnown` shows `NO_TRACK_HINT` as text outside the link and no `title` holding it; with `tracksKnown: false`, or an item on a track, no hint.
- New `PickLine.test.ts`: the icon is inside an `inline-flex w-fit max-w-full` link for an item; an "Any" pick has no link.
- New `ItemLink.test.ts`, like `RarityBox.test.ts`: the box and name sit in one `data-wowhead` link, colored by the `quality` passed in.

By hand at 1440 px: hovering the name, item level and state word of a group cell shows the item's tooltip; a click opens the details card, and a second click on the same cell closes it. At 375 px a tap opens the details card. Hovering an editor pick's icon and a search result's icon shows the tooltip, and a click on the blank space of an editor row or a search result opens nothing. In a search with short and long item names, every "Choose" button (and "Can't choose") lines up at the row's right edge.

## #65 Every item reference is a rarity-colored Wowhead link

**Problem.** The issue named two gaps: plain-text "Need: <item>" lines in the group grid, and dungeon priority credits linked without a rarity color. Both are gone in the current code: the grid's needed item is an `ItemCard` in the details card (`BisTarget`), and credits are `ItemCard`s on the character page and rarity-ringed links in `CreditChip`. What is left is one plain-text item, one hidden one, and a rarity rule that lives in three hardcoded strings.

**Every place an item shows,** and what changes:

| Where | Component | Link and tooltip | Rarity color | Change |
|---|---|---|---|---|
| Character page: equipped gear | `GearTable` → `ItemCard` | Yes | Equipped item's quality | None |
| Character page and details card: BiS target | `BisTarget` → `ItemCard` | Yes | `bisView`: Epic | Rule (below) |
| Character page: dungeon credits | `DungeonPriority` → `ItemCard` | Yes | `creditView`: Epic | Rule (below) |
| Character page and group: Great Vault | `VaultSection`, `GroupVault` → `ItemCard` | Yes | Item's quality | None |
| Group grid cell | `GroupCell` | Icon only | Name and ring | Whole cell (#89) |
| Group details card: equipped | `CellDetails` | Name only | Name and ring | Whole item (#89) |
| Group priority credits | `CreditChip` | Yes (icon tile; name in `aria-label` and `title`) | Ring, `creditView`: Epic | Rule (below) |
| BiS editor picks, overrides, orphans | `PickLine` | Name only | `settings-spec`: `pickQuality` (#143) | Whole item (#89) |
| Override search results and chosen item | `ItemSearch` | Name only | `pickQuality` (#143) | Whole item (#89) |
| Override search: item the class can't use | `ItemSearch` unusable row | No, plain `text-dim` | No | Becomes `ItemLink`, base quality |
| "Any" rows and picks | `AnyItemCard`, `PickLine`, `CreditChip` | No item to link | No | None |

**Open question answered: the rarity of a BiS target that isn't equipped.** Epic, by #143's `pickQuality` in `src/core/bis/pick-quality.ts`: a BiS pick shows as Epic unless its base quality is Legendary or Artifact. Method gives no quality, and every Mythic+ and raid BiS drop is Epic at the level it's chased.

**Design.**

- `bisView` and `creditView` in `src/server/views/member.ts` pass `quality: pickQuality(null)` instead of the literal `'EPIC'`, so one function owns the rule across the character page, the group page and the editor. The result is the same Epic today; there is no catalog lookup (see Scope).
- **Which quality `ItemLink` shows.** The caller passes it. A usable result and the chosen item pass `pickQuality(item.quality)`, since they become BiS picks. The unusable row passes the item's base quality, `item.quality ?? 'COMMON'`: it is any pasted item, never a pick, so Epic would be wrong. `RarityBox` takes the same `quality` instead of applying `pickQuality` itself, and `RarityBox.test.ts` follows.
- The unusable search row in `ItemSearch` renders its item through `ItemLink` (#89), colored by its base quality and with the tooltip, so the owner can read why the class can't use it. `unusable` is an `ItemChoice`, so it has everything `ItemLink` needs. The reason (`text-legacy`) and "Can't choose" stay beside it as words; the row keeps its `bg-surface` and gets no Choose button.
- **Readable on dark surfaces.** No palette change. Each `QUALITY_STYLES` text color is the game's rarity color brightened for the dark theme. At full opacity the lowest contrast any of them reaches on the app's surfaces (`bg`, `surface`, `surface-2`, `raised`, each quality's own `ItemCard` tint, and the gold, crest and vault row tones) is Epic `#c58cf5` on `raised` at 6.0:1, above WCAG AA's 4.5:1.
- **Replaced picks.** `PickLine`'s `replaced` line is `opacity-60`, which drops Epic text to 3.3:1 on `gold-wash` and 3.2:1 on `surface-2`. It becomes `opacity-80`, the lowest step that clears 4.5:1: Epic 4.8:1 on `gold-wash` and 4.6:1 on `surface-2`, Rare 4.9:1 and 4.7:1, and the muted detail 4.6:1 on `gold-wash`, the only surface a replaced pick sits on (`SlotRow` replaces only in an edited row). The strikethrough and the smaller 26 px icon stay as the signal that the pick was replaced, so the change doesn't rest on dimming.
- **Color is never the only signal.** Rarity is extra information, never state: every link's text is the item's name, the Wowhead tooltip names the quality in words, and an item's state (Done, Missing, Can't choose) is always written beside it.

**Testing.** `src/server/views/views.test.ts`: a BiS row and an item credit come out Epic. `ItemLink.test.ts`: an unusable item with base quality Rare, passed `'RARE'` as the row passes it, renders Rare's text and ring color, not Epic's. `PickLine.test.ts`: a replaced pick carries `opacity-80` and `line-through`. By hand on a spec's editor: paste the ID of an item the class can't wear; the row shows its name in its base quality's color, the tooltip on hover, the reason, and "Can't choose". By hand: every row of the table above shows a colored name or ring and a tooltip on hover.
