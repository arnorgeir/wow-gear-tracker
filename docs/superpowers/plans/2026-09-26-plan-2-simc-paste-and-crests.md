# Plan 2: SimC paste, crests and upgrade flags

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users paste a SimulationCraft export to update a character's gear instantly, with bag and Great Vault items, and show crest balances and which BiS items can be upgraded right now.

**Architecture:** A pure SimC parser and pure crest logic live in `src/core`. An import module validates a paste against the character, resolves item quality and tier from Raidbots bonus data and Blizzard item details, and saves a `simc` snapshot with its currencies. Snapshots become source-aware: a Blizzard sync only replaces a pasted snapshot when Blizzard's own data changes. View models and pages gain crests, upgrade flags, bag detection and vault choices.

**Tech Stack:** Same as plan 1: Next.js 16, React 19, TypeScript 5, Drizzle ORM with libsql, Vitest, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-09-26-gear-tracker-design.md`, sections "SimC paste", "Crests and upgrade flags", "Item quality" and "Great Vault list".

**Plan series:** Plan 2 of 3. Builds on plan 1, which is merged into `main`. Closes issue #2.

## Global Constraints

- Everything in plan 1's Global Constraints still applies.
- Every database write goes through `withWriteLock` in `src/core/db/queries.ts`. libsql's driver is synchronous, so an unlocked write can block the event loop.
- Crest counts come only from SimC pastes. Blizzard's API has no currencies.
- Upgrade costs are keyed by Raidbots' track `group`, never by track name: names like "Myth" repeat across seasons with different crests.
- Only BiS items get "can upgrade" flags. Non-BiS items never do.
- A SimC paste always becomes the current snapshot, unless it's identical to the current one. A Blizzard sync replaces a SimC snapshot only when Blizzard's gear differs from the last Blizzard snapshot.
- SimC fixtures use made-up character names.
- Commit messages never mention AI tools.

## Review Focus

1. **SimC text pasted from Windows or chat apps,** with CRLF line endings or leading spaces: it must parse the same as clean text. Pinned in Task 2.
2. **A paste from another character,** or the same name on another realm or region: reject it and name the field that differs. Realm tokens like `azjolnerub` must still match "Azjol-Nerub". Pinned in Task 6.
3. **A partial or wrong paste,** such as only the gear lines, an empty box, or a random log: a clear error, never a crash or an empty snapshot. Pinned in Tasks 2, 6 and 7.
4. **Pasting, then syncing again before logging out:** the paste must stay current, and the crests must not disappear. Pinned in Tasks 4 and 8.
5. **Crest math at the edges:** an item at max step, a balance below one step's cost, or a track with no cost data must never show a flag. Pinned in Task 3.

---

## File structure

```
src/core/
  types.ts                      Track gains group and currencyName
  raidbots/tracks.ts            + bonus qualities, RaidbotsData fetcher
  simc/parse.ts                 SimC text to a profile (pure)
  simc/__fixtures__/export.txt  sample export with a made-up name
  simc/import-simc.ts           validate a paste and save a simc snapshot
  gear/crests.ts                crest costs, affordable upgrades, balances (pure)
  blizzard/client.ts            + getItemDetails (quality and tier)
  db/schema.ts                  + track columns, bonus_qualities, snapshot_currencies, item_details
  db/queries.ts                 source-aware snapshots, currencies, qualities, item details
  sync/reference-sync.ts        ensureTracks returns qualities, + ensureItemDetails
src/server/
  services.ts                   fetchTracks becomes fetchRaidbots
  views.ts                      crests, upgrade flags, bags, vault choices
src/app/
  api/characters/[id]/simc/route.ts
  characters/[id]/page.tsx
src/components/
  SimcPaste.tsx                 client
  CharacterCard.tsx
```

Branch: create `feat/simc-paste-and-crests` from `main` before Task 1.

```bash
git checkout main && git pull && git checkout -b feat/simc-paste-and-crests
```

---

### Task 1: Raidbots track groups, crest names and bonus qualities

**Files:**
- Modify: `src/core/types.ts`, `src/core/raidbots/tracks.ts`, `src/core/db/schema.ts`, `src/core/db/queries.ts`, `src/core/sync/reference-sync.ts`, `src/server/services.ts`, `src/server/views.ts`, `src/core/live.live.test.ts`
- Modify tests: `src/core/raidbots/tracks.test.ts` (replace), `src/core/gear/evaluate.test.ts`, `src/core/db/queries.test.ts`, `src/core/sync/reference-sync.test.ts`, `src/server/views.test.ts`
- Create: a drizzle migration

**Interfaces:**
- Produces:
  - `Track` gains `group: number | null` and `currencyName: string | null`
  - `QUALITY_BY_RANK: readonly Quality[]`, `interface BonusQuality { bonusId: number; quality: Quality }`
  - `parseBonusQualities(data): BonusQuality[]`, `qualityFromBonuses(bonusIds, qualities: ReadonlyMap<number, Quality>): Quality | null`
  - `interface RaidbotsData { tracks: Track[]; qualities: BonusQuality[] }`, `createRaidbotsFetcher(fetchFn?): () => Promise<RaidbotsData>` (replaces `createRaidbotsTracksFetcher`)
  - Queries `replaceBonusQualities(db, entries: BonusQuality[])`, `getBonusQualityMap(db): Promise<Map<number, Quality>>`
  - `ensureTracks(deps: { db; fetchRaidbots: () => Promise<RaidbotsData>; now })` returns `{ tracks: Map<number, Track>; qualities: Map<number, Quality>; error: string | null }`
  - `Services.fetchRaidbots` replaces `Services.fetchTracks`

- [ ] **Step 1: Extend the Track type**

In `src/core/types.ts`, replace the `Track` interface:

```ts
export interface Track {
  bonusId: number;
  name: string;
  step: number;
  max: number;
  /** Raidbots upgrade group, unique per track per season. Upgrade costs are keyed by it. */
  group: number | null;
  currencyId: number | null;
  currencyName: string | null;
  costPerStep: number | null;
}
```

- [ ] **Step 2: Write the failing Raidbots tests**

Replace `src/core/raidbots/tracks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  createRaidbotsFetcher, decodeTrack, parseBonusQualities, parseRaidbotsBonuses, qualityFromBonuses, trackLabel,
} from './tracks';
import { fakeFetch, json, on } from '@/test/fake-fetch';

const sample = {
  '12850': { upgrade: { group: 618, level: 2, max: 6, name: 'Myth', fullName: 'Myth 2/6', bonusId: 12850, costs: [{ amounts: [{ currencyId: 3446, amount: 20, name: 'Myth Mistcrest' }] }] } },
  '12833': { upgrade: { group: 616, level: 1, max: 6, name: 'Champion', fullName: 'Champion 1/6', bonusId: 12833 } },
  '13440': { id: 13440, tag: 'Mythic+' },
  '12805': { id: 12805, itemLevel: { amount: 285 }, quality: 4 },
  '4775': { id: 4775, quality: 3 },
  '999': { upgrade: { level: 3 } },
};

describe('parseRaidbotsBonuses', () => {
  it('keeps upgrade bonuses with their group, crest and cost', () => {
    const tracks = parseRaidbotsBonuses(sample);
    expect(tracks).toHaveLength(2);
    expect(tracks).toEqual(expect.arrayContaining([
      { bonusId: 12850, name: 'Myth', step: 2, max: 6, group: 618, currencyId: 3446, currencyName: 'Myth Mistcrest', costPerStep: 20 },
      { bonusId: 12833, name: 'Champion', step: 1, max: 6, group: 616, currencyId: null, currencyName: null, costPerStep: null },
    ]));
  });
});

describe('parseBonusQualities', () => {
  it('maps numeric quality bonuses to quality names', () => {
    expect(parseBonusQualities(sample)).toEqual(expect.arrayContaining([
      { bonusId: 12805, quality: 'EPIC' },
      { bonusId: 4775, quality: 'RARE' },
    ]));
    expect(parseBonusQualities(sample)).toHaveLength(2);
  });
});

describe('qualityFromBonuses', () => {
  const qualities = new Map([[12805, 'EPIC' as const], [4775, 'RARE' as const]]);

  it('picks the highest quality among the bonus IDs', () => {
    expect(qualityFromBonuses([4775, 1, 12805], qualities)).toBe('EPIC');
  });

  it('returns null when no bonus ID sets a quality', () => {
    expect(qualityFromBonuses([1, 2], qualities)).toBeNull();
  });
});

describe('decodeTrack', () => {
  const tracks = new Map(parseRaidbotsBonuses(sample).map((t) => [t.bonusId, t]));

  it('finds the track among other bonus IDs', () => {
    expect(decodeTrack([13440, 6652, 12850], tracks)?.name).toBe('Myth');
  });

  it('returns null when no bonus ID is a track', () => {
    expect(decodeTrack([13440, 40], tracks)).toBeNull();
  });

  it('formats a label', () => {
    expect(trackLabel(tracks.get(12850)!)).toBe('Myth 2/6');
  });
});

describe('createRaidbotsFetcher', () => {
  it('fetches the live bonus data once and returns tracks and qualities', async () => {
    const { fn, calls } = fakeFetch([on('raidbots.com/static/data/live/bonuses.json', () => json(sample))]);
    const data = await createRaidbotsFetcher(fn)();
    expect(data.tracks).toHaveLength(2);
    expect(data.qualities).toHaveLength(2);
    expect(calls).toHaveLength(1);
  });
});
```

Run: `npx vitest run src/core/raidbots`
Expected: FAIL, because `parseBonusQualities`, `qualityFromBonuses` and `createRaidbotsFetcher` don't exist, and parsed tracks lack `group` and `currencyName`.

- [ ] **Step 3: Implement the Raidbots changes**

Replace `src/core/raidbots/tracks.ts`:

```ts
import { fetchJson, type FetchFn } from '../http';
import type { Quality, Track } from '../types';

export const RAIDBOTS_BONUSES_URL = 'https://www.raidbots.com/static/data/live/bonuses.json';

