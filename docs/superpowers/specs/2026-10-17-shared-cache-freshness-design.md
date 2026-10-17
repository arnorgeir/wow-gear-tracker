# Shared cache freshness: design

Issue: #166. Area: app. Size: M. Tech debt, no user-visible change.

## Problem

Each cached reference dataset decides "due, fresh or backing off" with its own code and its own one-hour constant:

- `src/core/sync/reference-sync.ts`: `RETRY_MS` and `timing()` for BiS lists, tracks and specs.
- The same file: tier stats' own `backingOff` check in `tierState()`.
- The same file: class icons' own TTL, backoff and `CLASS_ICONS_RETRY_MS` in `loadClassIcons()`.
- `src/core/sync/season-sync.ts`: `SEASON_RETRY_MS` and `seasonTiming()`, a line-for-line copy of `timing()`, plus its own copy of `statusOf()` inline in `readSeason()`.

A change to the retry rule has to be made in four places, and the copies already differ. `reference-sync.ts` also holds seven caches in one module (BiS lists, tracks, item icons, item details, tier stats, specs, class icons), and carries a leftover `syncBisLists` doc comment above `withTierFlags`.

Issue #164 (item icons back off after a failure) will build on this branch and needs the same rule for item icons.

## Decision on the open question

The issue asked: one shared freshness helper, or split `reference-sync.ts` into a directory of focused modules first? The owner answered "Always split into focused modules." This spec does both, in one pull request: the helper is the shared rule, and the split gives each cache its own module that calls it. Doing the helper alone would leave a 337-line module doing seven jobs; doing the split alone would copy `timing()` into four new files.

## Design

### 1. `src/core/sync/freshness.ts`: the one rule

Plain functions, no database access, so any cache can use them whatever its storage looks like (a meta key, a column, a per-item row):

```ts
export const DAY_MS = 86_400_000;
/** How long any cached reference dataset waits after a failed refresh before trying again. */
export const RETRY_MS = 60 * 60 * 1000;

export type ReferenceStatus = 'loading' | 'failed' | 'ready' | 'stale';

export interface CacheTiming { lastFailed: boolean; fresh: boolean; backingOff: boolean; due: boolean }

/**
 * Due when the data is missing or older than ttlMs, unless the last attempt failed within RETRY_MS.
 * A failure counts only when it is newer than the stored data. Pass storedAt null for a cache with
 * no single stored time: then any recorded failure counts.
 */
export function cacheTiming(storedAt: number | null, failedAt: number | null, now: number, ttlMs = DAY_MS): CacheTiming;

/** What the page says about a cache: whether it holds data, and whether the last attempt failed. */
export function referenceStatus(stored: boolean, lastFailed: boolean): ReferenceStatus;
```

