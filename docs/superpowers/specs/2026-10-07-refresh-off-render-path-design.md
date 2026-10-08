# Method and Raidbots refreshes off the render path

Status: design approved in chat on 2026-10-07. Spec review findings resolved on 2026-10-08; the owner approved the card's missing-track state in chat the same day.
Date: 2026-10-07
Issue: #60. Move Method and Raidbots refreshes off the render path

## Goal

Pages still wait on external requests before they render. The three view loaders (`getCharacterCards`, `getCharacterPage`, `getGroupPage`) do the following:

- They call `ensureTracks`, which fetches Raidbots `bonuses.json` once a day.
- They call `ensureBisLists` through `createBisLookup`, which fetches one Method gearing page per spec once a day.
- They call `ensureTierTargets`, which makes one Blizzard item request per tier item the first time a spec loads.

Since #44 a failed refresh retries at most hourly, so an outage no longer slows every load. Even so, the first load of each day waits on Method, and a group page waits for one Method request per distinct spec.

This change takes Method, Raidbots and tier-stat requests off the render path. A client-triggered route runs them, the same way `SeasonSync` loads season loot. Every view also gets a state for data that hasn't loaded yet.

Rendering is not fully network-free. Class icons, item icons and the character page's spec list stay on the render path (see Scope), so a cold cache can still delay a render on those.