/** Raidbots stores quality as a rank number: 0 is Poor, 4 is Epic, 7 is Heirloom. */
export const QUALITY_BY_RANK: readonly Quality[] = ['POOR', 'COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'ARTIFACT', 'HEIRLOOM'];

export interface BonusQuality {
  bonusId: number;
  quality: Quality;
}

export interface RaidbotsData {
  tracks: Track[];
  qualities: BonusQuality[];
}

interface RawUpgrade {
  name?: string;
  level?: number;
  max?: number;
  group?: number;
  costs?: { amounts?: { currencyId?: number; amount?: number; name?: string }[] }[];
}

export function parseRaidbotsBonuses(data: Record<string, unknown>): Track[] {
  const tracks: Track[] = [];
  for (const [key, value] of Object.entries(data)) {
    const upgrade = (value as { upgrade?: RawUpgrade } | null)?.upgrade;
    if (!upgrade?.name || typeof upgrade.level !== 'number' || typeof upgrade.max !== 'number') continue;
    // The cost of reaching a step is stored on that step's bonus; step 1 has none.
    const amount = upgrade.costs?.[0]?.amounts?.[0];
    tracks.push({
      bonusId: Number(key),
      name: upgrade.name,
      step: upgrade.level,
      max: upgrade.max,
      group: upgrade.group ?? null,
      currencyId: amount?.currencyId ?? null,
      currencyName: amount?.name ?? null,
      costPerStep: amount?.amount ?? null,
    });
  }
  return tracks;
}

export function parseBonusQualities(data: Record<string, unknown>): BonusQuality[] {
  const qualities: BonusQuality[] = [];
  for (const [key, value] of Object.entries(data)) {
    const rank = (value as { quality?: unknown } | null)?.quality;
    if (typeof rank !== 'number' || !QUALITY_BY_RANK[rank]) continue;
    qualities.push({ bonusId: Number(key), quality: QUALITY_BY_RANK[rank]! });
  }
  return qualities;
}

export function qualityFromBonuses(bonusIds: number[], qualities: ReadonlyMap<number, Quality>): Quality | null {
  let best: Quality | null = null;
  for (const id of bonusIds) {
    const quality = qualities.get(id);
    if (quality && (best === null || QUALITY_BY_RANK.indexOf(quality) > QUALITY_BY_RANK.indexOf(best))) best = quality;
  }
  return best;
}

export function decodeTrack(bonusIds: number[], tracks: ReadonlyMap<number, Track>): Track | null {
  for (const id of bonusIds) {
    const track = tracks.get(id);
    if (track) return track;
  }
  return null;
}

export const trackLabel = (track: Track) => `${track.name} ${track.step}/${track.max}`;

export function createRaidbotsFetcher(fetchFn: FetchFn = fetch) {
  return async (): Promise<RaidbotsData> => {
    const data = await fetchJson<Record<string, unknown>>(fetchFn, RAIDBOTS_BONUSES_URL);
    return { tracks: parseRaidbotsBonuses(data), qualities: parseBonusQualities(data) };
  };
}
```

Run: `npx vitest run src/core/raidbots`
Expected: PASS, 8 tests.

- [ ] **Step 4: Update the schema and generate a migration**

In `src/core/db/schema.ts`, replace the `upgradeTracks` table and add `bonusQualities` below it:

```ts
export const upgradeTracks = sqliteTable('upgrade_tracks', {
  bonusId: integer('bonus_id').primaryKey(),
  name: text('name').notNull(),
  step: integer('step').notNull(),
  max: integer('max').notNull(),
  group: integer('group_id'),
  currencyId: integer('currency_id'),
  currencyName: text('currency_name'),
  costPerStep: integer('cost_per_step'),
});

export const bonusQualities = sqliteTable('bonus_qualities', {
  bonusId: integer('bonus_id').primaryKey(),
  quality: text('quality').$type<Quality>().notNull(),
});
```

Run: `npm run db:generate -- --name raidbots-details`
Expected: a new `drizzle/0001_raidbots-details.sql` that adds two columns to `upgrade_tracks` and creates `bonus_qualities`.

- [ ] **Step 5: Write the failing query and sync tests**

In `src/core/db/queries.test.ts`:

1. Add `getBonusQualityMap, replaceBonusQualities` to the import from `./queries`.
2. Replace every `Track` literal so it has the two new fields:
   - `{ bonusId: 12850, name: 'Myth', step: 2, max: 6, currencyId: 3446, costPerStep: 20 }` becomes `{ bonusId: 12850, name: 'Myth', step: 2, max: 6, group: 618, currencyId: 3446, currencyName: 'Myth Mistcrest', costPerStep: 20 }`
   - `{ bonusId: 1, name: 'Hero', step: 1, max: 6, currencyId: null, costPerStep: null }` becomes `{ bonusId: 1, name: 'Hero', step: 1, max: 6, group: null, currencyId: null, currencyName: null, costPerStep: null }`
   - In the file-database test, `({ bonusId: i + 1, name: 'Hero', step: 1, max: 6, currencyId: null, costPerStep: null })` becomes `({ bonusId: i + 1, name: 'Hero', step: 1, max: 6, group: null, currencyId: null, currencyName: null, costPerStep: null })`
3. Add this test inside `describe('tracks, meta and icons', ...)`:

```ts
  it('stores bonus qualities', async () => {
    const db = await openTestDb();
    await replaceBonusQualities(db, [{ bonusId: 12805, quality: 'EPIC' }, { bonusId: 4775, quality: 'RARE' }]);
    expect(await getBonusQualityMap(db)).toEqual(new Map([[12805, 'EPIC'], [4775, 'RARE']]));
  });
```

In `src/core/gear/evaluate.test.ts`, replace the `track` helper:

```ts
const track = (bonusId: number, name: string, step: number, max = 6): Track =>
  ({ bonusId, name, step, max, group: null, currencyId: null, currencyName: null, costPerStep: null });
```

In `src/core/sync/reference-sync.test.ts`, replace the whole `describe('ensureTracks', ...)` block:

```ts
describe('ensureTracks', () => {
  const tracks: Track[] = [{ bonusId: 1, name: 'Myth', step: 1, max: 6, group: 618, currencyId: null, currencyName: null, costPerStep: null }];
  const data = { tracks, qualities: [{ bonusId: 12805, quality: 'EPIC' as const }] };
  const failing = async (): Promise<typeof data> => { throw new Error('down'); };

  it('refreshes daily, stores qualities, and keeps old data on failure', async () => {
    const db = await openTestDb();
    let calls = 0;
    const ok = async () => { calls++; return data; };
    const first = await ensureTracks({ db, fetchRaidbots: ok, now: 1 });
    expect(first).toMatchObject({ error: null });
    expect(first.qualities.get(12805)).toBe('EPIC');
    await ensureTracks({ db, fetchRaidbots: ok, now: 2 });
    expect(calls).toBe(1);
    const stale = await ensureTracks({ db, fetchRaidbots: failing, now: 2 + DAY_MS });
    expect(stale.tracks.size).toBe(1);
    expect(stale.qualities.size).toBe(1);
    expect(stale.error).toBeNull();
  });

  it('reports missing track data and waits an hour before retrying', async () => {
    const db = await openTestDb();
    let calls = 0;
    const counting = async () => { calls++; return failing(); };
    const first = await ensureTracks({ db, fetchRaidbots: counting, now: 1000 });
    expect(first.tracks.size).toBe(0);
    expect(first.error).toBe('Upgrade track data couldn’t be loaded, so upgrade states may be wrong');
    await ensureTracks({ db, fetchRaidbots: counting, now: 1000 + 59 * 60_000 });
    expect(calls).toBe(1);
    await ensureTracks({ db, fetchRaidbots: counting, now: 1000 + 61 * 60_000 });
    expect(calls).toBe(2);
  });
});
```

In `src/server/views.test.ts`:
- Replace `const tracks: Track[] = [{ bonusId: 99, name: 'Hero', step: 5, max: 6, currencyId: null, costPerStep: null }];` with `const tracks: Track[] = [{ bonusId: 99, name: 'Hero', step: 5, max: 6, group: 617, currencyId: null, currencyName: null, costPerStep: null }];`
- Replace `fetchTracks: async () => tracks,` with `fetchRaidbots: async () => ({ tracks, qualities: [] }),`
- Replace `s.fetchTracks = async () => { throw new Error('down'); };` with `s.fetchRaidbots = async () => { throw new Error('down'); };`

Run: `npx vitest run src`
Expected: FAIL in `queries.test.ts` and `reference-sync.test.ts`, because the queries and the new `ensureTracks` signature don't exist yet.

- [ ] **Step 6: Implement the queries, ensureTracks and wiring**

In `src/core/db/queries.ts`:
- Add `bonusQualities` to the import from `./schema`, and `Quality` is already imported from `../types`.
- Add these functions after `getTrackMap`:

```ts
export async function replaceBonusQualities(db: Db, entries: BonusQuality[]) {
  await withWriteLock(db, () => db.transaction(async (tx) => {
    await tx.delete(bonusQualities);
    for (let i = 0; i < entries.length; i += 500) await tx.insert(bonusQualities).values(entries.slice(i, i + 500));
  }));
}

export async function getBonusQualityMap(db: Db): Promise<Map<number, Quality>> {
  const rows = await db.select().from(bonusQualities);
  return new Map(rows.map((r) => [r.bonusId, r.quality]));
}
```

- Add `import type { BonusQuality } from '../raidbots/tracks';` at the top.

In `src/core/sync/reference-sync.ts`:
- Change the queries import to also import `getBonusQualityMap` and `replaceBonusQualities`.
- Add `import type { RaidbotsData } from '../raidbots/tracks';` and add `Quality` to the `../types` import.
- Replace the `TracksResult` interface and the `ensureTracks` function:

```ts
export interface TracksResult {
  tracks: Map<number, Track>;
  qualities: Map<number, Quality>;
  error: string | null;
}

/** Refreshes Raidbots data daily. On failure keeps what it has, and retries at most hourly. */
export async function ensureTracks(deps: { db: Db; fetchRaidbots: () => Promise<RaidbotsData>; now: number }): Promise<TracksResult> {
  const { db, fetchRaidbots, now } = deps;
  const fetchedAt = await getMeta(db, TRACKS_META_KEY);
  const failedAt = await getMeta(db, TRACKS_FAILED_META_KEY);
  const fresh = fetchedAt && now - fetchedAt.updatedAt < DAY_MS;
  const backingOff = failedAt && now - failedAt.updatedAt < TRACKS_RETRY_MS;
  if (!fresh && !backingOff) {
    try {
      const data = await fetchRaidbots();
      if (data.tracks.length === 0) throw new Error('No upgrade tracks in the Raidbots data');
      await replaceTracks(db, data.tracks);
      await replaceBonusQualities(db, data.qualities);
      await setMeta(db, TRACKS_META_KEY, String(now), now);
    } catch {
      await setMeta(db, TRACKS_FAILED_META_KEY, String(now), now);
    }
  }
  const tracks = await getTrackMap(db);
  const qualities = await getBonusQualityMap(db);
  return { tracks, qualities, error: tracks.size === 0 ? TRACKS_ERROR : null };
}
```

In `src/server/services.ts`:
- Replace `import { createRaidbotsTracksFetcher } from '@/core/raidbots/tracks';` with `import { createRaidbotsFetcher, type RaidbotsData } from '@/core/raidbots/tracks';`
- Replace `fetchTracks: () => Promise<Track[]>;` with `fetchRaidbots: () => Promise<RaidbotsData>;`
- Replace `fetchTracks: createRaidbotsTracksFetcher(),` with `fetchRaidbots: createRaidbotsFetcher(),`
- Remove `Track` from the `@/core/types` import if it's now unused.

In `src/server/views.ts`, replace both occurrences of `fetchTracks` with `fetchRaidbots` (in the destructuring and in the `ensureTracks` call).

In `src/core/live.live.test.ts`:
- Replace `import { createRaidbotsTracksFetcher } from './raidbots/tracks';` with `import { createRaidbotsFetcher } from './raidbots/tracks';`
- Replace `const tracks = await createRaidbotsTracksFetcher()();` with `const { tracks, qualities } = await createRaidbotsFetcher()();` and add `expect(qualities.length).toBeGreaterThan(100);` after the existing expectation.

- [ ] **Step 7: Run the tests and checks**

Run: `npx vitest run src && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src drizzle
git commit -m "feat: keep Raidbots track groups, crest names and bonus qualities"
```

---

### Task 2: SimC parser

**Files:**
- Create: `src/core/simc/parse.ts`, `src/core/simc/__fixtures__/export.txt`
- Test: `src/core/simc/parse.test.ts`

**Interfaces:**
- Consumes: `ItemLocation`, `SlotType` from `src/core/types.ts`.
- Produces:
  - `interface SimcItem { location: ItemLocation; slot: SlotType; itemId: number; name: string | null; itemLevel: number | null; bonusIds: number[] }`
  - `interface SimcCurrency { kind: 'upgrade' | 'catalyst'; currencyId: number; quantity: number }`
  - `interface SimcProfile { name: string; classToken: string; region: string; realmToken: string; specToken: string; items: SimcItem[]; currencies: SimcCurrency[] }`
  - `class SimcParseError extends Error { line: number | null }`
  - `parseSimc(text: string): SimcProfile`

- [ ] **Step 1: Write the fixture**

`src/core/simc/__fixtures__/export.txt` follows the SimulationCraft addon's output format:

```
# Testbear - Guardian - 2026-09-26 12:00 - EU/Tarren Mill
# SimC Addon 12.1.0-01
# WoW 12.1.0.68914, TOC 120100
# Requires SimulationCraft 1201-01 or newer

druid="Testbear"
level=90
race=night_elf
region=eu
server=tarren_mill
role=tank
professions=leatherworking=100/skinning=100
spec=guardian
# loot_spec=guardian

### Offspec Loadouts: Feral
# talents=CgGAAAAAAAAAAAAAAAAAAAAAAAAAB

talents=CgGAAAAAAAAAAAAAAAAAAAAAAAAAA

# Enigmatic Dreamwatcher's Somnolent Stare (321)
head=,id=271528,enchant_id=7960,bonus_id=13692/13440/6652/13696/13698/12850
# Yoke of the Charging Bear (318)
neck=,id=251173,gem_id=240892,bonus_id=13440/6652/13668/12699/12845
# Plain Shirt (1)
shirt=,id=6833
# Toxin-Coated Warstaff (321)
main_hand=,id=273783,enchant_id=7981,bonus_id=13440/6652/12701/12846

### Gear from Bags
#
# Primal Dinomancer's Belt (315)
# waist=,id=159301,bonus_id=13440/6652/12844
#
# Ritual Binder's Ring (311)
# finger1=,id=159459,bonus_id=13440/6652/12843

### Weekly Reward Choices
#
# Tumor of the Swarm (324)
# trinket1=,id=250245,bonus_id=13440/6652/12850
#
### End of Weekly Reward Choices

### Additional Character Info
#
# catalyst_currencies=3378:2
# upgrade_currencies=c:3446:85/c:3445:140/i:224072:3
```

- [ ] **Step 2: Write the failing tests**

`src/core/simc/parse.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSimc, SimcParseError } from './parse';

const text = readFileSync(new URL('./__fixtures__/export.txt', import.meta.url), 'utf8');