- Inputs are plain timestamps (`number | null`), not meta rows. Callers pass `meta?.updatedAt ?? null`. This is what makes the helper easy for item icons (#164) to adopt: an item icon's failure time can come from a meta key or a column without the helper caring.
- `RETRY_MS` is one constant, not a parameter. Every cache uses one hour today, and the issue's complaint is exactly that the hour is written four times. Add a parameter when a cache needs a different backoff.
- `ttlMs` is a parameter because class icons really do refresh every 30 days while the rest refresh daily.
- `fresh` and `backingOff` are returned alongside `due` so callers with per-item freshness (tier stats) can use the backoff half alone.

### 2. Split `reference-sync.ts` into `src/core/sync/reference/`

One module per cache, names and signatures unchanged. No barrel: callers' import paths change, as `AGENTS.md` ("Splitting code") allows.

| Module | Exports | Freshness |
|---|---|---|
| `reference/bis-lists.ts` | `BisResult`, `BisRead`, `BisSyncDeps`, `readBisLists`, `syncBisLists` (and private `withTierFlags`) | `cacheTiming(fetchedAt, failed?.updatedAt)` |
| `reference/tracks.ts` | `TracksResult`, `TracksRead`, `readTracks`, `syncTracks`, `ensureTracks`, `TRACKS_META_KEY` stays private | `cacheTiming(fetchedAt, failedAt)` |
| `reference/specs.ts` | `syncSpecs` | `cacheTiming(fetchedAt, failedAt)` |
| `reference/class-icons.ts` | `ensureClassIcons` | `cacheTiming(fetchedAt, failedAt, now, 30 * DAY_MS)` |
| `reference/tier-stats.ts` | `TierScope`, `readTierTargets`, `syncTierTargets`, `ensureItemStats` | `cacheTiming(null, failedAt).backingOff`, with per-item staleness from `needsStats` |
| `reference/item-details.ts` | `ensureItemDetails` | none today (fetches missing items only) |
| `reference/item-icons.ts` | `ensureItemIcons` | none today; #164 adds it |

`ensureItemStats` sits with tier stats because it reads and writes the same `tier_targets` rows through the same `needsStats` rule. `BIS_RETRY_MS`, which only tests import, goes: tests use `RETRY_MS`. `DAY_MS` moves to `freshness.ts`; callers import it from there. `ReferenceStatus` moves to `freshness.ts`.

The leftover `syncBisLists` doc comment above `withTierFlags` is deleted.

### 3. Season uses the same rule

`src/core/sync/season-sync.ts` keeps its place (it is not one of the reference caches, and `AGENTS.md` names `SEASON_META_KEY` there). `seasonTiming()` and `SEASON_RETRY_MS` go; `runSync()` and `readSeason()` call `cacheTiming(loaded?.updatedAt ?? null, failed?.updatedAt ?? null, now)`, and `readSeason()` uses `referenceStatus()` instead of its inline copy. `SeasonState['status']` becomes `ReferenceStatus`.

### 4. Tests move with their code

`reference-sync.test.ts` splits along the same seams: `reference/bis-lists.test.ts`, `reference/tracks.test.ts`, and so on. Test bodies move unchanged apart from imports and `BIS_RETRY_MS` → `RETRY_MS`. A new `freshness.test.ts` covers the rule directly.

### 5. Docs

`AGENTS.md` ("Database rules") names `TRACKS_META_KEY` in `src/core/sync/reference-sync.ts`; it becomes `src/core/sync/reference/tracks.ts`.

## Behavior

No user-visible change and no change to any cache's timing (spec review S.2):

1. **Class icons: unchanged.** Today any failure within the hour holds class icons back; the shared rule ignores a failure older than the last full fetch. The two differ only for a failure older than a fetch that is itself within the hour, and then the data is fresh (30-day TTL), so neither rule fetches. No difference can be observed, so no test targets one. A partial failure (some icons missing) still records a failure newer than the last full fetch, so it still backs off.
2. **Tier stats keep "any failure backs off", on purpose.** The issue lists "tier stats back off after any failure without comparing it to the stored data" as a difference. That difference stays on purpose, now stated through the helper (`storedAt` null): tier stats have no single stored time, only per-item rows. Comparing against the newest `statsFetchedAt` would break the backoff, because a partial failure writes the items it did get and the failure at the same `now`, so the failure would never be newer than the stored data and every render would retry the failed items.

## Not in scope

- Item icon backoff, and moving icon fetching out of page renders (#164). `ensureItemIcons` moves file but keeps its behavior.
- Moving `season-sync.ts` or `reference-run.ts` into the new directory.
- Any schema change, migration or cache version bump.

## Acceptance criteria

1. `src/core/sync/reference-sync.ts` no longer exists; each of the seven caches lives in its own module under `src/core/sync/reference/`.
2. `grep -rn --exclude=*.test.ts "60 \* 60 \* 1000" src/core/sync` finds one line, in `freshness.ts`. Tests may keep literal hours (spec review S.1).
3. `timing()`, `seasonTiming()`, `statusOf()`, `BIS_RETRY_MS`, `SEASON_RETRY_MS` and `CLASS_ICONS_RETRY_MS` are gone; BiS lists, tracks, specs, class icons, tier stats and season call `cacheTiming()`.
4. `freshness.test.ts` covers: missing data is due; data younger than the TTL is fresh and not due; data at the TTL is due; a failure newer than the data within the hour backs off; at the hour it is due again; a failure older than the data does not count; `storedAt` null counts any failure; a custom TTL; and all four `referenceStatus()` results.
5. Every existing test passes with only import changes and `BIS_RETRY_MS` → `RETRY_MS`.
6. `npm run typecheck && npm run lint && npm test` and `npm run build` are clean.

## Edge cases

- A failure at exactly `now - RETRY_MS` is no longer backing off (strict `<`, as today).
- Data at exactly `storedAt + ttlMs` is due (strict `<`, as today).
- A failure and a store at the same timestamp: the failure does not count (strict `>`, as today).
- Next bundles `class-icons.ts` once per server chunk; its in-flight registry stays on `globalThis` under the same `Symbol.for` key, so moving the file doesn't split it.
