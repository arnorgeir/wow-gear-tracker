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

In scope: the source choice, the Icy Veins `BisSource`, Icy Veins URLs from a static role table, the per-source list cache, per-source overrides, manual lists and copying, sync of only the sources in use, and source names in views and components.

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
- `bis_lists` gains `source` (`'method' | 'icyVeins'`), not null, with `.default('method')` in the schema so the generated table rebuild fills existing rows. The generated SQL is not hand-edited. The unique index becomes `(source, spec_slug, list_type)`. The cache stays shared across accounts, as today.
- `bis_overrides` gains `source` (`BisSourceId`), not null, `.default('method')` the same way, and it joins the primary key: `(account_id, spec_slug, source, list_type, slot_key)`.

New tables:

- `manual_bis_items`: an account's manual lists.
  - Columns: `account_id` (references `accounts`, cascade), `spec_slug`, `list_type`, `position`, and the row fields of `bis_items`: `slot_label`, `slots`, `item_id` (null for an "Any" row), `min_item_level`, `name`, `bonus_ids`, `is_tier`, `is_catalyst`, `source`.
  - `source` is the copied row's drop source ("Ula'tek", "Crafted"), as in `bis_items`. The site the copy came from lives in `manual_bis_lists.copied_from`.
  - Primary key `(account_id, spec_slug, list_type, position)`.
- `manual_bis_lists`: one row per `(account_id, spec_slug)`, with `copied_from` (`'method' | 'icyVeins'`) and `copied_at`. A row exists exactly when the manual lists exist.

`BisSourceId`, `FETCHED_SOURCES = ['method', 'icyVeins']` and `SOURCE_NAMES: Record<BisSourceId, string>` ("Method", "Icy Veins", "Manual") live in `src/core/types.ts`. The sources' `BisSource.name` and every component read the name from `SOURCE_NAMES`. There is no second map.

### Icy Veins source

`src/core/icy-veins/icy-veins.ts` exports `createIcyVeinsSource(fetchFn)`, which implements `BisSource`. It never touches the database.

- **URL:** `https://www.icy-veins.com/wow/<spec-slug>-pve-<role>-gear-best-in-slot`. Our spec slug matches Icy Veins' for all 40 sitemap entries (`frost-mage`, `beast-mastery-hunter`, `frost-death-knight`, `devourer-demon-hunter`).
- **Roles:** a static table in `src/core/icy-veins/roles.ts` lists the 13 non-dps slugs: 6 `tank` and 7 `healing`. Every other slug is `dps`. Roles never change, and a new tank or healer spec needs one line. The live test catches a wrong entry, because its URL 404s.
- **Parsing:** the three `<h3>` sections "Overall Best in Slot", "Best Gear from Mythic+" and "Best Gear from Raid" map to `overall`, `mythicPlus` and `raid`. Each section's `div.bis_items_grid` holds `div.bis_item` cards. For each card:
  - Cards are handled in this order:
    1. A `Shirt` or `Tabard` slot is ignored. Every list on every page has both, with no item.
    2. A card with no `data-wowhead`, or with an empty `bis_item_drop`, is skipped and counted. Two-handed specs get a placeholder Off Hand card with an unrelated item, no bonus IDs and no drop source, and this rule drops it.
    3. The slot name is mapped. An unknown name is a parse error.
  - The item ID and bonus IDs come from `data-wowhead="item=<id>&bonus=<ids>"`, HTML-decoded first (`&amp;`), as Method's `decodeHtml` does.
  - The slot comes from `span.bis_item_slot`, mapped through a name table to `SlotType`s and a slot label, as Method's parser does. The table covers Icy Veins' names ("Helm", "Hands", "Ring", "Trinket", and so on). Repeated rings and trinkets number in page order.
  - `original-item=<id>` in the same attribute marks a catalyst row: `isCatalyst: true`, `isTier: true`. The attribute decides, not the drop text: a catalyst row can read "Coiled Altar".
  - `source` is the `bis_item_drop` text. On a catalyst row, a leading "Catalyst from " is stripped, as Method strips "(Catalyst)". "Catalyst or X" stays as is: those are plain tier rows.
  - `isTier` on other rows: the page has no per-card tier text, and Guardian Druid lists tier pieces directly, with no `original-item`. The parser leaves it false, and `syncBisLists` sets it (see "Sources in the core").
  - A missing section gives an empty list, so the fallback to Overall applies.
  - The unknown-slot error names the slot, so a page redesign fails loudly instead of building a wrong list.
- Fetches go through `fetchWithRetry` in `src/core/http.ts`, as Method's do.

### Sources in the core

