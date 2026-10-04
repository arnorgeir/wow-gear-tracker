# Group dungeon priority cards: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the group's dungeon priority as one card per ranked dungeon, with Raider.IO artwork and a mini card per need under each member, without changing the ranking.

**Architecture:** The Raider.IO season parser keeps each dungeon's `background_image_url` after normalizing it. `season_dungeons` stores it, the daily same-season check refreshes it, and `SeasonLoot` carries it with the short name. `getGroupPage` attaches the artwork to each `GroupDungeonView` by challenge-mode ID. `rankDungeons` never sees it. `GroupPriority` composes new server child components; only the thumbnail is a client component, because it handles image errors.

**Tech Stack:** Next.js (App Router), React 19 server components, Tailwind v4 (`@theme` in `src/app/globals.css`), Drizzle with libsql SQLite, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-03-group-dungeon-priority-design.md`. The spec wins where this plan disagrees.

## Global Constraints

- Branch: `feat/group-dungeon-priority`, from `docs/group-priority-spec` (or from `main` once that is merged).
- Scoring is untouched: no edits to `src/core/priority/rank.ts`, and no changed expectations in `src/core/priority/priority.test.ts` beyond fixture fields.
- Artwork URL accepted only when it is an absolute `https:` URL on host `cdn.raiderio.net`, without username or password; anything else is `null`.
- `SEASON_META_KEY` goes from `season.v1` to `season.v2`. `TRACKS_META_KEY` stays.
- Thumbnail: 64 × 48 CSS px, `object-cover`, `alt=""`, `loading="lazy"`, `decoding="async"`.
- Fallback tile: `bg-surface-2`, `border-line-strong`, short name in `font-mono text-muted`; blank short name shows `M+`; `aria-hidden="true"`.
- Dungeon title: `h3`, `font-display`, at least 18 px (`text-lg`), bold, wraps and never truncates.
- Card gaps: at least 16 px between dungeon cards, 12 px card padding, 12 px between member blocks, 8 px between mini cards.
- Mini item icon is 28 px. Tier text is `Tier via catalyst`; Any text is `Any item, level <min>+`. Slot labels show exactly as `slotLabel` supplies them.
- Keep the copy `Score = weighted upgrades`, the split warning copy, and every existing season and eligibility message.
- Every write goes through `withWriteLock`; never nest it. No `instanceof` on our errors.
- Fixture names: Birkibjörn, Hrafnhildur, Sólrún. No real players.
- Commit subjects `type: lowercase imperative summary`; prose bodies near 72 columns saying why; no AI attribution or co-author trailers.
- Before calling it done: `npm run typecheck && npm run lint && npm test`, then `npm run build` with no dev server on this folder.

## Review Focus

1. **Garbage artwork on a real season response** (missing field, `http:`, other host, a number). The season must still load with `null` artwork. Pinned in Task 1 and Task 2.
2. **An install upgrading from `season.v1` while Blizzard is down.** Old loot must stay readable with null artwork, the page shows stale, and the reload retries after an hour. Pinned in Task 3.
3. **A rank whose challenge-mode ID has no season row.** It keeps its place, with `shortName: ''` and the `M+` tile. Pinned in Task 4 and Task 6.
4. **An image that fails before hydration attaches `onError`.** Server-rendered `<img>` can error before React listens. The ref callback in Task 6 checks `complete && naturalWidth === 0`. There is no browser test setup, so this goes on the manual checklist in Task 7.
5. **A long unbroken item or dungeon name at 320 px.** It must wrap, not overflow the section. Markup uses `min-w-0` and `wrap-anywhere`; Task 5 pins that the full name is rendered without truncation, and Task 7's manual check covers the layout.

---

### Task 1: Keep Raider.IO dungeon artwork in the season parser

**Files:**
- Modify: `src/core/raiderio/season.ts`
- Test: `src/core/raiderio/season.test.ts`

**Interfaces:**
- Produces: `artworkUrl(value: unknown): string | null`; `RawSeason['dungeons'][number]` gains `background_image_url?: unknown`; `MainSeason['dungeons'][number]` gains `imageUrl: string | null`.

- [ ] **Step 1: Write the failing tests**

Add to `src/core/raiderio/season.test.ts` (import `artworkUrl` alongside the existing imports):

```ts
const ART = 'https://cdn.raiderio.net/images/dungeons/expansion11/base/alpha-hollow.jpg';

