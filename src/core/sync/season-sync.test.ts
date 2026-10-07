import { describe, expect, it, vi } from 'vitest';
import { openTestDb } from '@/test/db';
import { fakeFetch, json, on } from '@/test/fake-fetch';
import type { BlizzardClient } from '../blizzard/client';
import { DAY_MS } from './reference-sync';
import { getMeta, setMeta } from '../db/queries/meta';
import { replaceSeason } from '../db/queries/season';
import { readSeason, SEASON_META_KEY, syncSeason } from './season-sync';

const T = Date.parse('2026-09-30T12:00:00Z');

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

const KEYSTONES: Record<number, { name: string; mapId: number; mapName: string }> = {
  501: { name: 'Alpha Hollow', mapId: 11, mapName: 'Alpha Hollow' },
  502: { name: 'Streets of Beta', mapId: 22, mapName: 'Beta Market' },
  503: { name: 'Beta Gambit', mapId: 22, mapName: 'Beta Market' },
};
// 900 shares Alpha Hollow's name but not its map, so the join must reject it.
const INSTANCES: Record<number, { id: number; name: string; mapId: number; encounterIds: number[] }> = {
  900: { id: 900, name: 'Alpha Hollow', mapId: 99, encounterIds: [] },
  901: { id: 901, name: 'Alpha Hollow', mapId: 11, encounterIds: [1] },
  902: { id: 902, name: 'Beta Market', mapId: 22, encounterIds: [2, 3] },
};
const ENCOUNTERS: Record<number, { id: number; name: string; items: { itemId: number; name: string }[] }> = {
  1: { id: 1, name: 'Hollow King', items: [{ itemId: 100, name: 'Hollow Robe' }, { itemId: 101, name: 'Vanished Band' }] },
  2: { id: 2, name: 'Market Warden', items: [{ itemId: 200, name: 'Warden Helm' }] },
  3: { id: 3, name: 'Gambit Queen', items: [{ itemId: 300, name: 'Queen’s Charm' }] },
};
const ITEMS: Record<number, { inventoryType: string; armorType: 'leather' | 'plate' | null; secondaryStats?: string[] | null } | null> = {
  100: { inventoryType: 'ROBE', armorType: 'leather', secondaryStats: ['CRIT_RATING', 'VERSATILITY'] },
  101: null,
  200: { inventoryType: 'HEAD', armorType: 'plate', secondaryStats: null },
  300: { inventoryType: 'TRINKET', armorType: null },
};

function fakeBlizzard(overrides: Partial<Record<string, unknown>> = {}) {
  const calls = { index: 0, encounters: [] as number[], items: [] as number[] };
  const blizzard = {
    getKeystoneDungeon: async (_r: string, cm: number) => KEYSTONES[cm]!,
    getJournalInstances: async () => { calls.index++; return Object.values(INSTANCES).map(({ id, name }) => ({ id, name })); },
    getJournalInstance: async (_r: string, id: number) => INSTANCES[id]!,
    getJournalEncounter: async (_r: string, id: number) => { calls.encounters.push(id); return ENCOUNTERS[id]!; },
    getItemDetails: async (_r: string, id: number) => {
      calls.items.push(id);
      const info = ITEMS[id];
      return info ? { quality: 'EPIC', isTier: false, ...info } : null;
    },
    ...overrides,
  } as unknown as BlizzardClient;
  return { blizzard, calls };
}

const deps = async (blizzard: BlizzardClient, fetchFn = raiderIo().fn) => ({ db: await openTestDb(), blizzard, fetchFn, now: T, region: 'eu' as const });

