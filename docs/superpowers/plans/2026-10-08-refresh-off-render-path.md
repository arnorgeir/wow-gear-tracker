# Refresh Off the Render Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pages render Method BiS lists, Raidbots tracks and tier stats from the database only. A client-triggered route refreshes them, and every view gets loading states.

**Architecture:** Each refresher in `src/core/sync/reference-sync.ts` splits into a database-only `read*` and a fetching `sync*`, which share one timing rule. A new `syncReference` in `src/core/sync/reference-run.ts` runs every sync for the tracked characters' specs. A call that arrives mid-pass gets one queued follow-up pass. Views read only, and hand pages a `referenceDue` key. `BackgroundSync` (renamed from `SeasonSync`) POSTs `/api/reference/sync` once per new key, then refreshes the page.

**Tech Stack:** Next.js (non-standard version: read `node_modules/next/dist/docs/` before touching routes or pages), React server components, TypeScript, libsql with Drizzle, Vitest, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-10-07-refresh-off-render-path-design.md`. The spec wins when this plan disagrees with it.

## Global Constraints

- `src/core` never imports `next`, `react`, or anything from `src/app`, `src/components` or `src/server`.
- Database steps run in sequence. Never run a read in parallel with a write on the same code path.
- `now` comes from callers (`services.now()`). Core code never calls `Date.now()` or global `fetch`.
- Exact copy: `Loading BiS list…` and `Loading upgrade track data…`. Use the ellipsis character `…`, not three dots. Existing strings use the curly apostrophe `’`; keep it.
- Exclusion reason text: `BiS list loading`.
- New meta key: `tiers.<region>.<slug>.failedAt`. Existing keys `tracks.v3.fetchedAt`, `tracks.failedAt` and `bis.<slug>.failed` stay unchanged. No schema change and no cache version bump.
- Retry backoff is one hour (`60 * 60 * 1000`). Freshness is one day (`DAY_MS`).
- Commit subjects are `type: lowercase imperative summary`. Bodies are terse, wrap at 72 columns, and say why. **No AI attribution and no co-author trailers**: AGENTS.md overrides any default.
- The gate before calling a task done is `npm run typecheck && npm run lint && npm test`. Add `npm run build` for tasks that touch pages or components, and never run it while `npm run dev` serves this folder.

## Review Focus

1. **Compare as changed to an uncached spec while a sync runs.** The new spec should fill in without a reload. Task 4 pins the queued pass; the hand check in Task 8 pins the client re-arm.
2. **Method or Raidbots down for hours.** The page should post once per load and never loop. Task 6's "drops failed work from the key" test pins it.
3. **A spec Method has no page for (404).** It should read `failed` with the missing-page message, and the group should exclude it with `no BiS list`, not `BiS list loading`. Task 1's cold-404 test and the existing group test in Task 6 pin it.
4. **A fresh install with no characters.** The home page should render "No characters yet" at once and ask only for tracks. Task 6's empty-cards test pins it.
5. **One spec tracked in two regions.** It should make one Method request, and no duplicate Blizzard item requests, because item rows are shared across regions. Task 4's dedupe test pins it.

---

### Task 1: BiS lists read and sync

**Files:**
- Modify: `src/core/sync/reference-sync.ts`
- Test: `src/core/sync/reference-sync.test.ts`

**Interfaces:**
- Produces:
  - `export type ReferenceStatus = 'loading' | 'failed' | 'ready' | 'stale'`
  - `export interface BisRead extends BisResult { status: ReferenceStatus; due: boolean }`
  - `export function readBisLists(db: Db, specSlug: string, now: number): Promise<BisRead>`
  - `export function syncBisLists(deps: { db: Db; source: BisSource; now: number }, specSlug: string): Promise<boolean>`, which returns `true` when it made a request.
  - The module-private helpers `RETRY_MS`, `timing()` and `statusOf()`, which Tasks 2 and 3 reuse.
- `ensureBisLists` stays in this task. Task 6 deletes it.

- [ ] **Step 1: Write the failing tests**

Add `readBisLists` and `syncBisLists` to the import from `./reference-sync` in `reference-sync.test.ts`. Then add this block after the `ensureBisLists` describe:

```ts
describe('readBisLists and syncBisLists', () => {
  const slug = 'guardian-druid';

  it('reads loading on a cold cache and asks for a sync', async () => {
    const db = await openTestDb();
    expect(await readBisLists(db, slug, 1)).toEqual({ lists: null, fetchedAt: null, error: null, status: 'loading', due: true });
  });

  it('syncs once, then reads ready until a day passes', async () => {
    const db = await openTestDb();
    const { s, calls } = source(async () => lists);
    expect(await syncBisLists({ db, source: s, now: 1000 }, slug)).toBe(true);
    expect(await readBisLists(db, slug, 1000 + DAY_MS - 1)).toEqual({ lists, fetchedAt: 1000, error: null, status: 'ready', due: false });
    expect(await syncBisLists({ db, source: s, now: 1000 + DAY_MS - 1 }, slug)).toBe(false);
    expect(calls()).toBe(1);
    expect((await readBisLists(db, slug, 1000 + DAY_MS)).due).toBe(true);
    expect(await syncBisLists({ db, source: s, now: 1000 + DAY_MS }, slug)).toBe(true);
    expect(calls()).toBe(2);
  });

  it('reads stale with the error after a failed refresh, and backs off for an hour', async () => {
    const db = await openTestDb();
    await syncBisLists({ db, source: source(async () => lists).s, now: 1000 }, slug);
    const down = source(async () => { throw new Error('down'); });
    const expired = 1000 + DAY_MS;
    expect(await syncBisLists({ db, source: down.s, now: expired }, slug)).toBe(true);
    expect(await readBisLists(db, slug, expired + 1)).toEqual({ lists, fetchedAt: 1000, error: 'BiS list couldn’t be updated', status: 'stale', due: false });
    expect(await syncBisLists({ db, source: down.s, now: expired + BIS_RETRY_MS - 1 }, slug)).toBe(false);
    expect(down.calls()).toBe(1);
    expect((await readBisLists(db, slug, expired + BIS_RETRY_MS)).due).toBe(true);
  });

  it('keeps the previous list when the page has no BiS tables', async () => {
    const db = await openTestDb();
    await syncBisLists({ db, source: source(async () => lists).s, now: 1000 }, slug);
    await syncBisLists({ db, source: source(async () => ({ overall: [], raid: [], mythicPlus: [] })).s, now: 1000 + DAY_MS }, slug);
    expect(await readBisLists(db, slug, 1000 + DAY_MS)).toMatchObject({ lists, fetchedAt: 1000, error: 'BiS list couldn’t be updated', status: 'stale' });
  });

  it('reads failed with the missing-page message on a cold 404, and recovers after the backoff', async () => {
    const db = await openTestDb();
    await syncBisLists({ db, source: source(async () => { throw new HttpError(404, 'u', ''); }).s, now: 1 }, 'nope-nope');
    expect(await readBisLists(db, 'nope-nope', 2)).toEqual({
      lists: null, fetchedAt: null, error: 'Fake has no gearing page for "nope-nope"', status: 'failed', due: false,
    });
    await syncBisLists({ db, source: source(async () => lists).s, now: 1 + BIS_RETRY_MS }, 'nope-nope');
    expect(await readBisLists(db, 'nope-nope', 2 + BIS_RETRY_MS)).toMatchObject({ lists, status: 'ready', error: null, due: false });
  });

  it('backs off per spec, so one failing spec does not stop another', async () => {
    const db = await openTestDb();
    await syncBisLists({ db, source: source(async () => { throw new Error('down'); }).s, now: 1 }, slug);
    expect((await readBisLists(db, 'feral-druid', 2)).due).toBe(true);
    const other = source(async () => lists);
    expect(await syncBisLists({ db, source: other.s, now: 2 }, 'feral-druid')).toBe(true);
    expect(other.calls()).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run src/core/sync/reference-sync.test.ts`
Expected: FAIL, because `readBisLists` and `syncBisLists` are not exported.

- [ ] **Step 3: Implement**

In `reference-sync.ts`, replace the `TRACKS_RETRY_MS` line and the `BIS_RETRY_MS` line with one shared constant. Then add the timing helpers above `ensureBisLists`, and the two functions after it:

```ts
const RETRY_MS = 60 * 60 * 1000;
export const BIS_RETRY_MS = RETRY_MS;
```

```ts
export type ReferenceStatus = 'loading' | 'failed' | 'ready' | 'stale';
type MetaRow = Awaited<ReturnType<typeof getMeta>>;

/** One rule for the page and the sync: due when the data is missing or a day old, unless the last attempt failed within the hour. */
function timing(storedAt: number | null, failed: MetaRow, now: number) {
  const lastFailed = failed !== null && (storedAt === null || failed.updatedAt > storedAt);
  const fresh = storedAt !== null && now - storedAt < DAY_MS;
  const backingOff = lastFailed && now - failed!.updatedAt < RETRY_MS;
  return { lastFailed, due: !fresh && !backingOff };
}

const statusOf = (stored: boolean, lastFailed: boolean): ReferenceStatus =>
  stored ? (lastFailed ? 'stale' : 'ready') : (lastFailed ? 'failed' : 'loading');

export interface BisRead extends BisResult { status: ReferenceStatus; due: boolean }
```

```ts
/** A spec's stored BiS lists and what the page should say about them. Reads the database only. */
export async function readBisLists(db: Db, specSlug: string, now: number): Promise<BisRead> {
  const cached = await getBisLists(db, specSlug);
  const failed = await getMeta(db, bisFailedKey(specSlug));
  const { lastFailed, due } = timing(cached?.fetchedAt ?? null, failed, now);
  return {
    lists: cached?.lists ?? null,
    fetchedAt: cached?.fetchedAt ?? null,
    error: lastFailed ? failed!.value : null,
    status: statusOf(cached !== null, lastFailed),
    due,
  };
}

/** Refreshes a spec's BiS lists when due. On failure keeps what it has and records why; never throws for an upstream failure. */
export async function syncBisLists(deps: { db: Db; source: BisSource; now: number }, specSlug: string): Promise<boolean> {
  const { db, source, now } = deps;
  const cached = await getBisLists(db, specSlug);
  const failed = await getMeta(db, bisFailedKey(specSlug));
  if (!timing(cached?.fetchedAt ?? null, failed, now).due) return false;
  try {
    const lists = await source.fetchLists(specSlug);
    if (lists.overall.length + lists.raid.length + lists.mythicPlus.length === 0) throw new Error('No BiS tables found');
    await replaceBisLists(db, specSlug, lists, now);
  } catch (err) {
    const error = isHttpError(err) && err.status === 404 && !cached
      ? `${source.name} has no gearing page for "${specSlug}"`
      : 'BiS list couldn’t be updated';
    await setMeta(db, bisFailedKey(specSlug), error, now);
  }
  return true;
}
```

In `ensureTracks`, replace `TRACKS_RETRY_MS` with `RETRY_MS`. Task 2 rewrites that function.

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run src/core/sync/reference-sync.test.ts`
Expected: PASS. The old `ensureBisLists` tests still pass too.

- [ ] **Step 5: Commit**

```bash
git add src/core/sync/reference-sync.ts src/core/sync/reference-sync.test.ts
git commit -m "feat: split bis list refresh into read and sync"
```

---

### Task 2: Tracks read and sync

**Files:**
- Modify: `src/core/sync/reference-sync.ts`
- Test: `src/core/sync/reference-sync.test.ts`

**Interfaces:**
- Consumes: `timing`, `statusOf`, `ReferenceStatus` and `RETRY_MS` from Task 1.
- Produces:
  - `export interface TracksRead extends TracksResult { status: ReferenceStatus; due: boolean }`
  - `export function readTracks(db: Db, now: number): Promise<TracksRead>`
  - `export function syncTracks(deps: { db: Db; fetchRaidbots: () => Promise<RaidbotsData>; now: number }): Promise<boolean>`
  - `ensureTracks` keeps its signature and returns `TracksResult`. Only the SimC route calls it.

- [ ] **Step 1: Write the failing tests**

Move the three constants `tracks`, `data` and `failing` out of the `ensureTracks` describe to module scope, unchanged. Add `readTracks` and `syncTracks` to the import. Then add:

```ts
describe('readTracks and syncTracks', () => {
  const TRACKS_ERROR = 'Upgrade track data couldn’t be loaded, so upgrade states may be wrong';

  it('reads loading on a fresh install, with no error', async () => {
    expect(await readTracks(await openTestDb(), 1)).toMatchObject({ status: 'loading', due: true, error: null });
  });

  it('reads failed with the error when the first load fails, and backs off an hour', async () => {
    const db = await openTestDb();
    expect(await syncTracks({ db, fetchRaidbots: failing, now: 1000 })).toBe(true);
    expect(await readTracks(db, 1000 + 59 * 60_000)).toMatchObject({ status: 'failed', due: false, error: TRACKS_ERROR });
    expect(await syncTracks({ db, fetchRaidbots: failing, now: 1000 + 59 * 60_000 })).toBe(false);
    expect((await readTracks(db, 1000 + 60 * 60_000)).due).toBe(true);
  });

  it('reads ready after a load, then stale without an error when a refresh fails', async () => {
    const db = await openTestDb();
    await syncTracks({ db, fetchRaidbots: async () => data, now: 1 });
    const ready = await readTracks(db, 2);
    expect(ready).toMatchObject({ status: 'ready', due: false, error: null });
    expect(ready.tracks.size).toBe(1);
    expect(ready.qualities.get(12805)).toBe('EPIC');
    expect((await readTracks(db, 1 + DAY_MS)).due).toBe(true);
    await syncTracks({ db, fetchRaidbots: failing, now: 1 + DAY_MS });
    const stale = await readTracks(db, 2 + DAY_MS);
    expect(stale).toMatchObject({ status: 'stale', due: false, error: null });
    expect(stale.tracks.size).toBe(1);
  });

  it('skips a sync when nothing is due', async () => {
    const db = await openTestDb();
    let calls = 0;
    const ok = async () => { calls++; return data; };
    expect(await syncTracks({ db, fetchRaidbots: ok, now: 1 })).toBe(true);
    expect(await syncTracks({ db, fetchRaidbots: ok, now: 2 })).toBe(false);
    expect(calls).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run src/core/sync/reference-sync.test.ts`
Expected: FAIL, because `readTracks` and `syncTracks` are not exported.

- [ ] **Step 3: Implement**

Replace `ensureTracks` with:

```ts
export interface TracksRead extends TracksResult { status: ReferenceStatus; due: boolean }

/** Stored Raidbots data and what the page should say about it. Reads the database only. Stale data shows no error: it is still usable. */
export async function readTracks(db: Db, now: number): Promise<TracksRead> {
  const fetchedAt = await getMeta(db, TRACKS_META_KEY);
  const failed = await getMeta(db, TRACKS_FAILED_META_KEY);
  const tracks = await getTrackMap(db);
  const qualities = await getBonusQualityMap(db);
  const { lastFailed, due } = timing(fetchedAt?.updatedAt ?? null, failed, now);
  const status = statusOf(tracks.size > 0, lastFailed);
  return { tracks, qualities, status, due, error: status === 'failed' ? TRACKS_ERROR : null };
}

/** Refreshes Raidbots data when due. On failure keeps what it has and records the attempt; never throws for an upstream failure. */
export async function syncTracks(deps: { db: Db; fetchRaidbots: () => Promise<RaidbotsData>; now: number }): Promise<boolean> {
  const { db, fetchRaidbots, now } = deps;
  const fetchedAt = await getMeta(db, TRACKS_META_KEY);
  const failed = await getMeta(db, TRACKS_FAILED_META_KEY);
  if (!timing(fetchedAt?.updatedAt ?? null, failed, now).due) return false;
  try {
    const data = await fetchRaidbots();
    if (data.tracks.length === 0) throw new Error('No upgrade tracks in the Raidbots data');
    await replaceTracks(db, data.tracks);
    await replaceBonusQualities(db, data.qualities);
    await setMeta(db, TRACKS_META_KEY, String(now), now);
  } catch {
    await setMeta(db, TRACKS_FAILED_META_KEY, String(now), now);
  }
  return true;
}

/** Sync then read, for the SimC route: the user already waits on that write, and parsing needs qualities. */
export async function ensureTracks(deps: { db: Db; fetchRaidbots: () => Promise<RaidbotsData>; now: number }): Promise<TracksResult> {
  await syncTracks(deps);
  const { tracks, qualities, error } = await readTracks(deps.db, deps.now);
  return { tracks, qualities, error };
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run src/core/sync/reference-sync.test.ts`
Expected: PASS, including the existing `ensureTracks` tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/sync/reference-sync.ts src/core/sync/reference-sync.test.ts
git commit -m "feat: split raidbots tracks refresh into read and sync"
```

---

### Task 3: Tier targets read and sync, with a backoff

**Files:**
- Modify: `src/core/sync/reference-sync.ts`
- Test: `src/core/sync/reference-sync.test.ts`

**Interfaces:**
- Consumes: `RETRY_MS` from Task 1.
- Produces:
  - `export interface TierScope { region: Region; specSlug: string; lists: BisLists | null }`
  - `export function readTierTargets(db: Db, scope: TierScope, now: number): Promise<{ targets: Map<number, TierTarget>; due: boolean }>`
  - `export function syncTierTargets(deps: { db: Db; blizzard: BlizzardClient; now: number }, scope: TierScope): Promise<boolean>`
- `ensureTierTargets` stays in this task. Task 6 deletes it.

- [ ] **Step 1: Write the failing tests**

Add `readTierTargets` and `syncTierTargets` to the import. Add this block after the `ensureTierTargets` describe. It redeclares that describe's helpers, because Task 6 deletes that describe.

```ts
describe('readTierTargets and syncTierTargets', () => {
  const tierRow = (itemId: number, isTier = true) =>
    ({ kind: 'item' as const, slotLabel: 'Chest', slots: ['CHEST' as const], itemId, name: `BiS ${itemId}`, bonusIds: [], isTier, isCatalyst: false, source: '' });
  const scope = (rows: ReturnType<typeof tierRow>[], specSlug = 'guardian-druid', region: 'eu' | 'us' = 'eu') =>
    ({ region, specSlug, lists: { overall: rows, raid: [], mythicPlus: rows } });
  const HM = ['HASTE_RATING', 'MASTERY_RATING'];
  const robe = { quality: 'EPIC', isTier: true, inventoryType: 'ROBE', armorType: 'cloth', secondaryStats: HM };

  function blizzardWith(answer: (id: number) => unknown) {
    const asked: number[] = [];
    const blizzard = { getItemDetails: async (_r: string, id: number) => { asked.push(id); return answer(id); } } as unknown as BlizzardClient;
    return { blizzard, asked };
  }

  it('fetches only tier rows’ items, once, and reads their pairs', async () => {
    const db = await openTestDb();
    const { blizzard, asked } = blizzardWith(() => ({ ...robe, isTier: false }));
    const both = scope([tierRow(10), tierRow(11, false)]);
    expect(await readTierTargets(db, both, 1)).toEqual({ targets: new Map(), due: true });
    expect(await syncTierTargets({ db, blizzard, now: 1 }, both)).toBe(true);
    const read = await readTierTargets(db, both, 2);
    expect(read.targets.get(10)).toEqual({ secondaryStats: HM, isTier: false });
    expect(read.targets.has(11)).toBe(false);
    expect(read.due).toBe(false);
    expect(await syncTierTargets({ db, blizzard, now: 2 }, scope([tierRow(10)]))).toBe(false);
    expect(asked).toEqual([10]);
  });

  it('stores no secondaries as [] and marks a tier-token piece', async () => {
    const db = await openTestDb();
    const { blizzard } = blizzardWith(() => ({ ...robe, secondaryStats: [] }));
    await syncTierTargets({ db, blizzard, now: 1 }, scope([tierRow(20)]));
    expect((await readTierTargets(db, scope([tierRow(20)]), 1)).targets.get(20)).toEqual({ secondaryStats: [], isTier: true });
  });

  it('retries a 404 only after a day', async () => {
    const db = await openTestDb();
    const { blizzard, asked } = blizzardWith(() => null);
    await syncTierTargets({ db, blizzard, now: 1 }, scope([tierRow(30)]));
    expect(await readTierTargets(db, scope([tierRow(30)]), 2)).toEqual({ targets: new Map([[30, { secondaryStats: null, isTier: false }]]), due: false });
    expect(await syncTierTargets({ db, blizzard, now: 2 }, scope([tierRow(30)]))).toBe(false);
    expect((await readTierTargets(db, scope([tierRow(30)]), 1 + DAY_MS)).due).toBe(true);
    await syncTierTargets({ db, blizzard, now: 1 + DAY_MS }, scope([tierRow(30)]));
    expect(asked).toEqual([30, 30]);
  });

  it('backs off an hour after a thrown request, storing nothing for it, then recovers', async () => {
    const db = await openTestDb();
    let down = true;
    const { blizzard, asked } = blizzardWith(() => { if (down) throw new Error('down'); return robe; });
    const one = scope([tierRow(31)]);
    expect(await syncTierTargets({ db, blizzard, now: 1000 }, one)).toBe(true);
    expect(await readTierTargets(db, one, 1001)).toEqual({ targets: new Map(), due: false });
    expect(await syncTierTargets({ db, blizzard, now: 1000 + BIS_RETRY_MS - 1 }, one)).toBe(false);
    expect(asked).toEqual([31]);
    expect((await readTierTargets(db, one, 1000 + BIS_RETRY_MS)).due).toBe(true);
    down = false;
    expect(await syncTierTargets({ db, blizzard, now: 1000 + BIS_RETRY_MS }, one)).toBe(true);
    expect(await readTierTargets(db, one, 1001 + BIS_RETRY_MS)).toEqual({ targets: new Map([[31, { secondaryStats: HM, isTier: true }]]), due: false });
  });

  it('stores what succeeded when one request of several throws', async () => {
    const db = await openTestDb();
    const { blizzard } = blizzardWith((id) => { if (id === 31) throw new Error('down'); return robe; });
    const two = scope([tierRow(30), tierRow(31)]);
    await syncTierTargets({ db, blizzard, now: 1 }, two);
    const read = await readTierTargets(db, two, 2);
    expect([...read.targets.keys()]).toEqual([30]);
    expect(read.due).toBe(false);
  });

  it('backs off per spec and region', async () => {
    const db = await openTestDb();
    const { blizzard } = blizzardWith(() => { throw new Error('down'); });
    await syncTierTargets({ db, blizzard, now: 1 }, scope([tierRow(40)]));
    expect((await readTierTargets(db, scope([tierRow(40)], 'feral-druid'), 2)).due).toBe(true);
    expect((await readTierTargets(db, scope([tierRow(40)], 'guardian-druid', 'us'), 2)).due).toBe(true);
  });

  it('fills in rows that ensureItemDetails wrote without stats', async () => {
    const db = await openTestDb();
    const simc = { getItemDetails: async () => ({ quality: 'EPIC', isTier: true }) } as unknown as BlizzardClient;
    await ensureItemDetails({ db, blizzard: simc, now: 1 }, 'eu', [50]);
    expect((await readTierTargets(db, scope([tierRow(50)]), 2)).due).toBe(true);
    const { blizzard, asked } = blizzardWith(() => robe);
    await syncTierTargets({ db, blizzard, now: 2 }, scope([tierRow(50)]));
    expect((await readTierTargets(db, scope([tierRow(50)]), 2)).targets.get(50)).toEqual({ secondaryStats: HM, isTier: true });
    expect(asked).toEqual([50]);
  });

  it('has nothing due without lists', async () => {
    const db = await openTestDb();
    expect(await readTierTargets(db, { region: 'eu', specSlug: 'guardian-druid', lists: null }, 1)).toEqual({ targets: new Map(), due: false });
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run src/core/sync/reference-sync.test.ts`
Expected: FAIL, because `readTierTargets` and `syncTierTargets` are not exported.

- [ ] **Step 3: Implement**

Add the following after `ensureTierTargets`. Import `type TierTargetRow` from `../db/queries/media` next to `getTierTargetRows`.

```ts
export interface TierScope { region: Region; specSlug: string; lists: BisLists | null }

// One entry per spec and region: a thrown tier request stores no row, so this is what holds the retry back.
const tierFailedKey = ({ region, specSlug }: TierScope) => `tiers.${region}.${specSlug}.failedAt`;

const tierItemIds = (lists: BisLists | null) =>
  lists ? [...new Set(LIST_TYPES.flatMap((l) => lists[l]).flatMap((r) => (r.kind === 'item' && r.isTier ? [r.itemId] : [])))] : [];

// Never fetched, or found no stats a day ago or more (a 404 stores an empty result).
const needsStats = (row: TierTargetRow | undefined, now: number) =>
  !row || row.statsFetchedAt === null || (row.secondaryStats === null && now - row.statsFetchedAt >= DAY_MS);

/** The scope's stored rows, and the items a sync would request now: none while a failure is within the hour. */
async function tierState(db: Db, scope: TierScope, now: number) {
  const ids = tierItemIds(scope.lists);
  const rows = await getTierTargetRows(db, ids);
  const failed = await getMeta(db, tierFailedKey(scope));
  const backingOff = failed !== null && now - failed.updatedAt < RETRY_MS;
  return { rows, pending: backingOff ? [] : ids.filter((id) => needsStats(rows.get(id), now)) };
}

const toTargets = (rows: Map<number, TierTargetRow>) =>
  new Map([...rows].map(([id, r]) => [id, { secondaryStats: r.secondaryStats, isTier: r.isTier }]));

/** Stat pairs for a spec's tier items in one region. Reads the database only. */
export async function readTierTargets(db: Db, scope: TierScope, now: number): Promise<{ targets: Map<number, TierTarget>; due: boolean }> {
  const { rows, pending } = await tierState(db, scope, now);
  return { targets: toTargets(rows), due: pending.length > 0 };
}

/**
 * Requests the tier items that need stats. Stores what came back; when any request throws,
 * records the failure so the scope waits an hour. Never throws for an upstream failure.
 */
export async function syncTierTargets(deps: { db: Db; blizzard: BlizzardClient; now: number }, scope: TierScope): Promise<boolean> {
  const { db, blizzard, now } = deps;
  const { pending } = await tierState(db, scope, now);
  if (pending.length === 0) return false;
  const fetched = await Promise.all(pending.map(async (itemId) => {
    try {
      return { itemId, info: await blizzard.getItemDetails(scope.region, itemId) };
    } catch {
      return null;
    }
  }));
  const found = fetched.filter((entry): entry is { itemId: number; info: ItemInfo | null } => entry !== null);
  if (found.length > 0) await upsertTierTargets(db, found, now);
  if (found.length < pending.length) await setMeta(db, tierFailedKey(scope), String(now), now);
  return true;
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run src/core/sync/reference-sync.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/sync/reference-sync.ts src/core/sync/reference-sync.test.ts
git commit -m "feat: split tier targets into read and sync with hourly backoff" -m "Thrown tier request stored nothing, so a sync left it due and every page retried at once. Backoff key per spec and region."
```

---

### Task 4: `syncReference` with a follow-up pass

**Files:**
- Create: `src/core/sync/reference-run.ts`
- Test: `src/core/sync/reference-run.test.ts`

**Interfaces:**
- Consumes: `syncTracks` (Task 2), `syncBisLists` and `readBisLists` (Task 1), `syncTierTargets` (Task 3), `listCharacters` from `../db/queries/characters`, and `methodSpecSlug` from `../method/method`.
- Produces:
  - `export type ReferenceSyncResult = 'skipped' | 'synced'`
  - `export interface ReferenceSyncDeps { db: Db; bisSource: BisSource; fetchRaidbots: () => Promise<RaidbotsData>; blizzard: BlizzardClient; now: number }`
  - `export function syncReference(deps: ReferenceSyncDeps): Promise<ReferenceSyncResult>`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { openTestDb } from '@/test/db';
import type { BlizzardClient } from '../blizzard/client';
import type { Db } from '../db/client';
import { insertCharacter, updateCharacter } from '../db/queries/characters';
import type { BisLists, Region } from '../types';
import { readBisLists, readTierTargets, readTracks } from './reference-sync';
import { syncReference, type ReferenceSyncDeps } from './reference-run';

const tierRobe = { kind: 'item', slotLabel: 'Chest', slots: ['CHEST'], itemId: 10, name: 'Tier Robe', bonusIds: [], isTier: true, isCatalyst: false, source: '' } as const;
const lists: BisLists = { overall: [], raid: [], mythicPlus: [tierRobe] };
const trackData = { tracks: [{ bonusId: 1, name: 'Myth', step: 1, max: 6, group: 618, currencyId: null, currencyName: null, costPerStep: null }], qualities: [] };

function deps(db: Db) {
  const calls = { lists: [] as string[], tracks: 0, items: [] as string[] };
  const d: ReferenceSyncDeps = {
    db, now: 1000,
    bisSource: { name: 'Fake', fetchLists: async (slug) => { calls.lists.push(slug); return lists; } },
    fetchRaidbots: async () => { calls.tracks++; return trackData; },
    blizzard: { getItemDetails: async (region: string, id: number) => { calls.items.push(`${region}:${id}`); return null; } } as unknown as BlizzardClient,
  };
  return { d, calls };
}

async function track(db: Db, name: string, className: string, specName: string, region: Region = 'eu') {
  return (await insertCharacter(db, { region, realmId: 1, realmSlug: 'argent-dawn', realmName: 'Argent Dawn', name, className, specName }, 1)).id;
}

describe('syncReference', () => {
  it('fetches tracks and each distinct spec once, without repeating tier requests across regions', async () => {
    const db = await openTestDb();
    await track(db, 'Birkibjörn', 'Druid', 'Guardian');
    await track(db, 'Sólrún', 'Druid', 'Guardian', 'us');
    await track(db, 'Hrafnhildur', 'Warrior', 'Protection');
    const { d, calls } = deps(db);
    expect(await syncReference(d)).toBe('synced');
    expect(calls.tracks).toBe(1);
    expect(calls.lists.sort()).toEqual(['guardian-druid', 'protection-warrior']);
    // Item rows are shared across regions, so the us scope finds item 10 already looked up.
    expect(calls.items).toEqual(['eu:10']);
    expect((await readTierTargets(db, { region: 'us', specSlug: 'guardian-druid', lists }, 1000)).due).toBe(false);
  });

  it('follows the spec override', async () => {
    const db = await openTestDb();
    const id = await track(db, 'Birkibjörn', 'Druid', 'Guardian');
    await updateCharacter(db, id, { specOverride: 'Feral' });
    const { d, calls } = deps(db);
    await syncReference(d);
    expect(calls.lists).toEqual(['feral-druid']);
  });

  it('skips when nothing is due', async () => {
    const db = await openTestDb();
    await track(db, 'Birkibjörn', 'Druid', 'Guardian');
    const { d, calls } = deps(db);
    await syncReference(d);
    expect(await syncReference(d)).toBe('skipped');
    expect(calls).toMatchObject({ tracks: 1, lists: ['guardian-druid'], items: ['eu:10'] });
  });

  it('records every failure without throwing, then backs off', async () => {
    const db = await openTestDb();
    await track(db, 'Birkibjörn', 'Druid', 'Guardian');
    const { d } = deps(db);
    d.bisSource = { name: 'Fake', fetchLists: async () => { throw new Error('down'); } };
    d.fetchRaidbots = async () => { throw new Error('down'); };
    expect(await syncReference(d)).toBe('synced');
    expect((await readTracks(db, 1000)).status).toBe('failed');
    expect((await readBisLists(db, 'guardian-druid', 1000)).status).toBe('failed');
    expect(await syncReference(d)).toBe('skipped');
  });

  it('gives calls during a pass one shared follow-up pass that sees a spec added meanwhile', async () => {
    const db = await openTestDb();
    await track(db, 'Birkibjörn', 'Druid', 'Guardian');
    const { d, calls } = deps(db);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    d.bisSource = { name: 'Fake', fetchLists: async (slug) => { calls.lists.push(slug); if (slug === 'guardian-druid') await gate; return lists; } };

    const first = syncReference(d);
    await vi.waitFor(() => expect(calls.lists).toEqual(['guardian-druid']));
    await track(db, 'Gnúpur', 'Mage', 'Frost');
    const second = syncReference(d);
    const third = syncReference(d);
    expect(third).toBe(second);
    release();

    expect(await first).toBe('synced');
    expect(await second).toBe('synced');
    expect(calls.lists).toEqual(['guardian-druid', 'frost-mage']);
    expect((await readBisLists(db, 'frost-mage', 1000)).status).toBe('ready');
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run src/core/sync/reference-run.test.ts`
Expected: FAIL, because `./reference-run` doesn't exist.

- [ ] **Step 3: Implement `src/core/sync/reference-run.ts`**

```ts
import type { BlizzardClient } from '../blizzard/client';
import type { Db } from '../db/client';
import { listCharacters } from '../db/queries/characters';
import { methodSpecSlug } from '../method/method';
import type { RaidbotsData } from '../raidbots/tracks';
import type { BisSource, Region } from '../types';
import { readBisLists, syncBisLists, syncTierTargets, syncTracks } from './reference-sync';

export type ReferenceSyncResult = 'skipped' | 'synced';
export interface ReferenceSyncDeps { db: Db; bisSource: BisSource; fetchRaidbots: () => Promise<RaidbotsData>; blizzard: BlizzardClient; now: number }

/** One pass: tracks, then every tracked spec's lists and, per region, its tier stats. Database steps run in sequence. */
async function runPass({ db, bisSource, fetchRaidbots, blizzard, now }: ReferenceSyncDeps): Promise<ReferenceSyncResult> {
  let requested = await syncTracks({ db, fetchRaidbots, now });
  // The same slug summarize gives the views, so the page and the sync agree on what is due.
  const specs = new Map<string, Set<Region>>();
  for (const c of await listCharacters(db)) {
    const slug = methodSpecSlug(c.specOverride || c.specName, c.className);
    specs.set(slug, (specs.get(slug) ?? new Set<Region>()).add(c.region));
  }
  for (const [specSlug, regions] of specs) {
    if (await syncBisLists({ db, source: bisSource, now }, specSlug)) requested = true;
    const { lists } = await readBisLists(db, specSlug, now);
    for (const region of regions) {
      if (await syncTierTargets({ db, blizzard, now }, { region, specSlug, lists })) requested = true;
    }
  }
  return requested ? 'synced' : 'skipped';
}

interface Slot { running: Promise<ReferenceSyncResult>; queued: Promise<ReferenceSyncResult> | null }
const slots = new WeakMap<Db, Slot>();

function launch(deps: ReferenceSyncDeps): Promise<ReferenceSyncResult> {
  const slot: Slot = { running: Promise.resolve('skipped'), queued: null };
  slot.running = runPass(deps).finally(() => {
    if (slots.get(deps.db) === slot && !slot.queued) slots.delete(deps.db);
  });
  slots.set(deps.db, slot);
  return slot.running;
}

/**
 * Refreshes Method lists, Raidbots tracks and tier stats for the tracked characters. A pass lists
 * characters once, at its start, so a call that arrives mid-pass may need work that pass never saw:
 * every such call shares one follow-up pass, which starts when the running one ends.
 */
export function syncReference(deps: ReferenceSyncDeps): Promise<ReferenceSyncResult> {
  const slot = slots.get(deps.db);
  if (!slot) return launch(deps);
  const again = () => launch(deps);
  slot.queued ??= slot.running.then(again, again);
  return slot.queued;
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run src/core/sync/reference-run.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/sync/reference-run.ts src/core/sync/reference-run.test.ts
git commit -m "feat: run reference syncs for tracked specs with one follow-up pass" -m "Pass lists characters once. A call mid-pass, such as a new Compare as spec, would otherwise wait on a pass that never sees it."
```

---

### Task 5: Reference sync route and `BackgroundSync`

Read the route handler guide in `node_modules/next/dist/docs/` first. The route mirrors `src/app/api/season/sync/route.ts`.

**Files:**
- Create: `src/app/api/reference/sync/route.ts`
- Move: `src/components/season-sync/SeasonSync.tsx` to `src/components/background-sync/BackgroundSync.tsx`, with `git mv`
- Modify: `src/app/characters/[id]/page.tsx`, `src/app/group/page.tsx`
- Test: `src/proxy.test.ts`

**Interfaces:**
- Consumes: `syncReference` (Task 4).
- Produces:
  - `POST /api/reference/sync`, which returns `{ result: ReferenceSyncResult }`.
  - `BackgroundSync({ url, due }: { url: string; due: string | null })`.

- [ ] **Step 1: Write the failing guard test**

Add to the `proxy` describe in `src/proxy.test.ts`:

```ts
  it('rejects a foreign Origin on the reference sync', async () => {
    const res = await proxy(request('/api/reference/sync', { method: 'POST', headers: { origin: 'http://evil.example' } }));
    expect(res.status).toBe(403);
  });
```

Run: `npx vitest run src/proxy.test.ts`
Expected: PASS already, because the guard covers every `/api` write. Keep it as a regression test for the new route.

- [ ] **Step 2: Create the route**

```ts
import { NextResponse } from 'next/server';
import { syncReference } from '@/core/sync/reference-run';
import { getServices } from '@/server/services';
import { errorResponse } from '@/server/route-helpers';

// No input: the server picks what to refresh from the tracked characters, so a client can't aim it at an arbitrary Method page.
export async function POST() {
  try {
    const { db, bisSource, fetchRaidbots, blizzard, now } = await getServices();
    return NextResponse.json({ result: await syncReference({ db, bisSource, fetchRaidbots, blizzard, now: now() }) });
  } catch (err) {
    return errorResponse(err);
  }
}
```

- [ ] **Step 3: Rename and generalize the client component**

```bash
git mv src/components/season-sync src/components/background-sync
git mv src/components/background-sync/SeasonSync.tsx src/components/background-sync/BackgroundSync.tsx
```

Replace the file's contents:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Asks a sync route to refresh in the background, then re-renders. `due` is the server's name for the work
 * the page is missing, or null. Each new name posts once: a refresh keeps this component, so the same name
 * never posts twice, and a page whose missing work changes mid-sync posts again.
 */
export function BackgroundSync({ url, due }: { url: string; due: string | null }) {
  const router = useRouter();
  useEffect(() => {
    if (!due) return;
    let cancelled = false;
    // Refresh after every answer, skips included: another page may have loaded the data meanwhile.
    fetch(url, { method: 'POST' })
      .catch(() => null)
      .then(() => { if (!cancelled) router.refresh(); });
    return () => { cancelled = true; };
  }, [due, url, router]);
  return null;
}
```

- [ ] **Step 4: Switch the season usages**

In `src/app/characters/[id]/page.tsx`, change the import to `import { BackgroundSync } from '@/components/background-sync/BackgroundSync';` and replace the `SeasonSync` element with:

```tsx
      <BackgroundSync url={`/api/season/sync?region=${view.region}`} due={view.priority.needsSync ? 'season' : null} />
```

In `src/app/group/page.tsx`, make the same import change and replace the `SeasonSync` line with:

```tsx
      {view.region && <BackgroundSync url={`/api/season/sync?region=${view.region}`} due={view.needsSeasonSync ? 'season' : null} />}
```

- [ ] **Step 5: Run the gate**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green. Stop `npm run dev` if it is running, then run `npm run build`. Expected: success.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/reference src/components/background-sync src/components/season-sync src/app/characters src/app/group src/proxy.test.ts
git commit -m "feat: add reference sync route and generalize season sync client"
```

---

### Task 6: Views read only

**Files:**
- Modify: `src/server/views/bis-lookup.ts`, `src/server/views/bis-lookup.test.ts`
- Modify: `src/server/views/character-cards.ts`, `src/server/views/character-page.ts`, `src/server/views/group-page.ts`
- Modify: `src/server/views/group-grid.ts`, `src/server/views/group-grid.test.ts`
- Modify: `src/server/views/types.ts`
- Modify: `src/server/views/views.test.ts`, `src/server/views/group-page.test.ts`
- Modify: `src/core/sync/reference-sync.ts`, `src/core/sync/reference-sync.test.ts` (delete `ensureBisLists` and `ensureTierTargets` and their describes)
- Modify: `src/app/page.tsx`, `src/app/characters/[id]/page.tsx`, `src/app/group/page.tsx`
- Modify the fixtures: `src/components/group-grid/member-notices.test.ts`, `src/components/group-grid/GroupGrid.test.ts`, `src/components/character-page/DungeonPriority.test.ts`

**Interfaces:**
- Consumes: `readBisLists`, `BisRead`, `readTracks`, `readTierTargets` (Tasks 1–3), `syncReference` (Task 4, tests only), `BackgroundSync` (Task 5).
- Produces:
  - `export interface SpecBis extends BisRead { targets: ReadonlyMap<number, TierTarget>; targetsDue: boolean; dueKeys: string[] }`
  - `export function createBisLookup(db: Db, time: number): (slug: string, region: Region) => Promise<SpecBis>`
  - `export function referenceDue(tracksDue: boolean, specs: SpecBis[]): string | null`
  - `getCharacterCards(services): Promise<{ cards: CharacterCardView[]; referenceDue: string | null }>`
  - `exclusionReason(state, hasRows, bisLoading = false)` and `EXCLUSION_REASONS.bisLoading = 'BiS list loading'`
  - New view fields:
    - `CharacterCardView`: `tracksKnown` and `tracksLoading`.
    - `CharacterPageView`: `bisLoading`, `tracksKnown`, `tracksLoading` and `referenceDue`.
    - `PriorityView`: `bisLoading`.
    - `GroupMemberView`: `bisLoading`.
    - `GroupPageView`: `tracksLoading` and `referenceDue`.

- [ ] **Step 1: Write the failing tests**

**`bis-lookup.test.ts`**: replace the whole file.

```ts
import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { syncBisLists } from '@/core/sync/reference-sync';
import type { BisLists } from '@/core/types';
import { createBisLookup, referenceDue, type SpecBis } from './bis-lookup';

const lists: BisLists = {
  overall: [],
  raid: [],
  mythicPlus: [{ kind: 'item', slotLabel: 'Head', slots: ['HEAD'], itemId: 10, name: 'Tier Helm', bonusIds: [], isTier: true, isCatalyst: false, source: 'Dungeon A' }],
};

describe('createBisLookup', () => {
  it('names a missing list as due work', async () => {
    const lookup = createBisLookup(await openTestDb(), 1000);
    expect(await lookup('guardian-druid', 'eu')).toMatchObject({ lists: null, status: 'loading', due: true, targetsDue: false, dueKeys: ['bis:guardian-druid'] });
  });

  it('names each region’s missing tier stats once the list is stored', async () => {
    const db = await openTestDb();
    await syncBisLists({ db, source: { name: 'Fake', fetchLists: async () => lists }, now: 1000 }, 'guardian-druid');
    const lookup = createBisLookup(db, 1000);
    const [eu, us] = await Promise.all([lookup('guardian-druid', 'eu'), lookup('guardian-druid', 'us')]);
    expect(eu).toMatchObject({ lists, status: 'ready', due: false, targetsDue: true, dueKeys: ['tiers:eu:guardian-druid'] });
    expect(us.dueKeys).toEqual(['tiers:us:guardian-druid']);
  });
});

describe('referenceDue', () => {
  it('joins the distinct due names in order, or says nothing is due', () => {
    const spec = (dueKeys: string[]) => ({ dueKeys }) as SpecBis;
    expect(referenceDue(true, [spec(['tiers:eu:guardian-druid']), spec(['bis:feral-druid']), spec(['bis:feral-druid'])]))
      .toBe('bis:feral-druid,tiers:eu:guardian-druid,tracks');
    expect(referenceDue(false, [spec([])])).toBeNull();
  });
});
```

**`group-grid.test.ts`**: add this line to the `exclusionReason` test.

```ts
    expect(exclusionReason('ready', false, true)).toBe('BiS list loading');
    expect(exclusionReason('ready', true, true)).toBeNull();
```

**`views.test.ts`**:

1. Add these imports:

   ```ts
   import { syncReference } from '@/core/sync/reference-run';
   import { DAY_MS, syncBisLists, syncTracks } from '@/core/sync/reference-sync';
   ```

2. Add this helper after `seed`:

   ```ts
   /** Fills the reference cache the way the background sync would. */
   const prime = (s: Services) =>
     syncReference({ db: s.db, bisSource: s.bisSource, fetchRaidbots: s.fetchRaidbots, blizzard: s.blizzard, now: s.now() });
   ```

3. In every existing test that calls `getCharacterPage` or `getCharacterCards`, add `await prime(s);` after the character is seeded and its snapshots are saved, and before the first loader call. Tests that override `s.fetchRaidbots` or `s.blizzard.getItemDetails` do so before `prime`. The one exception is "returns null for an unknown character".

4. Change every `const [card] = await getCharacterCards(s);` to `const { cards: [card] } = await getCharacterCards(s);`.

5. Add this block:

```ts
describe('reference data off the render path', () => {
  /** Counts the three requests a render must never make; the retained icon and spec calls stay stubbed. */
  function counting(s: Services) {
    const calls = { lists: 0, tracks: 0, items: 0 };
    const { bisSource, fetchRaidbots, blizzard } = s;
    s.bisSource = { name: bisSource.name, fetchLists: async (slug) => { calls.lists++; return bisSource.fetchLists(slug); } };
    s.fetchRaidbots = async () => { calls.tracks++; return fetchRaidbots(); };
    const getItemDetails = blizzard.getItemDetails.bind(blizzard);
    Object.assign(s.blizzard, { getItemDetails: async (region: string, id: number) => { calls.items++; return getItemDetails(region as 'eu', id); } });
    return calls;
  }

  it('renders loading states from an empty cache without asking Method, Raidbots or Blizzard item details', async () => {
    const s = await services();
    const calls = counting(s);
    const id = await seed(s);
    const page = await getCharacterPage(s, id);
    const { cards: [card], referenceDue } = await getCharacterCards(s);
    expect(calls).toEqual({ lists: 0, tracks: 0, items: 0 });
    expect(page).toMatchObject({
      bisLoading: true, bisError: null, tracksLoading: true, tracksKnown: false, tracksError: null, rows: [],
      referenceDue: 'bis:guardian-druid,tracks',
    });
    expect(page!.priority).toMatchObject({ bisLoading: true, approximate: true });
    expect(card).toMatchObject({ counts: null, bisError: null, tracksKnown: false, tracksLoading: true, tracksError: null });
    expect(referenceDue).toBe('bis:guardian-druid,tracks');
  });

  it('asks only for tracks with no characters', async () => {
    expect(await getCharacterCards(await services())).toEqual({ cards: [], referenceDue: 'tracks' });
  });

  it('needs no sync once the reference data is stored', async () => {
    const s = await services();
    const id = await seed(s);
    await prime(s);
    expect((await getCharacterPage(s, id))!.referenceDue).toBeNull();
    expect((await getCharacterCards(s)).referenceDue).toBeNull();
  });

  it('drops failed work from the key, so a failure does not ask again', async () => {
    const s = await services();
    s.bisSource = { name: 'Fake', fetchLists: async () => { throw new Error('down'); } };
    s.fetchRaidbots = async () => { throw new Error('down'); };
    const id = await seed(s);
    await prime(s);
    const page = await getCharacterPage(s, id);
    expect(page).toMatchObject({ referenceDue: null, bisLoading: false, bisError: 'BiS list couldn’t be updated', tracksLoading: false, tracksKnown: false });
    expect(page!.tracksError).toMatch(/Upgrade track data/);
  });

  it('treats tracks as unknown until stored, and cached tracks with a newer failure as known', async () => {
    const s = await services();
    const id = await seed(s);
    await syncBisLists({ db: s.db, source: s.bisSource, now: 1000 }, 'guardian-druid');
    let page = await getCharacterPage(s, id);
    let { cards: [card] } = await getCharacterCards(s);
    expect(page).toMatchObject({ tracksKnown: false, tracksLoading: true, tracksError: null, priority: { approximate: true } });
    expect(card).toMatchObject({ tracksKnown: false, tracksLoading: true });
    expect(card!.counts).not.toBeNull();

    await syncTracks({ db: s.db, fetchRaidbots: s.fetchRaidbots, now: 1000 });
    await syncTracks({ db: s.db, fetchRaidbots: async () => { throw new Error('down'); }, now: 1000 + DAY_MS });
    s.now = () => 1001 + DAY_MS;
    page = await getCharacterPage(s, id);
    ({ cards: [card] } = await getCharacterCards(s));
    expect(page).toMatchObject({ tracksKnown: true, tracksLoading: false, tracksError: null, priority: { approximate: false } });
    expect(card).toMatchObject({ tracksKnown: true, tracksLoading: false, tracksError: null });
  });
});
```

**`group-page.test.ts`**:

1. Add these imports:

   ```ts
   import { syncReference } from '@/core/sync/reference-run';
   import { DAY_MS, syncTracks } from '@/core/sync/reference-sync';
   ```

   Then add this helper:

   ```ts
   const prime = (s: Services) =>
     syncReference({ db: s.db, bisSource: s.bisSource, fetchRaidbots: s.fetchRaidbots, blizzard: s.blizzard, now: s.now() });
   ```

2. In every existing test except "is empty without keys", add `await prime(s);` immediately before the `getGroupPage` call.

3. Replace the test "asks Method once for two members of the same spec" with:

```ts
  it('asks Method once for two members of the same spec, in the sync and not the render', async () => {
    const { s, fetched } = await services();
    await track(s, 'Birkibjörn', 'Druid', 'Guardian', [worn('MAIN_HAND', 60)]);
    await track(s, 'Sólrún', 'Druid', 'Guardian', [worn('MAIN_HAND', 60)]);
    await prime(s);
    expect(fetched).toEqual(['guardian-druid']);
    await getGroupPage(s, keys('birkibjörn', 'sólrún'));
    expect(fetched).toEqual(['guardian-druid']);
  });
```

4. Add:

```ts
  it('leaves out a member whose BiS list is still loading, without asking Method', async () => {
    const { s, fetched } = await services();
    await track(s, 'Birkibjörn', 'Druid', 'Guardian', [worn('MAIN_HAND', 60)]);
    await season(s);
    const page = await getGroupPage(s, keys('birkibjörn'));
    expect(fetched).toEqual([]);
    expect(page.members[0]).toMatchObject({ state: 'ready', hasRows: false, bisLoading: true, bisError: null });
    expect(page.priority.excluded).toEqual([{ name: 'Birkibjörn', reason: 'BiS list loading' }]);
    expect(page).toMatchObject({ tracksKnown: false, tracksLoading: true, referenceDue: 'bis:guardian-druid,tracks' });
    expect(page.priority.approximate).toBe(true);
  });

  it('presents cached tracks as known after a failed refresh', async () => {
    const { s } = await services();
    const myth = { bonusId: 1, name: 'Myth', step: 1, max: 6, group: 618, currencyId: null, currencyName: null, costPerStep: null };
    await syncTracks({ db: s.db, fetchRaidbots: async () => ({ tracks: [myth], qualities: [] }), now: 1 });
    await syncTracks({ db: s.db, fetchRaidbots: async () => { throw new Error('down'); }, now: 1 + DAY_MS });
    s.now = () => 2 + DAY_MS;
    expect(await getGroupPage(s, [])).toMatchObject({ tracksKnown: true, tracksLoading: false, priority: { approximate: false } });
  });
```

**`reference-sync.test.ts`**: delete the `ensureBisLists` and `ensureTierTargets` describes. Remove `ensureBisLists` and `ensureTierTargets` from the import.

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run src/server/views src/core/sync`
Expected: FAIL, because `referenceDue`, the new fields and the three-argument `exclusionReason` don't exist yet.

- [ ] **Step 3: Implement the views**

Replace the whole of **`bis-lookup.ts`**:

```ts
import type { Db } from '@/core/db/client';
import { readBisLists, readTierTargets, type BisRead } from '@/core/sync/reference-sync';
import type { Region, TierTarget } from '@/core/types';

export interface SpecBis extends BisRead {
  targets: ReadonlyMap<number, TierTarget>;
  targetsDue: boolean;
  /** This spec's due work, by name, for the page's background sync key. */
  dueKeys: string[];
}

/** One BiS lookup per page, from the database only: lists once per spec, tier stat pairs once per spec and region. */
export function createBisLookup(db: Db, time: number) {
  const lists = new Map<string, Promise<BisRead>>();
  const lookups = new Map<string, Promise<SpecBis>>();
  return (slug: string, region: Region): Promise<SpecBis> => {
    if (!lists.has(slug)) lists.set(slug, readBisLists(db, slug, time));
    const key = `${region}:${slug}`;
    if (!lookups.has(key)) {
      lookups.set(key, (async () => {
        const bis = await lists.get(slug)!;
        const { targets, due: targetsDue } = await readTierTargets(db, { region, specSlug: slug, lists: bis.lists }, time);
        const dueKeys = [...(bis.due ? [`bis:${slug}`] : []), ...(targetsDue ? [`tiers:${key}`] : [])];
        return { ...bis, targets, targetsDue, dueKeys };
      })());
    }
    return lookups.get(key)!;
  };
}

/**
 * The page's background sync key: the reference work due for what it shows, or null. A new key re-arms the
 * sync when the page's needs change mid-sync; the route ignores it and picks its own work.
 */
export function referenceDue(tracksDue: boolean, specs: SpecBis[]): string | null {
  const keys = [...new Set([...(tracksDue ? ['tracks'] : []), ...specs.flatMap((s) => s.dueKeys)])].sort();
  return keys.length > 0 ? keys.join(',') : null;
}
```

Replace the whole of **`character-cards.ts`**:

```ts
import { listCharacters } from '@/core/db/queries/characters';
import { crestCostsByGroup } from '@/core/gear/crests';
import { countStates, evaluateGear } from '@/core/gear/evaluate';
import { ensureClassIcons, readTracks } from '@/core/sync/reference-sync';
import { createBisLookup, referenceDue, type SpecBis } from './bis-lookup';
import type { Services } from '../services';
import type { CharacterCardView } from './types';
import { loadGear, summarize, upgradeFor, crestView } from './summarize';

export async function getCharacterCards(services: Services): Promise<{ cards: CharacterCardView[]; referenceDue: string | null }> {
  const { db, blizzard, now } = services;
  const time = now();
  const tracks = await readTracks(db, time);
  const tracksKnown = tracks.tracks.size > 0;
  const costs = crestCostsByGroup(tracks.tracks.values());
  const characters = await listCharacters(db);
  const classIcons = await ensureClassIcons({ db, blizzard, now: time }, characters[0]?.region ?? 'eu');
  const bisFor = createBisLookup(db, time);
  const specs: SpecBis[] = [];
  const cards = await Promise.all(characters.map(async (c) => {
    const gear = await loadGear(db, c.id);
    const summary = summarize(c, gear.current, classIcons);
    const bis = await bisFor(summary.specSlug, c.region);
    specs.push(bis);
    const bisRows = bis.lists?.[c.priorityList] ?? [];
    const rows = evaluateGear({ equipped: gear.equipped, bisRows, tracks: tracks.tracks, bagItemIds: gear.bagItemIds, targets: bis.targets });
    return {
      ...summary,
      counts: bis.lists ? countStates(rows) : null,
      total: rows.length,
      bisError: bis.error,
      tracksError: tracks.error,
      tracksKnown,
      tracksLoading: tracks.status === 'loading',
      crests: crestView(gear, costs),
      upgradesReady: rows.filter((r) => upgradeFor(r, costs, gear.balances)).length,
    };
  }));
  return { cards, referenceDue: referenceDue(tracks.due, specs) };
}
```

**`character-page.ts`**:

1. Import `readTracks` instead of `ensureTracks`, and `referenceDue` from `./bis-lookup`.
2. Destructure `const { db, blizzard, now } = services;`.
3. Replace the `ensureTracks` line and the `loadMember` line with:

   ```ts
   const tracksRead = await readTracks(db, time);
   const { tracks } = tracksRead;
   const tracksKnown = tracks.size > 0;
   const member = await loadMember({ db, tracks, bisFor: createBisLookup(db, time) }, character);
   ```

4. In the returned object, replace `tracksError,` with:

   ```ts
       bisLoading: bis.status === 'loading',
       tracksError: tracksRead.error,
       tracksKnown,
       tracksLoading: tracksRead.status === 'loading',
       referenceDue: referenceDue(tracksRead.due, [bis]),
   ```

5. In `priority`, add `bisLoading: bis.status === 'loading',` and set `approximate: !tracksKnown,`.

**`group-page.ts`**:

1. Import `readTracks` instead of `ensureTracks`, and `referenceDue` from `./bis-lookup`.
2. Destructure `const { db, blizzard, now } = services;`.
3. Replace the `ensureTracks` line with:

   ```ts
   const tracksRead = await readTracks(db, time);
   const { tracks } = tracksRead;
   const tracksKnown = tracks.size > 0;
   ```

4. Replace the `ponytail:` comment and the `createBisLookup` line with:

   ```ts
   // Reads only: members load in sequence, and the lookup shares one read per spec.
   const bisFor = createBisLookup(db, time);
   ```

5. In the members loop, after `hasRows`, add `const bisLoading = data?.bis.status === 'loading';`. Then use `reason: exclusionReason(state, hasRows, bisLoading),` and add `bisLoading,` to `view` after `bisError`.
6. In the returned object:
   - set `tracksKnown,`;
   - add `tracksLoading: tracksRead.status === 'loading',`;
   - set `approximate: !tracksKnown,` in `priority`;
   - add after `needsSeasonSync`:

     ```ts
       referenceDue: referenceDue(tracksRead.due, loaded.flatMap(({ data }) => (data ? [data.bis] : []))),
     ```

**`group-grid.ts`**: add `bisLoading: 'BiS list loading',` to `EXCLUSION_REASONS`, and replace `exclusionReason` with:

```ts
/** Why the ranking leaves a member out, or null when the member counts. */
export function exclusionReason(state: GroupMemberState, hasRows: boolean, bisLoading = false): string | null {
  if (state === 'ready') return hasRows ? null : bisLoading ? EXCLUSION_REASONS.bisLoading : EXCLUSION_REASONS.noList;
  return EXCLUSION_REASONS[state];
}
```

**`types.ts`**:

1. In `CharacterCardView`, after `tracksError`, add:

   ```ts
     /** False until Raidbots data is stored: states that depend on upgrade tracks can't be told apart. */
     tracksKnown: boolean;
     tracksLoading: boolean;
   ```

2. In `PriorityView`, add `bisLoading: boolean;`.
3. In `CharacterPageView`, after `tracksError`, add `bisLoading: boolean; tracksKnown: boolean; tracksLoading: boolean; referenceDue: string | null;`.
4. In `GroupMemberView`, after `bisError`, add `bisLoading: boolean;`.
5. In `GroupPageView`, after `tracksKnown`, add `tracksLoading: boolean;`, and after `needsSeasonSync` add `referenceDue: string | null;`.

**`reference-sync.ts`**: delete `ensureBisLists` and `ensureTierTargets`. Keep `BisResult`, `getTierTargetRows`, `upsertTierTargets` and the `ItemInfo` import, which the new functions use.

- [ ] **Step 4: Wire the pages and fix the fixtures**

**`src/app/page.tsx`**: import `BackgroundSync` from `@/components/background-sync/BackgroundSync`. Replace the loader line with `const { cards, referenceDue } = await getCharacterCards(services);`, and add after `<StaleSync ids={staleIds} />`:

```tsx
      <BackgroundSync url="/api/reference/sync" due={referenceDue} />
```

**`src/app/characters/[id]/page.tsx`**: change `GearTable`'s prop to `tracksKnown={view.tracksKnown}`, and add after the season `BackgroundSync`:

```tsx
      <BackgroundSync url="/api/reference/sync" due={view.referenceDue} />
```

**`src/app/group/page.tsx`**: add after the season line:

```tsx
      <BackgroundSync url="/api/reference/sync" due={view.referenceDue} />
```

**Fixtures:**
- Add `bisLoading: false,` after `bisError: null,` in the `member` helpers of `member-notices.test.ts` and `GroupGrid.test.ts`.
- Add `bisLoading: false,` to `base` in `DungeonPriority.test.ts`.

- [ ] **Step 5: Run the gate**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green. Stop dev if it is running, then run `npm run build`. Expected: success.

- [ ] **Step 6: Commit**

```bash
git add src/server/views src/core/sync src/app src/components/group-grid/member-notices.test.ts src/components/group-grid/GroupGrid.test.ts src/components/character-page/DungeonPriority.test.ts
git commit -m "fix: render method and raidbots data from the database only" -m "First load of each day waited on Method, a group page once per spec. Pages now read stored data and post a due key to /api/reference/sync. Track availability from stored rows, not errors."
```

---

### Task 7: Loading and missing-track presentation

**Files:**
- Create: `src/components/shared/loading-copy.ts`
- Modify: `src/components/character-card/bis-summary.ts`, `bis-summary.test.ts`, `crest-line.ts`, `crest-line.test.ts`, `CharacterCard.tsx`
- Modify: `src/components/character-page/GearTable.tsx`, `DungeonPriority.tsx`, `DungeonPriority.test.ts`, `CharacterAlerts.tsx`
- Modify: `src/components/group-grid/member-notices.ts`, `member-notices.test.ts`, `MemberNotices.tsx`, `cell-note.ts`, `cell-note.test.ts`, `GroupGrid.tsx`
- Modify: `src/app/characters/[id]/page.tsx`, `src/app/group/page.tsx`

**Interfaces:**
- Consumes: the view fields from Task 6.
- Produces:
  - `BIS_LOADING` and `TRACKS_LOADING` constants.
  - `bisSummary(counts, tracksKnown = true)`.
  - `barSegments(counts, tracksKnown)`.
  - `crestLine({ ..., tracksKnown? }, now)`.
  - `cellNote(state, hasRows, bisLoading = false)`.
  - `MemberNotice` kind `'bisLoading'`.
  - `GearTable` prop `bisLoading`.

- [ ] **Step 1: Write the failing tests**

**`bis-summary.test.ts`**: import `barSegments`. Add this test inside the existing `bisSummary` describe:

```ts
  it('says nothing about states that need track data while it is unknown, and keeps the BiS total', () => {
    expect(bisSummary(counts, false)).toEqual({ bis: 6, text: '' });
  });
```

Then append a new describe at the end of the file:

```ts
describe('barSegments', () => {
  it('shows each state with track data', () => {
    expect(barSegments({ ...counts, wrongStats: 1, inBags: 2 }, true)).toEqual({ done: 3, mythUpgradable: 2, belowMyth: 1, wrongStats: 1, rest: 6 });
  });

  it('folds track-dependent states into one BiS segment without track data', () => {
    expect(barSegments({ ...counts, wrongStats: 1, inBags: 2 }, false)).toEqual({ done: 6, mythUpgradable: 0, belowMyth: 0, wrongStats: 1, rest: 6 });
  });
});
```

**`crest-line.test.ts`**: add inside the describe:

```ts
  it('keeps the balances but claims no upgrades while track data is unknown', () => {
    expect(crestLine({ crests: crests([myth]), gearFromSimc: true, upgradesReady: 0, tracksKnown: false }, now))
      .toEqual({ balances: [myth], text: '', tone: 'text-muted' });
    expect(crestLine({ crests: null, gearFromSimc: false, upgradesReady: 0, tracksKnown: false }, now).text).toBe('Crests unknown: paste SimC');
  });
```

**`member-notices.test.ts`**: add:

```ts
  it('says a member’s BiS list is loading', () => {
    expect(memberNotices(member({ hasRows: false, bisLoading: true }))).toEqual([{ kind: 'bisLoading', text: 'Loading BiS list…' }]);
  });
```

**`cell-note.test.ts`**: add to the `cellNote` test:

```ts
    expect(cellNote('ready', false, true)).toEqual({ text: 'Loading BiS list…', dim: true });
```

**`DungeonPriority.test.ts`**: add a test that follows the file's existing `render` helper:

```ts
  it('says the BiS list is loading instead of ranking', () => {
    const html = render({ ...base, bisLoading: true, season: 'loading' });
    expect(html).toContain('Loading BiS list…');
    expect(html).not.toContain('Loading this season’s loot…');
  });
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run src/components`
Expected: FAIL on the new cases.

- [ ] **Step 3: Implement the helpers**

**`src/components/shared/loading-copy.ts`**:

```ts
// One wording for every view that waits on the background reference sync.
export const BIS_LOADING = 'Loading BiS list…';
export const TRACKS_LOADING = 'Loading upgrade track data…';
```

**`bis-summary.ts`**:

```ts
import type { CharacterCardView } from '@/server/views/types';

type Counts = NonNullable<CharacterCardView['counts']>;

/**
 * The card's BiS total and its words under the bar. A wrong-stats piece isn't BiS, and is named only when there is one.
 * Without track data a matched item can't be told from one needing crests or the vault, so the words are left out.
 */
export function bisSummary(counts: CharacterCardView['counts'], tracksKnown = true): { bis: number; text: string } {
  if (!counts) return { bis: 0, text: '' };
  const bis = counts.done + counts.mythUpgradable + counts.belowMyth;
  if (!tracksKnown) return { bis, text: '' };
  const parts = [`${counts.done} done`, `${counts.mythUpgradable} need crests`, `${counts.belowMyth} vault targets`];
  if (counts.wrongStats > 0) parts.push(`${counts.wrongStats} wrong stats`);
  if (counts.inBags > 0) parts.push(`${counts.inBags} in bags`);
  return { bis, text: parts.join(', ') };
}

/** The bar's segment sizes. Without track data the track-dependent states fold into one BiS segment. */
export function barSegments(counts: Counts, tracksKnown: boolean) {
  const rest = counts.missing + counts.inBags;
  if (tracksKnown) return { done: counts.done, mythUpgradable: counts.mythUpgradable, belowMyth: counts.belowMyth, wrongStats: counts.wrongStats, rest };
  return { done: counts.done + counts.mythUpgradable + counts.belowMyth, mythUpgradable: 0, belowMyth: 0, wrongStats: counts.wrongStats, rest };
}
```

**`crest-line.ts`**: add `tracksKnown?: boolean;` to `CrestLineInput`, with the doc comment `/** False while upgrade track data is missing: upgrade costs are unknown. */`. Then change the start of `crestLine` to:

```ts
export function crestLine({ crests, gearFromSimc, upgradesReady, tracksKnown = true }: CrestLineInput, now: number): { balances: CrestBalance[]; text: string; tone: string } {
  if (!crests) return { balances: [], text: 'Crests unknown: paste SimC', tone: 'text-muted' };
  if (!tracksKnown) return { balances: crests.balances, text: '', tone: 'text-muted' };
```

**`member-notices.ts`**: widen the kind to `'untracked' | 'notFound' | 'syncError' | 'bisError' | 'bisLoading'`, import `BIS_LOADING` from `@/components/shared/loading-copy`, and add before `return notices;`:

```ts
  if (m.bisLoading) notices.push({ kind: 'bisLoading', text: BIS_LOADING });
```

**`cell-note.ts`**: import `BIS_LOADING`, give `cellNote` a third parameter `bisLoading = false`, and change the `ready` case to:

```ts
    case 'ready': return hasRows ? null : bisLoading ? { text: BIS_LOADING, dim: true } : { text: 'No BiS list', dim: false };
```

- [ ] **Step 4: Implement the components**

**`CharacterCard.tsx`**:
1. Import `barSegments` and `TRACKS_LOADING`.
2. Compute `const { bis, text: summary } = bisSummary(counts, card.tracksKnown);`.
3. Pass `tracksKnown: card.tracksKnown` into `crestLine`'s input.
4. Beside `bisSummary`, compute `const bar = counts && barSegments(counts, card.tracksKnown);`. Change the branch condition from `) : counts ? (` to `) : bar ? (`, so TypeScript narrows `bar`. `bar` is null exactly when `counts` is.
5. Change the five bar segments to use `bar.done`, `bar.mythUpgradable`, `bar.belowMyth`, `bar.wrongStats` and `bar.rest`.
6. Replace the summary span with:

   ```tsx
             {card.tracksLoading
               ? <span role="status" className="text-sm text-muted">{TRACKS_LOADING}</span>
               : summary && <span className="text-sm text-muted">{summary}</span>}
   ```

7. Render the crest text span only when `crests.text` is non-empty: `{crests.text && <span className={`text-sm ${crests.tone}`}>{crests.text}</span>}`.

**`GearTable.tsx`**: add the prop `bisLoading: boolean`, import `BIS_LOADING`, and replace the empty-rows line with:

```tsx
      {rows.length === 0 && (bisLoading
        ? <p role="status" className="p-6 text-muted">{BIS_LOADING}</p>
        : <p className="p-6 text-muted">No BiS list to compare against yet.</p>)}
```

**`DungeonPriority.tsx`**: import `BIS_LOADING`, and make the first line of `Ranking`:

```tsx
  if (priority.bisLoading) return <p role="status" className="text-muted">{BIS_LOADING}</p>;
```

**`CharacterAlerts.tsx`**: import `TRACKS_LOADING`, and add after the `tracksError` line:

```tsx
      {view.tracksLoading && <p role="status" className="text-muted">{TRACKS_LOADING}</p>}
```

**`MemberNotices.tsx`**:
1. Set the span's role to `n.kind === 'syncError' || n.kind === 'notFound' ? 'alert' : n.kind === 'bisLoading' ? 'status' : undefined`.
2. Set its class to `n.kind === 'untracked' || n.kind === 'bisLoading' ? 'text-muted' : 'text-[#f3c9a2]'`.

**`GroupGrid.tsx`**: change to `cellNote(m.state, m.hasRows, m.bisLoading)`.

**`src/app/characters/[id]/page.tsx`**: add `bisLoading={view.bisLoading}` to `GearTable`.

**`src/app/group/page.tsx`**: import `TRACKS_LOADING`. In the `view.members.length === 0 ? … : (…)` ternary, wrap the `GroupLayout` branch in a fragment with the status line first:

```tsx
        ) : (
          <>
            {view.tracksLoading && <p role="status" className="text-muted">{TRACKS_LOADING}</p>}
            <GroupLayout
              dungeonCount={view.priority.ranking?.dungeons.length ?? 0}
              legend={<StateLegend />}
              gear={<GroupGrid members={view.members} grid={view.grid} tracksKnown={view.tracksKnown} />}
              dungeons={<div className={PANEL_BOX}><GroupPriority priority={view.priority} /></div>}
              vault={<div className={PANEL_BOX}><GroupVault vault={view.vault} now={now} /></div>}
            />
          </>
        )}
```

- [ ] **Step 5: Run the gate**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green. Stop dev, then run `npm run build`. Expected: success.

- [ ] **Step 6: Commit**

```bash
git add src/components src/app
git commit -m "feat: show loading and unknown-track states while reference data syncs" -m "Without tracks, evaluate counts every match as done: card said done, rankings dropped approximate. Card keeps count only."
```

---

### Task 8: Hand checks and the pull request

**Files:** none changed unless a check fails.

- [ ] **Step 1: Run the full gate on the final commit**

Run: `npm run typecheck && npm run lint && npm test`, then stop dev and run `npm run build`.
Expected: all green. Record the test count.

- [ ] **Step 2: Hand checks** (local, with `.env`)

1. **Cold cache.** Point `DATABASE_URL` at a new file, such as `file:data/check-60.db`, start `npm run dev`, and track one character. Check that the home page, the character page and a group page with that character render at once with "Loading BiS list…" and "Loading upgrade track data…", then fill in without a reload. In the network tab, check that one `POST /api/reference/sync` is followed by a refresh.
2. **Compare as mid-sync.** On the character page, while the first sync is still running (throttle the network if needed), switch **Compare as** to a spec not loaded yet. Check that it fills in without a reload.
3. **Method down.** Temporarily point the Method source at a bad host, for example by editing the URL in `createMethodSource` locally without committing, and delete the stored lists or use a new database. Check that pages show "BiS list couldn’t be updated", and that reloads make one POST each with no loop. Revert the edit.
4. **Card with no tracks.** With lists stored and tracks missing (for example, block `raidbots.com`), check that the card shows `n / total`, a single-color bar, "Loading upgrade track data…" or the tracks error, and crest chips without upgrade text.

Record each result, and any check left to the owner, for the pull request's Testing section.

- [ ] **Step 3: Push and open the pull request**

Rebase on `origin/main` if it moved. Push `fix/refresh-off-render-path`, then open the pull request as AGENTS.md describes:
- `Closes #60.`
- `## What changes` bullets.
- `## Data`: one new meta key per spec and region, `tiers.<region>.<slug>.failedAt`; no schema change, no version bump.
- `## Testing`: the count, the gate, the hand checks, and the gaps, such as "no browser-level test of `BackgroundSync` re-arming".
- `Spec: docs/superpowers/specs/2026-10-07-refresh-off-render-path-design.md`.

Move #60 to In review.
