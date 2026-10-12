# BiS sources per spec: Method, Icy Veins and Manual

Issue: #125. Spike: `docs/superpowers/specs/2026-10-11-bis-sources-spike.md` (#124).
Builds on `docs/superpowers/specs/2026-10-11-bis-list-settings-design.md`, the first of the two specs split out of #103. This is the second.

## Problem

Method.gg is the only BiS source. Players who follow another guide can only override slot by slot, and a player who disagrees with every guide has no list of their own. The first spec deferred the source picker, because a picker with one option is noise. The spike found one more usable source, Icy Veins. Together with a manual list, that makes three real options.

## What success looks like

- The spec editor at `/settings/bis/<spec-slug>` has a "BiS source" choice: Method, Icy Veins or Manual. It saves as you choose. Method is the default.
- The chosen source's list is compared everywhere the spec's characters appear: the character page, the group page, dungeon priority, the character card and the spec picker card.
- Icy Veins gives Overall, Raid and Mythic+ lists for every spec, fetched and refreshed like Method's.
- Choosing Manual copies the spec's current lists, with the account's edits applied, into a list the account owns. That list never updates from a website. "Copy again from Method" or "Copy again from Icy Veins" replaces it after a confirm.
- Slot overrides belong to the source they were made on. Switching from Method to Icy Veins shows Icy Veins' picks with no edits. Switching back brings the Method edits back.
- Every place that says "Method" today names the chosen source instead: the badge ("From Icy Veins · 2 edited", "Manual"), the editor's pick column, the fallback notices and the Fetch and Refresh buttons.
- An Icy Veins fetch failure shows the same error and empty states Method's does, naming Icy Veins. It never falls back to Method silently.
- A second account never sees the first account's source choice, overrides or manual lists.

## Scope

In scope: the source choice, the Icy Veins `BisSource`, Icy Veins URLs from spec roles, the per-source list cache, per-source overrides, manual lists and copying, sync of only the sources in use, and source names in views and components.

Out of scope:

- murlok.io and Wowhead (see the spike: Mythic+ popularity only, and a blocked fetch).
- Different sources per list, such as Raid from Icy Veins and Mythic+ from Method.
- Per-character sources.
- Comparing two sources side by side.
- Gems, enchants and the trinket tier table from Icy Veins.
- A manual list that starts blank.
- Login and real accounts (#48 to #51).

## Design

### Data

Changed tables in `src/core/db/schema.ts`:

- `spec_settings` gains `source` (`BisSourceId`: `'method' | 'icyVeins' | 'manual'`), not null, default `'method'`.
- `bis_lists` gains `source` (`'method' | 'icyVeins'`), not null. The migration sets existing rows to `'method'`. The unique index becomes `(source, spec_slug, list_type)`. The cache stays shared across accounts, as today.
- `bis_overrides` gains `source` (`BisSourceId`), not null, and it joins the primary key: `(account_id, spec_slug, source, list_type, slot_key)`. The migration sets existing rows to `'method'`.
- `specs` gains `role` (`'tank' | 'healing' | 'dps'`), nullable until the catalog refetches. `SPECS_META_KEY` goes to `specs.v3.fetchedAt`, so installs refetch.

New tables:

- `manual_bis_items`: an account's manual lists.
  - Columns: `account_id` (references `accounts`, cascade), `spec_slug`, `list_type`, `position`, and the row fields of `bis_items`: `slot_label`, `slots`, `item_id` (null for an "Any" row), `min_item_level`, `name`, `bonus_ids`, `is_tier`, `is_catalyst`, `source`.
  - `source` keeps the text of the row it was copied from, such as "Method" or "Icy Veins", so the row keeps its origin.
  - Primary key `(account_id, spec_slug, list_type, position)`.
- `manual_bis_lists`: one row per `(account_id, spec_slug)`, with `copied_from` (`'method' | 'icyVeins'`) and `copied_at`. A row exists exactly when the manual lists exist.

`BisSourceId` and `FETCHED_SOURCES = ['method', 'icyVeins']` live in `src/core/types.ts`. A source's display name ("Method", "Icy Veins", "Manual") lives in one map in `src/components/shared/`.

### Icy Veins source

`src/core/icy-veins/icy-veins.ts` exports `createIcyVeinsSource(fetchFn, roleOf)`, which implements `BisSource`.

- **URL:** `https://www.icy-veins.com/wow/<spec-slug>-pve-<role>-gear-best-in-slot`. Our spec slug already matches Icy Veins' spec and class order (`frost-mage`, `beast-mastery-hunter`, `frost-death-knight`). `roleOf(specSlug)` reads `specs.role`. A spec with no role yet throws a `UserError` naming the reason ("Spec catalog not loaded yet").
- **Roles:** the spec catalog sync reads each spec's role from Blizzard's `/data/wow/playable-specialization/<id>` (`role.type`: TANK, HEALER, DAMAGE), mapped to `tank`, `healing` and `dps`. It runs under the same limiter as the icon fetches. A spec whose role can't be fetched keeps a null role.
- **Parsing:** the three `<h3>` sections "Overall Best in Slot", "Best Gear from Mythic+" and "Best Gear from Raid" map to `overall`, `mythicPlus` and `raid`. Each section's `div.bis_items_grid` holds `div.bis_item` cards. For each card:
  - The item ID and bonus IDs come from `data-wowhead="item=<id>&bonus=<ids>"`.
  - The slot comes from `span.bis_item_slot`, mapped through a name table to `SlotType`s and a slot label, as Method's parser does. The table covers Icy Veins' names ("Helm", "Hands", "Ring", "Trinket", and so on). Repeated rings and trinkets number in page order.
  - `original-item=<id>` in the same attribute marks a catalyst row: `isCatalyst: true`.
    - `isTier`: true on catalyst rows. For other rows on a tier slot (Head, Shoulder, Chest, Hands, Legs), `syncBisLists` sets it from the item catalog, which gets the item from Blizzard when missing, as overrides do. Icy Veins has no per-card "(Tier Set)" text to read.
  - A card naming no item is skipped and counted, not fatal. A missing section gives an empty list, so the fallback to Overall applies.
  - Unknown slot names are a parse error with the name in the message, so a page redesign fails loudly instead of building a wrong list.
- Fetches go through `fetchWithRetry` in `src/core/http.ts`, as Method's do.

### Sources in the core

- `Services` carries `bisSources: Record<'method' | 'icyVeins', BisSource>` in place of the single `bisSource`.
- `syncBisLists`, `readBisLists`, `getBisLists` and `replaceBisLists` take the source ID and read and write the `bis_lists` rows under it.
- Reference sync works out, for each tracked spec, the fetched sources any account uses for it (Method or Icy Veins; Manual uses none). It fetches only those, each on its own freshness key. A spec with no settings row counts as Method.
- `readEffective` in `src/server/views/bis-lookup.ts` (the effective-list loader behind `createBisLookup`) reads the account's source. Method or Icy Veins: base rows from `bis_lists` for that source, with that source's overrides applied. Manual: base rows from `manual_bis_items`, with the `'manual'` overrides applied. Tier-target discovery and everything downstream keep reading the effective list, unchanged.

### Manual lists

- **Choosing Manual** with no manual lists yet copies all three effective lists of the source the spec had chosen (the base rows with that source's overrides applied) into `manual_bis_items`, and writes `manual_bis_lists`. It runs under one `withWriteLock` call. If the spec's current source has no rows yet (never fetched), choosing Manual is refused with a `UserError`: "Fetch a list first, then copy it."
- **Choosing Manual again later** keeps the existing copy.
- **Editing a manual list** uses the same slot overrides, with source `'manual'`. Reset returns a slot to its copied pick, and the edit counts and the orphan card work as they do for other sources.
- **"Copy again from Method" or "from Icy Veins"** replaces the manual rows with that source's effective lists and deletes the `'manual'` overrides, after a confirm that says manual edits are lost. That source must have rows.
- **Switching away from Manual** keeps the manual lists and their overrides. Switching back shows them unchanged.

### Routes

- `PATCH /api/bis/settings` accepts `source` beside `listType` and `statsMatter`. Choosing Manual triggers the copy above.
- `POST /api/bis/manual/copy` with `{ specSlug, from: 'method' | 'icyVeins' }` runs "Copy again".
- `POST /api/bis/fetch` (Fetch and Refresh) fetches the spec's chosen source. On Manual it is not offered.
- The override routes take the source from the spec's current setting, never from the request, so an edit always lands on the list being shown.

### UI

- **Source picker:** a "BiS source" segmented radio group (Method, Icy Veins, Manual) at the top of the editor's comparison card, above "Compare against", with the same styling and saving. Below `xl` the controls stack, as they do now.
- **Editor header:**
  - For Method and Icy Veins: "From <source> · fetched <age>" with Refresh.
  - For Manual: "Manual · copied from <source> on <date>", plus a "Copy again" menu with both fetched sources and a confirm step.
- **Slot table:** the "Method's pick" column header becomes "<Source>'s pick", or "Copied pick" on Manual.
- **Badge and pills:** `BisSourceBadge` takes the source name: "From Icy Veins", "From Icy Veins · 2 edited", "Manual", "Manual · 1 edited".
- **Fallback notices:** the gear table, dungeon priority and group priority notices name the source: "Icy Veins has no Raid list for this spec. Showing Overall."
- **Spec picker cards:** show the source beside "Compares <list>". Fetch and Refresh act on the chosen source. A Manual spec shows "Manual" in place of the fetch state.
- **Errors:** the existing BiS error and empty states, with the source's name in place of "Method".

## Testing

- **Icy Veins parser,** on trimmed fixture pages under `src/core/icy-veins/__fixtures__/` with made-up item names:
  - The three lists.
  - Slot-name mapping with numbered rings and trinkets.
  - A catalyst row from `original-item`.
  - A card with no item, which is skipped.
  - A missing section, which gives an empty list.
  - An unknown slot name, which errors.
- **URL derivation** from slug and role, and the error when the role is missing.
- **Spec catalog:** roles are stored, and a failed role fetch leaves a null role.
- **Migrations:** existing lists and overrides become `'method'` and read back unchanged.
- **Overrides:** an override made on Method doesn't show on Icy Veins, and shows again after switching back.
- **Manual copy:**
  - The copy takes the effective list with overrides applied.
  - Choosing Manual again keeps the copy.
  - "Copy again" replaces it and clears the `'manual'` overrides.
  - Choosing Manual with no fetched rows is refused.
  - A second account never sees the first account's manual lists.
- **Reference sync:** only the sources in use are fetched, and a spec with no settings row fetches Method.
- **Routes:** the source PATCH, the copy route, and override routes writing under the current source.
- **Views and components:** every source-named string (badge, column header, notices, picker card, header), with an Icy Veins and a Manual case each.
- **Live test** (`src/core/icy-veins/icy-veins.live.test.ts`): every spec's URL resolves, and all three lists parse with no unknown slots.