describe('syncSeason', () => {
  it('stores the season under season.v3', () => {
    expect(SEASON_META_KEY).toBe('season.v3');
  });

  it('joins each dungeon to its journal instance by map ID and stores the loot with slots', async () => {
    const { blizzard, calls } = fakeBlizzard();
    const d = await deps(blizzard);
    expect(await syncSeason(d)).toBe('loaded');
    const state = await readSeason(d.db, T);
    expect(state).toMatchObject({ status: 'ready', needsSync: false });
    expect(state.dungeons.map((x) => [x.name, x.split])).toEqual([['Alpha Hollow', false], ['Beta Gambit', true], ['Streets of Beta', true]]);
    expect(state.dungeons[0]!.loot).toEqual([
      { itemId: 100, name: 'Hollow Robe', inventoryType: 'ROBE', armorType: 'leather', secondaryStats: ['CRIT_RATING', 'VERSATILITY'] },
      { itemId: 101, name: 'Vanished Band', inventoryType: null, armorType: null, secondaryStats: null },
    ]);
    expect(state.dungeons[1]!.loot[0]!.secondaryStats).toBeNull();
    // Split halves share instance 902 but keep their own artwork.
    expect(state.dungeons.map((x) => [x.challengeModeId, x.shortName, x.imageUrl])).toEqual([
      [501, 'AH', ART[501]], [503, 'GMBT', null], [502, 'STRT', ART[502]],
    ]);
    // Both Beta halves share instance 902: its encounters and items are fetched once.
    expect([...calls.encounters].sort()).toEqual([1, 2, 3]);
    expect([...calls.items].sort()).toEqual([100, 101, 200, 300]);
  });

  it('shares one load between two requests arriving together', async () => {
    const { blizzard, calls } = fakeBlizzard();
    const d = await deps(blizzard);
    expect(await Promise.all([syncSeason(d), syncSeason(d)])).toEqual(['loaded', 'loaded']);
    expect(calls.index).toBe(1);
  });

  it('skips within a day, and only rechecks the slug after one', async () => {
    const { blizzard, calls } = fakeBlizzard();
    const raider = raiderIo();
    const d = await deps(blizzard, raider.fn);
    await syncSeason(d);
    const raiderCalls = raider.calls.length;
    expect(await syncSeason({ ...d, now: T + 60_000 })).toBe('skipped');
    expect(raider.calls.length).toBe(raiderCalls);
    expect(await syncSeason({ ...d, now: T + DAY_MS + 1 })).toBe('current');
    expect(calls.index).toBe(1);
  });

  it('keeps the previous season when a later load fails, and marks it stale', async () => {
    const good = fakeBlizzard();
    const d = await deps(good.blizzard);
    await syncSeason(d);
    // Next season: a dungeon whose map no journal instance has.
    const next = fakeFetch([on('static-data', () => json({ seasons: [{
      slug: 'season-test-3', name: 'Test Season 3', is_main_season: true, starts: { eu: '2026-09-29T04:00:00Z' },
      dungeons: [{ challenge_mode_id: 777, name: 'Lost Vault', short_name: 'LV' }],
    }] }))]);
    const bad = fakeBlizzard({ getKeystoneDungeon: async () => ({ name: 'Lost Vault', mapId: 77, mapName: 'Lost Vault' }) });
    const later = T + DAY_MS + 1;
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await syncSeason({ ...d, blizzard: bad.blizzard, fetchFn: next.fn, now: later })).toBe('failed');
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
    const state = await readSeason(d.db, later);
    expect(state.status).toBe('stale');
    expect(state.dungeons.map((x) => x.name)).toEqual(['Alpha Hollow', 'Beta Gambit', 'Streets of Beta']);
  });

  it('refreshes artwork on the daily check without reloading loot', async () => {
    const { blizzard, calls } = fakeBlizzard();
    const d = await deps(blizzard);
    await syncSeason(d);
    const NEW = 'https://cdn.raiderio.net/images/dungeons/alpha-hollow-v2.jpg';
    // 501 changes, 502's field turns invalid, 503 stays without any.
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

  it('reloads a season stored under an older key even though its slug is unchanged', async () => {
    const { blizzard, calls } = fakeBlizzard();
    const d = await deps(blizzard);
    await replaceSeason(d.db, { slug: 'season-test-2', dungeons: [
      { challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', journalInstanceId: 901, mapId: 11, imageUrl: null },
    ], loot: [] });
    await setMeta(d.db, 'season.v2', 'season-test-2', T - 1000);
    expect(await syncSeason(d)).toBe('loaded');
    expect(calls.index).toBe(1);
    expect((await getMeta(d.db, SEASON_META_KEY))?.value).toBe('season-test-2');
    expect((await readSeason(d.db, T)).dungeons.find((x) => x.challengeModeId === 501)!.imageUrl).toBe(ART[501]);
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
});

describe('readSeason', () => {
  it('asks for a sync and says loading before any season is stored', async () => {
    expect(await readSeason(await openTestDb(), T)).toEqual({ status: 'loading', needsSync: true, dungeons: [] });
  });

  it('says failed, and waits before retrying, when the first load fails', async () => {
    const { blizzard } = fakeBlizzard({ getJournalInstances: async () => { throw new Error('Blizzard is down'); } });
    const d = await deps(blizzard);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await syncSeason(d)).toBe('failed');
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
    expect(await readSeason(d.db, T + 60_000)).toEqual({ status: 'failed', needsSync: false, dungeons: [] });
    expect((await readSeason(d.db, T + 2 * 60 * 60 * 1000)).needsSync).toBe(true);
  });

  // The page refreshes after every sync response, so a skip must leave it nothing to ask for again.
  it('stops asking for a sync whenever a sync would skip', async () => {
    const loaded = await deps(fakeBlizzard().blizzard);
    await syncSeason(loaded);
    expect(await syncSeason({ ...loaded, now: T + 60_000 })).toBe('skipped');
    expect((await readSeason(loaded.db, T + 60_000)).needsSync).toBe(false);

    const failing = await deps(fakeBlizzard({ getJournalInstances: async () => { throw new Error('Blizzard is down'); } }).blizzard);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    await syncSeason(failing);
    logged.mockRestore();
    expect(await syncSeason({ ...failing, now: T + 60_000 })).toBe('skipped');
    expect((await readSeason(failing.db, T + 60_000)).needsSync).toBe(false);
  });
});
