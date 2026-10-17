# Icon fetching off the render path: design

Issue: #164. Area: character, group. Size: M. Builds on #166 (PR #194: `src/core/sync/freshness.ts` and the `src/core/sync/reference/` split).

## Problem

The character page, the group page, the home page and `GET /api/search` fetch missing icons from Blizzard and write them to the database while they render:

- `src/server/views/character-page.ts`: `ensureClassIcons` and `ensureItemIcons`.
- `src/server/views/group-page.ts`: the same.
- `src/server/views/character-cards.ts`: `ensureClassIcons` on the home page.
- `src/app/api/search/route.ts`: a `GET` handler that calls `ensureClassIcons`.

`ensureItemIcons` (`src/core/sync/reference/item-icons.ts`) stores nothing when a request fails, so every later render asks again and waits. Blizzard's client allows four requests at a time with a ten-second timeout each, so a stalled media endpoint holds a page for ten seconds per four missing icons. Class icons already back off for an hour after a failure; item icons don't. `AGENTS.md` says never write on `GET`.

## Decision on the open question

The issue asked: move icon fetching into the background reference sync, add a failure backoff to `ensureItemIcons`, or both? The owner answered "Yes", which reads as both. This spec does both:

- **Backoff** keeps every remaining caller of `ensureItemIcons` (the BiS edit route, the season sync and the new background step) from hammering a stalled endpoint.
- **Background sync** takes the wait and the write out of `GET` renders entirely. Backoff alone would still make the first render after each hour wait on Blizzard, and would still write on `GET`.

## Design

### 1. Item icon backoff: one meta key

`src/core/sync/reference/item-icons.ts` records a failure under the meta key `itemIcons.failedAt` whenever any icon request throws, at `now`. Before fetching, `ensureItemIcons` reads that key and fetches nothing while `cacheTiming(null, failedAt, now).backingOff` is true; it returns the stored icons as usual.

- One key for all items, not one per item. Item icons have no single stored time, so `storedAt` is `null` and any failure within the hour counts, as tier stats do (#166 spec, "Behavior" 2). A failure means the endpoint is struggling; holding back every unknown item for an hour is the point. Icons that loaded in the same attempt are still stored.
- No schema change and no migration: the `meta` table already holds failure times for tracks, specs and class icons.
- A 404 still stores a `null` icon, as today, so an item Blizzard has no icon for is never asked again and never counts as a failure.

### 2. Reads for the page

Two read-only functions, used by the views and the search route in place of the `ensure*` calls:

```ts
// reference/item-icons.ts
/** Stored icons for these items, and whether any is missing and not backing off. Reads the database only. */
export async function readItemIcons(db: Db, itemIds: number[], now: number): Promise<{ icons: Map<number, string | null>; due: boolean }>;

// reference/class-icons.ts
/** Stored class icons, and whether a refresh is due. Reads the database only. */
export async function readClassIcons(db: Db, now: number): Promise<{ icons: Map<string, string | null>; due: boolean }>;
```

`readClassIcons().due` uses the same `cacheTiming(fetchedAt, failedAt, now, 30 * DAY_MS)` that `loadClassIcons` uses, so the page and the sync agree on what is due.

### 3. Due keys

The page's background sync key gains two names, through `referenceDue()` in `src/server/views/bis-lookup.ts`:

- `itemIcons` when `readItemIcons().due` is true for the items the page shows.
- `classIcons` when `readClassIcons().due` is true.

`referenceDue(tracksDue, specs)` becomes `referenceDue(tracksDue, specs, extra: string[] = [])`, where `extra` holds these names. The existing `BackgroundSync` posts `/api/reference/sync` once per new key and refreshes the page; no client change.

The home page (`getCharacterCards`) shows class icons only, so it adds `classIcons`. The character and group pages add both. The dungeon page and the settings pages already read icons without fetching and stay as they are.

### 4. The background pass fetches icons

`runPass` in `src/core/sync/reference-run.ts` gains two steps at the end, after tier stats, so slow icon requests never hold up BiS lists or tracks:

1. **Class icons:** when `readClassIcons(db, now).due`, call `ensureClassIcons` with the first tracked character's region, or `eu` with none (the home page's region today). Blizzard's class data is the same in every region.
2. **Item icons:** `syncItemIcons({ db, blizzard, now }, region)` in `item-icons.ts`. It skips when backing off, else lists the item IDs the pages can show that have no row in `items`, and fetches them in chunks of 20. A chunk with any failure records `itemIcons.failedAt`; a chunk where every request failed stops the pass's icon step, since the endpoint is down. One item that always fails (a 500, or a body that won't parse) then costs only itself: the rest of the list still loads in the same pass, and the failed item is asked again after the hour (spec review S.2). Returns whether anything was due. It runs only when there are tracked characters, with the first one's region.

The icon step runs inside the pass, so a sync request that arrives meanwhile waits for it, as it already waits for BiS lists and tier stats (`syncReference` runs one pass at a time). On a stalled endpoint the wait is one chunk: five rounds of the client's 10 s timeout, plus its usual 401 and 429 retries (spec review S.1). Running icons outside the pass would let the page refresh before the icons land, with an unchanged key, so `BackgroundSync` would never post again for them.

