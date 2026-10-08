import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { setMeta } from '../db/queries/meta';
import { BIS_RETRY_MS, DAY_MS, ensureItemIcons, ensureTracks, ensureItemDetails, ensureClassIcons, readBisLists, syncBisLists, readTracks, syncTracks, readTierTargets, syncTierTargets } from './reference-sync';
import { HttpError } from '../http';
import type { BisLists, BisSource, Track } from '../types';
import type { BlizzardClient } from '../blizzard/client';

const lists: BisLists = {
  overall: [{ kind: 'item', slotLabel: 'Head', slots: ['HEAD'], itemId: 5, name: 'Helm', bonusIds: [], isTier: false, isCatalyst: false, source: 'Boss' }],
  raid: [],
  mythicPlus: [],
};

function source(impl: () => Promise<BisLists>) {
  let calls = 0;
  const s: BisSource = { name: 'Fake', fetchLists: async () => { calls++; return impl(); } };
  return { s, calls: () => calls };
}

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

const tracks: Track[] = [{ bonusId: 1, name: 'Myth', step: 1, max: 6, group: 618, currencyId: null, currencyName: null, costPerStep: null }];
const data = { tracks, qualities: [{ bonusId: 12805, quality: 'EPIC' as const }] };
const failing = async (): Promise<typeof data> => { throw new Error('down'); };

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

describe('ensureTracks', () => {
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

  it('refetches track data saved by an older version of the app', async () => {
    const db = await openTestDb();
    await setMeta(db, 'tracks.fetchedAt', '1', 1);
    let calls = 0;
    const result = await ensureTracks({ db, fetchRaidbots: async () => { calls++; return data; }, now: 2 });
    expect(calls).toBe(1);
    expect(result.tracks.get(1)?.group).toBe(618);
  });

  it('stores crest icon names and refetches over a fresh v2 cache', async () => {
    const db = await openTestDb();
    await setMeta(db, 'tracks.v2.fetchedAt', '1', 1);
    const withIcon = { ...data, tracks: [{ ...tracks[0]!, currencyId: 3446, currencyName: 'Myth Mistcrest', costPerStep: 20, currencyIcon: 'inv_121_crest_myth' }] };
    let calls = 0;
    const result = await ensureTracks({ db, fetchRaidbots: async () => { calls++; return withIcon; }, now: 2 });
    expect(calls).toBe(1);
    expect(result.tracks.get(1)?.currencyIcon).toBe('inv_121_crest_myth');
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

describe('ensureItemIcons', () => {
  it('fetches only unknown icons and remembers items without one', async () => {
    const db = await openTestDb();
    const asked: number[] = [];
    const blizzard = {
      getItemIconUrl: async (_region: string, id: number) => { asked.push(id); return id === 1 ? 'https://i/1.jpg' : null; },
    } as unknown as BlizzardClient;
    const first = await ensureItemIcons({ db, blizzard, now: 1 }, 'eu', [1, 2, 1]);
    expect(first.get(1)).toBe('https://i/1.jpg');
    expect(first.get(2)).toBeNull();
    await ensureItemIcons({ db, blizzard, now: 2 }, 'eu', [1, 2]);
    expect(asked.sort()).toEqual([1, 2]);
  });

  it('skips icons that fail to load so they retry later', async () => {
    const db = await openTestDb();
    const blizzard = { getItemIconUrl: async () => { throw new Error('down'); } } as unknown as BlizzardClient;
    expect((await ensureItemIcons({ db, blizzard, now: 1 }, 'eu', [7])).has(7)).toBe(false);
  });
});

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

describe('ensureClassIcons', () => {
  function blizzardWith(fail = false) {
    const calls = { classes: 0 };
    const blizzard = {
      getClasses: async () => { calls.classes++; if (fail) throw new Error('down'); return [{ id: 11, name: 'Druid', specs: [] }, { id: 10, name: 'Monk', specs: [] }]; },
      getClassIconUrl: async (_region: string, id: number) => (id === 11 ? 'https://i/druid.jpg' : null),
    } as unknown as BlizzardClient;
    return { blizzard, calls };
  }

  it('fills the cache and serves it for 30 days', async () => {
    const db = await openTestDb();
    const { blizzard, calls } = blizzardWith();
    expect(await ensureClassIcons({ db, blizzard, now: 1 }, 'eu')).toEqual(new Map([['Druid', 'https://i/druid.jpg'], ['Monk', null]]));
    await ensureClassIcons({ db, blizzard, now: 1 + 29 * DAY_MS }, 'eu');
    expect(calls.classes).toBe(1);
    await ensureClassIcons({ db, blizzard, now: 1 + 30 * DAY_MS }, 'eu');
    expect(calls.classes).toBe(2);
  });

  it('keeps cached icons when some icon calls fail, and retries them later', async () => {
    const db = await openTestDb();
    await ensureClassIcons({ db, blizzard: blizzardWith().blizzard, now: 1 }, 'eu');
    let iconCalls = 0;
    const flaky = {
      getClasses: async () => [{ id: 11, name: 'Druid', specs: [] }, { id: 10, name: 'Monk', specs: [] }],
      getClassIconUrl: async () => { iconCalls++; throw new Error('timeout'); },
    } as unknown as BlizzardClient;
    const icons = await ensureClassIcons({ db, blizzard: flaky, now: 1 + 30 * DAY_MS }, 'eu');
    expect(icons.get('Druid')).toBe('https://i/druid.jpg');
    await ensureClassIcons({ db, blizzard: flaky, now: 1 + 30 * DAY_MS + 61 * 60_000 }, 'eu');
    expect(iconCalls).toBe(4);
  });

  it('waits an hour before retrying after a failure', async () => {
    const db = await openTestDb();
    const { blizzard, calls } = blizzardWith(true);
    await ensureClassIcons({ db, blizzard, now: 1000 }, 'eu');
    await ensureClassIcons({ db, blizzard, now: 1000 + 59 * 60_000 }, 'eu');
    expect(calls.classes).toBe(1);
    await ensureClassIcons({ db, blizzard, now: 1000 + 61 * 60_000 }, 'eu');
    expect(calls.classes).toBe(2);
  });

  it('keeps the cache when Blizzard fails', async () => {
    const db = await openTestDb();
    await ensureClassIcons({ db, blizzard: blizzardWith().blizzard, now: 1 }, 'eu');
    const icons = await ensureClassIcons({ db, blizzard: blizzardWith(true).blizzard, now: 1 + 31 * DAY_MS }, 'eu');
    expect(icons.get('Druid')).toBe('https://i/druid.jpg');
  });
});

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
