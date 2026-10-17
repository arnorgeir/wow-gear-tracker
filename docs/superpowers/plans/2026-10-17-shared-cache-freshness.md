# Shared cache freshness: implementation plan

Spec: `docs/superpowers/specs/2026-10-17-shared-cache-freshness-design.md` (the authority). Issue: #166.
Worktree: `C:\workspace\wgt-166`, branch `chore/shared-cache-freshness`.

Refactor with no behavior change. Each task ends green: `npm run typecheck && npm run lint && npm test`. Commit per task with the repo `commit` skill (`chore:` subjects, no AI attribution).

## Task 1: `src/core/sync/freshness.ts` with tests first

1. Write `src/core/sync/freshness.test.ts` covering acceptance criterion 4 of the spec:
   - `cacheTiming(null, null, now)` → `{ lastFailed: false, fresh: false, backingOff: false, due: true }`.
   - stored at `t`, `now = t + DAY_MS - 1` → fresh, not due; `now = t + DAY_MS` → due.
   - stored `t`, failed `t + DAY_MS + 5`, now `t + DAY_MS + 5 + RETRY_MS - 1` → lastFailed, backingOff, not due; at `+ RETRY_MS` → due, still lastFailed.
   - failure older than stored, or equal to it → lastFailed false.
   - `storedAt` null with a failure → lastFailed and backingOff within the hour.
   - custom TTL `30 * DAY_MS`: fresh at `29 * DAY_MS`, due at `30 * DAY_MS`.
   - `referenceStatus`: (false,false) loading, (false,true) failed, (true,false) ready, (true,true) stale.
2. Run it; it fails (no module).
3. Write `freshness.ts` exactly as the spec's section 1 signature: `DAY_MS`, `RETRY_MS`, `ReferenceStatus`, `CacheTiming`, `cacheTiming`, `referenceStatus`.
4. Test passes. Commit: `chore: add shared freshness rule for cached reference data`.

## Task 2: split `reference-sync.ts` into `src/core/sync/reference/`

Move code unchanged except freshness calls and imports. Relative imports inside `src/core` follow the existing style (`../../db/...`).

1. `reference/item-icons.ts`: `ensureItemIcons`.
2. `reference/item-details.ts`: `ensureItemDetails`.
3. `reference/bis-lists.ts`: `BisResult`, `BisRead`, `BisSyncDeps`, `bisFailedKey`, `withTierFlags` (drop the leftover `syncBisLists` doc comment above it), `readBisLists`, `syncBisLists`. Replace `timing(...)` with `cacheTiming(cached?.fetchedAt ?? null, failed?.updatedAt ?? null, now)` and `statusOf` with `referenceStatus`. Re-export nothing else.
4. `reference/tracks.ts`: `TRACKS_META_KEY` with its version comment, `TRACKS_FAILED_META_KEY`, `TRACKS_ERROR`, `TracksResult`, `TracksRead`, `readTracks`, `syncTracks`, `ensureTracks`.
5. `reference/tier-stats.ts`: `TierScope`, `tierFailedKey`, `tierItemIds`, `needsStats`, `tierState`, `toTargets`, `readTierTargets`, `syncTierTargets`, `ensureItemStats`. In `tierState`: `const { backingOff } = cacheTiming(null, failed?.updatedAt ?? null, now);` with a one-line comment that tier stats have no single stored time, so any failure counts (spec, Behavior 2).
6. `reference/specs.ts`: `SPEC_ICON_PARALLEL`, meta keys, `syncSpecs`.
7. `reference/class-icons.ts`: meta keys, `CLASS_ICONS_TTL_MS = 30 * DAY_MS`, `ensureClassIcons`, the `globalThis` registry under the same `Symbol.for('wow-gear-tracker.classIconRuns')` key, `loadClassIcons` using `cacheTiming(fetchedAt?.updatedAt ?? null, failedAt?.updatedAt ?? null, now, CLASS_ICONS_TTL_MS).due`. Drop `CLASS_ICONS_RETRY_MS`.
8. Delete `reference-sync.ts`. Drop `BIS_RETRY_MS`.
9. Update every importer (from the spec's grep): `src/app/api/bis/fetch/route.ts`, `src/app/api/characters/[id]/simc/route.ts`, `src/app/api/search/route.ts`, `src/components/spec-picker/fetch-state.test.ts` (`DAY_MS` from `@/core/sync/freshness`), `src/core/bis/edits.ts`, `src/core/bis/spec-base.ts`, `src/core/simc/import-simc.ts`, `src/core/sync/reference-run.ts`, `src/core/sync/reference-run.test.ts`, `src/core/sync/season-sync.ts`, `src/core/sync/season-sync.test.ts`, `src/server/views/bis-lookup.ts`, `bis-lookup.test.ts`, `character-cards.ts`, `character-page.ts`, `group-page.ts`, `group-page.test.ts`, `settings.test.ts`, `views.test.ts`. Re-grep `reference-sync` and `ReferenceStatus` afterwards; nothing in `src` may name the old module.
10. Split `reference-sync.test.ts` along the same seams into `reference/<module>.test.ts`, bodies unchanged apart from imports and `BIS_RETRY_MS` → `RETRY_MS`. Shared fixtures (`lists`, `noBlizzard`, `source()`) go into the BiS test, which is their only user; check each fixture's users before placing it. Test count must equal the old count.
11. Gate green. Commit: `chore: split reference sync into one module per cache`.

## Task 3: season uses the shared rule

1. In `season-sync.ts`: drop `SEASON_RETRY_MS`, `MetaRow`, `seasonTiming`; `runSync` and `readSeason` call `cacheTiming(loaded?.updatedAt ?? null, failed?.updatedAt ?? null, now)`; `readSeason` uses `referenceStatus(dungeons.length > 0, lastFailed)`; `SeasonState['status']` is `ReferenceStatus`.
2. Season tests pass unchanged. Commit: `chore: use shared freshness rule for season loot`.

## Task 4: docs and final checks

1. `AGENTS.md` ("Database rules"): `TRACKS_META_KEY` path → `src/core/sync/reference/tracks.ts`.
2. Acceptance checks: `grep -rn --exclude=*.test.ts "60 \* 60 \* 1000" src/core/sync` → one line in `freshness.ts`; `grep -rnE "seasonTiming|statusOf|BIS_RETRY_MS|SEASON_RETRY_MS|CLASS_ICONS_RETRY_MS|reference-sync" src AGENTS.md` → nothing.
3. Full gate plus `npm run build` (in the worktree only). Commit: `docs: point tracks cache rule at its new module`.