describe('parseSimc', () => {
  const profile = parseSimc(text);

  it('reads the character header', () => {
    expect(profile).toMatchObject({ name: 'Testbear', classToken: 'druid', region: 'eu', realmToken: 'tarren_mill', specToken: 'guardian' });
  });

  it('reads equipped items with name and item level, and skips the shirt', () => {
    expect(profile.items.filter((i) => i.location === 'equipped')).toEqual([
      { location: 'equipped', slot: 'HEAD', itemId: 271528, name: 'Enigmatic Dreamwatcher\'s Somnolent Stare', itemLevel: 321, bonusIds: [13692, 13440, 6652, 13696, 13698, 12850] },
      { location: 'equipped', slot: 'NECK', itemId: 251173, name: 'Yoke of the Charging Bear', itemLevel: 318, bonusIds: [13440, 6652, 13668, 12699, 12845] },
      { location: 'equipped', slot: 'MAIN_HAND', itemId: 273783, name: 'Toxin-Coated Warstaff', itemLevel: 321, bonusIds: [13440, 6652, 12701, 12846] },
    ]);
  });

  it('reads bag and Great Vault items', () => {
    expect(profile.items.filter((i) => i.location === 'bag').map((i) => [i.slot, i.itemId, i.name, i.itemLevel])).toEqual([
      ['WAIST', 159301, 'Primal Dinomancer\'s Belt', 315],
      ['FINGER_1', 159459, 'Ritual Binder\'s Ring', 311],
    ]);
    expect(profile.items.filter((i) => i.location === 'vault').map((i) => [i.slot, i.itemId, i.itemLevel])).toEqual([['TRINKET_1', 250245, 324]]);
  });

  it('reads crests and catalyst charges, skipping item currencies', () => {
    expect(profile.currencies).toEqual([
      { kind: 'catalyst', currencyId: 3378, quantity: 2 },
      { kind: 'upgrade', currencyId: 3446, quantity: 85 },
      { kind: 'upgrade', currencyId: 3445, quantity: 140 },
    ]);
  });

  it('parses Windows line endings and indented lines the same way', () => {
    const messy = text.split('\n').map((l) => `  ${l}`).join('\r\n');
    expect(parseSimc(messy)).toEqual(profile);
  });

  it('rejects text without a character line', () => {
    expect(() => parseSimc('head=,id=1\nneck=,id=2')).toThrow(SimcParseError);
    expect(() => parseSimc('')).toThrow(/character line is missing/);
  });

  it('rejects an export with no equipped items', () => {
    expect(() => parseSimc('druid="Testbear"\nregion=eu\nserver=tarren_mill')).toThrow(/No equipped items/);
  });

  it('names the line of an item without an id', () => {
    try {
      parseSimc('druid="Testbear"\nregion=eu\nserver=tarren_mill\nhead=,bonus_id=1');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(SimcParseError);
      expect((err as SimcParseError).line).toBe(4);
    }
  });
});
```

Run: `npx vitest run src/core/simc`
Expected: FAIL, because `./parse` doesn't exist.

- [ ] **Step 3: Implement the parser**

`src/core/simc/parse.ts`:

```ts
import type { ItemLocation, SlotType } from '../types';

export interface SimcItem {
  location: ItemLocation;
  slot: SlotType;
  itemId: number;
  name: string | null;
  itemLevel: number | null;
  bonusIds: number[];
}

export interface SimcCurrency {
  kind: 'upgrade' | 'catalyst';
  currencyId: number;
  quantity: number;
}

export interface SimcProfile {
  name: string;
  classToken: string;
  region: string;
  realmToken: string;
  specToken: string;
  items: SimcItem[];
  currencies: SimcCurrency[];
}

export class SimcParseError extends Error {
  constructor(message: string, public readonly line: number | null) {
    super(message);
    this.name = 'SimcParseError';
  }
}

// SimC slot names. Shirt, tabard and ammo are left out on purpose.
const SLOTS: Record<string, SlotType> = {
  head: 'HEAD', neck: 'NECK', shoulder: 'SHOULDER', back: 'BACK', chest: 'CHEST', wrist: 'WRIST', hands: 'HANDS',
  waist: 'WAIST', legs: 'LEGS', feet: 'FEET', finger1: 'FINGER_1', finger2: 'FINGER_2',
  trinket1: 'TRINKET_1', trinket2: 'TRINKET_2', main_hand: 'MAIN_HAND', off_hand: 'OFF_HAND',
};

type Section = ItemLocation | 'ignore' | 'info';

function sectionFor(header: string, current: Section): Section {
  if (/Gear from Bags/i.test(header)) return 'bag';
  if (/End of Weekly Reward Choices/i.test(header)) return 'ignore';
  if (/Weekly Reward Choices/i.test(header)) return 'vault';
  if (/Additional Character Info/i.test(header)) return 'info';
  if (/Merchant items|Linked gear/i.test(header)) return 'ignore';
  // Other headers, like "Offspec Loadouts", sit between the character lines and the gear.
  return current;
}

function parseItem(body: string, location: ItemLocation, pending: { name: string; itemLevel: number } | null, lineNo: number): SimcItem | null {
  const match = body.match(/^([a-z0-9_]+)=,?(.*)$/);
  if (!match) return null;
  const slot = SLOTS[match[1]!];
  if (!slot) return null;
  const options = new Map(match[2]!.split(',').filter(Boolean).map((part) => {
    const eq = part.indexOf('=');
    return eq === -1 ? [part, ''] as const : [part.slice(0, eq), part.slice(eq + 1)] as const;
  }));
  const itemId = Number(options.get('id'));
  if (!Number.isInteger(itemId) || itemId <= 0) throw new SimcParseError(`The ${match[1]} item on line ${lineNo} has no item id`, lineNo);
  const bonus = options.get('bonus_id');
  return {
    location,
    slot,
    itemId,
    name: pending?.name ?? null,
    itemLevel: pending?.itemLevel ?? null,
    bonusIds: bonus ? bonus.split('/').map(Number).filter((n) => Number.isInteger(n)) : [],
  };
}

function parseCurrencies(kind: SimcCurrency['kind'], value: string): SimcCurrency[] {
  return value.split('/').filter(Boolean).flatMap((entry) => {
    const parts = entry.split(':');
    if (kind === 'upgrade') {
      // Entries are c:<currency>:<qty> for currencies and i:<item>:<count> for items; keep currencies only.
      if (parts[0] !== 'c') return [];
      parts.shift();
    }
    const [currencyId, quantity] = parts.map(Number);
    return Number.isInteger(currencyId) && Number.isFinite(quantity) ? [{ kind, currencyId: currencyId!, quantity: quantity! }] : [];
  });
}