It has to land before hosting (#8).

## What success looks like

- No page render calls Method, Raidbots or Blizzard's item endpoint for tier stats. View loader tests count calls to those three and assert zero, with the retained icon and spec calls stubbed.
- A spec with no list says **Loading BiS list…**. Missing Raidbots data says **Loading upgrade track data…**. The page then fills in on its own, without a manual reload.
- That holds when the work changes mid-sync. Changing **Compare as** to an uncached spec while a sync runs still loads the new spec without a reload.
- When Method or Raidbots is down, the existing error messages still show, and the stored data stays in use.
- A failed refresh of any kind, tier stats included, doesn't trigger a request loop: the hourly backoff stops the page from asking again.
- The client never names what to refresh, so it can't make the server fetch an arbitrary Method URL.

## Scope

In scope:

- Raidbots tracks and qualities.
- Method BiS lists.
- Tier-target stat pairs, because they follow the BiS list.

Out of scope, staying on the render path:

- **Class icons** (`ensureClassIcons`): 30-day TTL with an hourly backoff.
- **Item icons** (`ensureItemIcons`): fetched once per new item, then cached.
- **The spec list** on the character page (`blizzard.getClasses`): already falls back to the current spec on failure.

These are rare or cheap. Moving them would add states, such as a missing icon or a missing spec list, for little gain.

**The SimC paste route** keeps refreshing tracks inline through `ensureTracks`. The user is already waiting on that write, and it needs qualities to parse the paste.

## Design

### Core: read and sync split (`src/core/sync/reference-sync.ts`)

Each refresher splits into a read half and a sync half, the way `readSeason` and `syncSeason` already do.

**One timing rule, shared by the read and the sync, as `seasonTiming` does:**

- **due:** the data isn't fresh, meaning it is missing or a day old or more, and the kind isn't backing off, meaning it hasn't failed within the hour.
- **lastFailed:** a failure is recorded, and it is newer than the stored data.

**Status, the same four values the season uses:**

| Stored data | lastFailed | Status |
|---|---|---|
| none | no | `loading` |
| none | yes | `failed` |
| present | no | `ready` |
| present | yes | `stale` |

Each sync returns `true` when it made a request and `false` when nothing was due. None of them throws for an upstream failure; each records it in meta.

**BiS lists**

- `readBisLists(db, specSlug, now): Promise<BisRead>`, where `BisRead = BisResult & { status, due }`. It reads the database only.
  - `error` is the message stored in the `bis.<slug>.failed` meta when lastFailed, otherwise `null`. The messages are unchanged: "BiS list couldn't be updated", or "<source> has no gearing page for "<slug>"".
- `syncBisLists({ db, source, now }, specSlug): Promise<boolean>`. It returns `false` when nothing is due.
  - Otherwise it fetches, rejects empty lists as today, and calls `replaceBisLists`.
  - On failure it writes the failure meta.
- `ensureBisLists` is removed; nothing calls it after this change.

**Tracks**

- `readTracks(db, now): Promise<TracksRead>`, where `TracksRead = TracksResult & { status, due }`.
  - Stored data means at least one track row.
  - `error` is the existing `TRACKS_ERROR` text when status is `failed`, otherwise `null`.
  - A fresh install reads `loading`, not an error.
  - **The `stale` status is new for tracks.** Today an expired load with a newer failure still shows no error, because the old tracks are there. That stays true: `error` is `null` when stale. Only `failed` sets it.
- `syncTracks({ db, fetchRaidbots, now }): Promise<boolean>`: the fetch half of today's `ensureTracks`.
- `ensureTracks` stays, rewritten as `syncTracks` then `readTracks`, and returns `TracksResult` as today. Only the SimC route calls it.

**Tier targets**

A tier lookup is scoped to one spec in one region: `TierScope = { region, specSlug, lists }`.

- **An item needs stats** under today's rule: no row yet, never fetched, or no stats with the last fetch a day old or more. A 404 still stores an empty result and retries after a day, as today.
- **A failed request now backs off.** When any request in a sync throws, the sync stores what succeeded and writes the meta key `tiers.<region>.<slug>.failedAt`. A thrown request never stores a row, so it is never mistaken for an empty stat result.
- **due** is true when some item needs stats and that key isn't within the hour.
- `readTierTargets(db, scope, now): Promise<{ targets: Map<number, TierTarget>; due: boolean }>`. It reads the stored rows only.
- `syncTierTargets({ db, blizzard, now }, scope): Promise<boolean>`. It requests only the items that need stats, and returns `false` when nothing is due.
- `ensureTierTargets` is removed.

The backoff is per spec and region, so one failing spec doesn't hold back another. A new tier item on a spec that failed within the hour waits for the backoff to end.

### Core: one entry point (`src/core/sync/reference-run.ts`)

`syncReference({ db, bisSource, fetchRaidbots, blizzard, now }): Promise<'skipped' | 'synced'>` runs one pass:

1. Run `syncTracks`.
2. List the tracked characters with `listCharacters`.
3. Collect each distinct `methodSpecSlug(specOverride || specName, className)`, with the set of regions that use it. This is the slug `summarize` gives the views.
4. For each spec, run `syncBisLists`. Then read the stored lists, and for each of its regions run `syncTierTargets`.

Every database step runs in sequence, because in-memory test databases have one connection.

- A pass returns `'synced'` when any sync made a request, and `'skipped'` otherwise.
- It lives in its own file because it does a different job: it orchestrates, and the per-kind functions fetch.

**Calls that arrive during a pass get one follow-up pass.** A pass lists characters once, at its start. A request that arrives later may need work that pass never saw, such as a spec just chosen in **Compare as**. So the first call starts a pass, and every call that arrives while it runs shares one queued pass that starts when the first ends. Calls that arrive during the queued pass queue one more. At most one pass runs and one waits per database, kept in a `WeakMap<Db, …>` as `syncSeason` does. A follow-up pass with nothing due makes no request.

`createBisLookup(db, time)` in `src/server/views/bis-lookup.ts` switches to the read functions. It still memoizes once per spec, and once per spec and region for targets. It returns `SpecBis = BisRead & { targets; targetsDue; dueKeys }`.

- `dueKeys` names this spec's due work: `bis:<slug>` when the list is due, `tiers:<region>:<slug>` when its targets are due.
- `referenceDue(tracksDue, specs)` builds a page's key: the sorted, distinct names, including `tracks` when tracks are due, joined with commas. It returns `null` when nothing is due.

### Route

`POST /api/reference/sync` in `src/app/api/reference/sync/route.ts`.

- It takes no body and no query.
- It calls `syncReference` with the parts of `getServices()` it needs, and returns `{ result }`.
- Errors go through `errorResponse`, so a missing config answers 503.
- The request guard in `src/proxy.ts` covers it like every `/api` write.

### Client component

`SeasonSync` becomes `BackgroundSync({ url, due })`, and its directory moves from `season-sync/` to `background-sync/`.

- `due` is a string the server builds for the work the page is missing, or `null` when nothing is.
- The effect depends on `due` and `url`. It POSTs once for each new non-null `due`, then calls `router.refresh()` whatever the answer. A refresh keeps the component, so the same `due` never posts twice.
- The route ignores `due`. The key only re-arms the client; the server still picks its own work.
- Pages render one instance per route:
  - `url="/api/season/sync?region=<region>"` with `due="season"` when the season needs a sync, else `null`.
  - `url="/api/reference/sync"` with the page's `referenceDue`.

**Re-arming.** When **Compare as** picks an uncached spec mid-sync, the refreshed page's key gains `bis:<new slug>`. The new key fires a new POST, and that call joins the queued pass, which lists the new spec. The same holds for a second page that joins a running pass.

**Loop check.** After a failed sync, the failure is newer than the data and inside the backoff window, so that work is no longer due. Its name leaves the key. After a successful sync, the data is fresh and its name leaves the key too. The key only changes when the due work changes, and each change posts once, so nothing loops. That includes tier stats, which now back off like the rest.

### Views

Each loader computes `referenceDue` from the tracks it read and every `SpecBis` it looked up. Track availability comes from stored data, never from an error: `tracksKnown` is `tracks.size > 0` in every view, and every ranking's `approximate` is `!tracksKnown`. Cached tracks with a newer failure stay known, so they show as normal.

View types change as follows:

- `CharacterCardView` gains `tracksKnown` and `tracksLoading`. `getCharacterCards` returns `{ cards, referenceDue }` instead of a bare array, with the key covering every card.
- `CharacterPageView` gains `bisLoading`, `tracksLoading`, `tracksKnown` and `referenceDue`. `PriorityView` gains `bisLoading`.
- `GroupPageView` gains `tracksLoading` and `referenceDue`. Its existing `tracksKnown` switches to the map-size rule. `GroupMemberView` gains `bisLoading`.

Definitions:

- `bisLoading` is BiS status `loading`.
- `tracksLoading` is tracks status `loading`.
- The character page passes `view.tracksKnown` to `GearTable`, instead of `!tracksError`.

**What each view shows:**

| View | BiS loading | BiS failed | Tracks unknown (loading or failed) |
|---|---|---|---|
| Cards | Existing "Loading BiS list…" (already shown when there's no list and no error) | Existing `bisError` | Keep the `bis / total` count, which doesn't depend on tracks. Draw the bar as one BiS segment, plus the wrong-stats segment. Drop the summary words and the crest upgrade text; crest chips stay. Show "Loading upgrade track data…" with `role="status"` while loading, or the existing `tracksError` line when failed |
| Character page | `GearTable` shows "Loading BiS list…" with `role="status"` in place of "No BiS list to compare against yet." List counts read 0/0 as today | Existing alert | Tones hidden. "Loading upgrade track data…" with `role="status"` in `CharacterAlerts` while loading; the existing alert when failed |
| Character page priority | "Loading BiS list…" with `role="status"` in place of the ranking | Unchanged | `approximate` |
| Group page | The member is excluded with the reason `BiS list loading`, a new `EXCLUSION_REASONS.bisLoading`. The member notice says "Loading BiS list…" in muted text with `role="status"` | Existing `bisError` notice and the "no BiS list" reason | Tones hidden, `approximate`, and the same status line as the character page above the grid while loading |

Wording uses an ellipsis character and sentence case, matching the existing "Loading BiS list…". The two loading strings live in one shared copy module.

## Testing

**Core** (`reference-sync.test.ts`, new `reference-run.test.ts`), with `openTestDb` and fake sources:

- `readBisLists` and `readTracks` cover each status: `loading`, `failed`, `ready` and `stale`.
- `due` follows the shared rule at the day and hour boundaries.
- Each sync skips when nothing is due, stores on success, and records failure without throwing. These replace the current `ensureBisLists` and `ensureTierTargets` tests and keep their cases.
- Tier targets, with fresh tracks and lists and an unfetched tier item whose request throws:
  - `due` is false right after the sync, and stays false through repeated syncs inside the hour, with no new request;
  - it is true again at the hour, and a successful retry stores the stats;
  - a 404 still waits a day, and a thrown request stores no row.
- `syncReference`:
  - fetches each distinct spec once;
  - runs tier targets once per region that uses the spec;
  - a call during a pass waits for one follow-up pass, which picks up a spec added after the first pass listed characters;
  - several calls during a pass share that one follow-up;
  - returns `'skipped'` when nothing is due;
  - doesn't throw when every source fails.

**Views** (`views.test.ts`, `group-page.test.ts`, `bis-lookup.test.ts`):

- Tests seed tracked characters, stub the retained icon and spec calls with fixed values, and count calls to Method, Raidbots and Blizzard item details. With no reference cache, each loader returns loading states and a non-null `referenceDue`, and the count is zero.
- After `syncReference`, `referenceDue` is `null`.
- A failed sync drops the failed work from `referenceDue`.
- With BiS lists and season loot stored, matched items with upgrade bonus IDs, and no tracks or failure meta: cards report `tracksKnown: false` and `tracksLoading: true`, the group's `tracksKnown` is false, and both rankings are `approximate`. With cached tracks and a newer failure, all three read as normal.
- The group exclusion reason reads `BiS list loading`.

**Route:**

- A guard test, like the season sync route's.

**Components:**

- `bisSummary` and `crestLine` cover the missing-track case; `member-notices` covers the loading notice. No component tests beyond the existing pattern.

**By hand:**

- Start with an empty `DATABASE_URL` file and track one character. Each page renders with the loading text, then fills in.
- With a sync running, change **Compare as** to a spec not loaded yet. It fills in without a reload.
- Block network to Method by pointing the source at a bad host. Pages show the existing errors, and the network tab shows one POST per page load, not a loop.

## Data

- No schema change.
- Existing meta keys are unchanged: `tracks.v3.fetchedAt`, `tracks.failedAt` and `bis.<slug>.failed`. So no cache version bump.
- One new meta key per spec and region, `tiers.<region>.<slug>.failedAt`, records a failed tier request for the backoff.
