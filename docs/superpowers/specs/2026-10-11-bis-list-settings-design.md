# BiS list settings: per-account overrides on Method's lists

Status: design approved in chat on 2026-10-11. Spec review on 2026-10-11 raised eight findings, resolved below. The owner moved the compared-list choice into settings and deferred #97 on 2026-10-11.
Date: 2026-10-11
Issues: #103 (BiS list settings, with #13 folded in), #14 (show the BiS source), #15 (settings view, page shell only)

## Goal

Today every character follows Method.gg's BiS list for its spec, and nothing about it can be changed except which list a character compares against. Players disagree with Method on single slots, and some don't care whether a catalyzed tier piece has Method's secondary stats as long as the set bonus is active.

This spec adds a Settings section where an account, per spec, chooses which list (Overall, Raid or Mythic+) its characters compare against, overrides single slots of Method's lists, and chooses whether stats matter on tier pieces. The character page shows which source drives its list and how many slots were edited.

Settings belong to an account. Login doesn't exist yet (#48 to #51), so the app seeds one local account and resolves every request to it. Login later replaces only that resolver.

This is the first of two specs split out of #103. The second adds other BiS sources (murlok.io, Wowhead, Icy Veins), a source picker and fully manual lists, after a spike on which sources have usable pages.

## What success looks like

- `/settings/bis` lists every class and spec from Blizzard's catalog. Specs with a tracked character carry a "Tracked" badge. Others show "Not fetched" with a Fetch button, or "Fetched <age>" with Refresh.
- `/settings/bis/<spec-slug>` shows Method's Overall, Raid and Mythic+ lists for the spec. Each slot row can be overridden with an item found by name, ID or Wowhead link, and reset to Method's pick.
- The same page sets which list the spec's characters compare against, Mythic+ by default. Raid is choosable for the first time. A chosen list Method doesn't have falls back to Overall, with the existing notice.
- The character page has no list tabs and no per-character list choice. It shows the spec's compared list.
- On a tier slot, an override can be the tier piece itself, or a regular item with "Catalyst into tier" switched on. The second reads like Method's own catalyst rows: any tier piece in the slot matches, and its stats are compared with the chosen item's.
- Item search only offers items the class can use in that slot: a mage never sees plate, and every class sees cloth cloaks. A pasted ID for an unusable item shows the item with the reason instead of hiding it.
- An override applies to every character of that spec on the account, on the character page, the group page and in dungeon priority. An overridden tier item gets its stat pair fetched like Method's own tier items.
- When Method changes its list, untouched slots follow Method and overrides stay. An override whose slot no longer exists in Method's list is listed for removal and is not applied.
- A per-spec checkbox, "Tier pieces must have the list's stats", is checked by default. Unchecked: no "Wrong stats" state, and dungeon priority stops preferring matching stats.
- The character page's BiS header shows "Method" or "Method · 2 edited", linking to that spec's settings page.
- A second account in the database never sees the first account's overrides or settings.

## Scope

In scope: the account foundation, the spec catalog, the settings pages, the compared-list choice, slot overrides, item search and lookup, tier stats for overridden items, the stats checkbox and the source badge.

Out of scope, each a follow-up issue:

- Other BiS sources, the source picker and fully manual lists (the second spec, after a spike).
- Manual stat marks (#97). Deferred: a mark has to be scoped to the target it confirms and lapse on equipment changes across Blizzard and SimC snapshots, which is its own design. #97 goes back to Needs spec.
- Raid loot in item search. Search covers season dungeon loot and looked-up items only.
- Weapon proficiency filtering. A mage may see an axe in search; armor type and slot are filtered.
- Per-character overrides or list choices on top of per-spec ones.
- Login and real accounts (#48 to #51).
- The credentials part of #15. The settings shell only reserves a "General" section.
- Running without Blizzard credentials. The app needs them for every page today, and this spec doesn't change that.
- An "Edit" shortcut that opens the editor from the character page.
- Stat weights (#95), borrowed stats for SimC items (#96), tertiary stats and sockets (#98).

## Design

### Data

New tables in `src/core/db/schema.ts`:

- `accounts`: `id` (primary key), `name`. The migration inserts `{ id: 1, name: 'Local' }`.
- `specs`: `method_slug` (primary key), `class_id`, `class_name`, `spec_name`, `icon_url` (nullable), `fetched_at`. `method_slug` comes from `methodSpecSlug(specName, className)`, so the catalog and the views agree on slugs.
- `spec_settings`: `account_id` (references `accounts`, cascade), `spec_slug`, `list_type` (`ListType`, default `'mythicPlus'`), `stats_matter` (boolean, default true). Primary key `(account_id, spec_slug)`. A missing row means the defaults. The second spec adds the source choice here.
- `bis_overrides`: `account_id` (references `accounts`, cascade), `spec_slug`, `list_type`, `slot_key`, `item_id`, `catalyst` (boolean, default false). Primary key `(account_id, spec_slug, list_type, slot_key)`.
- `item_catalog`: `item_id` (primary key), `name`, `inventory_type`, `armor_type`, `quality` (nullable), `is_tier`, `fetched_at`. Every item an override names is in here. It is separate from `item_details`, which belongs to the tier-stat lookup and has its own freshness rules, and from `dungeon_loot`, which means "drops in this dungeon" and drives dungeon credit.

Changed tables:

- `dungeon_loot` gains `quality` (nullable) and `is_tier`, filled by the season sync from the item details it already fetches. Bump `SEASON_META_KEY` in `src/core/sync/season-sync.ts` from `season.v3` to `season.v4`, so installs refetch.
- `characters` drops `priority_list`. Its job moves to `spec_settings.list_type`. Existing per-character choices are not carried over: every spec starts on Mythic+, and the owner re-picks Overall where wanted. Specs are slugged in TypeScript, not SQL, so a carry-over would need a one-off script for a handful of rows.

`bis_lists` and `bis_items` stay the global cache of Method's public data. Overrides sit on top of them and never change them.

### Accounts

`Services` gains `currentAccountId(): number`, returning `1`. Every loader and route handler that reads or writes account data takes the account from it. No core function reads it: core functions take `accountId` as a parameter.

### Spec catalog

The existing `getClasses` client call already returns every class with its spec names. A sync step stores one row per spec in `specs`, using the region of the first tracked character, and does nothing when no character is tracked. It runs with the reference sync, at most once a day, through `fetchJson` and `createLimiter`. The same sync fetches each spec's icon from `/data/wow/media/playable-specialization/{id}` (asset key `icon`) and stores the URL in `specs.icon_url`; the image is hotlinked from `render.worldofwarcraft.com`, as class icons are. A spec whose icon request fails or is missing stores null, and the views then fall back to the class icon. A failed catalog sync keeps the old rows. Until the first sync succeeds, the picker shows only tracked specs, built from `characters` as today.

### Compared list

`choosePriorityList(lists, chosen)` in `src/core/priority/list.ts` takes any `ListType`. When the chosen list is not Overall, has no rows, and Overall has rows, it returns Overall with `fellBack: true`. Mythic+ behaves as today.

Every loader that used `characters.priority_list` reads `spec_settings.list_type` for the character's spec slug and the current account instead: the character cards, the character page, the group page and dungeon priority. The group page's "Overall" notice in `MemberHeader` names the list actually shown, so a Raid choice reads correctly.

The character page loses its `?list=` search parameter, `ListTabs`, `ListSwitchProvider` and `WhileListSettled`, and `CharacterSettings` loses its list radio. Components that nothing imports afterwards are deleted, with their tests. `PATCH /api/characters/<id>` stops accepting `priorityList`.

### Slot keys and the overlay

Logic modules in `src/core/bis/`, pure functions:

- `slotKeys(rows: BisRow[]): string[]` names each row `<slotLabel>#<n>`, where `n` counts rows with the same `slotLabel` in list order, from 1. Two "Ring" rows become `Ring#1` and `Ring#2`. Method's slot labels are stable across updates, so keys survive a refetch that only changes items.
- `applyOverrides(rows, overrides, catalog)` returns `{ rows, editedCount, orphans }`.
  - A row whose key has an override becomes `kind: 'item'` with the override's `itemId` and `name` from `catalog`, empty `bonusIds`, and `isTier` and `isCatalyst` as follows: a catalyst override gives `isTier: true, isCatalyst: true`, the same shape the Method parser gives a base marked for the catalyst; otherwise `isTier` is the catalog's and `isCatalyst` is false. It keeps the original row's `slotLabel`, `slots` and `source`. It gains `edited: { methodPick: BisRow }`.
  - An override whose key matches no row goes into `orphans` and is not applied.
  - An override whose item is missing from `catalog` is treated as an orphan, so a broken row never reaches the gear logic.
- `classCanUse(item, className, slots)` returns `{ ok: true }` or `{ ok: false, reason }`. The item's `slotsForInventoryType(inventoryType)` must overlap the row's `slots`. When any of those slots is in `ARMOR_SLOTS` from `src/core/priority/slots.ts`, the item's armor type must match `armorTypeForClass(className)`. Cloaks are BACK, outside `ARMOR_SLOTS`, so a cloth cloak passes for every class, the same rule the ranker's `fitsSlot` uses.
- `canCatalyst(item, slots)` is true when any of the row's `slots` is in `TIER_SLOTS` and the item is not itself a tier piece. `TIER_SLOTS` (HEAD, SHOULDER, CHEST, HANDS, LEGS) is added to `src/core/priority/slots.ts`.
- `parseItemInput(input)` returns an item ID from a bare number or a Wowhead URL (`/item=(\d+)/`), or `null`.

`BisRow` gains an optional `edited` field in `src/core/types.ts`.

### Tier stats for overridden items

Tier target stats are fetched per spec and region for the tier item IDs in that spec's lists. Overrides can add tier IDs Method's lists don't have, so both paths take the effective tier IDs:

- `TierScope` in `src/core/sync/reference-sync.ts` gains `extraItemIds?: number[]`. The IDs it covers are `tierItemIds(lists)` plus those.
- Read path: `createBisLookup` builds the scope from the account's effective lists, after the overlay, passing the overlaid lists as `lists`, so `readTierTargets` reports `due` when an override names a tier item with no stored stats. Reads stay database-only.
- Write path: `runPass` in `src/core/sync/reference-run.ts` passes each tracked spec's Method lists, and as `extraItemIds` every tier item named by any account's overrides for that spec, read with one query on `bis_overrides` joined to `item_catalog`, keeping overrides that are `catalyst` or whose item `is_tier`. A catalyst override's base item is a target like Method's catalyst bases, so its stat pair is fetched the same way. The union across accounts keeps the sync free of a current account: it serves whoever is looking.
- Refresh after an override changes: saving a tier override makes the next page read report due work, the page's existing background sync key fires `runPass`, and the stats arrive on the following render. No route fetches stats directly.

### Stats checkbox

- `evaluateGear` gains `statsMatter: boolean`. With it false, the `wrongStats` branch is skipped and the row falls through to its track state, so an upgradable tier piece stays upgradable. The "stats unverified" label is not shown.
- Dungeon ranking in `src/core/priority/rank.ts` gains `statsMatter`. With it false, a catalyst alternative is not ranked below a drop with the list's stats: every drop that fits the slot credits at full weight, with a new fit `any` that reads "catalyst into tier" and names no stats.
- The control is a checkbox labelled "Tier pieces must have the list's stats", checked when `stats_matter` is true, checked by default. A line beneath it reads "Uncheck if the set bonus is all that matters for this spec."

### Data flow

`bisFor(specSlug, region)` in `src/server/views/bis-lookup.ts` gains `accountId`. It reads the cached lists, then the account's `spec_settings`, overrides and the catalog rows they name, one after another, applies the overlay to each list type, reads tier targets for the effective lists, and returns `SpecBis` with the overlaid lists, `listType`, `statsMatter`, `editedCount` (summed across list types) and `orphans`. The character page, the group page and dungeon priority already go through `bisFor`, so they all use edited lists. Their loaders pass `statsMatter` on to `evaluateGear` and the ranking, and take the compared list from `listType` through `choosePriorityList`.

### Item metadata

Every catalog row is complete and factual: name, inventory type, armor type, quality and tier identity come from Blizzard, never from defaults.

- `parseItemInfo` in `src/core/blizzard/parse.ts` keeps the raw item's `name`, and `ItemInfo` gains `name: string | null`. `RawItem` gains `name?: string`.
- The season sync already fetches item details for each loot item. It now also stores their `quality` and `isTier` in `dungeon_loot`. The name stays the journal's.
- Saving an override fills `item_catalog` for the item when it isn't there yet:
  1. From `dungeon_loot`, when that row has a non-null `inventory_type` (a season sync under `season.v4` wrote it).
  2. Otherwise from one Blizzard item request through the existing client. A result with no name, or no inventory type, is a `UserError`: "Couldn't read that item from Blizzard."
- A Blizzard failure while saving leaves no override and no catalog row, and shows "Couldn't reach Blizzard. Try again." A null quality is stored as null and renders without a rarity color; the Wowhead tooltip still shows it.

### Item search and lookup

- Search is local only: `dungeon_loot` and `item_catalog`, matched by case-folded name substring or exact ID, then filtered with `classCanUse`. At most 20 usable results, by name. An exact ID match that fails `classCanUse` is returned separately with its reason. Results carry quality for rarity colors.
- Lookup takes the raw input, parses it with `parseItemInput`, and when the ID is not local makes one Blizzard item request through the existing client, storing the result in `item_catalog`. The client calls lookup only when the input parses as an ID or link and search found nothing.
- Saving an override re-checks `classCanUse` on the server.

### Routes

All writes go through `withWriteLock`. Nothing writes on `GET`.

| Route | Body or query | Does |
|---|---|---|
| `GET /api/items/search` | `q`, `specSlug`, `listType`, `slotKey` | Local search, filtered for the spec's class and the row's slots |
| `POST /api/items/lookup` | `{ input, specSlug, listType, slotKey }` | Parses the input, fetches and caches an unknown item, returns it with its `classCanUse` result |
| `PUT /api/bis/overrides` | `{ specSlug, listType, slotKey, itemId, catalyst }` | Fills the catalog if needed, validates and upserts one override |
| `DELETE /api/bis/overrides` | `{ specSlug, listType, slotKey }` | Removes one override, including an orphan |
| `PATCH /api/bis/settings` | `{ specSlug, listType?, statsMatter? }` | Upserts `spec_settings` |
| `POST /api/bis/fetch` | `{ specSlug }` | Runs `syncBisLists` for one spec. The slug must be in `specs` or belong to a tracked character, so a client can't aim the fetch at an arbitrary Method page |

Fetching a Method list needs no Blizzard call. It still goes through `getServices()`, which needs credentials like every other route today.

### Pages

Loaders in `src/server/views/`: `settings-bis.ts` for the picker, `settings-spec.ts` for one spec's editor. Their view types go in `views/types.ts`.

- **Top menu.** Settings leaves the page tabs. On desktop it sits at the far right of the header in its own `nav aria-label="Account"`, after a 1 px by 28 px divider, with the tab look (gold underline and diamond when active). On a phone, Characters and Group stay as tabs and Settings is a 44 px icon-only gear link in the brand row, `aria-label="Settings"`; when active it is gold on a gold-tinted background.
- **Settings layout.** `/settings` redirects to `/settings/bis`. On desktop a 220 px left rail holds the "Settings" heading and a vertical section nav: "BiS lists" (active: raised background, small gold diamond) and a disabled "General" with a "Coming soon" pill. On a phone the rail becomes a row of pills: "BiS lists" and "General soon".
- **`/settings/bis`: the spec picker.** A "BiS lists" heading with an intro line.
  - "Your specs": one card per tracked spec, two columns on desktop and stacked on a phone. A card shows the spec icon, the spec name in class color, "Compares <list> · <n> edited" or "no edits", the tracked character's portrait (24 px round, class-color ring) and name, and a chevron, and links to the editor. On a phone the portrait leads and the spec icon is a corner badge.
  - "All classes": on desktop a three-column grid of class cards, each with the class icon from `class_media` and the class name in class color. On a phone, a native `<details>` per class whose summary reads "<n> tracked" or "<n> specs".
  - Each spec row shows its spec icon (32 px), its name and one state: "Tracked" (a gold pill; on a phone "Tracked: <character> · compares <list>"), "Not fetched" with Fetch, "Fetched <age>" with Refresh, or "Fetch failed" with Try again, the failure text in the missing color. Fetch, Refresh and Try again call `POST /api/bis/fetch`, then `router.refresh()`. The reference sync keeps refreshing tracked specs only.
- **`/settings/bis/<spec-slug>`: the editor.**
  - A "← All specs" link.
  - Header: the spec icon (60 px, class-color border) with the class icon as a corner badge; the spec name in class color; a "Used by" row of character chips (portrait and name, each linking to the character page); on the right "Method list fetched <age>" with Refresh.
  - Comparison card, two columns. "Compare against" is a segmented control of real radio inputs for Overall, Raid and Mythic+, the checked one gold-tinted, with a helper line beneath, saved on change. "Tier pieces" holds the stats checkbox with its helper line.
  - Tabs for Overall, Raid and Mythic+, choosing which list to edit. The compared tab shows a gold "Compared" pill with a diamond. Every tab shows its edit count, "no edits" or "<n> edited". A list Method doesn't have shows "Method has no <type> list for this spec."
  - Slot table columns: Slot, Method's pick, Your pick, action. An unedited row reads "Follows Method" with an Override button. An edited row is tinted, with Method's pick dimmed and struck through, the chosen item with an "Edited" pill, and Reset. While its search is open the Override button reads Cancel with a gold border.
  - The search panel sits under the row, indented to the item columns, labelled "Replace Method's <slot> pick", with the placeholder "Search by name, ID or Wowhead link". Input is debounced. Each result shows rarity color, armor type, slot and source, and a Choose button. The footer hint reads "Searches this season's dungeon loot. Paste an item ID or Wowhead link for anything else."
  - Search states: the catalyst step shows "Catalyst into tier" as a switch (off by default) with a helper line, Save and Cancel, and an overridden catalyst row reads "<item> → catalyst into tier". An exact ID the class can't use shows greyed with its reason and "Can't choose". A lookup in progress reads "Looking up item <id> on Blizzard…" with `role="status"`. An error shows with `role="alert"`.
  - Orphans sit in a card titled "No longer in Method's list", with "Method dropped these slots. Your picks for them aren't applied." Each row says "Was your pick for <slot>" and has Remove.
  - A spec with no cached list shows the Fetch button instead of the editor.
  - On a phone each slot is a card: the slot label, an Edited pill and the action button in the top row, then the items. The tabs are three equal columns.
- **Character page.** No list tabs.
  - The BiS section header reads "<List> BiS" with "<n>/<total> done", and the source badge at its right.
  - The badge is a 36 px pill linking to `/settings/bis/<spec-slug>` (#14): "From Method" in neutral colors, or "From Method · <n> edited" with a gold edge and a gold count. Both end in a chevron.
  - The spec line under the character name gets its spec icon (the class icon when the spec has none).
  - When the chosen list is missing and Overall is shown, the header says "Overall BiS" and a notice reads "Method has no <list> list for this spec. Showing Overall."

### Components

Each in its own kebab-case directory under `src/components/`, with branching logic in a `.ts` beside it:

- `main-nav/`: the Characters and Group tabs, the Account nav with Settings, and the phone gear.
- `settings-nav/`: the rail and the phone pills.
- `spec-picker/`: tracked-spec cards, class cards and spec rows, and the Fetch button.
- `bis-editor/`: the header, the comparison card, the tabs and slot rows. The slot row and orphan list are files inside it.
- `item-search/`: the input, results and the search-then-lookup flow. Debouncing uses a shared hook if one exists in `src/components/hooks/`, else its own.
- `bis-source-badge/`: the character page badge.
- `spec-icon/`: a spec's icon, falling back to the class icon.

New semantic tokens in `globals.css` where none fits: a gold tint and gold edge for the active and edited states, a warmer tint for edited rows, a dim text color for disabled items, and a muted red edge for the orphan card.

### Errors

These are `UserError`s, so they show as 400s:

- "No item with ID <id>." when Blizzard returns 404 on lookup or save.
- "Not a Wowhead item link or ID." when lookup input doesn't parse.
- "Couldn't read that item from Blizzard." when an item comes back with no name or slot.
- "<Class> can't wear <armor type>." or "That item doesn't fit the <slot label> slot." when an override fails `classCanUse`.
- "Method has no list for this spec yet. Fetch it first." when overriding a spec with no cached list.
- "Only regular items in tier slots can be catalyzed." when `catalyst` is true and `canCatalyst` is false.
- "That slot isn't in Method's list." when an override names an unknown slot key.

A Blizzard request that fails for any other reason during lookup or save shows "Couldn't reach Blizzard. Try again." as a `UserError` and writes nothing. A failed Method fetch reuses `syncBisLists`'s failure meta and never clears a cached list.

## Testing

Failing tests first. Real in-memory SQLite through `openTestDb()`, fake `fetch` through `src/test/fake-fetch.ts`. Fixture names are made up, such as Birkibjörn, a Frost Mage.

- Core:
  - `slotKeys` with repeated labels.
  - `applyOverrides` for replace, tier override, catalyst override, orphan and missing catalog item.
  - `classCanUse`: cloth chest rejected and cloth cloak accepted for a Warrior, slot mismatch, non-armor items.
  - `canCatalyst` for a regular chest, a tier chest and a ring.
  - `parseItemInput` for numbers, Wowhead URLs with and without locale paths, and junk.
  - `choosePriorityList` for Raid and Mythic+ falling back to Overall, and Overall never falling back.
  - `evaluateGear` with `statsMatter` false: a wrong-stat Myth 3/6 tier piece reads `mythUpgradable`, a wrong-stat 6/6 reads `done`, and true keeps `wrongStats`.
  - The ranking with `statsMatter` false.
  - `parseItemInfo` keeps the name.
- Sync:
  - The season sync stores quality and tier identity.
  - `runPass` requests stats for a tier item that only an override names, and for a catalyst override's base item. After the sync, `bisFor` returns its target, `evaluateGear` shows `wrongStats` for a mismatched equipped piece, and the ranking prefers a matching drop.
  - Catalog sync keeps old rows on failure.
- Queries: override upsert and delete; settings defaults (Mythic+, stats matter); a second account sees none of the first account's rows; `item_catalog` filled from a `dungeon_loot` row, from a Blizzard item when the item isn't local, and nothing written when that request fails.
- Views: `bisFor` returns overlaid lists, `listType`, `editedCount`, `orphans` and `statsMatter`, and reports targets due for an overridden tier item with no stats; the character page and group page use the spec's compared list; the picker loader marks tracked, untracked, fetched and failed specs; the editor loader pairs each row with its override.
- Routes: input validation, each `UserError` above, and `PATCH /api/characters/<id>` ignoring `priorityList`.
- Not covered: there are no browser-level tests yet (#35). Debounce, keyboard use of search results, the tabs and the radio group are checked by hand, at phone width too.