/** Parses the text from the SimulationCraft addon's /simc window. */
export function parseSimc(text: string): SimcProfile {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let section: Section = 'equipped';
  let name: string | null = null;
  let classToken = '';
  let region = '';
  let realmToken = '';
  let specToken = '';
  let pending: { name: string; itemLevel: number } | null = null;
  const items: SimcItem[] = [];
  const currencies: SimcCurrency[] = [];

  lines.forEach((raw, index) => {
    const line = raw.trim();
    const lineNo = index + 1;
    if (!line) { pending = null; return; }
    if (line.startsWith('###')) { section = sectionFor(line, section); pending = null; return; }

    if (line.startsWith('#')) {
      const body = line.slice(1).trim();
      const currency = body.match(/^(upgrade|catalyst)_currencies=(.*)$/);
      if (currency) { currencies.push(...parseCurrencies(currency[1] as SimcCurrency['kind'], currency[2]!)); return; }
      if (section === 'bag' || section === 'vault') {
        const item = parseItem(body, section, pending, lineNo);
        if (item) { items.push(item); pending = null; return; }
      }
      const named = body.match(/^(.+?)\s+\((\d+)\)$/);
      pending = named ? { name: named[1]!, itemLevel: Number(named[2]) } : null;
      return;
    }

    if (section !== 'equipped') return;
    const header = line.match(/^([a-z_]+)="(.+)"$/);
    if (header) {
      if (name === null) { classToken = header[1]!; name = header[2]!; }
      return;
    }
    const setting = line.match(/^([a-z_]+)=(.*)$/);
    if (!setting) return;
    if (setting[1] === 'region') region = setting[2]!;
    else if (setting[1] === 'server') realmToken = setting[2]!;
    else if (setting[1] === 'spec') specToken = setting[2]!;
    else {
      const item = parseItem(line, 'equipped', pending, lineNo);
      if (item) items.push(item);
      pending = null;
    }
  });

  if (name === null) {
    throw new SimcParseError('The character line is missing, for example druid="Name". Copy the whole text from the /simc window.', null);
  }
  if (!items.some((i) => i.location === 'equipped')) throw new SimcParseError('No equipped items found in the SimC text.', null);
  return { name, classToken, region, realmToken, specToken, items, currencies };
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/core/simc`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/simc
git commit -m "feat: parse SimulationCraft exports with bag, vault and currency data"
```

---

### Task 3: Crest costs and affordable upgrades

**Files:**
- Create: `src/core/gear/crests.ts`
- Test: `src/core/gear/crests.test.ts`

**Interfaces:**
- Consumes: `Track` from `src/core/types.ts` (with `group` and `currencyName` from Task 1).
- Produces:
  - `interface CrestCost { group: number; currencyId: number; currencyName: string; costPerStep: number }`
  - `crestCostsByGroup(tracks: Iterable<Track>): Map<number, CrestCost>`
  - `interface UpgradeOption { steps: number; currencyName: string; costPerStep: number }`
  - `affordableUpgrade(track: Track | null, costs: ReadonlyMap<number, CrestCost>, balances: ReadonlyMap<number, number>): UpgradeOption | null`
  - `interface CrestBalance { currencyId: number; name: string; quantity: number; steps: number }`
  - `summarizeCrests(balances: ReadonlyMap<number, number>, costs: ReadonlyMap<number, CrestCost>): CrestBalance[]`

- [ ] **Step 1: Write the failing tests**

`src/core/gear/crests.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { affordableUpgrade, crestCostsByGroup, summarizeCrests } from './crests';
import type { Track } from '../types';

const t = (bonusId: number, name: string, step: number, group: number | null, cost: [number, string, number] | null): Track => ({
  bonusId, name, step, max: 6, group,
  currencyId: cost?.[0] ?? null, currencyName: cost?.[1] ?? null, costPerStep: cost?.[2] ?? null,
});

const tracks = [
  t(1, 'Myth', 1, 618, null),
  t(2, 'Myth', 2, 618, [3446, 'Myth Mistcrest', 20]),
  t(3, 'Myth', 6, 618, [3446, 'Myth Mistcrest', 20]),
  t(4, 'Hero', 5, 617, [3445, 'Hero Mistcrest', 20]),
  t(5, 'Myth', 3, 500, [2999, 'Old Myth Crest', 15]),
  t(6, 'Mystery', 2, null, [1, 'No group', 10]),
];
const costs = crestCostsByGroup(tracks);

describe('crestCostsByGroup', () => {
  it('keys costs by group, so seasons with the same track name stay apart', () => {
    expect(costs.get(618)).toEqual({ group: 618, currencyId: 3446, currencyName: 'Myth Mistcrest', costPerStep: 20 });
    expect(costs.get(500)?.currencyId).toBe(2999);
    expect(costs.size).toBe(3);
  });
});

describe('affordableUpgrade', () => {
  const balances = new Map([[3446, 85], [3445, 10]]);

  it('counts the steps the balance covers, capped at the track max', () => {
    expect(affordableUpgrade(tracks[0]!, costs, balances)).toEqual({ steps: 4, currencyName: 'Myth Mistcrest', costPerStep: 20 });
    expect(affordableUpgrade(t(9, 'Myth', 5, 618, null), costs, balances)?.steps).toBe(1);
  });

  it('returns null at max step, below one step’s cost, or without cost data', () => {
    expect(affordableUpgrade(tracks[2]!, costs, balances)).toBeNull();
    expect(affordableUpgrade(tracks[3]!, costs, balances)).toBeNull();
    expect(affordableUpgrade(tracks[5]!, costs, balances)).toBeNull();
    expect(affordableUpgrade(t(9, 'Myth', 2, 777, null), costs, balances)).toBeNull();
    expect(affordableUpgrade(null, costs, balances)).toBeNull();
  });
});

describe('summarizeCrests', () => {
  it('lists crests the character holds, highest track first, with the steps they cover', () => {
    expect(summarizeCrests(new Map([[3445, 140], [3446, 85], [1234, 5]]), costs)).toEqual([
      { currencyId: 3446, name: 'Myth Mistcrest', quantity: 85, steps: 4 },
      { currencyId: 3445, name: 'Hero Mistcrest', quantity: 140, steps: 7 },
    ]);
  });
});
```

Run: `npx vitest run src/core/gear/crests.test.ts`
Expected: FAIL, because `./crests` doesn't exist.

- [ ] **Step 2: Implement the crest logic**

`src/core/gear/crests.ts`:

```ts
import type { Track } from '../types';

export interface CrestCost {
  group: number;
  currencyId: number;
  currencyName: string;
  costPerStep: number;
}

export interface UpgradeOption {
  steps: number;
  currencyName: string;
  costPerStep: number;
}

export interface CrestBalance {
  currencyId: number;
  name: string;
  quantity: number;
  steps: number;
}

/** One cost per upgrade track group. Every step of a track costs the same crest amount. */
export function crestCostsByGroup(tracks: Iterable<Track>): Map<number, CrestCost> {
  const costs = new Map<number, CrestCost>();
  for (const track of tracks) {
    if (track.group === null || track.currencyId === null || track.costPerStep === null || costs.has(track.group)) continue;
    costs.set(track.group, {
      group: track.group,
      currencyId: track.currencyId,
      currencyName: track.currencyName ?? `Currency ${track.currencyId}`,
      costPerStep: track.costPerStep,
    });
  }
  return costs;
}

export function affordableUpgrade(
  track: Track | null, costs: ReadonlyMap<number, CrestCost>, balances: ReadonlyMap<number, number>,
): UpgradeOption | null {
  if (!track || track.group === null || track.step >= track.max) return null;
  const cost = costs.get(track.group);
  if (!cost) return null;
  const steps = Math.min(track.max - track.step, Math.floor((balances.get(cost.currencyId) ?? 0) / cost.costPerStep));
  return steps > 0 ? { steps, currencyName: cost.currencyName, costPerStep: cost.costPerStep } : null;
}

export function summarizeCrests(balances: ReadonlyMap<number, number>, costs: ReadonlyMap<number, CrestCost>): CrestBalance[] {
  const seen = new Set<number>();
  const summary: CrestBalance[] = [];
  // Higher groups are higher tracks within a season, so Myth comes before Hero.
  for (const cost of [...costs.values()].sort((a, b) => b.group - a.group)) {
    const quantity = balances.get(cost.currencyId);
    if (quantity === undefined || seen.has(cost.currencyId)) continue;
    seen.add(cost.currencyId);
    summary.push({ currencyId: cost.currencyId, name: cost.currencyName, quantity, steps: Math.floor(quantity / cost.costPerStep) });
  }
  return summary;
}
```

- [ ] **Step 3: Run the tests to see them pass**

Run: `npx vitest run src/core/gear`
Expected: PASS, including the 4 new crest tests.

- [ ] **Step 4: Commit**

```bash
git add src/core/gear/crests.ts src/core/gear/crests.test.ts
git commit -m "feat: work out crest balances and affordable BiS upgrades"
```

---

### Task 4: Snapshot currencies and source-aware snapshots

**Files:**
- Modify: `src/core/db/schema.ts`, `src/core/db/queries.ts`
- Test: `src/core/db/queries.test.ts`, `src/core/sync/character-sync.test.ts`
- Create: a drizzle migration

**Interfaces:**
- Consumes: `withWriteLock` (private to queries.ts), `SnapshotSource`.
- Produces:
  - `interface SnapshotCurrency { kind: 'upgrade' | 'catalyst'; currencyId: number; quantity: number }`
  - `Snapshot` gains `currencies: SnapshotCurrency[]`
  - `saveSnapshotIfChanged(db, characterId, source, items, now, currencies?: SnapshotCurrency[])`. A `blizzard` save compares with the latest Blizzard snapshot. A `simc` save compares with the latest snapshot of any source.
  - `getLatestSnapshot(db, characterId, source?: SnapshotSource): Promise<Snapshot | null>`

- [ ] **Step 1: Add the table and generate a migration**

In `src/core/db/schema.ts`, add below `snapshotItems`:

```ts
export const snapshotCurrencies = sqliteTable('snapshot_currencies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  snapshotId: integer('snapshot_id').notNull().references(() => gearSnapshots.id, { onDelete: 'cascade' }),
  kind: text('kind').$type<'upgrade' | 'catalyst'>().notNull(),
  currencyId: integer('currency_id').notNull(),
  quantity: integer('quantity').notNull(),
}, (t) => [index('snapshot_currencies_snapshot').on(t.snapshotId)]);
```

Run: `npm run db:generate -- --name snapshot-currencies`
Expected: a new `drizzle/0002_snapshot-currencies.sql` that creates `snapshot_currencies`.

- [ ] **Step 2: Write the failing tests**

In `src/core/db/queries.test.ts`, add this block at the end of the file:

```ts
describe('snapshot sources', () => {
  const bagBelt = { location: 'bag' as const, slot: 'WAIST', itemId: 9, name: 'Belt', itemLevel: 300, quality: 'EPIC' as const, bonusIds: [], isTier: false };
  const crests = [{ kind: 'upgrade' as const, currencyId: 3446, quantity: 85 }];

  it('keeps a newer SimC paste current until Blizzard’s own data changes', async () => {
    const db = await openTestDb();
    const { id } = await insertCharacter(db, newCharacter, 1);
    const blizzardGear = gearToSnapshotItems(gear);
    await saveSnapshotIfChanged(db, id, 'blizzard', blizzardGear, 10);
    const paste = await saveSnapshotIfChanged(db, id, 'simc', [...blizzardGear, bagBelt], 20, crests);
    expect(paste.changed).toBe(true);

    expect(await saveSnapshotIfChanged(db, id, 'blizzard', blizzardGear, 30)).toMatchObject({ changed: false });
    expect((await getLatestSnapshot(db, id))?.source).toBe('simc');

    const upgraded = gearToSnapshotItems(gear.map((g) => (g.slot === 'NECK' ? { ...g, itemLevel: 330 } : g)));
    expect(await saveSnapshotIfChanged(db, id, 'blizzard', upgraded, 40)).toMatchObject({ changed: true });
    expect((await getLatestSnapshot(db, id))?.source).toBe('blizzard');
  });

  it('makes a repeated paste current again after Blizzard took over', async () => {
    const db = await openTestDb();
    const { id } = await insertCharacter(db, newCharacter, 1);
    const pasted = [...gearToSnapshotItems(gear), bagBelt];
    await saveSnapshotIfChanged(db, id, 'simc', pasted, 10, crests);
    await saveSnapshotIfChanged(db, id, 'blizzard', gearToSnapshotItems(gear), 20);
    expect(await saveSnapshotIfChanged(db, id, 'simc', pasted, 30, crests)).toMatchObject({ changed: true });
    expect(await saveSnapshotIfChanged(db, id, 'simc', pasted, 40, crests)).toMatchObject({ changed: false });
  });

  it('stores currencies and reads the latest snapshot of one source', async () => {
    const db = await openTestDb();
    const { id } = await insertCharacter(db, newCharacter, 1);
    await saveSnapshotIfChanged(db, id, 'simc', gearToSnapshotItems(gear), 10, crests);
    await saveSnapshotIfChanged(db, id, 'blizzard', gearToSnapshotItems(gear.slice(0, 1)), 20);
    const simc = await getLatestSnapshot(db, id, 'simc');
    expect(simc).toMatchObject({ source: 'simc', createdAt: 10, currencies: crests });
    expect((await getLatestSnapshot(db, id))?.currencies).toEqual([]);
  });

  it('treats a change in crests alone as a new paste', async () => {
    const db = await openTestDb();
    const { id } = await insertCharacter(db, newCharacter, 1);
    await saveSnapshotIfChanged(db, id, 'simc', gearToSnapshotItems(gear), 10, crests);
    const more = [{ kind: 'upgrade' as const, currencyId: 3446, quantity: 105 }];
    expect(await saveSnapshotIfChanged(db, id, 'simc', gearToSnapshotItems(gear), 20, more)).toMatchObject({ changed: true });
  });
});
```

In `src/core/sync/character-sync.test.ts`:
- Change the queries import to `import { gearToSnapshotItems, getCharacter, getLatestSnapshot, insertCharacter, saveSnapshotIfChanged } from '../db/queries';`
- Add this test before `it('throws for an unknown character ID', ...)`:

```ts
  it('keeps a newer SimC paste when Blizzard still has the same gear', async () => {
    const { db, id, syncer, advance } = await setup();
    await syncer.sync(id);
    advance(1000);
    await saveSnapshotIfChanged(db, id, 'simc', gearToSnapshotItems(gear), 1_001_000, [{ kind: 'upgrade', currencyId: 3446, quantity: 85 }]);
    expect(await syncer.sync(id, { force: true })).toBe('unchanged');
    expect((await getLatestSnapshot(db, id))?.source).toBe('simc');
  });
```

Run: `npx vitest run src/core/db src/core/sync`
Expected: FAIL. `saveSnapshotIfChanged` ignores currencies and compares against the latest snapshot of any source, so the Blizzard save after a paste creates a new snapshot.

- [ ] **Step 3: Implement source-aware snapshots**

In `src/core/db/queries.ts`:
- Add `snapshotCurrencies` to the import from `./schema`.
- Replace everything from `export interface SnapshotItemInput {` up to, but not including, `export async function replaceBisLists(` with:

```ts
export interface SnapshotItemInput {
  location: ItemLocation;
  slot: string;
  itemId: number;
  name: string;
  itemLevel: number | null;
  quality: Quality;
  bonusIds: number[];
  isTier: boolean;
}

export interface SnapshotCurrency {
  kind: 'upgrade' | 'catalyst';
  currencyId: number;
  quantity: number;
}

export interface Snapshot {
  id: number;
  source: SnapshotSource;
  createdAt: number;
  items: SnapshotItemInput[];
  currencies: SnapshotCurrency[];
}

export const gearToSnapshotItems = (gear: GearItem[]): SnapshotItemInput[] =>
  gear.map((g) => ({ location: 'equipped', slot: g.slot, itemId: g.itemId, name: g.name, itemLevel: g.itemLevel, quality: g.quality, bonusIds: g.bonusIds, isTier: g.isTier }));

function hashSnapshot(list: SnapshotItemInput[], currencies: SnapshotCurrency[]): string {
  const items = list
    .map((i) => [i.location, i.slot, i.itemId, i.itemLevel, i.bonusIds.join(':'), i.isTier].join('|'))
    .sort();
  const money = currencies.map((c) => [c.kind, c.currencyId, c.quantity].join('|')).sort();
  // Snapshots without currencies hash exactly as they did before currencies existed.
  const payload = money.length > 0 ? JSON.stringify([items, money]) : JSON.stringify(items);
  return createHash('sha256').update(payload).digest('hex');
}

function latestSnapshotRow(db: Db, characterId: number, source?: SnapshotSource) {
  const where = source
    ? and(eq(gearSnapshots.characterId, characterId), eq(gearSnapshots.source, source))
    : eq(gearSnapshots.characterId, characterId);
  return db.select().from(gearSnapshots).where(where).orderBy(desc(gearSnapshots.createdAt), desc(gearSnapshots.id)).get();
}

/**
 * Saves a snapshot unless nothing changed.
 * A Blizzard sync compares with the last Blizzard snapshot, so an unchanged Blizzard profile never
 * replaces a newer SimC paste. Blizzard only updates after a logout, so changed Blizzard data is at
 * least as new as the paste. A paste compares with whatever snapshot is current.
 */
export async function saveSnapshotIfChanged(
  db: Db, characterId: number, source: SnapshotSource, list: SnapshotItemInput[], now: number, currencies: SnapshotCurrency[] = [],
): Promise<{ snapshotId: number; changed: boolean }> {
  return withWriteLock(db, async () => {
    const contentHash = hashSnapshot(list, currencies);
    const previous = await latestSnapshotRow(db, characterId, source === 'blizzard' ? 'blizzard' : undefined);
    if (previous && previous.contentHash === contentHash && previous.source === source) return { snapshotId: previous.id, changed: false };
    return db.transaction(async (tx) => {
      const [snapshot] = await tx.insert(gearSnapshots).values({ characterId, source, createdAt: now, contentHash }).returning({ id: gearSnapshots.id });
      if (list.length > 0) await tx.insert(snapshotItems).values(list.map((i) => ({ ...i, snapshotId: snapshot!.id })));
      if (currencies.length > 0) await tx.insert(snapshotCurrencies).values(currencies.map((c) => ({ ...c, snapshotId: snapshot!.id })));
      return { snapshotId: snapshot!.id, changed: true };
    });
  });
}

export async function getLatestSnapshot(db: Db, characterId: number, source?: SnapshotSource): Promise<Snapshot | null> {
  const latest = await latestSnapshotRow(db, characterId, source);
  if (!latest) return null;
  const rows = await db.select().from(snapshotItems).where(eq(snapshotItems.snapshotId, latest.id)).orderBy(asc(snapshotItems.id));
  const money = await db.select().from(snapshotCurrencies).where(eq(snapshotCurrencies.snapshotId, latest.id)).orderBy(asc(snapshotCurrencies.id));
  return {
    id: latest.id,
    source: latest.source,
    createdAt: latest.createdAt,
    items: rows.map(({ location, slot, itemId, name, itemLevel, quality, bonusIds, isTier }) =>
      ({ location, slot, itemId, name, itemLevel, quality, bonusIds, isTier })),
    currencies: money.map(({ kind, currencyId, quantity }) => ({ kind, currencyId, quantity })),
  };
}

export const equippedGear = (snapshot: Snapshot): GearItem[] =>
  snapshot.items
    .filter((i) => i.location === 'equipped')
    .map((i) => ({ slot: i.slot as SlotType, itemId: i.itemId, name: i.name, itemLevel: i.itemLevel, quality: i.quality, bonusIds: i.bonusIds, isTier: i.isTier }));

```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src && npm run typecheck`
Expected: all pass. The existing test "saves a snapshot only when the gear changed" still passes, because both of its saves are Blizzard saves.

- [ ] **Step 5: Commit**

```bash
git add src/core/db src/core/sync/character-sync.test.ts drizzle
git commit -m "feat: store snapshot currencies and keep SimC pastes until Blizzard changes"
```

---

### Task 5: Blizzard item details for quality and tier

SimC exports don't say which items are tier pieces, and some bonus lists don't set a quality. Blizzard's item endpoint has both: `quality.type`, and `preview_item.set` for items in a set.

**Files:**
- Modify: `src/core/blizzard/client.ts`, `src/core/db/schema.ts`, `src/core/db/queries.ts`, `src/core/sync/reference-sync.ts`
- Test: `src/core/blizzard/client.test.ts`, `src/core/db/queries.test.ts`, `src/core/sync/reference-sync.test.ts`, `src/core/sync/character-sync.test.ts`
- Create: a drizzle migration

**Interfaces:**
- Produces:
  - `interface ItemDetails { quality: Quality | null; isTier: boolean }`
  - `BlizzardClient.getItemDetails(region, itemId): Promise<ItemDetails | null>`
  - Queries `upsertItemDetails(db, entries: ({ itemId: number } & ItemDetails)[], now)`, `getItemDetailsMap(db, ids): Promise<Map<number, ItemDetails>>`
  - `ensureItemDetails(deps: { db; blizzard; now: number }, region, itemIds): Promise<Map<number, ItemDetails>>`

- [ ] **Step 1: Add the table and generate a migration**

In `src/core/db/schema.ts`, add below `items`:

```ts
export const itemDetails = sqliteTable('item_details', {
  itemId: integer('item_id').primaryKey(),
  quality: text('quality').$type<Quality>(),
  isTier: integer('is_tier', { mode: 'boolean' }).notNull(),
  fetchedAt: integer('fetched_at').notNull(),
});
```

Run: `npm run db:generate -- --name item-details`
Expected: a new `drizzle/0003_item-details.sql`.

- [ ] **Step 2: Write the failing tests**

In `src/core/blizzard/client.test.ts`, add inside the `describe`:

```ts
  it('reads item quality and whether the item belongs to a set', async () => {
    const { api } = client([
      on('/data/wow/item/111', () => json({ quality: { type: 'EPIC' }, preview_item: { set: { item_set: { id: 2057 } } } })),
      on('/data/wow/item/222', () => json({ quality: { type: 'RARE' }, preview_item: {} })),
      on('/data/wow/item/999', () => new Response('', { status: 404 })),
    ]);
    expect(await api.getItemDetails('eu', 111)).toEqual({ quality: 'EPIC', isTier: true });
    expect(await api.getItemDetails('eu', 222)).toEqual({ quality: 'RARE', isTier: false });
    expect(await api.getItemDetails('eu', 999)).toBeNull();
  });
```

In `src/core/db/queries.test.ts`, add `getItemDetailsMap, upsertItemDetails` to the import from `./queries`, then add inside `describe('tracks, meta and icons', ...)`:

```ts
  it('stores item details', async () => {
    const db = await openTestDb();
    await upsertItemDetails(db, [{ itemId: 1, quality: 'EPIC', isTier: true }, { itemId: 2, quality: null, isTier: false }], 1);
    expect(await getItemDetailsMap(db, [1, 2, 3])).toEqual(new Map([[1, { quality: 'EPIC', isTier: true }], [2, { quality: null, isTier: false }]]));
    expect((await getItemDetailsMap(db, [])).size).toBe(0);
  });
```

In `src/core/sync/reference-sync.test.ts`, change the import to include `ensureItemDetails`, then add at the end:

```ts
describe('ensureItemDetails', () => {
  it('fetches unknown items once and remembers items Blizzard doesn’t know', async () => {
    const db = await openTestDb();
    const asked: number[] = [];
    const blizzard = {
      getItemDetails: async (_region: string, id: number) => { asked.push(id); return id === 1 ? { quality: 'EPIC', isTier: true } : null; },
    } as unknown as BlizzardClient;
    const first = await ensureItemDetails({ db, blizzard, now: 1 }, 'eu', [1, 2, 1]);
    expect(first.get(1)).toEqual({ quality: 'EPIC', isTier: true });
    expect(first.get(2)).toEqual({ quality: null, isTier: false });
    await ensureItemDetails({ db, blizzard, now: 2 }, 'eu', [1, 2]);
    expect(asked.sort()).toEqual([1, 2]);
  });

  it('skips items that fail to load so they retry later', async () => {
    const db = await openTestDb();
    const blizzard = { getItemDetails: async () => { throw new Error('down'); } } as unknown as BlizzardClient;
    expect((await ensureItemDetails({ db, blizzard, now: 1 }, 'eu', [7])).has(7)).toBe(false);
  });
});
```

In `src/core/sync/character-sync.test.ts`, add `getItemDetails: async () => null,` to the `client` object in `fakeBlizzard`, after `getItemIconUrl`.

Run: `npx vitest run src/core`
Expected: FAIL, because `getItemDetails`, the item details queries and `ensureItemDetails` don't exist.

- [ ] **Step 3: Implement item details**

In `src/core/blizzard/client.ts`:
- Add after the `PlayableClass` interface:

```ts
export interface ItemDetails { quality: Quality | null; isTier: boolean }
```

- Add to the `BlizzardClient` interface, after `getItemIconUrl`:

```ts
  getItemDetails(region: Region, itemId: number): Promise<ItemDetails | null>;
```

- Add to the returned object, after `getItemIconUrl`:

```ts
    async getItemDetails(region, itemId) {
      try {
        const item = await api<{ quality?: { type: string }; preview_item?: { set?: unknown } }>(region, `/data/wow/item/${itemId}`, 'static');
        return { quality: (item.quality?.type as Quality | undefined) ?? null, isTier: Boolean(item.preview_item?.set) };
      } catch (err) {
        if (err instanceof HttpError && err.status === 404) return null;
        throw err;
      }
    },
```

In `src/core/db/queries.ts`:
- Add `itemDetails` to the import from `./schema`.
- Add `import type { ItemDetails } from '../blizzard/client';` at the top.
- Add after `getItemIcons`:

```ts
export async function upsertItemDetails(db: Db, entries: ({ itemId: number } & ItemDetails)[], now: number) {
  await withWriteLock(db, async () => {
    for (const entry of entries) {
      await db.insert(itemDetails).values({ ...entry, fetchedAt: now })
        .onConflictDoUpdate({ target: itemDetails.itemId, set: { quality: entry.quality, isTier: entry.isTier, fetchedAt: now } });
    }
  });
}

export async function getItemDetailsMap(db: Db, ids: number[]): Promise<Map<number, ItemDetails>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(itemDetails).where(inArray(itemDetails.itemId, [...new Set(ids)]));
  return new Map(rows.map((r) => [r.itemId, { quality: r.quality, isTier: r.isTier }]));
}
```

In `src/core/sync/reference-sync.ts`:
- Add `getItemDetailsMap, upsertItemDetails` to the queries import, and change the client import to `import type { BlizzardClient, ItemDetails } from '../blizzard/client';`.
- Add at the end of the file:

```ts
export async function ensureItemDetails(
  deps: { db: Db; blizzard: BlizzardClient; now: number }, region: Region, itemIds: number[],
): Promise<Map<number, ItemDetails>> {
  const { db, blizzard, now } = deps;
  const unique = [...new Set(itemIds)];
  const known = await getItemDetailsMap(db, unique);
  const unknown = unique.filter((id) => !known.has(id));
  const fetched = await Promise.all(unknown.map(async (itemId) => {
    try {
      const details = await blizzard.getItemDetails(region, itemId);
      return { itemId, ...(details ?? { quality: null, isTier: false }) };
    } catch {
      return null;
    }
  }));
  const found = fetched.filter((entry): entry is { itemId: number } & ItemDetails => entry !== null);
  if (found.length > 0) await upsertItemDetails(db, found, now);
  return getItemDetailsMap(db, unique);
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src && npm run typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/core drizzle
git commit -m "feat: fetch item quality and tier membership from Blizzard"
```

---

### Task 6: Import a SimC paste

**Files:**
- Create: `src/core/simc/import-simc.ts`
- Test: `src/core/simc/import-simc.test.ts`

**Interfaces:**
- Consumes: `parseSimc`, `SimcParseError` (Task 2), `qualityFromBonuses` (Task 1), `ensureItemDetails` (Task 5), `saveSnapshotIfChanged` with currencies (Task 4), `getCharacter`, `UserError`.
- Produces:
  - `interface ImportResult { changed: boolean; equipped: number; bags: number; vault: number }`
  - `importSimc(deps: { db; blizzard; qualities: ReadonlyMap<number, Quality>; now: () => number }, characterId: number, text: string): Promise<ImportResult>`

- [ ] **Step 1: Write the failing tests**

`src/core/simc/import-simc.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { importSimc } from './import-simc';
import { getLatestSnapshot, insertCharacter } from '../db/queries';
import { UserError } from '../errors';
import type { BlizzardClient } from '../blizzard/client';

const text = readFileSync(new URL('./__fixtures__/export.txt', import.meta.url), 'utf8');

const blizzard = {
  getItemDetails: async (_region: string, id: number) => (id === 271528 ? { quality: 'EPIC', isTier: true } : { quality: 'RARE', isTier: false }),
} as unknown as BlizzardClient;
const qualities = new Map([[12850, 'EPIC' as const]]);

async function setup(realmName = 'Tarren Mill', realmSlug = 'tarren-mill') {
  const db = await openTestDb();
  const { id } = await insertCharacter(db, { region: 'eu', realmId: 1, realmSlug, realmName, name: 'Testbear', className: 'Druid', specName: 'Guardian' }, 1);
  return { db, id, deps: { db, blizzard, qualities, now: () => 500 } };
}

describe('importSimc', () => {
  it('saves a SimC snapshot with equipped, bag and vault items and crests', async () => {
    const { db, id, deps } = await setup();
    expect(await importSimc(deps, id, text)).toEqual({ changed: true, equipped: 3, bags: 2, vault: 1 });
    const snapshot = await getLatestSnapshot(db, id);
    expect(snapshot).toMatchObject({ source: 'simc', createdAt: 500 });
    expect(snapshot!.currencies).toHaveLength(3);
    const head = snapshot!.items.find((i) => i.slot === 'HEAD')!;
    expect(head).toMatchObject({ itemId: 271528, quality: 'EPIC', isTier: true, itemLevel: 321 });
    const neck = snapshot!.items.find((i) => i.slot === 'NECK')!;
    expect(neck).toMatchObject({ quality: 'RARE', isTier: false });
  });

  it('reports an identical paste as unchanged', async () => {
    const { id, deps } = await setup();
    await importSimc(deps, id, text);
    expect((await importSimc(deps, id, text)).changed).toBe(false);
  });

  it('matches realm tokens without dashes or spaces', async () => {
    const { id, deps } = await setup('Azjol-Nerub', 'azjol-nerub');
    const other = text.replace('server=tarren_mill', 'server=azjolnerub');
    expect((await importSimc(deps, id, other)).changed).toBe(true);
  });

  it('rejects a paste from another character, naming who it belongs to', async () => {
    const { id, deps } = await setup();
    await expect(importSimc(deps, id, text.replace('druid="Testbear"', 'druid="Otherbear"')))
      .rejects.toThrow('This SimC export is for Otherbear, not Testbear.');
  });

  it('rejects a paste from another realm or region', async () => {
    const { id, deps } = await setup();
    await expect(importSimc(deps, id, text.replace('server=tarren_mill', 'server=draenor'))).rejects.toThrow(/realm "draenor"/);
    await expect(importSimc(deps, id, text.replace('region=eu', 'region=us'))).rejects.toThrow(/region US/);
  });

  it('turns parse errors into a readable message', async () => {
    const { id, deps } = await setup();
    await expect(importSimc(deps, id, 'hello there')).rejects.toBeInstanceOf(UserError);
    await expect(importSimc(deps, id, 'hello there')).rejects.toThrow(/Couldn’t read that SimC text/);
  });
});
```

Run: `npx vitest run src/core/simc/import-simc.test.ts`
Expected: FAIL, because `./import-simc` doesn't exist.

- [ ] **Step 2: Implement the import**

`src/core/simc/import-simc.ts`:

```ts
import type { BlizzardClient } from '../blizzard/client';
import type { Db } from '../db/client';
import { getCharacter, saveSnapshotIfChanged, type SnapshotItemInput } from '../db/queries';
import { UserError } from '../errors';
import { qualityFromBonuses } from '../raidbots/tracks';
import { ensureItemDetails } from '../sync/reference-sync';
import type { ItemLocation, Quality } from '../types';
import { parseSimc, SimcParseError, type SimcProfile } from './parse';

export interface ImportResult {
  changed: boolean;
  equipped: number;
  bags: number;
  vault: number;
}

interface Deps {
  db: Db;
  blizzard: BlizzardClient;
  qualities: ReadonlyMap<number, Quality>;
  now: () => number;
}

// SimC tokens drop spaces, dashes and apostrophes ("tarren_mill", "azjolnerub"), so compare letters and digits only.
const normalize = (text: string) => text.normalize('NFC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]/gu, '');

export async function importSimc({ db, blizzard, qualities, now }: Deps, characterId: number, text: string): Promise<ImportResult> {
  const character = await getCharacter(db, characterId);
  if (!character) throw new UserError('That character isn’t tracked anymore.');

  let profile: SimcProfile;
  try {
    profile = parseSimc(text);
  } catch (err) {
    if (err instanceof SimcParseError) throw new UserError(`Couldn’t read that SimC text. ${err.message}`);
    throw err;
  }

  if (normalize(profile.name) !== normalize(character.name)) {
    throw new UserError(`This SimC export is for ${profile.name}, not ${character.name}.`);
  }
  if (profile.region.toLowerCase() !== character.region) {
    throw new UserError(`This SimC export is from region ${profile.region.toUpperCase() || 'unknown'}, but ${character.name} is in ${character.region.toUpperCase()}.`);
  }
  const realm = normalize(profile.realmToken);
  if (realm !== normalize(character.realmName) && realm !== normalize(character.realmSlug)) {
    throw new UserError(`This SimC export is from the realm "${profile.realmToken}", but ${character.name} is on ${character.realmName}.`);
  }

  const time = now();
  const details = await ensureItemDetails({ db, blizzard, now: time }, character.region, profile.items.map((i) => i.itemId));
  const items: SnapshotItemInput[] = profile.items.map((item) => ({
    location: item.location,
    slot: item.slot,
    itemId: item.itemId,
    name: item.name ?? `Item ${item.itemId}`,
    itemLevel: item.itemLevel,
    quality: qualityFromBonuses(item.bonusIds, qualities) ?? details.get(item.itemId)?.quality ?? 'COMMON',
    bonusIds: item.bonusIds,
    isTier: details.get(item.itemId)?.isTier ?? false,
  }));

  const { changed } = await saveSnapshotIfChanged(db, characterId, 'simc', items, time, profile.currencies);
  const count = (location: ItemLocation) => items.filter((i) => i.location === location).length;
  return { changed, equipped: count('equipped'), bags: count('bag'), vault: count('vault') };
}
```

- [ ] **Step 3: Run the tests to see them pass**

Run: `npx vitest run src/core/simc`
Expected: PASS, 14 tests across both files.

- [ ] **Step 4: Commit**

```bash
git add src/core/simc/import-simc.ts src/core/simc/import-simc.test.ts
git commit -m "feat: import SimC pastes after checking they belong to the character"
```

---

### Task 7: SimC paste API route

**Files:**
- Create: `src/app/api/characters/[id]/simc/route.ts`

**Interfaces:**
- Consumes: `importSimc` (Task 6), `ensureTracks` (Task 1), `getServices`, `getCharacter`, `errorResponse`, `parseId`.
- Produces: `POST /api/characters/[id]/simc` with body `{ text: string }`, returning `ImportResult` on success or `{ error }` with status 400 or 404.

- [ ] **Step 1: Write the route**

`src/app/api/characters/[id]/simc/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { getCharacter } from '@/core/db/queries';
import { importSimc } from '@/core/simc/import-simc';
import { ensureTracks } from '@/core/sync/reference-sync';
import { getServices } from '@/server/services';
import { errorResponse, parseId } from '@/server/route-helpers';

const MAX_LENGTH = 200_000;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Unknown character' }, { status: 404 });
  try {
    const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
    const text = typeof body?.text === 'string' ? body.text : '';
    if (!text.trim()) return NextResponse.json({ error: 'Paste the text from the /simc window first.' }, { status: 400 });
    if (text.length > MAX_LENGTH) return NextResponse.json({ error: 'That text is too long to be a SimC export.' }, { status: 400 });

    const services = await getServices();
    if (!(await getCharacter(services.db, id))) return NextResponse.json({ error: 'Unknown character' }, { status: 404 });
    const { qualities } = await ensureTracks({ db: services.db, fetchRaidbots: services.fetchRaidbots, now: services.now() });
    const result = await importSimc({ db: services.db, blizzard: services.blizzard, qualities, now: services.now }, id, text);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npm run typecheck && npm run lint`
Expected: both pass.

- [ ] **Step 3: Check the route against the dev server**

Run `npm run dev`, then check the rejection paths:

```bash
curl -s -X POST -H "Content-Type: application/json" -d '{"text":""}' http://localhost:3000/api/characters/1/simc
curl -s -X POST -H "Content-Type: application/json" -d '{"text":"hello"}' http://localhost:3000/api/characters/1/simc
curl -s -X POST -H "Content-Type: application/json" --data-binary @- http://localhost:3000/api/characters/1/simc < /dev/null
```

Expected:
1. `{"error":"Paste the text from the /simc window first."}`
2. `{"error":"Couldn’t read that SimC text. The character line is missing, ..."}`
3. The same "Paste the text" error, not a 500.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/characters/[id]/simc"
git commit -m "feat: add the SimC paste API route"
```

---

### Task 8: View models for crests, upgrades, bags and vault choices

**Files:**
- Modify: `src/server/views.ts` (replace), `src/server/views.test.ts`

**Interfaces:**
- Consumes: `crestCostsByGroup`, `affordableUpgrade`, `summarizeCrests`, `CrestBalance`, `UpgradeOption` (Task 3). `getLatestSnapshot(db, id, source?)`, `Snapshot` with currencies (Task 4). `ensureTracks` returning qualities (Task 1). `decodeTrack`.
- Produces:
  - `GearRowView` gains `upgrade: UpgradeOption | null`
  - `interface VaultChoiceView extends ItemView { isBis: boolean }`
  - `interface CrestView { balances: CrestBalance[]; pastedAt: number }`
  - `CharacterSummary` gains `sourceAt: number | null`: the paste time for SimC gear, the last sync time for Blizzard gear
  - `CharacterCardView` gains `crests: CrestView | null` and `upgradesReady: number`
  - `CharacterPageView` gains `vaultChoices: VaultChoiceView[]`, `vaultChoicesAt: number | null` and `crests: CrestView | null`

- [ ] **Step 1: Write the failing tests**

In `src/server/views.test.ts`:

1. Change the queries import to `import { gearToSnapshotItems, insertCharacter, saveSnapshotIfChanged } from '@/core/db/queries';`
2. Replace the `tracks` constant so it includes a Hero track with cost data:

```ts
const tracks: Track[] = [
  { bonusId: 99, name: 'Hero', step: 5, max: 6, group: 617, currencyId: null, currencyName: null, costPerStep: null },
  { bonusId: 98, name: 'Hero', step: 6, max: 6, group: 617, currencyId: 3445, currencyName: 'Hero Mistcrest', costPerStep: 20 },
];
```

3. Change `async function services(): Promise<Services> {` to `async function services(bisLists: BisLists = lists): Promise<Services> {`, and inside it change `bisSource: { name: 'Fake', fetchLists: async () => lists },` to `bisSource: { name: 'Fake', fetchLists: async () => bisLists },`.
4. Add at the end of the file:

```ts
describe('SimC data', () => {
  const withBelt: BisLists = {
    ...lists,
    mythicPlus: [...lists.mythicPlus, { slotLabel: 'Belt', slots: ['WAIST'], itemId: 30, name: 'Best Belt', bonusIds: [], isTier: false, isCatalyst: false, source: 'Dungeon C' }],
  };
  const pasted = [
    ...gearToSnapshotItems(gear),
    { location: 'bag' as const, slot: 'WAIST', itemId: 30, name: 'Best Belt', itemLevel: 300, quality: 'EPIC' as const, bonusIds: [], isTier: false },
    { location: 'vault' as const, slot: 'NECK', itemId: 20, name: 'Best Neck', itemLevel: 330, quality: 'EPIC' as const, bonusIds: [], isTier: false },
    { location: 'vault' as const, slot: 'BACK', itemId: 77, name: 'Other Cloak', itemLevel: 330, quality: 'EPIC' as const, bonusIds: [], isTier: false },
  ];
  const crests = [{ kind: 'upgrade' as const, currencyId: 3445, quantity: 45 }];

  it('shows bag BiS items, crests, upgrade flags and vault choices from a paste', async () => {
    const s = await services(withBelt);
    const id = await seed(s);
    await saveSnapshotIfChanged(s.db, id, 'simc', pasted, 900, crests);

    const page = await getCharacterPage(s, id);
    expect(page!.sourceAt).toBe(900);
    expect(page!.rows.map((r) => r.state)).toEqual(['done', 'belowMyth', 'inBags']);
    expect(page!.rows[0]!.upgrade).toBeNull();
    expect(page!.rows[1]!.upgrade).toEqual({ steps: 1, currencyName: 'Hero Mistcrest', costPerStep: 20 });
    expect(page!.crests).toEqual({ balances: [{ currencyId: 3445, name: 'Hero Mistcrest', quantity: 45, steps: 2 }], pastedAt: 900 });
    expect(page!.vaultChoices.map((v) => [v.itemId, v.isBis])).toEqual([[20, true], [77, false]]);
    expect(page!.vaultChoicesAt).toBe(900);

    const [card] = await getCharacterCards(s);
    expect(card).toMatchObject({ upgradesReady: 1, crests: { pastedAt: 900 }, sourceAt: 900 });
  });

  it('keeps crests from the last paste after Blizzard takes over, but forgets the bags', async () => {
    const s = await services(withBelt);
    const id = await seed(s);
    await saveSnapshotIfChanged(s.db, id, 'simc', pasted, 900, crests);
    const upgraded = gear.map((g) => (g.slot === 'NECK' ? { ...g, itemLevel: 330 } : g));
    await saveSnapshotIfChanged(s.db, id, 'blizzard', gearToSnapshotItems(upgraded), 950);

    const page = await getCharacterPage(s, id);
    expect(page!.snapshot?.source).toBe('blizzard');
    expect(page!.rows[2]!.state).toBe('missing');
    expect(page!.crests?.pastedAt).toBe(900);
    expect(page!.vaultChoices).toHaveLength(2);
  });

  it('shows no crests or vault choices without a paste', async () => {
    const s = await services();
    const id = await seed(s);
    const page = await getCharacterPage(s, id);
    expect(page).toMatchObject({ crests: null, vaultChoices: [], vaultChoicesAt: null });
    expect(page!.rows.every((r) => r.upgrade === null)).toBe(true);
  });
});
```

Run: `npx vitest run src/server`
Expected: FAIL, because the view models have no `sourceAt`, `upgrade`, `crests` or `vaultChoices`, and ignore bag items.

- [ ] **Step 2: Replace the views module**

Replace `src/server/views.ts`:

```ts
import type { Db } from '@/core/db/client';
import {
  equippedGear, getCharacter, getLatestSnapshot, listCharacters, type CharacterRow, type Snapshot, type SnapshotItemInput,
} from '@/core/db/queries';
import { affordableUpgrade, crestCostsByGroup, summarizeCrests, type CrestBalance, type CrestCost, type UpgradeOption } from '@/core/gear/crests';
import { countStates, evaluateGear, type GearRow } from '@/core/gear/evaluate';
import { methodSpecSlug } from '@/core/method/method';
import { decodeTrack, trackLabel } from '@/core/raidbots/tracks';
import { ensureBisLists, ensureItemIcons, ensureTracks, type BisResult } from '@/core/sync/reference-sync';
import {
  LIST_TYPES, type GearItem, type ItemState, type ListType, type Quality, type Region, type SlotType, type SnapshotSource, type Track,
} from '@/core/types';
import type { Services } from './services';

export interface ItemView {
  itemId: number;
  name: string;
  itemLevel: number | null;
  quality: Quality;
  bonusIds: number[];
  iconUrl: string | null;
  trackLabel: string | null;
}

export interface GearRowView {
  slotLabel: string;
  slot: SlotType;
  state: ItemState;
  equipped: ItemView | null;
  bis: ItemView & { isTier: boolean; isCatalyst: boolean; source: string };
  upgrade: UpgradeOption | null;
}

export interface VaultChoiceView extends ItemView {
  isBis: boolean;
}

export interface CrestView {
  balances: CrestBalance[];
  pastedAt: number;
}

export interface CharacterSummary {
  id: number;
  name: string;
  realmName: string;
  region: Region;
  className: string;
  activeSpec: string;
  spec: string;
  specSlug: string;
  status: 'ok' | 'notFound';
  lastSyncedAt: number | null;
  lastSyncError: string | null;
  priorityList: 'mythicPlus' | 'overall';
  snapshot: { source: SnapshotSource; createdAt: number } | null;
  /** When the current gear was captured: the paste time for SimC, the last sync for Blizzard. */
  sourceAt: number | null;
}

export interface CharacterCardView extends CharacterSummary {
  counts: Record<ItemState, number> | null;
  tracksError: string | null;
  total: number;
  bisError: string | null;
  crests: CrestView | null;
  upgradesReady: number;
}

export interface CharacterPageView extends CharacterSummary {
  listType: ListType;
  rows: GearRowView[];
  vault: GearRowView[];
  vaultChoices: VaultChoiceView[];
  vaultChoicesAt: number | null;
  crests: CrestView | null;
  counts: Record<ListType, { bis: number; total: number }>;
  bisFetchedAt: number | null;
  bisError: string | null;
  tracksError: string | null;
  specs: string[];
}

interface GearContext {
  current: Snapshot | null;
  simc: Snapshot | null;
  equipped: GearItem[];
  bagItemIds: Set<number>;
  balances: Map<number, number>;
}

async function loadGear(db: Db, characterId: number): Promise<GearContext> {
  const current = await getLatestSnapshot(db, characterId);
  const simc = current?.source === 'simc' ? current : await getLatestSnapshot(db, characterId, 'simc');
  return {
    current,
    simc,
    equipped: current ? equippedGear(current) : [],
    // Bag contents are only known while the current gear comes from a paste.
    bagItemIds: new Set(current?.source === 'simc' ? current.items.filter((i) => i.location === 'bag').map((i) => i.itemId) : []),
    // Crests only come from pastes, so the latest paste's balances stay useful after Blizzard takes over.
    balances: new Map((simc?.currencies ?? []).filter((c) => c.kind === 'upgrade').map((c) => [c.currencyId, c.quantity])),
  };
}

function summarize(c: CharacterRow, snapshot: Snapshot | null): CharacterSummary {
  const spec = c.specOverride || c.specName;
  return {
    id: c.id, name: c.name, realmName: c.realmName, region: c.region, className: c.className,
    activeSpec: c.specName, spec, specSlug: methodSpecSlug(spec, c.className),
    status: c.status, lastSyncedAt: c.lastSyncedAt, lastSyncError: c.lastSyncError, priorityList: c.priorityList,
    snapshot: snapshot && { source: snapshot.source, createdAt: snapshot.createdAt },
    sourceAt: !snapshot ? null : snapshot.source === 'simc' ? snapshot.createdAt : c.lastSyncedAt ?? snapshot.createdAt,
  };
}

/** Only BiS items the character already wears on a track get a flag; crests spent elsewhere are wasted. */
const upgradeFor = (row: GearRow, costs: ReadonlyMap<number, CrestCost>, balances: ReadonlyMap<number, number>) =>
  row.matched && (row.state === 'mythUpgradable' || row.state === 'belowMyth') ? affordableUpgrade(row.track, costs, balances) : null;

const crestView = (gear: GearContext, costs: ReadonlyMap<number, CrestCost>): CrestView | null =>
  gear.simc ? { balances: summarizeCrests(gear.balances, costs), pastedAt: gear.simc.createdAt } : null;

const bisCount = (rows: GearRow[]) => rows.filter((r) => r.matched).length;

export async function getCharacterCards(services: Services): Promise<CharacterCardView[]> {
  const { db, bisSource, fetchRaidbots, now } = services;
  const time = now();
  const { tracks, error: tracksError } = await ensureTracks({ db, fetchRaidbots, now: time });
  const costs = crestCostsByGroup(tracks.values());
  const bisBySlug = new Map<string, Promise<BisResult>>();
  const characters = await listCharacters(db);
  return Promise.all(characters.map(async (c) => {
    const gear = await loadGear(db, c.id);
    const summary = summarize(c, gear.current);
    if (!bisBySlug.has(summary.specSlug)) bisBySlug.set(summary.specSlug, ensureBisLists({ db, source: bisSource, now: time }, summary.specSlug));
    const bis = await bisBySlug.get(summary.specSlug)!;
    const bisRows = bis.lists?.[c.priorityList] ?? [];
    const rows = evaluateGear({ equipped: gear.equipped, bisRows, tracks, bagItemIds: gear.bagItemIds });
    return {
      ...summary,
      counts: bis.lists ? countStates(rows) : null,
      total: rows.length,
      bisError: bis.error,
      tracksError,
      crests: crestView(gear, costs),
      upgradesReady: rows.filter((r) => upgradeFor(r, costs, gear.balances)).length,
    };
  }));
}

function itemView(
  item: { itemId: number; name: string; itemLevel: number | null; quality: Quality; bonusIds: number[] },
  icons: ReadonlyMap<number, string | null>, track: Track | null,
): ItemView {
  return {
    itemId: item.itemId,
    name: item.name,
    itemLevel: item.itemLevel,
    quality: item.quality,
    bonusIds: item.bonusIds,
    iconUrl: icons.get(item.itemId) ?? null,
    trackLabel: track ? trackLabel(track) : null,
  };
}

export async function getCharacterPage(services: Services, id: number, listType?: ListType): Promise<CharacterPageView | null> {
  const { db, blizzard, bisSource, fetchRaidbots, now } = services;
  const character = await getCharacter(db, id);
  if (!character) return null;
  const time = now();
  const gear = await loadGear(db, id);
  const summary = summarize(character, gear.current);
  const list = listType ?? character.priorityList;

  const specsPromise = blizzard.getClasses(character.region)
    .then((classes) => classes.find((cls) => cls.name === character.className)?.specs ?? [summary.spec])
    .catch(() => [summary.spec]);
  // Database work runs in sequence: an in-memory libsql database can't serve a read while a write transaction is open.
  const { tracks, error: tracksError } = await ensureTracks({ db, fetchRaidbots, now: time });
  const bis = await ensureBisLists({ db, source: bisSource, now: time }, summary.specSlug);
  const specs = await specsPromise;
  const costs = crestCostsByGroup(tracks.values());

  const evaluate = (l: ListType) => evaluateGear({ equipped: gear.equipped, bisRows: bis.lists?.[l] ?? [], tracks, bagItemIds: gear.bagItemIds });
  const gearRows = evaluate(list);
  const vaultItems = gear.simc?.items.filter((i) => i.location === 'vault') ?? [];

  const iconIds = [...gear.equipped.map((g) => g.itemId), ...gearRows.map((r) => r.row.itemId), ...vaultItems.map((i) => i.itemId)];
  const icons = await ensureItemIcons({ db, blizzard, now: time }, character.region, iconIds);

  const rows: GearRowView[] = gearRows.map((r) => ({
    slotLabel: r.row.slotLabel,
    slot: r.slot,
    state: r.state,
    equipped: r.equipped && itemView(r.equipped, icons, r.track),
    bis: {
      ...itemView({ itemId: r.row.itemId, name: r.row.name, itemLevel: null, quality: 'EPIC', bonusIds: r.row.bonusIds }, icons, null),
      isTier: r.row.isTier,
      isCatalyst: r.row.isCatalyst,
      source: r.row.source,
    },
    upgrade: upgradeFor(r, costs, gear.balances),
  }));

  const listRows = bis.lists?.[list] ?? [];
  const isBis = (item: SnapshotItemInput) =>
    listRows.some((r) => r.itemId === item.itemId || (r.isTier && item.isTier && r.slots.includes(item.slot as SlotType)));
  const vaultChoices = vaultItems.map((item) => ({ ...itemView(item, icons, decodeTrack(item.bonusIds, tracks)), isBis: isBis(item) }));

  const counts = Object.fromEntries(LIST_TYPES.map((l) => {
    const evaluated = l === list ? gearRows : evaluate(l);
    return [l, { bis: bisCount(evaluated), total: evaluated.length }];
  })) as Record<ListType, { bis: number; total: number }>;

  return {
    ...summary,
    listType: list,
    rows,
    vault: rows.filter((r) => r.state === 'belowMyth'),
    vaultChoices,
    vaultChoicesAt: gear.simc?.createdAt ?? null,
    crests: crestView(gear, costs),
    counts,
    bisFetchedAt: bis.fetchedAt,
    bisError: bis.error,
    tracksError,
    specs,
  };
}
```

- [ ] **Step 3: Run the tests to see them pass**

Run: `npx vitest run src && npm run typecheck`
Expected: all pass, including the 3 new view tests.

- [ ] **Step 4: Commit**

```bash
git add src/server
git commit -m "feat: add crests, upgrade flags, bag items and vault choices to the view models"
```

---

### Task 9: SimC paste box, crests and upgrade badges in the UI

**Files:**
- Create: `src/components/SimcPaste.tsx`, `src/components/UpgradeBadge.tsx`, `src/components/CrestSummary.tsx`
- Modify: `src/app/characters/[id]/page.tsx` (replace), `src/components/CharacterCard.tsx` (replace)

**Interfaces:**
- Consumes: `CharacterPageView`, `CharacterCardView`, `CrestView`, `GearRowView`, `VaultChoiceView` (Task 8). `UpgradeOption` (Task 3). The route from Task 7.
- Produces: `<SimcPaste id />`, `<UpgradeBadge upgrade />`, `<CrestSummary crests now />`.

- [ ] **Step 1: Write the new components**

`src/components/UpgradeBadge.tsx`:

```tsx
import type { UpgradeOption } from '@/core/gear/crests';

export function UpgradeBadge({ upgrade }: { upgrade: UpgradeOption }) {
  const steps = `${upgrade.steps} ${upgrade.steps === 1 ? 'step' : 'steps'}`;
  return (
    <span
      title={`You can upgrade this now: ${upgrade.costPerStep} ${upgrade.currencyName} per step`}
      className="inline-flex h-[26px] w-fit items-center gap-1 rounded-full border border-[#3e8a4d] bg-[#173020] px-2 text-[13px] font-bold text-upgrade"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
      {steps}
      <span className="sr-only"> of upgrades you can afford now</span>
    </span>
  );
}
```

`src/components/CrestSummary.tsx`:

```tsx
import { formatAge } from '@/core/format';
import type { CrestView } from '@/server/views';

export function CrestSummary({ crests, now }: { crests: CrestView | null; now: number }) {
  if (!crests) return <p className="text-sm text-muted">Crests unknown. Paste SimC to see them.</p>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {crests.balances.length === 0 && <span className="text-sm text-muted">No crests in the last paste.</span>}
      {crests.balances.map((b) => (
        <span key={b.currencyId} className="flex h-8 items-center gap-2 rounded-full border border-line bg-surface-2 px-3 text-sm">
          {b.name}
          <strong className="font-mono font-medium">{b.quantity}</strong>
          <span className="text-muted">({b.steps} {b.steps === 1 ? 'step' : 'steps'})</span>
        </span>
      ))}
      <span className="text-sm text-muted">From SimC, pasted {formatAge(crests.pastedAt, now)}</span>
    </div>
  );
}
```

`src/components/SimcPaste.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ImportResponse { error?: string; changed?: boolean; equipped?: number; bags?: number; vault?: number }

export function SimcPaste({ id }: { id: number }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/characters/${id}/simc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json().catch(() => ({}))) as ImportResponse;
      if (!res.ok) {
        setMessage({ kind: 'error', text: data.error ?? 'Couldn’t import that SimC text.' });
        return;
      }
      setText('');
      setMessage({
        kind: 'ok',
        text: data.changed
          ? `Imported ${data.equipped} equipped, ${data.bags} bag and ${data.vault} Great Vault items.`
          : 'Nothing changed since your last paste.',
      });
      router.refresh();
    } catch {
      setMessage({ kind: 'error', text: 'Couldn’t reach the app server.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="rounded-2xl border border-line bg-surface p-5">
      <summary className="cursor-pointer font-semibold">Update from SimC</summary>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <p className="text-sm text-muted">
          In game, type <code className="font-mono text-ink">/simc</code>, copy all the text, and paste it here. It updates your gear, bags,
          Great Vault and crests right away, with no logout needed.
        </p>
        <label htmlFor="simc-text" className="sr-only">SimC export</label>
        <textarea
          id="simc-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          spellCheck={false}
          placeholder={'druid="Name"\nregion=eu\n...'}
          className="rounded-xl border border-line-strong bg-surface-2 p-3 font-mono text-sm text-ink focus:border-gold focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={busy || !text.trim()} className="h-11 rounded-xl bg-gold px-5 font-bold text-[#1a1408] disabled:opacity-50">
            {busy ? 'Importing…' : 'Import'}
          </button>
          {message && (
            <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${message.kind === 'error' ? 'text-[#f3c9a2]' : 'text-upgrade'}`}>
              {message.text}
            </p>
          )}
        </div>
      </form>
    </details>
  );
}
```

- [ ] **Step 2: Replace the character card**

Replace `src/components/CharacterCard.tsx`:

```tsx
import Link from 'next/link';
import { formatAge } from '@/core/format';
import type { CharacterCardView } from '@/server/views';
import { classColor } from './class-colors';
import { RemoveCharacterButton } from './RemoveCharacterButton';

