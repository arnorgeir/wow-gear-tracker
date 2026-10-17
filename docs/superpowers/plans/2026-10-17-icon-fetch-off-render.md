# Icon fetching off the render path: plan

Spec: `docs/superpowers/specs/2026-10-17-icon-fetch-off-render-design.md`. Issue #164. Branch `fix/icon-fetch-off-render`, worktree `C:\workspace\wgt-164`, stacked on `chore/shared-cache-freshness` (PR #194).

TDD throughout: write each test, watch it fail, then the code. Gate at the end: `npm run typecheck && npm run lint && npm test && npm run build` (pages' data changes).

## Task 1: item icon backoff and reads (`src/core/sync/reference/item-icons.ts`)

Tests in `item-icons.test.ts`:

1. `ensureItemIcons` after a throwing request: a second call within 59 min asks nothing; at 61 min asks again.
2. A mixed attempt (item 1 loads, item 2 throws) stores item 1 and records the failure.
3. `readItemIcons(db, ids, now)`: `due` true when an ID has no row; false when every ID has a row, a `null` icon included; false while backing off; false for an empty ID list. Makes no Blizzard call (it takes no client).
4. Replace "skips icons that fail to load so they retry later" with the backoff version.

Code:

- `const ITEM_ICONS_FAILED_META_KEY = 'itemIcons.failedAt'`.
- Private `fetchIcons(deps, region, ids): Promise<number>` fetches, upserts what loaded, returns the failure count.
- Private `backingOff(db, now)`: `cacheTiming(null, failed?.updatedAt ?? null, now).backingOff`.
- `ensureItemIcons`: unknown IDs; if any and not backing off, `fetchIcons`, and `setMeta(failed key)` when failures > 0. Return `getItemIcons`.
- `readItemIcons`: `getItemIcons`, then `due = some id missing && !backingOff`.

## Task 2: `missingItemIconIds(db)` (`src/core/db/queries/media.ts`)

Test in a new `media.test.ts` beside it (or the nearest existing queries test): seed a character with two Blizzard snapshots and one SimC snapshot (equipped, bag and vault items), a `bis_items` row, a `manual_bis_items` row, a `bis_overrides` row, a `dungeon_loot` row, and an `items` row for one of them. Expect only: equipped and vault items of the latest snapshot per source, BiS, manual and override items, minus the one in `items`. Older snapshot, bag and loot items absent.

Code: one drizzle query or `sql` union. Latest snapshot per source: `gear_snapshots.id IN (SELECT max(id) FROM gear_snapshots GROUP BY character_id, source)`. Exclude `item_id IS NULL`. `NOT IN (SELECT item_id FROM items)`. Return sorted distinct numbers.

## Task 3: `syncItemIcons` (`item-icons.ts`)

Tests:

1. Fetches only missing IDs (seed via the same tables), returns true; a second call returns false with nothing asked.
2. Backing off: returns false and asks nothing.
3. 45 missing IDs, one always throws: every other ID stored in one call; failure recorded.
4. 45 missing IDs, all throw: only the first chunk of 20 is asked.

Code: `export async function syncItemIcons(deps, region): Promise<boolean>`; `CHUNK = 20`; loop chunks, `fetchIcons`; failures → `setMeta`; `failures === chunk.length` → break.

## Task 4: class icon read (`class-icons.ts`)

Tests: `readClassIcons(db, now)` due on an empty cache, not due after `ensureClassIcons`, not due within an hour of a failure, due after 30 days. Code: shares the `cacheTiming` call with `loadClassIcons` through a private `classIconTiming(db, now)`.

## Task 5: the pass (`src/core/sync/reference-run.ts`)

Tests in `reference-run.test.ts`:

1. With a tracked character, a snapshot and no icons, `syncReference` stores item icons and class icons (fake `getItemIconUrl`, `getClasses`, `getClassIconUrl`).
2. With no characters: class icons fetched with region `eu`; no item icon requests.
3. Existing tests whose fakes lack the icon methods: add stubs so `'skipped'` expectations hold once icons are stored (or prime icons first).

Code, at the end of `runPass`, in sequence:

```ts
const iconRegion = characters[0]?.region ?? 'eu';
if ((await readClassIcons(db, now)).due) { await ensureClassIcons({ db, blizzard, now }, iconRegion); requested = true; }
if (characters[0] && await syncItemIcons({ db, blizzard, now }, characters[0].region)) requested = true;
```

## Task 6: views and the search route

- `bis-lookup.ts`: `referenceDue(tracksDue, specs, extra: string[] = [])`, `extra` merged into the sorted key set. Unit test the merge.
- `character-page.ts`: `readClassIcons(db, time)` and `readItemIcons(db, iconIds, time)` in place of the `ensure*` calls; pass `[...(classDue ? ['classIcons'] : []), ...(itemDue ? ['itemIcons'] : [])]` to `referenceDue`.
- `group-page.ts`: the same.
- `character-cards.ts`: `readClassIcons`, `classIcons` key.
- `src/app/api/search/route.ts`: `getClassIconMap(services.db)`; drop the try/catch around a fetch that no longer happens only if the read can't throw usefully — keep the empty-map fallback.
- Tests in `views.test.ts`, "reference data off the render path": count `getItemIconUrl`, `getClasses` (outside the spec picker, which stays: count `getClassIconUrl` and `getItemIconUrl` instead) and assert zero after rendering both pages and the cards from an empty cache; assert the new keys; after `prime`, icons present and keys `null`. Update the existing icon assertions and exact key strings per spec acceptance 9. `group-page.test.ts`: same for the group page.
- `search-route.test.ts`: empty cache → `null` and no `getClasses` call; seeded `class_media` → the icon.

## Task 7: gate and docs

- `grep -rn "ensureItemIcons\|ensureClassIcons" src/server src/app` outside tests is empty.
- Full gate, plus `npm run build` in the worktree.
- Commits: one per task where it stands alone (`fix: back off item icons after a failure`, `fix: fetch icons in background reference sync`, `fix: read icons only during renders and search`), bodies saying why.
