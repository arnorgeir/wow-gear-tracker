# Method and Raidbots refreshes off the render path

Status: design approved in chat on 2026-10-07; written spec awaiting the owner's review.
Date: 2026-10-07
Issue: #60. Move Method and Raidbots refreshes off the render path

## Goal

Pages still wait on external requests before they render. The three view loaders (`getCharacterCards`, `getCharacterPage`, `getGroupPage`) do the following:

- They call `ensureTracks`, which fetches Raidbots `bonuses.json` once a day.
- They call `ensureBisLists` through `createBisLookup`, which fetches one Method gearing page per spec once a day.
- They call `ensureTierTargets`, which makes one Blizzard item request per tier item the first time a spec loads.

Since #44 a failed refresh retries at most hourly, so an outage no longer slows every load. Even so, the first load of each day waits on Method, and a group page waits for one Method request per distinct spec.

This change makes every page render from the database alone. A client-triggered route runs the refreshes, the same way `SeasonSync` loads season loot. Every view also gets a state for data that hasn't loaded yet.

It has to land before hosting (#8).

## What success looks like

- No page render calls Method, Raidbots or Blizzard's item endpoint for tier stats. A view loader test uses a fake fetch that fails the test when it is called.
- With an empty database, every page renders at once. A spec with no list says **Loading BiS list…**. Missing Raidbots data says **Loading upgrade track data…**. The page then fills in on its own, without a manual reload.
- When Method or Raidbots is down, the existing error messages still show, and the stored data stays in use.
- A failed refresh doesn't trigger a request loop: the hourly backoff stops the page from asking again.
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

**One timing rule per kind, shared by the read and the sync, as `seasonTiming` does:**

- **due:** the data isn't fresh, meaning it is missing or a day old or more, and the kind isn't backing off, meaning it hasn't failed within the hour.
- **lastFailed:** a failure is recorded, and it is newer than the stored data.

**Status, the same four values the season uses:**

| Stored data | lastFailed | Status |
|---|---|---|
| none | no | `loading` |
| none | yes | `failed` |
| present | no | `ready` |
| present | yes | `stale` |

**BiS lists**

- `readBisLists(db, specSlug, now): Promise<BisRead>`, where `BisRead = BisResult & { status, due }`. It reads the database only.
  - `error` is the message stored in the `bis.<slug>.failed` meta when lastFailed, otherwise `null`. The messages are unchanged: "BiS list couldn't be updated", or "<source> has no gearing page for "<slug>"".
- `syncBisLists({ db, source, now }, specSlug): Promise<void>`. It returns early when nothing is due.
  - Otherwise it fetches, rejects empty lists as today, and calls `replaceBisLists`.
  - On failure it writes the failure meta and doesn't throw.
- `ensureBisLists` is removed; nothing calls it after this change.

**Tracks**

- `readTracks(db, now): Promise<TracksRead>`, where `TracksRead = { tracks, qualities, status, due, error }`.
  - `error` is the existing `TRACKS_ERROR` text when status is `failed`, otherwise `null`.
  - A fresh install reads `loading`, not an error.
  - **The `stale` status is new for tracks.** Today an expired load with a newer failure still shows no error, because the old tracks are there. That stays true: `error` is `null` when stale. Only `failed` sets it.
- `syncTracks({ db, fetchRaidbots, now }): Promise<void>`: the fetch half of today's `ensureTracks`.
- `ensureTracks` stays, rewritten as `syncTracks` then `readTracks`, and returns `TracksResult` as today. Only the SimC route calls it.

**Tier targets**

- `readTierTargets(db, lists, now): Promise<{ targets: Map<number, TierTarget>; due: boolean }>`.
  - It reads the stored rows only.
  - `due` is true when any tier row's item meets today's refetch rule: no row yet, never fetched, or no stats with the last fetch a day old or more.
- `syncTierTargets({ db, blizzard, now }, region, lists): Promise<void>`: today's `ensureTierTargets` fetch and store. A failed request stores nothing, as today.

### Core: one entry point (`src/core/sync/reference-run.ts`)

`syncReference({ db, bisSource, fetchRaidbots, blizzard, now }): Promise<'skipped' | 'synced'>` runs these steps in order:

1. Run `syncTracks`.
2. List the tracked characters with `listCharacters`.
3. Collect each distinct `methodSpecSlug(specOverride || specName, className)`, with the set of regions that use it.
4. For each spec, run `syncBisLists`. Then, for each of its regions, read the stored lists and run `syncTierTargets`.

Every database step runs in sequence, because in-memory test databases have one connection.

- It returns `'skipped'` when nothing was due, and `'synced'` otherwise.
- Failures are recorded in meta by each sync. `syncReference` itself never throws for an upstream failure.
- Calls that arrive together share one run, through a `WeakMap<Db, Promise>`, the same as `syncSeason`.
- It lives in its own file because it does a different job: it orchestrates, and the per-kind functions fetch.

`createBisLookup` in `src/server/views/bis-lookup.ts` switches to the read functions. It still memoizes once per spec, and once per spec and region for targets. It returns `SpecBis = BisRead & { targets; targetsDue }`.

### Route

`POST /api/reference/sync` in `src/app/api/reference/sync/route.ts`.

- It takes no body and no query.
- It calls `syncReference` with the parts of `getServices()` it needs, and returns `{ result }`.
- Errors go through `errorResponse`, so a missing config answers 503.
- The request guard in `src/proxy.ts` covers it like every `/api` write.

### Client component

`SeasonSync` becomes `BackgroundSync({ url, needed })`, and its directory moves from `season-sync/` to `background-sync/`.

- The effect is unchanged: when `needed` is true it POSTs once per mount, then calls `router.refresh()` whatever the answer.
- Pages render one instance per route:
  - `url="/api/season/sync?region=<region>"` with the season flag.
  - `url="/api/reference/sync"` with the reference flag.

**Loop check.** After a failed sync, the failure is newer than the data and inside the backoff window, so `due` is false. The refresh then renders `needed={false}`, and nothing fires again. After a successful sync, the data is fresh and `due` is false.

### Views

Each loader computes `needsReferenceSync = tracks.due || any spec on the page has bis.due || any spec on the page has targetsDue`. View types gain the following fields:

- `CharacterCardView`: `bisLoading: boolean`. `getCharacterCards` returns `{ cards, needsReferenceSync }` instead of a bare array, with the flag covering every card.
- `CharacterPageView`: `bisLoading`, `tracksLoading`, `tracksKnown` and `needsReferenceSync`.
- `GroupPageView`: `tracksLoading` and `needsReferenceSync`. `GroupMemberView` gains `bisLoading`.

Definitions:

- `bisLoading` is BiS status `loading`.
- `tracksLoading` is tracks status `loading`.
- `tracksKnown` is `tracks.size > 0`.
- The character page passes `tracksKnown` to `GearTable`, instead of `!tracksError`. Otherwise a loading state, with no error and no tracks, would show tones it can't know.

**What each view shows:**

| View | BiS loading | BiS failed | Tracks loading |
|---|---|---|---|
| Cards | Existing "Loading BiS list…" (already shown when there's no list and no error) | Existing `bisError` | Nothing extra. `tracksError` stays `null`, and tones are already hidden while tracks are unknown |
| Character page | `GearTable` area shows "Loading BiS list…" with `role="status"`. List counts read 0/0 as today | Existing alert | "Loading upgrade track data…" line with `role="status"` in `CharacterAlerts`, not the alert |
| Character page priority | "Loading BiS list…" with `role="status"` in place of the ranking | Unchanged | `approximate` as today |
| Group page | The member is excluded with the reason `BiS list loading`, a new `EXCLUSION_REASONS.bisLoading`. The member notice says "Loading BiS list…" | Existing `bisError` notice and the "no BiS list" reason | Same status line as the character page, above the grid |

Wording uses an ellipsis character and sentence case, matching the existing "Loading BiS list…".

## Testing

**Core** (`reference-sync.test.ts`, new `reference-run.test.ts`), with `openTestDb` and fake sources:

- `readBisLists` and `readTracks` cover each status: `loading`, `failed`, `ready` and `stale`.
- `due` follows the shared rule at the day and hour boundaries.
- Each sync skips when nothing is due, stores on success, and records failure without throwing. These replace the current `ensureBisLists` and `ensureTracks` tests.
- `readTierTargets.due` follows today's refetch rule.
- `syncReference`:
  - fetches each distinct spec once;
  - runs tier targets once per region that uses the spec;
  - shares one run between calls that arrive together;
  - returns `'skipped'` when nothing is due;
  - doesn't throw when every source fails.

**Views** (`views.test.ts`, `group-page.test.ts`):

- With a fresh database and a fetch that throws when called, each loader returns loading states and `needsReferenceSync: true`, and makes no request.
- With fresh data, `needsReferenceSync` is false.
- The group exclusion reason reads `BiS list loading`.

**Route:**

- A guard test, like the season sync route's.

**Components:**

- `member-notices` covers the loading notice. No component tests beyond the existing pattern.

**By hand:**

- Start with an empty `DATABASE_URL` file. Each page renders at once with the loading text, then fills in.
- Block network to Method by pointing the source at a bad host. Pages show the existing errors, and the network tab shows one POST per page load, not a loop.

## Data

- No schema change.
- Meta keys are unchanged: `tracks.v3.fetchedAt`, `tracks.failedAt` and `bis.<slug>.failed`. So no cache version bump.