describe('artworkUrl', () => {
  it('keeps an HTTPS URL on Raider.IO’s CDN unchanged', () => {
    expect(artworkUrl(ART)).toBe(ART);
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['a number', 42],
    ['empty', ''],
    ['malformed', 'not a url'],
    ['HTTP', 'http://cdn.raiderio.net/images/a.jpg'],
    ['credential-bearing', 'https://user:pw@cdn.raiderio.net/images/a.jpg'],
    ['another host', 'https://evil.example/images/a.jpg'],
    ['a lookalike host', 'https://cdn.raiderio.net.evil.example/a.jpg'],
  ])('turns %s into null', (_label, value) => {
    expect(artworkUrl(value)).toBeNull();
  });
});
```

In the existing `pickMainSeason` test, give the fixture dungeon artwork and expect it through:

```ts
const dungeons: RawSeason['dungeons'] = [{ challenge_mode_id: 501, name: 'Alpha Hollow', short_name: 'AH', background_image_url: ART }];
// ...
expect(picked).toEqual({ slug: 'season-test-2', name: 'season-test-2', dungeons: [{ challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', imageUrl: ART }] });
```

Add a test that bad artwork never rejects the season:

```ts
it('keeps a dungeon whose artwork is unusable, with null artwork', () => {
  const picked = pickMainSeason([season('season-test-2', true, { eu: '2026-08-19T04:00:00Z' }, [
    { challenge_mode_id: 502, name: 'Streets of Beta', short_name: 'STRT', background_image_url: 'http://cdn.raiderio.net/x.jpg' },
    { challenge_mode_id: 503, name: 'Beta Gambit', short_name: 'GMBT' },
  ])], now);
  expect(picked!.dungeons.map((d) => [d.challengeModeId, d.imageUrl])).toEqual([[502, null], [503, null]]);
});
```

`ART` must be declared above `dungeons`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/core/raiderio/season.test.ts`
Expected: FAIL, `artworkUrl` is not exported, and `imageUrl` is missing from the picked season.

- [ ] **Step 3: Implement**

In `src/core/raiderio/season.ts`:

```ts
export interface RawSeason {
  slug: string;
  name: string;
  is_main_season: boolean;
  starts: Record<string, string | null>;
  dungeons: { challenge_mode_id: number; name: string; short_name: string; background_image_url?: unknown }[];
}

export interface MainSeason {
  slug: string;
  name: string;
  dungeons: { challengeModeId: number; name: string; shortName: string; imageUrl: string | null }[];
}

const ARTWORK_HOST = 'cdn.raiderio.net';

/**
 * A dungeon's artwork URL as Raider.IO gives it, or null for anything other than an HTTPS URL on
 * its CDN. A new host falls back to the placeholder until we choose to accept it.
 */
export function artworkUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== ARTWORK_HOST || url.username || url.password) return null;
  return value;
}
```

And in `pickMainSeason`:

```ts
dungeons: best.dungeons.map((d) => ({
  challengeModeId: d.challenge_mode_id, name: d.name, shortName: d.short_name, imageUrl: artworkUrl(d.background_image_url),
})),
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/core/raiderio/season.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/raiderio/season.ts src/core/raiderio/season.test.ts
git commit -m "feat: keep raider.io dungeon artwork in the season" -m "The group priority cards need a thumbnail per dungeon, and the season
response already carries one. Only HTTPS URLs on Raider.IO's CDN are
kept, so a bad value falls back to a placeholder instead of rejecting
the season or pointing the browser somewhere unexpected."
```

---

### Task 2: Store artwork with the season and carry it on `SeasonLoot`

**Files:**
- Modify: `src/core/db/schema.ts` (the `seasonDungeons` table)
- Create: `drizzle/0007_season-artwork.sql` (generated) and its `drizzle/meta` snapshot (generated)
- Modify: `src/core/db/queries/season.ts`
- Modify: `src/core/types.ts` (`SeasonLoot`)
- Modify: `src/core/sync/season-sync.ts` (`loadSeasonLoot` only)
- Modify fixtures: `src/core/priority/priority.test.ts`, `src/server/views/group-page.test.ts`
- Test: `src/core/db/queries/season.test.ts`, `src/core/sync/season-sync.test.ts`

**Interfaces:**
- Consumes: `MainSeason['dungeons'][number].imageUrl` from Task 1.
- Produces:
  - `SeasonDungeonRow` gains `imageUrl: string | null`.
  - `SeasonLoot` is `{ challengeModeId: number; name: string; shortName: string; imageUrl: string | null; split: boolean; loot: LootItem[] }`.
  - `updateSeasonArtwork(db: Db, slug: string, art: { challengeModeId: number; imageUrl: string | null }[]): Promise<void>` in `src/core/db/queries/season.ts`.

- [ ] **Step 1: Write the failing storage tests**

In `src/core/db/queries/season.test.ts`, give the fixture rows artwork (split halves 502 and 503 differ, 503 has none):

```ts
const AH = 'https://cdn.raiderio.net/images/dungeons/alpha-hollow.jpg';
const STRT = 'https://cdn.raiderio.net/images/dungeons/streets.jpg';
// dungeons:
{ challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', journalInstanceId: 901, mapId: 11, imageUrl: AH },
{ challengeModeId: 502, name: 'Streets of Beta', shortName: 'STRT', journalInstanceId: 902, mapId: 22, imageUrl: STRT },
{ challengeModeId: 503, name: 'Beta Gambit', shortName: 'GMBT', journalInstanceId: 902, mapId: 22, imageUrl: null },
```

Update the first test's expectation to include the new fields:

```ts
{ challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', imageUrl: AH, split: false, loot: [ /* unchanged */ ] },
{ challengeModeId: 503, name: 'Beta Gambit', shortName: 'GMBT', imageUrl: null, split: true, loot: [ /* unchanged */ ] },
{ challengeModeId: 502, name: 'Streets of Beta', shortName: 'STRT', imageUrl: STRT, split: true, loot: [ /* unchanged */ ] },
```

Add tests for the refresh query (import `updateSeasonArtwork`):

```ts
describe('updateSeasonArtwork', () => {
  it('replaces or clears artwork on matching rows only, and never adds rows', async () => {
    const db = await openTestDb();
    await replaceSeason(db, data);
    const NEW = 'https://cdn.raiderio.net/images/dungeons/alpha-hollow-v2.jpg';
    await updateSeasonArtwork(db, 'season-test-2', [
      { challengeModeId: 501, imageUrl: NEW },
      { challengeModeId: 502, imageUrl: null },
      { challengeModeId: 999, imageUrl: NEW },
    ]);
    const season = await getSeasonLoot(db);
    expect(season.map((d) => [d.challengeModeId, d.imageUrl])).toEqual([[501, NEW], [503, null], [502, null]]);
    expect(season[0]!.loot).toHaveLength(2);
  });

  it('leaves another season’s rows alone', async () => {
    const db = await openTestDb();
    await replaceSeason(db, data);
    await updateSeasonArtwork(db, 'season-test-3', [{ challengeModeId: 501, imageUrl: null }]);
    expect((await getSeasonLoot(db))[0]!.imageUrl).toBe(AH);
  });
});
```

- [ ] **Step 2: Write the failing full-load test**

In `src/core/sync/season-sync.test.ts`, let the Raider.IO fixture take artwork per challenge-mode ID. `JSON.stringify` drops `undefined`, so a missing entry means the field is absent:

```ts
const ART = {
  501: 'https://cdn.raiderio.net/images/dungeons/alpha-hollow.jpg',
  502: 'https://cdn.raiderio.net/images/dungeons/streets.jpg',
} as Record<number, unknown>;

const raiderIo = (art: Record<number, unknown> = ART) => fakeFetch([
  on('expansion_id=11', () => json({ seasons: [{
    slug: 'season-test-2', name: 'Test Season 2', is_main_season: true, starts: { eu: '2026-08-19T04:00:00Z' },
    dungeons: [
      { challenge_mode_id: 501, name: 'Alpha Hollow', short_name: 'AH', background_image_url: art[501] },
      { challenge_mode_id: 502, name: 'Streets of Beta', short_name: 'STRT', background_image_url: art[502] },
      { challenge_mode_id: 503, name: 'Beta Gambit', short_name: 'GMBT', background_image_url: art[503] },
    ],
  }] })),
  on('expansion_id=12', () => new Response('bad expansion', { status: 400 })),
]);
```

At the end of the first test (`joins each dungeon to its journal instance by map ID…`) add:

```ts
// Split halves share instance 902 but keep their own artwork.
expect(state.dungeons.map((x) => [x.challengeModeId, x.shortName, x.imageUrl])).toEqual([
  [501, 'AH', ART[501]], [503, 'GMBT', null], [502, 'STRT', ART[502]],
]);
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run src/core/db/queries/season.test.ts src/core/sync/season-sync.test.ts`
Expected: FAIL. Typecheck errors on `imageUrl` are expected too.

- [ ] **Step 4: Change the schema and generate the migration**

In `src/core/db/schema.ts`, add the column to `seasonDungeons` after `shortName`:

```ts
  shortName: text('short_name').notNull(),
  imageUrl: text('image_url'),
```

Run: `npm run db:generate -- --name season-artwork`
Expected: a new `drizzle/0007_season-artwork.sql` containing ``ALTER TABLE `season_dungeons` ADD `image_url` text;`` and an updated `drizzle/meta`. Do not edit earlier migrations.

- [ ] **Step 5: Implement the queries and type**

In `src/core/types.ts`:

```ts
export interface SeasonLoot { challengeModeId: number; name: string; shortName: string; imageUrl: string | null; split: boolean; loot: LootItem[] }
```

In `src/core/db/queries/season.ts`, change the imports to `import { and, asc, eq } from 'drizzle-orm';`, then:

```ts
export interface SeasonDungeonRow { challengeModeId: number; name: string; shortName: string; journalInstanceId: number; mapId: number; imageUrl: string | null }
```

In `getSeasonLoot`, add the two fields to each mapped dungeon:

```ts
  return dungeons.map((d) => ({
    challengeModeId: d.challengeModeId,
    name: d.name,
    shortName: d.shortName,
    imageUrl: d.imageUrl,
    split: dungeons.some((x) => x !== d && x.journalInstanceId === d.journalInstanceId),
    loot: /* unchanged */,
  }));
```

Add the refresh query:

```ts
/**
 * Refreshes stored artwork for the season already loaded, so a corrected URL reaches existing
 * installs without reloading loot. Rows it doesn't name keep theirs; it never adds a row.
 */
export async function updateSeasonArtwork(db: Db, slug: string, art: { challengeModeId: number; imageUrl: string | null }[]): Promise<void> {
  await withWriteLock(db, () => db.transaction(async (tx) => {
    for (const a of art) {
      await tx.update(seasonDungeons).set({ imageUrl: a.imageUrl })
        .where(and(eq(seasonDungeons.challengeModeId, a.challengeModeId), eq(seasonDungeons.seasonSlug, slug)));
    }
  }));
}
```

In `src/core/sync/season-sync.ts` `loadSeasonLoot`, carry the URL. In the first loop's `dungeons.push({...})` add `imageUrl: d.imageUrl`, and in the final `rows` mapping add `imageUrl: d.imageUrl`.

- [ ] **Step 6: Update the other fixtures for the wider types**

`src/core/priority/priority.test.ts` line 16:

```ts
const dungeon = (challengeModeId: number, name: string, items: LootItem[], split = false): SeasonLoot =>
  ({ challengeModeId, name, shortName: '', imageUrl: null, split, loot: items });
```

`src/server/views/group-page.test.ts` `season()` helper: add `imageUrl` to every dungeon row. Task 4 asserts on these values:

```ts
{ challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', journalInstanceId: 901, mapId: 11, imageUrl: 'https://cdn.raiderio.net/images/dungeons/alpha-hollow.jpg' },
{ challengeModeId: 502, name: 'Streets of Beta', shortName: 'SB', journalInstanceId: 902, mapId: 22, imageUrl: null },
{ challengeModeId: 503, name: 'Gambit of Beta', shortName: 'GB', journalInstanceId: 902, mapId: 23, imageUrl: 'https://cdn.raiderio.net/images/dungeons/gambit.jpg' },
{ challengeModeId: 504, name: 'Delta Deep', shortName: 'DD', journalInstanceId: 904, mapId: 44, imageUrl: null },
```

Run `npm run typecheck` and fix any other `SeasonLoot` or `SeasonDungeonRow` literal it reports the same way: `shortName` and `imageUrl` only, no logic changes.

- [ ] **Step 7: Run the tests to see them pass**

Run: `npm run typecheck && npx vitest run src/core`
Expected: PASS, including every `src/core/priority` test with unchanged expectations.

- [ ] **Step 8: Commit**

```bash
git add src/core drizzle src/server/views/group-page.test.ts
git commit -m "feat: store dungeon artwork with the season" -m "The season row keeps the artwork URL beside the short name, so the
group page can show a thumbnail without asking Raider.IO on every
render. Each split half keeps its own URL, keyed by its challenge mode,
while still sharing its instance's loot."
```

---

### Task 3: Reload v1 seasons and refresh artwork on the daily check

**Files:**
- Modify: `src/core/sync/season-sync.ts`
- Test: `src/core/sync/season-sync.test.ts`

**Interfaces:**
- Consumes: `updateSeasonArtwork` from Task 2; `MainSeason.dungeons[].imageUrl` from Task 1.
- Produces: `SEASON_META_KEY === 'season.v2'`. `syncSeason` results are unchanged: a same-season check still returns `'current'`.

- [ ] **Step 1: Write the failing tests**

Add to `describe('syncSeason')` in `src/core/sync/season-sync.test.ts`. Add `import { getMeta, setMeta } from '../db/queries/meta';`, `import { replaceSeason } from '../db/queries/season';`, and `SEASON_META_KEY` to the `./season-sync` import.

```ts
it('refreshes artwork on the daily check without reloading loot', async () => {
  const { blizzard, calls } = fakeBlizzard();
  const d = await deps(blizzard);
  await syncSeason(d);
  const NEW = 'https://cdn.raiderio.net/images/dungeons/alpha-hollow-v2.jpg';
  // 501 changes, 502's field turns invalid, 503 gains nothing.
  const changed = raiderIo({ 501: NEW, 502: 'http://cdn.raiderio.net/streets.jpg' });
  const later = T + DAY_MS + 1;
  expect(await syncSeason({ ...d, fetchFn: changed.fn, now: later })).toBe('current');
  const state = await readSeason(d.db, later);
  expect(state.dungeons.map((x) => [x.challengeModeId, x.imageUrl])).toEqual([[501, NEW], [503, null], [502, null]]);
  expect(state.dungeons[0]!.loot).toHaveLength(2);
  expect(calls.index).toBe(1);
  expect([...calls.encounters].sort()).toEqual([1, 2, 3]);
});

it('keeps a stored dungeon’s artwork when the response leaves that dungeon out, and adds no rows', async () => {
  const { blizzard } = fakeBlizzard();
  const d = await deps(blizzard);
  await syncSeason(d);
  const fewer = fakeFetch([on('static-data', () => json({ seasons: [{
    slug: 'season-test-2', name: 'Test Season 2', is_main_season: true, starts: { eu: '2026-08-19T04:00:00Z' },
    dungeons: [{ challenge_mode_id: 777, name: 'Lost Vault', short_name: 'LV', background_image_url: ART[501] }],
  }] }))]);
  const later = T + DAY_MS + 1;
  expect(await syncSeason({ ...d, fetchFn: fewer.fn, now: later })).toBe('current');
  const state = await readSeason(d.db, later);
  expect(state.dungeons.map((x) => [x.challengeModeId, x.imageUrl])).toEqual([[501, ART[501]], [503, null], [502, ART[502]]]);
});

it('keeps artwork and loot when Raider.IO fails on the daily check', async () => {
  const { blizzard } = fakeBlizzard();
  const d = await deps(blizzard);
  await syncSeason(d);
  const down = fakeFetch([on('static-data', () => new Response('down', { status: 503 }))]);
  const later = T + DAY_MS + 1;
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(await syncSeason({ ...d, fetchFn: down.fn, now: later })).toBe('failed');
  logged.mockRestore();
  const state = await readSeason(d.db, later);
  expect(state.status).toBe('stale');
  expect(state.dungeons[0]).toMatchObject({ challengeModeId: 501, imageUrl: ART[501] });
  expect(state.dungeons[0]!.loot).toHaveLength(2);
});

it('reloads a season stored under the v1 key even though its slug is unchanged', async () => {
  const { blizzard, calls } = fakeBlizzard();
  const d = await deps(blizzard);
  await replaceSeason(d.db, { slug: 'season-test-2', dungeons: [
    { challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', journalInstanceId: 901, mapId: 11, imageUrl: null },
  ], loot: [] });
  await setMeta(d.db, 'season.v1', 'season-test-2', T - 1000);
  expect(SEASON_META_KEY).toBe('season.v2');
  expect(await syncSeason(d)).toBe('loaded');
  expect(calls.index).toBe(1);
  expect((await getMeta(d.db, SEASON_META_KEY))?.value).toBe('season-test-2');
  expect((await readSeason(d.db, T)).dungeons[0]!.imageUrl).toBe(ART[501]);
});

it('keeps v1 loot readable with null artwork when the v2 reload fails, and backs off', async () => {
  const bad = fakeBlizzard({ getJournalInstances: async () => { throw new Error('Blizzard is down'); } });
  const d = await deps(bad.blizzard);
  await replaceSeason(d.db, { slug: 'season-test-2', dungeons: [
    { challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', journalInstanceId: 901, mapId: 11, imageUrl: null },
  ], loot: [{ challengeModeId: 501, encounterId: 1, encounterName: 'Hollow King', itemId: 100, itemName: 'Hollow Robe', inventoryType: 'ROBE', armorType: 'leather' }] });
  await setMeta(d.db, 'season.v1', 'season-test-2', T - 1000);
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(await syncSeason(d)).toBe('failed');
  logged.mockRestore();
  const state = await readSeason(d.db, T);
  expect(state).toMatchObject({ status: 'stale', needsSync: false });
  expect(state.dungeons[0]).toMatchObject({ challengeModeId: 501, imageUrl: null });
  expect(state.dungeons[0]!.loot).toHaveLength(1);
  expect(await syncSeason({ ...d, now: T + 60_000 })).toBe('skipped');
  expect(await getMeta(d.db, SEASON_META_KEY)).toBeNull();
});
```

The existing test `skips within a day, and only rechecks the slug after one` already pins that nothing is refreshed within the interval. Keep it.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/core/sync/season-sync.test.ts`
Expected: FAIL. The refresh test keeps the old URL, and the v1 tests return `'loaded'` with key `season.v1`, or fail the key assertion.

- [ ] **Step 3: Implement**

In `src/core/sync/season-sync.ts`:

```ts
export const SEASON_META_KEY = 'season.v2';
```

Import `updateSeasonArtwork` from `'../db/queries/season'`. In `runSync`, replace the same-slug branch:

```ts
    if (loaded?.value === season.slug) {
      // Same season: only artwork can have moved, so refresh it without rebuilding loot.
      await updateSeasonArtwork(db, season.slug, season.dungeons);
      await setMeta(db, SEASON_META_KEY, season.slug, now);
      return 'current';
    }
```

A failure inside `updateSeasonArtwork` throws into the existing `catch`, which records the failure, so the check is only marked done after the write succeeds.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/core/sync`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/sync
git commit -m "feat: refresh season artwork on the daily check" -m "Bumping the season cache to v2 makes every install reload once to pick
up artwork, while old loot stays readable if that reload fails. After
that, the daily same-season check rewrites only the artwork URLs, so a
fixed URL from Raider.IO reaches existing installs without a loot
rebuild."
```

---

### Task 4: Give each group dungeon view its artwork

**Files:**
- Create: `src/server/views/dungeon-art.ts`
- Create: `src/server/views/dungeon-art.test.ts`
- Modify: `src/server/views/types.ts` (`GroupDungeonView`)
- Modify: `src/server/views/group-page.ts`
- Test: `src/server/views/group-page.test.ts`

**Interfaces:**
- Consumes: `SeasonLoot.shortName` and `SeasonLoot.imageUrl` from Task 2.
- Produces:
  - `dungeonArt(dungeons: SeasonLoot[], challengeModeId: number): { shortName: string; imageUrl: string | null }`.
  - `GroupDungeonView` is `{ challengeModeId: number; name: string; shortName: string; imageUrl: string | null; score: number; split: boolean; members: GroupMemberCreditsView[] }`.

- [ ] **Step 1: Write the failing tests**

`src/server/views/dungeon-art.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { SeasonLoot } from '@/core/types';
import { dungeonArt } from './dungeon-art';

const AH = 'https://cdn.raiderio.net/images/dungeons/alpha-hollow.jpg';
const season: SeasonLoot[] = [
  { challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', imageUrl: AH, split: false, loot: [] },
  { challengeModeId: 502, name: 'Streets of Beta', shortName: 'STRT', imageUrl: null, split: true, loot: [] },
];

describe('dungeonArt', () => {
  it('finds artwork by challenge mode ID', () => {
    expect(dungeonArt(season, 501)).toEqual({ shortName: 'AH', imageUrl: AH });
    expect(dungeonArt(season, 502)).toEqual({ shortName: 'STRT', imageUrl: null });
  });

  it('gives an unmatched dungeon the fallback instead of dropping it', () => {
    expect(dungeonArt(season, 999)).toEqual({ shortName: '', imageUrl: null });
  });
});
```

In `src/server/views/group-page.test.ts`, in the test `ranks for the group with credits per member and keeps split dungeons marked`, after its existing assertions, add a check that artwork follows challenge-mode ID even though the ranking order differs from the season's name order:

```ts
const art: Record<number, [string, string | null]> = {
  501: ['AH', 'https://cdn.raiderio.net/images/dungeons/alpha-hollow.jpg'],
  502: ['SB', null],
  503: ['GB', 'https://cdn.raiderio.net/images/dungeons/gambit.jpg'],
  504: ['DD', null],
};
expect(priority.ranking!.dungeons.length).toBeGreaterThan(0);
for (const d of priority.ranking!.dungeons) expect([d.shortName, d.imageUrl]).toEqual(art[d.challengeModeId]);
```

If that test names the view something other than `priority`, use its variable. The test's existing assertions on score, order, members, credits and `split` stay as they are.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/server/views/dungeon-art.test.ts src/server/views/group-page.test.ts`
Expected: FAIL. The module is missing, and `shortName` is undefined on the views.

- [ ] **Step 3: Implement**

`src/server/views/dungeon-art.ts`:

```ts
import type { SeasonLoot } from '@/core/types';

/** A ranked dungeon's artwork, looked up by challenge mode. A rank the season doesn't list keeps its place with the placeholder. */
export function dungeonArt(dungeons: SeasonLoot[], challengeModeId: number): { shortName: string; imageUrl: string | null } {
  const dungeon = dungeons.find((d) => d.challengeModeId === challengeModeId);
  return { shortName: dungeon?.shortName ?? '', imageUrl: dungeon?.imageUrl ?? null };
}
```

`src/server/views/types.ts`:

```ts
export interface GroupDungeonView { challengeModeId: number; name: string; shortName: string; imageUrl: string | null; score: number; split: boolean; members: GroupMemberCreditsView[] }
```

`src/server/views/group-page.ts`: import `dungeonArt` from `'./dungeon-art'`, and in the ranking mapping add the spread after `name`:

```ts
        dungeons: ranks.filter((d) => d.score > 0).map((d) => ({
          challengeModeId: d.challengeModeId,
          name: d.name,
          ...dungeonArt(season.dungeons, d.challengeModeId),
          score: d.score,
          split: d.split,
          members: /* unchanged */,
        })),
```

- [ ] **Step 4: Run them to see them pass**

Run: `npm run typecheck && npx vitest run src/server`
Expected: typecheck fails only in `src/components/group-priority/GroupPriority.test.ts` (fixtures lack the new fields), and server tests pass. Fix that test file's fixtures now by adding `shortName` and `imageUrl: null` to each dungeon literal. Task 6 rewrites those tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/views src/components/group-priority/GroupPriority.test.ts
git commit -m "feat: pass dungeon artwork to the group priority view" -m "Artwork is looked up by challenge mode while mapping ranks to views,
so the ranking engine never sees presentation data. A rank the season
doesn't list still shows, with the placeholder tile."
```

---

### Task 5: Mini credit cards under each member

**Files:**
- Create: `src/components/group-priority/credit-text.ts`
- Create: `src/components/group-priority/credit-text.test.ts`
- Create: `src/components/group-priority/CreditCard.tsx`
- Create: `src/components/group-priority/CreditCard.test.ts`
- Create: `src/components/group-priority/MemberNeeds.tsx`

**Interfaces:**
- Consumes: `PriorityCreditView`, `GroupMemberCreditsView` (unchanged); `QUALITY_STYLES` from `@/components/item-card/quality-styles`; `wowheadData` from `@/components/item-card/wowhead`; `CharacterAvatar` from `@/components/character-avatar/CharacterAvatar`.
- Produces:
  - `needText(credit: Exclude<PriorityCreditView, { kind: 'item' }>): string`.
  - `CreditCard({ credit }: { credit: PriorityCreditView })`, a server component.
  - `MemberNeeds({ member }: { member: GroupMemberCreditsView })`, a server component.

- [ ] **Step 1: Write the failing tests**

`src/components/group-priority/credit-text.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { needText } from './credit-text';

describe('needText', () => {
  it('names a tier need and an Any need with its real minimum', () => {
    expect(needText({ kind: 'tier', slotLabel: 'Chest', weight: 5 })).toBe('Tier via catalyst');
    expect(needText({ kind: 'any', slotLabel: 'Feet', weight: 3, minItemLevel: 341 })).toBe('Any item, level 341+');
  });
});
```

`src/components/group-priority/CreditCard.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PriorityCreditView } from '@/server/views/types';
import { CreditCard } from './CreditCard';

const render = (credit: PriorityCreditView) => renderToStaticMarkup(createElement(CreditCard, { credit }));
const LONG = 'Ceremonialbracersofthehollowkingwhoneverstopsspeakingaboutthemarket';
const item = (iconUrl: string | null): PriorityCreditView => ({
  kind: 'item', slotLabel: 'Ring 2', weight: 4,
  item: { itemId: 101, name: LONG, itemLevel: null, quality: 'EPIC', bonusIds: [10, 20], iconUrl, trackLabel: null },
});

describe('CreditCard', () => {
  it('links a named item to Wowhead with its bonus IDs, icon, full name and slot', () => {
    const html = render(item('https://render.worldofwarcraft.com/icons/56/band.jpg'));
    expect(html).toContain('href="https://www.wowhead.com/item=101"');
    expect(html).toContain('data-wowhead="item=101&amp;bonus=10:20"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
    expect(html).toContain('src="https://render.worldofwarcraft.com/icons/56/band.jpg"');
    expect(html).toContain(LONG);
    expect(html).toContain('Ring 2');
    expect(html).not.toContain('truncate');
    expect(html).not.toContain('ilvl=');
    expect(html).toContain('focus-visible:');
  });

  it('gives a named item without an icon a decorative placeholder', () => {
    const html = render(item(null));
    expect(html).not.toContain('<img');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(LONG);
  });

  it('shows tier and Any needs as plain cards with their slot, without a link or an item ID', () => {
    for (const credit of [
      { kind: 'tier', slotLabel: 'Chest', weight: 5 },
      { kind: 'any', slotLabel: 'Feet', weight: 3, minItemLevel: 334 },
    ] satisfies PriorityCreditView[]) {
      const html = render(credit);
      expect(html).not.toContain('<a');
      expect(html).not.toContain('wowhead');
      expect(html).not.toContain('<img');
      expect(html).toContain(credit.slotLabel);
    }
    expect(render({ kind: 'any', slotLabel: 'Feet', weight: 3, minItemLevel: 334 })).toContain('Any item, level 334+');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/group-priority/credit-text.test.ts src/components/group-priority/CreditCard.test.ts`
Expected: FAIL, the modules are missing.

- [ ] **Step 3: Implement**

`src/components/group-priority/credit-text.ts`:

```ts
import type { PriorityCreditView } from '@/server/views/types';

/** What a tier or Any need asks for. A named item shows its own name instead. */
export const needText = (credit: Exclude<PriorityCreditView, { kind: 'item' }>): string =>
  (credit.kind === 'tier' ? 'Tier via catalyst' : `Any item, level ${credit.minItemLevel}+`);
```

`src/components/group-priority/CreditCard.tsx`:

```tsx
import { QUALITY_STYLES } from '@/components/item-card/quality-styles';
import { wowheadData } from '@/components/item-card/wowhead';
import type { PriorityCreditView } from '@/server/views/types';
import { needText } from './credit-text';

const CARD = 'flex min-w-0 max-w-full items-center gap-2 rounded-lg border px-2 py-1.5';
const NAME = 'text-sm font-semibold wrap-anywhere';
const SLOT = 'text-xs text-muted wrap-anywhere';

/** One need: a named item links to Wowhead; tier and Any needs are plain cards, never buttons or links. */
export function CreditCard({ credit }: { credit: PriorityCreditView }) {
  if (credit.kind === 'item') {
    const { item } = credit;
    const q = QUALITY_STYLES[item.quality] ?? QUALITY_STYLES.COMMON;
    return (
      <a href={`https://www.wowhead.com/item=${item.itemId}`} data-wowhead={wowheadData(item.itemId, item.bonusIds, null)}
        target="_blank" rel="noreferrer" title={`weight ${credit.weight}`}
        className={`${CARD} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold`}
        style={{ background: q.bg, borderColor: q.border }}>
        {item.iconUrl
          ? <img src={item.iconUrl} alt="" width={28} height={28} className="size-7 shrink-0 rounded border" style={{ borderColor: q.ring }} />
          : <span aria-hidden="true" className="size-7 shrink-0 rounded border border-line-strong bg-surface-2" />}
        <span className="flex min-w-0 flex-col">
          <span className={NAME} style={{ color: q.text }}>{item.name}</span>
          <span className={SLOT}>{credit.slotLabel}</span>
        </span>
      </a>
    );
  }
  return (
    <div title={`weight ${credit.weight}`} className={`${CARD} border-line bg-surface-2`}>
      <span className="flex min-w-0 flex-col">
        <span className={NAME}>{needText(credit)}</span>
        <span className={SLOT}>{credit.slotLabel}</span>
      </span>
    </div>
  );
}
```

`src/components/group-priority/MemberNeeds.tsx`:

```tsx
import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import type { GroupMemberCreditsView } from '@/server/views/types';
import { CreditCard } from './CreditCard';

/** A member's needs from one dungeon: one card per credit, in the ranking's order. */
export function MemberNeeds({ member }: { member: GroupMemberCreditsView }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <CharacterAvatar name={member.name} className={member.className} avatarUrl={member.avatarUrl} classIconUrl={member.classIconUrl} size={24} />
        <span className="min-w-0 font-semibold wrap-anywhere">{member.name}</span>
      </div>
      <ul className="flex flex-wrap gap-2">
        {member.credits.map((c, j) => <li key={j} className="min-w-0 max-w-full"><CreditCard credit={c} /></li>)}
      </ul>
    </div>
  );
}
```

`wrap-anywhere` is Tailwind v4's `overflow-wrap: anywhere` utility. If the build CSS doesn't contain it, use `[overflow-wrap:anywhere]` instead.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/components/group-priority`
Expected: PASS. `GroupPriority.test.ts` still passes because nothing renders the new components yet.

- [ ] **Step 5: Commit**

```bash
git add src/components/group-priority
git commit -m "feat: add mini need cards for the group priority" -m "Each need gets a small card with its slot always visible, instead of a
run of inline links whose slot only showed on hover. Named items keep
their Wowhead link and quality colors; tier and Any needs stay plain
text so they don't look clickable."
```

---

### Task 6: Dungeon cards with thumbnails in the priority section

**Files:**
- Create: `src/components/group-priority/thumbnail-label.ts`
- Create: `src/components/group-priority/thumbnail-label.test.ts`
- Create: `src/components/group-priority/DungeonThumbnail.tsx` (client)
- Create: `src/components/group-priority/DungeonCard.tsx`
- Modify: `src/components/group-priority/GroupPriority.tsx`
- Test: `src/components/group-priority/GroupPriority.test.ts`

**Interfaces:**
- Consumes: `GroupDungeonView` with `shortName` and `imageUrl` (Task 4); `MemberNeeds` (Task 5); `SPLIT_DUNGEON` from `@/components/shared/priority-copy`.
- Produces:
  - `thumbnailLabel(shortName: string): string`.
  - `DungeonThumbnail({ imageUrl, shortName }: { imageUrl: string | null; shortName: string })`.
  - `DungeonCard({ dungeon, rank }: { dungeon: GroupDungeonView; rank: number })`.

- [ ] **Step 1: Write the failing tests**

`src/components/group-priority/thumbnail-label.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { thumbnailLabel } from './thumbnail-label';

describe('thumbnailLabel', () => {
  it('uses the short name, or M+ when it is blank', () => {
    expect(thumbnailLabel('STRT')).toBe('STRT');
    expect(thumbnailLabel('')).toBe('M+');
    expect(thumbnailLabel('  ')).toBe('M+');
  });
});
```

In `src/components/group-priority/GroupPriority.test.ts`, add a dungeon helper below `credits` and these tests. Keep every existing test, giving their dungeon literals `shortName` and `imageUrl` as Task 4 did.

```ts
const AH = 'https://cdn.raiderio.net/images/dungeons/alpha-hollow.jpg';
const dungeon = (over: Partial<GroupDungeonView>): GroupDungeonView => ({
  challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', imageUrl: AH, score: 5, split: false,
  members: [{ ...credits, credits: [{ kind: 'tier', slotLabel: 'Chest', weight: 5 }] }], ...over,
});
const band: PriorityCreditView = { kind: 'item', slotLabel: 'Ring 1', weight: 4,
  item: { itemId: 101, name: 'Vanished Band', itemLevel: null, quality: 'EPIC', bonusIds: [], iconUrl: null, trackLabel: null } };

it('gives each ranked dungeon its own card and heading, in rank order', () => {
  const html = render({ ...base, ranking: { nothingFrom: [], dungeons: [
    dungeon({ challengeModeId: 501, name: 'Alpha Hollow', score: 8 }),
    dungeon({ challengeModeId: 502, name: 'Streets of Beta', score: 3 }),
  ] } });
  expect(html).toContain('<ol');
  expect(html.match(/<article/g)).toHaveLength(2);
  expect(html.match(/<h3/g)).toHaveLength(2);
  expect(html.indexOf('Alpha Hollow')).toBeLessThan(html.indexOf('Streets of Beta'));
  expect(html).toMatch(/Score<\/span> 8/);
  expect(html).toContain('Score = weighted upgrades');
});

it('shows a lazy decorative thumbnail, or the short-name tile without one', () => {
  const html = render({ ...base, ranking: { nothingFrom: [], dungeons: [
    dungeon({ challengeModeId: 501 }),
    dungeon({ challengeModeId: 502, name: 'Streets of Beta', shortName: 'STRT', imageUrl: null }),
    dungeon({ challengeModeId: 503, name: 'Unlisted Depths', shortName: '', imageUrl: null }),
  ] } });
  expect(html).toContain(`src="${AH}"`);
  expect(html).toMatch(/<img[^>]*alt=""[^>]*width="64"[^>]*height="48"[^>]*loading="lazy"/);
  expect(html).toContain('decoding="async"');
  expect(html).toMatch(/aria-hidden="true"[^>]*>STRT</);
  expect(html).toMatch(/aria-hidden="true"[^>]*>M\+</);
});

it('lists each member under their name, one card per need, with slots visible', () => {
  const html = render({ ...base, ranking: { nothingFrom: [], dungeons: [dungeon({ members: [
    { ...credits, credits: [band, { kind: 'any', slotLabel: 'Feet', weight: 3, minItemLevel: 334 }] },
    { ...credits, key: 'eu.argent-dawn.hrafnhildur', name: 'Hrafnhildur', credits: [band] },
  ] })] } });
  expect(html.match(/Vanished Band/g)).toHaveLength(2);
  expect(html).toContain('Ring 1');
  expect(html).toContain('Feet');
  expect(html.indexOf('Birkibjörn')).toBeLessThan(html.indexOf('Any item, level 334+'));
  expect(html.indexOf('Any item, level 334+')).toBeLessThan(html.indexOf('Hrafnhildur'));
});

it('keeps two members with the same display name apart', () => {
  const html = render({ ...base, ranking: { nothingFrom: [], dungeons: [dungeon({ members: [
    { ...credits, credits: [band] },
    { ...credits, key: 'eu.silvermoon.birkibjörn', credits: [band] },
  ] })] } });
  expect(html.match(/Vanished Band/g)).toHaveLength(2);
  expect(html.match(/>Birkibjörn</g)).toHaveLength(2);
});

it('puts the split warning inside its own dungeon’s card, above its members', () => {
  const html = render({ ...base, ranking: { nothingFrom: [], dungeons: [
    dungeon({ challengeModeId: 501 }),
    dungeon({ challengeModeId: 502, name: 'Streets of Beta', split: true }),
  ] } });
  const split = html.indexOf('Split dungeon');
  expect(split).toBeGreaterThan(html.indexOf('Streets of Beta'));
  expect(split).toBeLessThan(html.lastIndexOf('Birkibjörn'));
  expect(html.match(/Split dungeon/g)).toHaveLength(1);
});
```

Add `GroupDungeonView` and `PriorityCreditView` to the `@/server/views/types` import.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/group-priority`
Expected: FAIL: no `<article>`, no `<h3>`, no thumbnail, and `thumbnail-label` is missing.

- [ ] **Step 3: Implement**

`src/components/group-priority/thumbnail-label.ts`:

```ts
/** The placeholder tile's text: the dungeon's short name, or M+ when Raider.IO gave none. */
export const thumbnailLabel = (shortName: string): string => shortName.trim() || 'M+';
```

`src/components/group-priority/DungeonThumbnail.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { thumbnailLabel } from './thumbnail-label';

const BOX = 'h-12 w-16 shrink-0 rounded-md';

/**
 * Decorative: the title beside it names the dungeon. A missing or broken image becomes the
 * short-name tile. Remembering which URL failed lets a new URL from a later refresh load.
 */
export function DungeonThumbnail({ imageUrl, shortName }: { imageUrl: string | null; shortName: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!imageUrl || failedUrl === imageUrl) {
    return (
      <span aria-hidden="true" className={`${BOX} flex items-center justify-center border border-line-strong bg-surface-2 font-mono text-xs text-muted`}>
        {thumbnailLabel(shortName)}
      </span>
    );
  }
  return (
    <img src={imageUrl} alt="" width={64} height={48} loading="lazy" decoding="async" className={`${BOX} object-cover`}
      onError={() => setFailedUrl(imageUrl)}
      // A server-rendered image can fail before hydration attaches onError; catch that on mount.
      ref={(el) => { if (el?.complete && el.naturalWidth === 0) setFailedUrl(imageUrl); }} />
  );
}
```

`src/components/group-priority/DungeonCard.tsx`:

```tsx
import { SPLIT_DUNGEON } from '@/components/shared/priority-copy';
import type { GroupDungeonView } from '@/server/views/types';
import { DungeonThumbnail } from './DungeonThumbnail';
import { MemberNeeds } from './MemberNeeds';

/** One ranked dungeon: rank, thumbnail, title and score, then each benefiting member's needs. */
export function DungeonCard({ dungeon, rank }: { dungeon: GroupDungeonView; rank: number }) {
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-xl border border-line-strong bg-raised p-3">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="w-6 shrink-0 font-mono text-muted">{rank}</span>
        <DungeonThumbnail imageUrl={dungeon.imageUrl} shortName={dungeon.shortName} />
        <h3 className="min-w-0 flex-1 basis-40 font-display text-lg font-bold wrap-anywhere">{dungeon.name}</h3>
        <p className="ml-auto font-mono text-gold"><span className="font-sans text-xs text-muted">Score</span> {dungeon.score}</p>
      </header>
      {dungeon.split && <p className="text-xs text-muted">{SPLIT_DUNGEON}</p>}
      <div className="flex flex-col gap-3">
        {dungeon.members.map((m) => <MemberNeeds key={m.key} member={m} />)}
      </div>
    </article>
  );
}
```

`src/components/group-priority/GroupPriority.tsx`: delete the `Credit` component, and the `CharacterAvatar`, `wowheadData` and `SPLIT_DUNGEON` imports (keep the other `priority-copy` imports). Import `DungeonCard` from `'./DungeonCard'` and `PriorityCreditView` is no longer needed. Replace the `<ol>…</ol>` in `Ranking` with:

```tsx
      <ol className="flex flex-col gap-4">
        {dungeons.map((d, i) => <li key={d.challengeModeId} className="min-w-0"><DungeonCard dungeon={d} rank={i + 1} /></li>)}
      </ol>
```

Leave everything else in `GroupPriority.tsx` unchanged: headings, messages, `nothingFrom` and section container.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/components`
Expected: PASS, including every earlier `GroupPriority` state test and `DungeonPriority.test.ts` for the character page.

- [ ] **Step 5: Commit**

```bash
git add src/components/group-priority
git commit -m "feat: show the group priority as dungeon cards" -m "Each ranked dungeon is its own card with a thumbnail, a real heading and
its score, so dungeons no longer blur together in one long list. A
missing or broken image turns into the dungeon's short name, and the
ranking itself is unchanged."
```

---

### Task 7: Verify the whole branch

**Files:** none changed unless a check fails.

- [ ] **Step 1: Run the gate**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all clean. Note the test count for the pull request.

- [ ] **Step 2: Build**

Stop any `npm run dev` serving this folder first, or build in a separate worktree (see `AGENTS.md`).
Run: `npm run build`
Expected: success. Confirm `wrap-anywhere` produced CSS: `grep -r "overflow-wrap:anywhere" .next/static/css`. If it is missing, switch the class to `[overflow-wrap:anywhere]` in `CreditCard.tsx`, `MemberNeeds.tsx` and `DungeonCard.tsx`, rerun the gate, and commit that as a new commit, `fix: wrap long names in the priority cards`.

- [ ] **Step 3: Confirm no extra requests on render**

Run `npm run dev` and open a group page. In the dev server log and the browser network panel, a page render makes no Raider.IO request beyond the existing season sync. Thumbnails load from `cdn.raiderio.net` directly in the browser.

- [ ] **Step 4: Manual checks for the pull request's Testing section**

There is no browser test setup, so check these by hand and record them:

- With a five-member group and long names at 320, 375, 768, 1024 and 1440 px: cards stay distinct, nothing overlaps, and the section adds no page-level horizontal scroll. At 1024 px, check the half-width column beside the vault. The gear grid's own sideways scroll and the priority/vault layout are unchanged.
- Dungeon titles stand out from member names, and every mini card clearly sits under its member.
- Block a thumbnail request in devtools, reload, and confirm the short-name tile with no broken-image glyph. This exercises the before-hydration path. Then do the same with a URL nulled in the database.
- Tab through named-item cards: focus is visible, and tooltips and links work. Tier and Any cards get no tab stop.
- A split warning stays inside its dungeon's card; the stale, partial and approximate messages read well above the list.
- A real Raider.IO thumbnail crops acceptably at 64 × 48.

- [ ] **Step 5: Hand off**

Open the pull request with `Closes #67.`, `## What changes`, `## Data` (new `image_url` column, migration `0007_season-artwork`, `SEASON_META_KEY` to `season.v2`), `## Testing` with the gaps above, and `Spec: docs/superpowers/specs/2026-10-03-group-dungeon-priority-design.md`. No AI attribution.
