# Dungeon guide layout and nav item

Status: asked for by the owner on 2026-10-17 (redesign the dungeon pages after the in-game Adventure Guide, add a menu item), written for the unattended loop; the owner reviews it with PR #159.
Date: 2026-10-17
Issues: #155, part of #45. Changes the page from #5 (merged in #156) and the tactics panel from `2026-10-14-boss-tactics-design.md`, which stays the authority for data and markup.

## Goal

The dungeon page reads like the in-game Adventure Guide: one boss at a time, chosen from a list of bosses, with its overview, abilities and loot behind tabs. The main menu gets a "Dungeons" item that opens a list of the season's dungeons.

Take the guide's layout, not its art: no WoW textures, frames or icons are copied. The page keeps the app's own tokens (`bg-surface`, `border-line`, `text-gold`, Cinzel for headings, Barlow for text).

## Out of scope

- Difficulty dropdown, class or slot loot filters, a boss model tab, ability icons and severity markers (tank, deadly, interrupt). The stored data has none of them, and Blizzard's journal sample showed no ability flags.
- Boss portraits. `creature_display` media exists but isn't stored, and storing render art needs the licensing check in project memory first. Banners carry the boss name and its order.
- The season overview's Mythic+ summaries (#46) and guide links (#47). The new `/dungeons` list is the simplest page the nav item needs; #46 grows it.

## Routes and state

- **`/dungeons`**: the season's dungeons, in the stored order, each a card with its art (the `imageUrl` already stored) and name, linking to `/dungeons/<id>`. No season stored: a short line saying the season loads from a character page, linking to `/`.
- **`/dungeons/<id>`**: as today, plus two optional search params that pick what shows:
  - `boss=<encounterId>`: the chosen boss. Missing, or not one of this dungeon's bosses: the dungeon itself is chosen.
  - `tab=overview|abilities|loot`: the tab. Missing or unknown: `overview`. `abilities` with no boss chosen falls back to `overview`.
- Every choice is a plain link that changes the search params, so the page stays a server component with no client state, the back button walks through choices, and a choice can be shared as a URL. Parsing the params is a pure function in the page's directory with tests (`guide-state.ts`).
- **Nav:** `MainNav` gains `{ href: '/dungeons', label: 'Dungeons', icon: 'dungeons' }` after Group. `isActiveLink` already marks it active on `/dungeons/<id>`.

## Layout

A two-page spread on wide screens (`lg` and up), like an open book. The left page is the boss index; the right page shows the choice, with tab ribbons down its outer edge.

```
 Dungeons / Den of Nalorakk / Sentinel of Winter
┌───────────────────────┬──────────────────────────────────────┬──┐
│ [art] Den of Nalorakk │ Sentinel of Winter                   │Ov│◀ ribbon tabs,
│  Dungeon overview     │ lore description (muted)             │──│  chosen one
│ ───────────────────── │                                      │Ab│  joins the page
│ 1  The Hoardmonger    │ overview paragraphs                  │──│
│ 2  Sentinel of Winter◀│ ▸ Tanks                              │Lo│
│ 3  Nalorakk           │ ▸ Healers                            │  │
│                       │ ▸ Damage Dealers                     │  │
└───────────────────────┴──────────────────────────────────────┴──┘
```

- **Spread:** one `bg-surface` panel, `rounded-xl border border-line-strong`, split into a left column (`lg:w-80`) and a right column, with a 1 px `border-line` spine and a soft inner shadow on each side of it so the pages read as facing each other. That spine is the page's one decorative flourish; nothing else gets gradients or textures.
- **Breadcrumb** above the spread: `Dungeons` (link to `/dungeons`) / dungeon name (link to the dungeon root) / boss name when one is chosen. `nav aria-label="Breadcrumb"`, current item `aria-current="page"`.
- **Left page, boss index:** the dungeon's art (`DungeonThumbnail`, wider) and name as the index heading, then an "Overview" row for the dungeon, then one banner row per boss in journal order. A banner is a full-width link: its order number in `font-mono text-muted` (the bosses really are a sequence), then the name in `font-display`. The chosen row gets `bg-gold-soft border-gold-line text-gold` and `aria-current="page"`, the same active colors the nav uses. Banners keep the current tab when it applies to bosses.
- **Right page:** the chosen title as `h2` (boss name, or the dungeon name), then the tab panel.
- **Tab ribbons:** a vertical strip on the right page's outer edge, one link per tab with its label written out ("Overview", "Abilities", "Loot"; rotated text is hard to read, so labels stay horizontal in a narrow column). The chosen ribbon takes the page's own background and loses its inner border, so it reads as attached to the page; the others sit back in `bg-surface-2`. A link list with `aria-current="page"` on the chosen tab, not an ARIA tablist, since each tab is a navigation. "Abilities" shows only when a boss is chosen.
- **Narrow screens (below `lg`):** the breadcrumb, then the boss index as a horizontal, scrollable row of banners, then the tabs as a horizontal row of ribbons above the panel. No sideways page scroll at 375 px.

## Tab content

- **Overview, dungeon chosen:** the dungeon art large (aspect-video, `object-cover`, falls back to the short-name tile as `DungeonThumbnail` does), the split-dungeon note when it applies, then each boss's description as a short entry linking to that boss. A boss with no description shows its name only.
- **Overview, boss chosen:** description in muted text, the overview blocks, then each role as a native `<details>` with its title as the summary, open by default (the guide's collapsible role sections). No tactics stored: "No journal entry for this boss yet." and the loot tab still works.
- **Abilities:** the ability tree from `BossTactics`, each ability with children as a `<details>` (open by default) whose summary is the ability's spell link; a leaf ability is a list item. Spell links and markup rendering are unchanged.
- **Loot, dungeon chosen:** every item in the dungeon, in boss order, as `ItemCard`s whose detail line adds the boss: "Leather wrist" becomes "Leather wrist, The Hoardmonger". **Loot, boss chosen:** only that boss's items, detail as today. Grid as today.

## Components

All inside `src/components/dungeon-page/`, since only the page renders them: `DungeonPage.tsx` (the spread and wiring), `BossIndex.tsx`, `GuideTabs.tsx`, `Breadcrumb.tsx`, `OverviewTab.tsx`, `LootTab.tsx`, and `BossTactics.tsx` split into the overview and abilities parts it already holds. `guide-state.ts` parses params and builds hrefs. `/dungeons` gets `src/components/dungeon-list/DungeonList.tsx` and a loader `getDungeonList(services)` in `src/server/views/dungeon-list.ts` reading the stored season (dungeons only).

## Testing

- `guide-state.test.ts`: missing, valid and unknown `boss` and `tab`; `abilities` without a boss falls back; hrefs keep the tab when moving between bosses and drop `abilities` when moving to the dungeon root.
- `DungeonPage.test.ts` (markup): breadcrumb items and `aria-current`; the chosen banner and ribbon carry `aria-current="page"`; "Abilities" hidden without a boss; dungeon loot shows the boss in the detail line; a boss without tactics shows the empty line.
- `DungeonList.test.ts` and `dungeon-list.test.ts`: cards in order with links; the no-season line.
- `MainNav.test.ts`: the Dungeons item, active on `/dungeons/585`.
- Gate: typecheck, lint, test, build.
- By hand: `/dungeons` and a dungeon at 1440 and 375 px, every tab for a boss and for the dungeon, back button walks choices, keyboard focus visible on banners and ribbons.
