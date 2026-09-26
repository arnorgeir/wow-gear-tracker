import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { setMeta } from '../db/queries';
import { DAY_MS, ensureBisLists, ensureItemIcons, ensureTracks, ensureItemDetails, ensureClassIcons } from './reference-sync';
import { HttpError } from '../http';
import type { BisLists, BisSource, Track } from '../types';
import type { BlizzardClient } from '../blizzard/client';

const lists: BisLists = {
  overall: [{ slotLabel: 'Head', slots: ['HEAD'], itemId: 5, name: 'Helm', bonusIds: [], isTier: false, isCatalyst: false, source: 'Boss' }],
  raid: [],
  mythicPlus: [],
};

function source(impl: () => Promise<BisLists>) {
  let calls = 0;
  const s: BisSource = { name: 'Fake', fetchLists: async () => { calls++; return impl(); } };
  return { s, calls: () => calls };
}

describe('ensureBisLists', () => {
  it('fetches once and serves the cache for a day', async () => {
    const db = await openTestDb();
    const { s, calls } = source(async () => lists);
    expect(await ensureBisLists({ db, source: s, now: 1000 }, 'guardian-druid')).toEqual({ lists, fetchedAt: 1000, error: null });
    await ensureBisLists({ db, source: s, now: 1000 + DAY_MS - 1 }, 'guardian-druid');
    expect(calls()).toBe(1);
    await ensureBisLists({ db, source: s, now: 1000 + DAY_MS }, 'guardian-druid');
    expect(calls()).toBe(2);
  });

  it('keeps the previous list when the page has no BiS tables', async () => {
    const db = await openTestDb();
    await ensureBisLists({ db, source: source(async () => lists).s, now: 1000 }, 'guardian-druid');
    const empty = source(async () => ({ overall: [], raid: [], mythicPlus: [] }));
    const result = await ensureBisLists({ db, source: empty.s, now: 1000 + DAY_MS }, 'guardian-druid');
    expect(result).toEqual({ lists, fetchedAt: 1000, error: 'BiS list couldn’t be updated' });
  });

  it('explains a missing Method page when nothing is cached', async () => {
    const db = await openTestDb();
    const missing = source(async () => { throw new HttpError(404, 'u', ''); });
    expect(await ensureBisLists({ db, source: missing.s, now: 1 }, 'nope-nope')).toEqual({
      lists: null, fetchedAt: null, error: 'Fake has no gearing page for "nope-nope"',
    });
  });
});

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

  it('refetches track data saved by an older version of the app', async () => {
    const db = await openTestDb();
    await setMeta(db, 'tracks.fetchedAt', '1', 1);
    let calls = 0;
    const result = await ensureTracks({ db, fetchRaidbots: async () => { calls++; return data; }, now: 2 });
    expect(calls).toBe(1);
    expect(result.tracks.get(1)?.group).toBe(618);
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