function crestLine(card: CharacterCardView): { text: string; tone: string } {
  if (!card.crests) return { text: 'Crests unknown: paste SimC', tone: 'text-muted' };
  const balances = card.crests.balances.map((b) => `${b.name.split(' ')[0]} ${b.quantity}`).join(', ') || 'No crests';
  if (card.upgradesReady === 0) return { text: `${balances}: no BiS upgrades affordable`, tone: 'text-muted' };
  const ready = `${card.upgradesReady} BiS ${card.upgradesReady === 1 ? 'upgrade' : 'upgrades'} ready`;
  return { text: `${balances}: ${ready}`, tone: 'text-upgrade' };
}

export function CharacterCard({ card, now }: { card: CharacterCardView; now: number }) {
  const color = classColor(card.className);
  const counts = card.counts;
  const bis = counts ? counts.done + counts.mythUpgradable + counts.belowMyth : 0;
  const source = card.snapshot && card.sourceAt !== null
    ? `${card.snapshot.source === 'simc' ? 'SimC, pasted' : 'Blizzard, synced'} ${formatAge(card.sourceAt, now)}`
    : 'Not synced yet';
  const listName = card.priorityList === 'mythicPlus' ? 'Mythic+ BiS' : 'Overall BiS';
  const crests = crestLine(card);

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-3.5">
        <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full border-2 bg-bg text-xl font-bold" style={{ borderColor: color, color }}>
          {card.name.charAt(0)}
        </span>
        <div className="flex min-w-0 flex-col">
          <Link href={`/characters/${card.id}`} className="truncate text-xl font-bold text-ink no-underline hover:underline">{card.name}</Link>
          <span className="text-[15px] text-muted">{card.realmName}</span>
          <span className="text-[15px] font-semibold" style={{ color }}>{card.spec} {card.className}</span>
        </div>
      </div>

      {card.status === 'notFound' ? (
        <p className="rounded-lg border border-[#8a5a2b] bg-[#2e1f16] p-3 text-[15px] text-[#f3c9a2]">
          Blizzard can&rsquo;t find this character. It may have been renamed or transferred.
        </p>
      ) : counts ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold uppercase tracking-wider text-muted">{listName}</span>
            <span className="font-mono"><strong className="text-gold">{bis}</strong><span className="text-muted"> / {card.total}</span></span>
          </div>
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div className="bg-gold" style={{ flexGrow: counts.done }} />
            <div className="bg-crest" style={{ flexGrow: counts.mythUpgradable }} />
            <div className="bg-vault" style={{ flexGrow: counts.belowMyth }} />
            <div style={{ flexGrow: counts.missing + counts.inBags }} />
          </div>
          <span className="text-sm text-muted">
            {counts.done} done, {counts.mythUpgradable} need crests, {counts.belowMyth} vault targets
            {counts.inBags > 0 ? `, ${counts.inBags} in bags` : ''}
          </span>
          <span className={`text-sm ${crests.tone}`}>{crests.text}</span>
        </div>
      ) : (
        <p className="text-sm text-muted">{card.bisError ?? 'Loading BiS list…'}</p>
      )}

      {card.tracksError && card.status === 'ok' && <p className="text-sm text-[#f3c9a2]">{card.tracksError}.</p>}
      {card.lastSyncError && card.status === 'ok' && <p className="text-sm text-[#f3c9a2]">{card.lastSyncError}</p>}

      <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
        <span className="text-sm text-muted">{source}</span>
        <RemoveCharacterButton id={card.id} name={card.name} />
      </div>
    </article>
  );
}
```

- [ ] **Step 3: Replace the character page**

Replace `src/app/characters/[id]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CharacterSettings } from '@/components/CharacterSettings';
import { classColor } from '@/components/class-colors';
import { CrestSummary } from '@/components/CrestSummary';
import { EmptySlotCard, ItemCard } from '@/components/ItemCard';
import { RefreshButton } from '@/components/RefreshButton';
import { RemoveCharacterButton } from '@/components/RemoveCharacterButton';
import { SetupNotice } from '@/components/SetupNotice';
import { SimcPaste } from '@/components/SimcPaste';
import { StaleSync } from '@/components/StaleSync';
import { StateBadge } from '@/components/StateBadge';
import { UpgradeBadge } from '@/components/UpgradeBadge';
import { MissingConfigError } from '@/core/config';
import { formatAge } from '@/core/format';
import { isStale } from '@/core/sync/character-sync';
import { LIST_TYPES, type ListType } from '@/core/types';
import { getServices, type Services } from '@/server/services';
import { getCharacterPage, type GearRowView } from '@/server/views';

