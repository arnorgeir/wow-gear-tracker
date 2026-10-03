import { describe, expect, it, vi } from 'vitest';
import { openTestDb } from '@/test/db';
import { fakeFetch, json, on } from '@/test/fake-fetch';
import type { BlizzardClient } from '../blizzard/client';
import { DAY_MS } from './reference-sync';
import { readSeason, syncSeason } from './season-sync';

const T = Date.parse('2026-09-30T12:00:00Z');

const raiderIo = () => fakeFetch([
  on('expansion_id=11', () => json({ seasons: [{
    slug: 'season-test-2', name: 'Test Season 2', is_main_season: true, starts: { eu: '2026-08-19T04:00:00Z' },
    dungeons: [
      { challenge_mode_id: 501, name: 'Alpha Hollow', short_name: 'AH' },
      { challenge_mode_id: 502, name: 'Streets of Beta', short_name: 'STRT' },
      { challenge_mode_id: 503, name: 'Beta Gambit', short_name: 'GMBT' },
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
const ITEMS: Record<number, { inventoryType: string; armorType: 'leather' | 'plate' | null } | null> = {
  100: { inventoryType: 'ROBE', armorType: 'leather' },
  101: null,
  200: { inventoryType: 'HEAD', armorType: 'plate' },
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
  it('joins each dungeon to its journal instance by map ID and stores the loot with slots', async () => {
    const { blizzard, calls } = fakeBlizzard();
    const d = await deps(blizzard);
    expect(await syncSeason(d)).toBe('loaded');
    const state = await readSeason(d.db, T);
    expect(state).toMatchObject({ status: 'ready', needsSync: false });
    expect(state.dungeons.map((x) => [x.name, x.split])).toEqual([['Alpha Hollow', false], ['Beta Gambit', true], ['Streets of Beta', true]]);
    expect(state.dungeons[0]!.loot).toEqual([
      { itemId: 100, inventoryType: 'ROBE', armorType: 'leather' },
      { itemId: 101, inventoryType: null, armorType: null },
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