- `Services` carries `bisSources: Record<'method' | 'icyVeins', BisSource>` in place of the single `bisSource`.
- `syncBisLists`, `readBisLists`, `getBisLists` and `replaceBisLists` take the source ID and read and write the `bis_lists` rows under it.
- **Failures are per source:** `bisFailedKey` becomes `bis.<source>.<slug>.failed`. An Icy Veins failure never delays Method's retry or shows on Method, and the reverse. Old `bis.<slug>.failed` rows are left to go stale.
- **Tier flags for Icy Veins:** `syncBisLists` gains `blizzard` and `region` in its deps. For an Icy Veins list, it runs every non-catalyst row on a tier slot (Head, Shoulder, Chest, Hands, Legs) through `ensureItemDetails` (`item_details.isTier`), the lookup SimC import already uses. There is no third item lookup. The region is the first region of the spec's tracked characters. If any lookup fails, the whole sync fails and records the failure, so no list with wrong tier flags sits cached for a day.
- Reference sync works out, for each tracked spec, the fetched sources any account uses for it (Method or Icy Veins; Manual uses none). It fetches only those, each on its own freshness key. A spec with no settings row counts as Method.
- **Tier targets for every list in use:** `runPass` in `src/core/sync/reference-run.ts` syncs tier targets for the union of the lists in use for each spec: each fetched source any account uses, plus `manual_bis_items` rows with `is_tier`. It keeps `overrideTierItemIds`, which spans every source once `source` is in the key, a harmless superset. Without this, an Icy Veins or Manual spec's tier items never get stats, and the page's background sync never clears.
- `readEffective` in `src/server/views/bis-lookup.ts` (the effective-list loader behind `createBisLookup`) reads the account's source. Method or Icy Veins: base rows from `bis_lists` for that source, with that source's overrides applied. Manual: base rows from `manual_bis_items`, with the `'manual'` overrides applied. Tier-target discovery in the views and everything downstream keep reading the effective list, unchanged.
- **Manual's `BisRead`:** `status: 'ready'`, `due: false`, `error: null`, and `fetchedAt` is `manual_bis_lists.copied_at`. A Manual spec never shows loading, never arms a `bis:<slug>` sync key, and never shows an old fetch failure.
- **One source-aware read:** `readEffective`'s source choice moves into one core function, `readSpecBase(db, accountId, specSlug, now)`, which returns the source, the base lists and the `BisRead`. Everything else reads through it: `readEffective`, the spec picker cards (`src/server/views/settings-bis.ts`), the editor (`src/server/views/settings-spec.ts`), and slot-key validation in `src/core/bis/edits.ts`, which calls `getBisLists` today.

### Manual lists

- **Choosing Manual** with no manual lists yet copies all three effective lists of the source the spec had chosen (the base rows with that source's overrides applied) into `manual_bis_items`, and writes `manual_bis_lists`. One new query function, `chooseManual`, does the settings upsert, the copy and the `manual_bis_lists` row in one `withWriteLock` task and one transaction. `withWriteLock` isn't reentrant, so the task never calls `updateSpecSettings` or another locked helper. It reads the base rows and overrides itself, inside the task. If the spec's current source has no rows yet (never fetched), choosing Manual is refused with a `UserError`: "Fetch a list first, then copy it."
- **Choosing Manual again later** keeps the existing copy.
- **Editing a manual list** uses the same slot overrides, with source `'manual'`. Reset returns a slot to its copied pick, and the edit counts and the orphan card work as they do for other sources.
- **"Copy again from Method" or "from Icy Veins"** replaces the manual rows with that source's effective lists and deletes the `'manual'` overrides, after a confirm that says manual edits are lost. That source must have rows. A second locked function, `copyManual`, does this under the same rule.
- **Switching away from Manual** keeps the manual lists and their overrides. Switching back shows them unchanged.

### Routes

- `PATCH /api/bis/settings` accepts `source` beside `listType` and `statsMatter`. Choosing Manual triggers the copy above.
- `POST /api/bis/manual/copy` with `{ specSlug, from: 'method' | 'icyVeins' }` runs "Copy again".
- `POST /api/bis/fetch` (Fetch and Refresh) fetches the spec's chosen source. On Manual it is not offered.
- The override routes write under the spec's current source. The client also sends the source it shows. On a mismatch, from a tab left open while the source changed elsewhere, the route answers a `UserError`: "The BiS source changed. Reload the page." The server's setting stays the authority.

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
  - Shirt and Tabard cards ignored, not errors.
  - A placeholder Off Hand card with an empty drop source skipped.
  - `source` text: the catalyst prefix stripped, "Catalyst or X" kept.
  - HTML-encoded `data-wowhead` decoded.
  - A catalyst row from `original-item`.
  - A card with no item, which is skipped.
  - A missing section, which gives an empty list.
  - An unknown slot name, which errors.
- **URL derivation** from slug and the role table, with a tank, a healer and a dps case.
- **Tier flags:** a non-catalyst Icy Veins tier row gets `isTier` from `ensureItemDetails`, and a failed lookup fails the sync and records it.
- **Migrations:** existing lists and overrides become `'method'` and read back unchanged.
- **Overrides:** an override made on Method doesn't show on Icy Veins, and shows again after switching back.
- **Manual copy:**
  - The copy takes the effective list with overrides applied.
  - Choosing Manual again keeps the copy.
  - "Copy again" replaces it and clears the `'manual'` overrides.
  - Choosing Manual with no fetched rows is refused.
  - A second account never sees the first account's manual lists.
- **Reference sync:** only the sources in use are fetched, and a spec with no settings row fetches Method. An Icy Veins failure leaves Method's status and retry timing untouched. An Icy Veins spec's and a Manual spec's tier items get stats.
- **Manual's read:** ready, not due, no error, with `copied_at` as its age, even with an old Method failure on record.
- **Choose Manual and Copy again:** each runs in one lock and leaves no half-copied list when a write fails.
- **Routes:** the source PATCH, the copy route, override routes writing under the current source, and a source mismatch answering 400.
- **Views and components:** every source-named string (badge, column header, notices, picker card, header), with an Icy Veins and a Manual case each.
- **Live test** (`src/core/icy-veins/icy-veins.live.test.ts`): every spec's URL resolves, and all three lists parse with no unknown slots. A known two-handed spec (Beast Mastery Hunter) has no Off Hand row.