export const dynamic = 'force-dynamic';

const LIST_NAMES: Record<ListType, string> = { overall: 'Overall', raid: 'Raid', mythicPlus: 'Mythic+' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ list?: string }> };

function BisTarget({ row }: { row: GearRowView }) {
  const name = row.bis.isTier ? `Tier piece (catalyst ${row.bis.name})` : row.bis.name;
  return (
    <ItemCard itemId={row.bis.itemId} name={name} quality={row.bis.quality} iconUrl={row.bis.iconUrl}
      bonusIds={row.bis.bonusIds} itemLevel={null} detail={row.bis.source} />
  );
}

export default async function CharacterPage({ params, searchParams }: Props) {
  const [{ id }, { list }] = await Promise.all([params, searchParams]);
  let services: Services;
  try {
    services = await getServices();
  } catch (err) {
    if (err instanceof MissingConfigError) return <SetupNotice missing={err.missing} />;
    throw err;
  }
  const listType = (LIST_TYPES as readonly string[]).includes(list ?? '') ? (list as ListType) : undefined;
  const view = await getCharacterPage(services, Number(id), listType);
  if (!view) notFound();

  const now = services.now();
  const color = classColor(view.className);
  const source = view.snapshot && view.sourceAt !== null
    ? `${view.snapshot.source === 'simc' ? 'From SimC, pasted' : 'From Blizzard, synced'} ${formatAge(view.sourceAt, now)}`
    : 'Not synced yet';

  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-10 sm:px-16">
      <Link href="/" className="text-sm">&larr; All characters</Link>

      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <span className="flex size-16 items-center justify-center rounded-full border-2 bg-bg text-2xl font-bold" style={{ borderColor: color, color }}>
            {view.name.charAt(0)}
          </span>
          <div className="flex flex-col">
            <h1 className="font-display text-4xl font-bold tracking-wide">{view.name}</h1>
            <span className="text-muted">{view.realmName} ({view.region.toUpperCase()})</span>
            <span className="font-semibold" style={{ color }}>{view.spec} {view.className}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">{source}</span>
          <RefreshButton id={view.id} />
          <RemoveCharacterButton id={view.id} name={view.name} redirectTo="/" />
        </div>
      </div>

      {view.status === 'notFound' && (
        <p role="alert" className="rounded-lg border border-[#8a5a2b] bg-[#2e1f16] p-3 text-[#f3c9a2]">
          Blizzard can&rsquo;t find this character. It may have been renamed or transferred. You can remove it and search again.
        </p>
      )}
      {view.status === 'ok' && view.lastSyncError && <p role="alert" className="text-[#f3c9a2]">{view.lastSyncError}</p>}
      {view.bisError && (
        <p role="alert" className="text-[#f3c9a2]">
          {view.bisError}{view.bisFetchedAt ? `. Showing the list from ${formatAge(view.bisFetchedAt, now)}.` : '.'}
        </p>
      )}
      {view.tracksError && <p role="alert" className="text-[#f3c9a2]">{view.tracksError}.</p>}

      <SimcPaste id={view.id} />

      <section aria-label="Crests" className="flex flex-col gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">Crests</h2>
        <CrestSummary crests={view.crests} now={now} />
      </section>

      <CharacterSettings id={view.id} specs={view.specs} spec={view.spec} activeSpec={view.activeSpec} priorityList={view.priorityList} />

      <nav aria-label="BiS lists" className="flex gap-2 border-b border-line">
        {LIST_TYPES.map((l) => (
          <Link key={l} href={`/characters/${view.id}?list=${l}`} aria-current={l === view.listType ? 'page' : undefined}
            className={`-mb-px border-b-2 px-4 py-3 font-semibold no-underline ${l === view.listType ? 'border-gold text-ink' : 'border-transparent text-muted'}`}>
            {LIST_NAMES[l]} <span className="font-mono text-sm">{view.counts[l].bis}/{view.counts[l].total}</span>
          </Link>
        ))}
      </nav>

      <section aria-label="Gear by slot" className="flex flex-col rounded-2xl border border-line bg-surface">
        <div className="hidden grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_190px] gap-3 border-b border-line px-4 py-3 text-[13px] font-semibold uppercase tracking-wider text-muted md:grid">
          <span>Slot</span><span>Equipped</span><span>BiS</span><span>State</span>
        </div>
        {view.rows.length === 0 && <p className="p-6 text-muted">No BiS list to compare against yet.</p>}
        {view.rows.map((row, index) => (
          <div key={`${row.slot}-${index}`} className="grid grid-cols-1 gap-3 border-b border-raised px-4 py-2 md:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_190px] md:items-center">
            <span className="font-semibold text-muted">{row.slotLabel}</span>
            {row.equipped ? (
              <ItemCard itemId={row.equipped.itemId} name={row.equipped.name} quality={row.equipped.quality} iconUrl={row.equipped.iconUrl}
                bonusIds={row.equipped.bonusIds} itemLevel={row.equipped.itemLevel} golden={row.state === 'done' && !view.tracksError}
                detail={[row.equipped.trackLabel ?? 'no track', row.equipped.itemLevel].filter(Boolean).join(' · ')} />
            ) : <EmptySlotCard />}
            <BisTarget row={row} />
            <div className="flex flex-col gap-1.5">
              <StateBadge state={row.state} />
              {row.upgrade && <UpgradeBadge upgrade={row.upgrade} />}
            </div>
          </div>
        ))}
      </section>

      <section aria-label="Great Vault" className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-2xl font-bold">Great Vault</h2>

        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-muted">BiS items below Myth track</h3>
          {view.vault.length === 0 ? (
            <p className="text-muted">None. Every BiS item you have is on Myth track.</p>
          ) : view.vault.map((row) => row.equipped && (
            <ItemCard key={row.slot} itemId={row.equipped.itemId} name={row.equipped.name} quality={row.equipped.quality}
              iconUrl={row.equipped.iconUrl} bonusIds={row.equipped.bonusIds} itemLevel={row.equipped.itemLevel}
              detail={row.equipped.trackLabel ?? undefined} />
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-muted">
            This week&rsquo;s choices{view.vaultChoicesAt !== null ? `, from SimC pasted ${formatAge(view.vaultChoicesAt, now)}` : ''}
          </h3>
          {view.vaultChoicesAt === null ? (
            <p className="text-muted">Paste SimC to see your Great Vault choices.</p>
          ) : view.vaultChoices.length === 0 ? (
            <p className="text-muted">No item choices in the vault in the last paste.</p>
          ) : view.vaultChoices.map((choice, index) => (
            <div key={`${choice.itemId}-${index}`} className="flex items-center gap-3">
              <div className="min-w-0 grow">
                <ItemCard itemId={choice.itemId} name={choice.name} quality={choice.quality} iconUrl={choice.iconUrl}
                  bonusIds={choice.bonusIds} itemLevel={choice.itemLevel}
                  detail={[choice.trackLabel, choice.itemLevel].filter(Boolean).join(' · ') || undefined} />
              </div>
              <span className={`w-20 shrink-0 text-sm font-bold ${choice.isBis ? 'text-bags' : 'text-muted'}`}>{choice.isBis ? 'BiS' : 'Not BiS'}</span>
            </div>
          ))}
        </div>
      </section>

      <StaleSync ids={view.status === 'ok' && isStale(view.lastSyncedAt, now) ? [view.id] : []} />
    </main>
  );
}
```

- [ ] **Step 4: Verify types, lint and build**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 5: Check it in the browser**

Run `npm run dev`. Take the fixture `src/core/simc/__fixtures__/export.txt`, and change `druid="Testbear"` and `server=tarren_mill` to match a character you track. Paste it on that character's page and import.

Expected:
1. The message says "Imported 3 equipped, 2 bag and 1 Great Vault items."
2. The source line reads "From SimC, pasted just now".
3. The crest row shows Myth and Hero crests with the steps they cover.
4. BiS items on a track below max show a green step badge when crests cover a step.
5. The Great Vault section lists this week's choice, marked BiS or Not BiS.
6. Pasting the same text again says "Nothing changed since your last paste."
7. Pasting text from a different character name shows the mismatch message, and the page doesn't change.
8. The characters page card shows the crest line and "SimC, pasted just now".
9. Clicking **Refresh** keeps the SimC gear, because Blizzard's data hasn't changed.

- [ ] **Step 6: Commit**

```bash
git add src/components src/app
git commit -m "feat: add the SimC paste box, crest summary and upgrade badges"
```

---

### Task 10: README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a SimC section**

In `README.md`, add after the "Set up" section:

````markdown
## Instant updates with SimC

Blizzard's API only updates a character after they log out. For instant updates, use the [SimulationCraft addon](https://www.curseforge.com/wow/addons/simulationcraft):

1. In game, type `/simc` and copy all the text.
2. On the character's page, open **Update from SimC**, paste, and select **Import**.

A paste also brings in bag items, Great Vault choices and crest counts, which Blizzard's API doesn't have. The pasted gear stays current until Blizzard's data changes, which happens after your next logout.
````

- [ ] **Step 2: Update the agent rules**

`AGENTS.md` arrives on `main` with PR #19. If it's there, rebase this branch on `main` first, then make these edits in its "Architecture rules" and "External data facts" sections:

- Replace ``  - Logic (`gear`) is pure functions, with no network or database access.`` with ``  - Logic (`gear`, `simc/parse`) is pure functions, with no network or database access.``
- Replace ``  - Sync (`sync`, `characters`) combines clients and the database, and receives both as parameters.`` with ``  - Sync (`sync`, `characters`, `simc/import-simc`) combines clients and the database, and receives both as parameters.``
- Replace `SimC pastes (plan 2) add instant updates.` with `SimC pastes add instant updates, plus bag items, Great Vault choices and crests. A paste stays current until Blizzard's own data changes.`

If PR #19 isn't merged yet, skip this step and record that in the ledger.

- [ ] **Step 3: Run the full check**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 4: Commit**

```bash
git add README.md AGENTS.md
git commit -m "docs: explain SimC pastes in the README and agent rules"
```
