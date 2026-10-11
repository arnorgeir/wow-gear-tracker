# BiS list settings: per-account overrides on Method's lists

Status: design approved in chat on 2026-10-11.
Date: 2026-10-11
Issues: #103 (BiS list settings, with #13 folded in), #14 (show the BiS source), #15 (settings view, page shell only), #97 (confirm a tier piece's stats by hand)

## Goal

Today every character follows Method.gg's BiS list for its spec, and nothing about it can be changed. Players disagree with Method on single slots, and some don't care whether a catalyzed tier piece has Method's secondary stats as long as the set bonus is active.

This spec adds a Settings section where an account overrides single slots of Method's lists per spec, and chooses per spec whether stats matter on tier pieces. The character page shows which source drives its list and how many slots were edited. An owner can also mark an equipped tier piece's stats as right or wrong by hand when the app can't read them.

Settings belong to an account. Login doesn't exist yet (#48 to #51), so the app seeds one local account and resolves every request to it. Login later replaces only that resolver.

This is the first of two specs split out of #103. The second adds other BiS sources (murlok.io, Wowhead, Icy Veins), a source picker and fully manual lists, after a spike on which sources have usable pages.

## What success looks like

- `/settings/bis` lists every class and spec from Blizzard's catalog. Specs with a tracked character carry a "Tracked" badge. Others show "Not fetched" with a Fetch button, or "Fetched <age>" with Refresh.
- `/settings/bis/<spec-slug>` shows Method's Overall, Raid and Mythic+ lists for the spec. Each slot row can be overridden with an item found by name, ID or Wowhead link, and reset to Method's pick.
- Item search only offers items the class can use in that slot: a mage never sees plate. A pasted ID for an unusable item shows the item with the reason instead of hiding it.
- An override applies to every character of that spec on the account, on the character page, the group page and in dungeon priority.
- When Method changes its list, untouched slots follow Method and overrides stay. An override whose slot no longer exists in Method's list is listed for removal and is not applied.
- A per-spec toggle, on by default, says whether a tier piece with stats other than the list's counts as done. Off: no "Wrong stats" state, and dungeon priority stops preferring matching stats.
- The character page's BiS header shows "Method" or "Method · 2 edited", linking to that spec's settings page.
- A tier row whose stats are unverified or wrong can be marked "Right stats" or "Wrong stats" by hand. The mark lapses when the item in that slot changes.
- A second account in the database never sees the first account's overrides or settings.

## Scope

In scope: the account foundation, the spec catalog, the settings pages, slot overrides, item search and lookup, the stats toggle, the source badge and manual stat marks.

Out of scope, each a follow-up issue:

- Other BiS sources, the source picker and fully manual lists (the second spec, after a spike).
- Raid loot in item search. Search covers season dungeon loot and looked-up items only.
- Weapon proficiency filtering. A mage may see an axe in search; armor type and slot are filtered.
- Per-character overrides on top of per-spec ones.
- Login and real accounts (#48 to #51).
- The credentials part of #15. The settings shell only reserves a "General" section.
- An "Edit" shortcut that opens the editor from the character page.
- Stat weights (#95), borrowed stats for SimC items (#96), tertiary stats and sockets (#98).

## Design

### Data

New tables in `src/core/db/schema.ts`, one migration:

- `accounts`: `id` (primary key), `name`. The migration inserts `{ id: 1, name: 'Local' }`.
- `specs`: `spec_id` (primary key, Blizzard's playable specialization ID), `class_id`, `class_name`, `spec_name`, `method_slug`, `fetched_at`. `method_slug` comes from `methodSpecSlug(specName, className)`, so the catalog and the views agree on slugs.
- `spec_settings`: `account_id` (references `accounts`, cascade), `spec_slug`, `stats_matter` (boolean, default true). Primary key `(account_id, spec_slug)`. A missing row means the defaults. The second spec adds the source choice here.
- `bis_overrides`: `account_id` (references `accounts`, cascade), `spec_slug`, `list_type`, `slot_key`, `item_id`. Primary key `(account_id, spec_slug, list_type, slot_key)`.
- `item_catalog`: `item_id` (primary key), `name`, `inventory_type`, `armor_type`, `quality`, `is_tier`, `fetched_at`. Every item an override names is in here. It is separate from `item_details`, which belongs to the tier-stat lookup and has its own freshness rules, and from `dungeon_loot`, which means "drops in this dungeon" and drives dungeon credit.
- `stat_marks`: `character_id` (references `characters`, cascade), `slot`, `item_id`, `mark` (`'right' | 'wrong'`). Primary key `(character_id, slot)`.

`bis_lists` and `bis_items` stay the global cache of Method's public data. Overrides sit on top of them and never change them.

No cached Raidbots or season data gains columns, so `TRACKS_META_KEY` and `SEASON_META_KEY` stay.

### Accounts

`Services` gains `currentAccountId(): number`, returning `1`. Every loader and route handler that reads or writes account data takes the account from it. No core function reads it: core functions take `accountId` as a parameter.

### Spec catalog

A new Blizzard client call reads the playable specialization index and each class's name, and a sync step stores them in `specs`. It runs with the reference sync, at most once a day, through `fetchJson` and `createLimiter`. A failed catalog sync keeps the old rows. Until the first sync succeeds, the picker shows only tracked specs, built from `characters` as today.

### Slot keys and the overlay

Logic modules in `src/core/bis/`, pure functions:

- `slotKeys(rows: BisRow[]): string[]` names each row `<slotLabel>#<n>`, where `n` counts rows with the same `slotLabel` in list order, from 1. Two "Ring" rows become `Ring#1` and `Ring#2`. Method's slot labels are stable across updates, so keys survive a refetch that only changes items.
- `applyOverrides(rows, overrides, catalog)` returns `{ rows, editedCount, orphans }`.
  - A row whose key has an override becomes `kind: 'item'` with the override's `itemId`, and with `name` and `isTier` from `catalog`, empty `bonusIds`, `isCatalyst: false`, and the original row's `slotLabel`, `slots` and `source`. It gains `edited: { methodPick: BisRow }`.
  - An override whose key matches no row goes into `orphans` and is not applied.
  - An override whose item is missing from `catalog` is treated as an orphan, so a broken row never reaches the gear logic.
- `classCanUse(item, className, slots)` returns `{ ok: true }` or `{ ok: false, reason }`. Armor items must match `armorTypeForClass(className)`. The item's `slotsForInventoryType(inventoryType)` must overlap the row's `slots`. Non-armor items pass the armor check.
- `parseItemInput(input)` returns an item ID from a bare number or a Wowhead URL (`/item=(\d+)/`), or `null`.

`BisRow` gains an optional `edited` field in `src/core/types.ts`.

### Stats

- `evaluateGear` gains `statsMatter: boolean` and `marks: ReadonlyMap<SlotType, { itemId: number; mark: 'right' | 'wrong' }>`.
  - A mark whose `itemId` equals the equipped item's turns the slot's `StatMatch` into `'same'` (right) or `'different'` (wrong). It wins over detected and unknown stats. A mark for another item ID is ignored.
  - With `statsMatter` false, the `wrongStats` branch is skipped and the row falls through to its track state, and the "stats unverified" label is not shown.
- Dungeon ranking in `src/core/priority/rank.ts` gains `statsMatter`. With it false, a catalyst alternative is not ranked below a drop with the list's stats.

### Data flow

`bisFor(specSlug, region)` in `src/server/views/bis-lookup.ts` gains `accountId`. It reads the cached lists, then the account's overrides, the catalog rows they name and `spec_settings`, one after another, applies the overlay to each list type, and returns `SpecBis` with the overlaid lists, `statsMatter`, `editedCount` (summed across list types) and `orphans`. The character page, the group page and dungeon priority already go through `bisFor`, so they all use edited lists without further changes. Their loaders pass `statsMatter` and the character's marks on to `evaluateGear` and the ranking.

### Item search and lookup

- Search is local only: `dungeon_loot` and `item_catalog`, matched by case-folded name substring or exact ID, then filtered with `classCanUse`. At most 20 usable results, by name. An exact ID match that fails `classCanUse` is returned separately with its reason.
- Lookup takes the raw input, parses it with `parseItemInput`, and when the ID is not local makes one Blizzard item request through the existing client, storing the result in `item_catalog`. The client calls lookup only when the input parses as an ID or link and search found nothing.
- Saving an override makes sure the item is in `item_catalog`, copying it from `dungeon_loot` when it is there, and re-checks `classCanUse` on the server.

### Routes

All writes go through `withWriteLock`. Nothing writes on `GET`.

| Route | Body or query | Does |
|---|---|---|
| `GET /api/items/search` | `q`, `specSlug`, `listType`, `slotKey` | Local search, filtered for the spec's class and the row's slots |
| `POST /api/items/lookup` | `{ input, specSlug, listType, slotKey }` | Parses the input, fetches and caches an unknown item, returns it with its `classCanUse` result |
| `PUT /api/bis/overrides` | `{ specSlug, listType, slotKey, itemId }` | Validates and upserts one override |
| `DELETE /api/bis/overrides` | `{ specSlug, listType, slotKey }` | Removes one override, including an orphan |
| `PATCH /api/bis/settings` | `{ specSlug, statsMatter }` | Upserts `spec_settings` |
| `POST /api/bis/fetch` | `{ specSlug }` | Runs `syncBisLists` for one spec |
| `PUT /api/characters/<id>/stat-marks` | `{ slot, itemId, mark }` | Upserts a mark. Rejects one whose `itemId` is not the item equipped in that slot |
| `DELETE /api/characters/<id>/stat-marks` | `{ slot }` | Removes a mark |

When a stat mark is written for a slot, any older mark for that slot is replaced, so lapsed marks don't pile up.

### Pages

Loaders in `src/server/views/`: `settings-bis.ts` for the picker, `settings-spec.ts` for one spec's editor. Their view types go in `views/types.ts`.

- `/settings` redirects to `/settings/bis`. The settings layout has section navigation: "BiS lists" and a disabled "General", marked "coming soon".
- `/settings/bis`: the spec picker. Classes in groups with their icon from `class_media`, specs as rows. A tracked spec shows "Tracked". An untracked spec shows "Not fetched" and a Fetch button, or "Fetched <age>" and Refresh, or "Fetch failed, try again". Fetch and Refresh call `POST /api/bis/fetch`, then `router.refresh()`. The reference sync keeps refreshing tracked specs only.
- `/settings/bis/<spec-slug>`: the editor.
  - Tabs for Overall, Raid and Mythic+, using the existing list tab pattern. A list Method doesn't have shows "Method has no <type> list for this spec."
  - The stats toggle: "Tier pieces with other stats count as done", with one line explaining the set bonus case.
  - One row per Method slot: the slot label, Method's pick as a rarity-colored Wowhead link (or "Any <item level>"), and an "Override" button.
  - An overridden row shows the chosen item, an "Edited" tag in words, Method's pick struck through beside it, and Reset.
  - Override opens an item search input with the placeholder "Search by name, ID or Wowhead link". Input is debounced. Results are rarity-colored Wowhead links. Unusable exact matches show greyed with their reason and can't be picked.
  - Orphans sit below the list, under "No longer in Method's list", each with its item and Remove.
  - A spec with no cached list shows the Fetch button instead of the editor.
- Character page: the BiS header gains a badge, "Method" or "Method · <n> edited", linking to `/settings/bis/<spec-slug>` (#14). A tier row showing "stats unverified" or "Wrong stats" gains a "Mark stats" control with Right, Wrong and Clear (#97). The control is hidden when `statsMatter` is off.

### Components

Each in its own kebab-case directory under `src/components/`, with branching logic in a `.ts` beside it:

- `settings-nav/`: the section navigation.
- `spec-picker/`: classes and spec rows, and the Fetch button.
- `bis-editor/`: tabs, the stats toggle and slot rows. The slot row and orphan list are files inside it.
- `item-search/`: the input, results and the search-then-lookup flow. Debouncing uses a shared hook if one exists in `src/components/hooks/`, else its own.
- `bis-source-badge/`: the character page badge.
- `stat-mark/`: the Right, Wrong and Clear control.

### Errors

These are `UserError`s, so they show as 400s:

- "No item with ID <id>." when Blizzard returns 404 on lookup.
- "Not a Wowhead item link or ID." when lookup input doesn't parse.
- "<Class> can't wear <armor type>." or "That item doesn't fit the <slot label> slot." when an override fails `classCanUse`.
- "Method has no list for this spec yet. Fetch it first." when overriding a spec with no cached list.
- "That slot isn't in Method's list." when an override names an unknown slot key.
- "That item isn't equipped in this slot." when a stat mark names another item.

A failed fetch reuses `syncBisLists`'s failure meta and never clears a cached list. Missing Blizzard credentials make lookup and fetch return 503 through `MissingConfigError`. Local search and the editor keep working.

## Testing

Failing tests first. Real in-memory SQLite through `openTestDb()`, fake `fetch` through `src/test/fake-fetch.ts`. Fixture names are made up, such as Birkibjörn, a Frost Mage.

- Core: `slotKeys` with repeated labels; `applyOverrides` for replace, tier override, orphan and missing catalog item; `classCanUse` for armor mismatch, slot mismatch and non-armor items; `parseItemInput` for numbers, Wowhead URLs with and without locale paths, and junk; `evaluateGear` with `statsMatter` off and with marks for the equipped and another item; the ranking with `statsMatter` off.
- Queries: override upsert and delete; settings defaults; a second account sees none of the first account's rows; catalog sync keeps old rows on failure; `item_catalog` filled from `dungeon_loot` and from a lookup.
- Views: `bisFor` returns overlaid lists, `editedCount`, `orphans` and `statsMatter`; the picker loader marks tracked, untracked, fetched and failed specs; the editor loader pairs each row with its override.
- Routes: input validation, each `UserError` above, 503 without credentials, and the stat mark item check.
- Not covered: there are no browser-level tests yet (#35). Debounce, keyboard use of search results and the tabs are checked by hand.
