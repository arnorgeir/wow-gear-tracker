# Group page layout for five members, with crest icons

Status: draft, awaiting owner approval
Date: 2026-10-04
Issues: #75 — Group page layout that scales to five members and small screens; #63 — Show crest icons instead of crest names
Design: the "Approved: Group page for five" row of the design canvas, https://claude.ai/artifact/XW7MPW49MWZZoYEty6MTxc (boards "Approved: Group page, desktop (side rail)", "… tablet (768)" and "… phone (390)")
Parent specs: `docs/superpowers/specs/2026-10-03-plan-3b-group-page-design.md`, `docs/superpowers/specs/2026-10-03-group-dungeon-priority-design.md`

## Goal

The Group page answers two questions: how does everyone's gear compare, and where should we go next. With five members the dungeon priority list sits below a tall gear grid and grows long, so the second answer is a long scroll away. This change puts both answers on one screen on desktop, and one tap apart on smaller screens.

It also replaces crest names with their icons everywhere crests appear (#63), because the compact column headers only have room for icons.

The data the page shows does not change. Rankings, scores, member states, vault choices and crest balances come from the same loaders. This spec changes layout and presentation, and adds one piece of data: the icon name of each crest currency. It supersedes the page layout in the group-page spec and the "Keep the existing page layout and controls" decision of the dungeon priority spec. Those specs remain authoritative for everything else.

## What success looks like

- At 1280 px and wider, the gear grid for five members and the dungeon priority list are visible side by side, and the priority list stays in view while the grid scrolls.
- Below 1280 px, Gear, Dungeons and Vault are tabs, so each is one tap away and never below the others.
- At 390 px, the gear grid shows all five members without sideways scrolling, and every cell still names its state in a word.
- Every piece of information today's page shows is still reachable: item names, what replaces an item, upgrade steps, crests, member errors and actions, every priority notice and every vault choice.
- Every member name on the page has its avatar beside it.
- Crests show as their icons, with the name on hover, on the group grid, character page, character cards and upgrade badges. A missing icon falls back to the name and never breaks a page or a sync.

## Decisions and reasons

### 1. Desktop: compact grid beside a sticky rail

At the `xl` breakpoint (1280 px) and wider, the page body is two columns:

- **Left:** the state legend, then the compact gear grid (decision 3), filling the remaining width.
- **Right:** a rail about 400 px wide, sticky at `top-6`. A two-button switch at its top shows **Dungeons** or **Great Vault**. It opens on Dungeons.

1280 px is the narrowest width where each of five grid columns keeps about 130 px, the least the compact cell needs for an icon beside "Champion 2/6". The owner chose this layout because the page is mostly used as an overview of each other's gear and where to go next. A "run next" hero (option C in the canvas) was rejected because the group may not hold the top dungeon's keystone. The dungeon-by-member matrix (option B) was rejected because it hides the gear while you read it.

### 2. Below 1280 px: tabs

Below `xl`, a tab bar with three buttons, **Gear**, **Dungeons** and **Vault**, sits under the member pills. Dungeons shows the number of ranked dungeons beside its label. Only the chosen panel shows, at full width. The page opens on Gear. Each tab is a `<button>` with `aria-pressed` and a touch target of at least 44 px.

Below `sm` (640 px), the gear grid shrinks further (decision 3), and the member pills hide the spec.

The phone board drew the members as an avatar grid behind an "Edit group" button. This spec keeps today's wrapping pills instead, without the spec, so adding and removing members work the same at every size with no new code.

### 3. One view state, switched by CSS

A new client component, `group-layout/GroupLayout.tsx`, receives the three panels as server-rendered slots (`gear`, `dungeons`, `vault`) and the dungeon count. It holds one state, `view: 'gear' | 'dungeons' | 'vault'`, defaulting to `'gear'`. A pure function in `group-layout/panel-classes.ts` maps the view to Tailwind classes:

| Panel | `view` is `gear` | `view` is `dungeons` | `view` is `vault` |
|---|---|---|---|
| Gear | shown | hidden, shown at `xl` | hidden, shown at `xl` |
| Dungeons | hidden, shown in the rail at `xl` | shown | hidden |
| Vault | hidden | hidden | shown |

The tab bar is hidden at `xl`. The rail switch is shown only at `xl`; its Dungeons button is pressed whenever `view` is not `'vault'`, and pressing it sets `'dungeons'`. On a desktop, then, the page opens with the grid and the rail on Dungeons, and on a phone it opens on Gear.

The server renders the right layout on the first paint, so there is no hydration mismatch and no `matchMedia`. The view is not remembered across reloads.

A media-query hook rendering different trees was rejected: the first render cannot know the width, so it flashes or mismatches. A `?view=` URL parameter was rejected: every switch would cost a server round trip.

### 4. The compact gear cell

`GroupCell` becomes one `<button>`, keeping today's row tone from `rowTone`. Inside, in a row:

- The equipped item's icon with its quality border. An empty slot shows today's empty-slot placeholder at icon size.
- A text column: item level in mono, the track label (hidden below `sm`), and a **state word**.
- An upgrade arrow in the top-right corner when `cell.upgrade` is set, with "Can upgrade now" for screen readers.

The state words are short forms of today's `StateBadge` wording, in a new pure function beside the cell:

| State | Word | Today's badge |
|---|---|---|
| `done` | Done | Done: Myth max |
| `mythUpgradable` | Crests | Upgrade with crests |
| `belowMyth` | Vault | Great Vault target |
| `inBags` | Bags | BiS in bags |
| `missing` | Need, or Need tier when the BiS row is a tier piece | Missing |

The word always follows the state. When tracks are unknown (`tracksKnown` false), the cell drops its tone as it does today, and the word still shows.

The button's accessible name reads in full, for example "Birkibjörn, Head: Enigmatic Dreamwatcher's Somnolent Stare, item level 321, upgrade with crests". Hovering shows the Wowhead tooltip through `data-wowhead` on the button (see "Risks"). Pressing it opens the details card (decision 6).

Below `sm`, the cell stacks vertically: icon, item level, state word. Five such cells fit in 390 px. Slot labels shorten through a pure function keyed by `SlotType`, beside `SLOT_LABELS`: Head, Neck, Shldr, Cloak, Chest, Wrist, Gloves, Belt, Legs, Boots, Ring 1, Ring 2, Trink 1, Trink 2, Weap and Off-h. The full label stays available to screen readers.

Columns for members without rows keep today's `cellNote` text.

### 5. Column headers: avatar, name, crests, and warnings only when needed

`MemberHeader` slims to:

- **Line 1:** the avatar and class-colored name, linking to the character page, as today.
- **Line 2:** crest chips (decision 9), always shown, never behind a toggle. With no paste, a short "No SimC" link to the character page replaces them.
- **Only when it applies:** today's warnings and buttons, unchanged in wording: the untracked line with Track, not found with Remove, the sync error with Refresh, the BiS error, and "Overall list" when the member fell back to Method's Overall list. The Mythic+ list is the default and gets no label.

The owner chose always-visible compact crests over a collapsible header: fewer things to click.

### 6. One details card for every cell, at every size

A new `cell-details/CellDetails.tsx` opens when a cell is pressed. It shows:

- the member's avatar and name, and the slot
- the full `ItemCard`, the Wowhead link with its tooltip
- `StateBadge`
- `UpgradeBadge` when the item can be upgraded now
- the need line from today's `needText`, except that a tier need names the piece: "Need: Enigmatic Dreamwatcher's Plumage (tier, via catalyst)"
- a close button

It uses the native `popover` attribute, so it renders in the top layer, never clipped by the grid's scroll box, and the browser gives Escape and light dismiss. At `sm` and up it is placed beside the pressed cell, from the cell's `getBoundingClientRect` when it opens, and kept inside the viewport. Below `sm` it is fixed to the bottom of the screen with a 12 px margin. Focus moves into the card when it opens and back to the cell when it closes. One card is open at a time.

The owner chose a card over a `title` attribute because the item name and what replaces it must stay reachable by touch and keyboard, and Wowhead's tooltip cannot say what replaces the item.

### 7. Dungeons panel: collapsible rows

The panel keeps the heading "Dungeon priority", "Score = weighted upgrades", and every notice `GroupPriority` shows today, in the same words and order: partial coverage, the Overall fallback per member, approximate drops and a stale season at the top; loading or failed instead of the list; "Nothing anyone needs from …" at the bottom; and the "needs at least one member" text when there is no ranking.

Each ranked dungeon is a native `<details>` element inside the ordered list, which gives keyboard and screen-reader support with no client code. The first dungeon is open on load. Any number can be open.

- **Summary:** rank, a 48×36 `DungeonThumbnail`, the dungeon name, the score, and one badge per benefiting member with an 18 px avatar and that member's number of credits. The member's name is in the badge for screen readers and in its `title`.
- **Open body:** one line per benefiting member, in ranking order: a 20 px avatar, the class-colored name, then chips in credit order. A split dungeon's note sits at the top of the body.

Each chip is a 32 px tile with its slot under it, in the short slot words from decision 4 ("Chest", "Ring 1", "Trink 2"), at 10 px. The visible slot word is what tells a reader which piece each need is for, without hovering. The chips, labeled by a pure function:

| Credit | Tile | Label (tooltip and screen readers) |
|---|---|---|
| `item` | the item's icon, a Wowhead link with `data-wowhead` | "Cloak of the Restless Tribes (Cloak)" |
| `tier` | the tier piece's own icon, a Wowhead link, with a gold "T" badge in the corner | "Enigmatic Dreamwatcher's Plumage (Shoulders), tier: catalyst a shoulders drop from this dungeon" |
| `any` | a dashed tile with the minimum item level | "Any ring, level 334+" |

A tier chip shows the piece the member is hunting, not the dungeon drop that becomes it. Any drop in that slot and armor type can be catalysted, so the drop is one of several equal candidates, while the tier piece matches the member's BiS list and the character page. A tier credit whose piece has no icon falls back to a dashed tile with "T" and the same label.

Each chip keeps today's per-credit weight in its `title`.

The character page's own dungeon priority list (`character-page/DungeonPriority.tsx`) shows tier needs the same way: the tier piece's name and icon with a tier label, instead of "Tier via catalyst".

### 8. Vault panel

`GroupVault` keeps its content and wording: one block per member with avatar and name, the paste age, and each choice as an `ItemCard` with "BiS" or "Not BiS". Only its container changes, so it fits the rail and the tab.

### 9. Crest icons (#63)

**Source.** Blizzard's APIs expose no currency icons. Wowhead's tooltip endpoint, `https://nether.wowhead.com/tooltip/currency/<id>`, returns the icon name for any currency ID. Checked on 2026-10-04 for the Midnight season's crests:

| ID | Crest | Icon |
|---|---|---|
| 3442 | Adventurer Mistcrest | `inv_121_crest_adventurer` |
| 3443 | Veteran Mistcrest | `inv_121_crest_veteran` |
| 3444 | Champion Mistcrest | `inv_121_crest_champion` |
| 3445 | Hero Mistcrest | `inv_121_crest_hero` |
| 3446 | Myth Mistcrest | `inv_121_crest_myth` |

The images are hotlinked from `https://wow.zamimg.com/images/wow/icons/medium/<icon>.jpg`, the host Wowhead's tooltip script already loads from. Only icon names are stored; no third-party image is committed or downloaded. The owner chose hotlinking over local copies. Looking up by currency ID, rather than keeping a hand-made list, means next season's crests work without a code change.

**Client.** A new client module, `src/core/wowhead/currency.ts`, fetches the endpoint through `fetchJson` and returns the `icon` field. It accepts only names matching `^[a-z0-9_]+$`; anything else counts as no icon. The Wowhead module is a client in the `src/core` sense: it fetches and parses, and never touches the database.

**Storage.** `upgrade_tracks` gains a nullable `currency_icon` column. `ensureTracks` receives a `fetchCurrencyIcon` function beside `fetchRaidbots`. After a successful Raidbots fetch, it looks up each distinct currency ID, at most 4 at a time through `createLimiter`, and stores the names with the tracks. A failed lookup stores null for that currency and never fails the tracks sync; the next daily refresh tries again. `TRACKS_META_KEY` moves to `tracks.v3.fetchedAt`, so existing installs refetch instead of keeping rows without icons for a day.

**Views.** One helper turns an icon name into the image URL. `CrestBalance` gains `iconUrl: string | null`. `UpgradeOption` gains `currencyId` and `iconUrl`. `CrestCost` carries the icon name from the track row.

**Display.** A new `crest-chip/CrestChip.tsx` shows a 16 px icon and the count in mono, with the full name and steps in its `title` and for screen readers ("Myth Mistcrest: 85, 4 steps"). With no icon, it shows the first word of the name and the count, as the character card does today. It is used:

- in the group column headers (decision 5)
- in `CrestSummary` on the character page, replacing the name chips; the paste age stays
- on character cards, where `crestLine` returns the balances as data and the card renders chips, followed by today's "3 BiS upgrades ready" or "no BiS upgrades affordable" text and tone
- in `UpgradeBadge`, as a 13 px crest icon before the step count, with today's `title` text

### 10. Avatars beside every member name

Every member name the page shows has a `CharacterAvatar` beside it: the member pills, column headers, details card, dungeon summary badges, dungeon body lines and vault blocks. A member without a tracked character shows no avatar, as today.

## Data and view shape

- **Schema:** `upgrade_tracks.currency_icon`, nullable text. Generate the migration with `npm run db:generate -- --name crest-icons`.
- **Cache version:** `TRACKS_META_KEY` becomes `tracks.v3.fetchedAt`.
- **Types:** `Track` gains `currencyIcon: string | null`. `CrestCost`, `CrestBalance` and `UpgradeOption` gain the fields in decision 9. The `tier` credit, in `rank.ts` and in `PriorityCreditView`, gains the tier piece's `itemId`, `name` and `bonusIds` from its BiS row; the view adds its `item: ItemView` the way item credits get theirs, so the loaders include tier credit item IDs in their icon lookups. No other view type changes shape.
- **Services:** the Wowhead currency lookup is built in `services.ts` with the shared `fetchFn`, like the other clients.

## Component boundaries

| Piece | Kind | Job |
|---|---|---|
| `group-layout/GroupLayout.tsx` | client | View state, tab bar, rail switch, panel visibility |
| `group-layout/panel-classes.ts` | pure | View to classes, tested |
| `group-grid/GroupGrid.tsx` | server | Grid with compact cells and short slot labels |
| `group-grid/GroupCell.tsx` | client | Cell button that opens `CellDetails` |
| `group-grid/state-word.ts`, `group-grid/slot-short.ts` | pure | Words and short labels, tested |
| `cell-details/CellDetails.tsx` | client | The popover card and its placement |
| `group-grid/MemberHeader.tsx` | server | Slim header with crest chips and warnings |
| `group-priority/DungeonRow.tsx` | server | One `<details>` dungeon, replacing `DungeonCard` |
| `group-priority/CreditChip.tsx`, `group-priority/chip-label.ts` | server, pure | Chips and their labels, replacing `CreditCard` |
| `crest-chip/CrestChip.tsx` | server | Icon and count with fallback |
| `src/core/wowhead/currency.ts` | core client | Icon name lookup |

`GroupCell` becomes a client component only because it opens the card. The cell's markup stays plain, and its rules stay in the pure functions.

## Acceptance tests

### Automated

- `panel-classes`: each view gives the visibility in the decision 3 table, including the rail switch's pressed state.
- `state-word`: each state, including unknown tracks, gives its word, and a missing tier row gives "Need tier".
- `slot-short`: every slot type gives its short label.
- `chip-label`: item, tier and Any credits give the labels in decision 7.
- `rankDungeons`: a tier credit carries the tier piece's item ID, name and bonus IDs; scores and order are unchanged.
- Group and character page views: a tier credit carries its `item` with the icon URL.
- The cell `needText`: a tier need names the piece.
- `crestLine`: returns balances as data with today's text and tone for the ready, none-affordable and unknown cases.
- `wowhead/currency`: parses the icon from a trimmed tooltip fixture; rejects an icon name with other characters; an HTTP error or a missing field gives no icon.
- `ensureTracks`, with the in-memory database and fake fetch: stores icon names per currency; one failed lookup stores null for that currency and the sync still succeeds; the v3 key forces a refetch over a fresh v2 key.
- Crest views: `CrestBalance.iconUrl` and `UpgradeOption.iconUrl` carry the URL when the icon is known and null when not.

### By hand

The project has no browser-level tests, so these are checked by hand on the final commit:

- 1440, 1280, 1024, 768 and 390 px wide, with five members: the layout matches the approved boards, and nothing scrolls sideways at 390 px.
- The rail stays in view while the grid scrolls, and its switch shows Dungeons and Vault.
- Tabs switch panels, and resizing across 1280 px keeps a sensible panel.
- A cell opens the details card by mouse, touch and keyboard; Escape and an outside click close it; focus returns to the cell.
- Hovering a cell shows the Wowhead tooltip.
- Dungeon rows open and close with mouse and keyboard; the first is open on load.
- Crest icons show on the group headers, character page, character cards and upgrade badges, and the names show when the icon host is blocked.
- A member who is untracked, not found, syncing, or has a sync error shows today's text and button in the slim header.

## Risks

- **Wowhead tooltips on a button.** The tooltip script is known to work on links with `data-wowhead`. If it ignores a `<button>`, a link cannot simply go inside the button, because interactive elements may not nest. The cell then becomes two siblings: the icon as a Wowhead link for hover, and the rest of the cell as the details button. The plan's first task checks this in the running app, before the cell is built.
- **The tooltip endpoint is undocumented.** If it changes, crests fall back to names. `AGENTS.md` gets an "External data facts" line saying so.

## Out of scope

- Reordering members (#64).
- Making the Missing state stand out more (#66). The new "Need" word touches it; #66 keeps its own ideas.
- Remembering the chosen tab or rail view across reloads.
- Changes to scoring, eligibility, membership or season loot.