"Item IDs the pages can show" is one query in `src/core/db/queries/media.ts`, `missingItemIconIds(db)`, a union of:

- `snapshot_items` in `equipped` and `vault` locations, from each character's latest snapshot per source (the snapshots the views read; older snapshots and bag items are never shown with icons);
- `bis_items` and `manual_bis_items` rows with an item ID;
- `bis_overrides`;

minus every `item_id` already in `items`.

`dungeon_loot` stays out: the season sync owns loot icons (`cacheLootIcons`), and listing them here too would race it for the client's four request slots (spec review S.1). Tier credits on the character and group pages show loot items; a loot icon the season sync couldn't load keeps the page's `itemIcons` key, which posts once and fetches nothing for it (see Edge cases).

### 5. Renders stop writing

- `getCharacterPage`, `getGroupPage` and `getCharacterCards` call `readClassIcons` and `readItemIcons` instead of `ensureClassIcons` and `ensureItemIcons`. A missing icon renders as it does today when Blizzard has none: the item card's fallback.
- `GET /api/search` calls `getClassIconMap(db)` and never fetches. An empty cache gives `classIconUrl: null`, and the result shows the class-colored initial, as it already does when the fetch fails. The home page's background sync fills the cache, so the next search has icons.
- `ensureItemIcons` keeps its other callers: the BiS edit route (`src/core/bis/edits.ts`, a `POST`, where the user waits on the item they just picked) and the season sync. Both get the backoff.

`ensureClassIcons` keeps its in-flight sharing; the pass is now its only caller, but the sharing is harmless and removing it is not this issue.

## Behavior

1. **First visit with an empty icon cache:** the page renders at once, without icons, and its sync key includes `itemIcons` and `classIcons`. The background pass fetches them; the page refreshes with icons. Today the page waits for the icons before showing anything.
2. **Blizzard media stalls:** the page renders at once. The pass waits on one chunk, records the failure, and the page's key drops `itemIcons` for the next hour, so the page doesn't post again. Today every render waits.
3. **A new SimC paste or BiS edit brings a new item:** the next render's key includes `itemIcons`; the pass fetches it.
4. **Character search** shows the class-colored initial until the class icon cache fills, instead of waiting on Blizzard inside the `GET`.

## Not in scope

- The character page's `blizzard.getClasses` call for its spec picker (a read, not a write; separate issue if it matters).
- Icons on the dungeon page, which the season sync already fetches.
- Removing `ensureClassIcons`'s in-flight sharing.
- Any schema change, migration or cache version bump.

## Acceptance criteria

1. `grep -rn "ensureItemIcons\|ensureClassIcons" src/server src/app` finds nothing outside tests.
2. Rendering the character page, the group page and the home page, and calling `GET /api/search`, make no Blizzard media request and no database write, with an empty icon cache (tested with a counting fake, as "reference data off the render path" in `views.test.ts` does for lists and tracks).
3. With an empty icon cache, the character page's and the group page's `referenceDue` include `classIcons` and `itemIcons`; the home page's includes `classIcons`.
4. After `syncReference` with a working fake, those pages show the icons and their `referenceDue` drops both names.
5. `ensureItemIcons`: after a failed request, a call within the hour fetches nothing; a call at the hour fetches again; icons that loaded beside the failure are stored.
6. `readItemIcons().due` is false while backing off, true when an item is missing otherwise, false when every item has a row (including a `null` icon).
7. `syncItemIcons` fetches only missing IDs from the listed tables, ignores older snapshots, bag items and dungeon loot, keeps going after a chunk with one failure, and stops after a chunk where every request failed.
8. `GET /api/search` returns `classIconUrl: null` for an empty cache and makes no Blizzard call.
9. Existing tests that expected render-time fetching are updated (spec review S.4): in `views.test.ts`, the icon assertions in the row, credit, identity and card tests run after `prime()`, which now loads icons; the exact `referenceDue` strings gain `classIcons` and `itemIcons` (with no characters the home page's key is `classIcons,tracks`); `search-route.test.ts` expects `null` until the cache holds the icon. `reference-run.test.ts` fakes get `getItemIconUrl` and class stubs where a test checks `'skipped'`.
10. `npm run typecheck && npm run lint && npm test` and `npm run build` are clean.

## Edge cases

- **No tracked characters:** the home page may still ask for `classIcons`; the pass fetches them with region `eu`. Item icons skip: nothing to show.
- **Characters in two regions:** icons are fetched with the first character's region. Blizzard serves the same media in every region.
- **A page shows an item none of the listed tables holds:** its key keeps `itemIcons`; `BackgroundSync` posts once per key, so there's no loop. None is known today.
- **Loot icons on the character and group pages:** tier credits show `dungeon_loot` items. When the season sync failed one, the page's key includes `itemIcons` and the pass doesn't fetch it; the next season sync does. `BackgroundSync` posts once per key, so no loop.
- **Icons skipped during a backoff elsewhere** (spec review S.3): the dungeon page, the settings spec page and the BiS edit route don't trigger the pass. Items from BiS lists and overrides fill the next time a character or group page is opened; loot icons wait for the next season sync. Accepted: those pages show icons the character pages already need.
- **Many missing icons on an old install:** the first pass fetches them in the background, 20 at a time, four in flight; other sync requests wait for it. Pages render meanwhile.
