import { describe, expect, it, vi } from 'vitest';
import { openTestDb } from '@/test/db';
import { DAY_MS, RETRY_MS } from '../freshness';
import { readBisLists, syncBisLists } from './bis-lists';
import { HttpError } from '../../http';
import type { BisLists, BisRow, BisSource, SlotType } from '../../types';
import type { BlizzardClient } from '../../blizzard/client';

const lists: BisLists = {
  overall: [{ kind: 'item', slotLabel: 'Head', slots: ['HEAD'], itemId: 5, name: 'Helm', bonusIds: [], isTier: false, isCatalyst: false, source: 'Boss' }],
  raid: [],
  mythicPlus: [],
};

const noBlizzard = {} as BlizzardClient;

function source(impl: () => Promise<BisLists>) {
  let calls = 0;
  const s: BisSource = { name: 'Fake', fetchLists: async () => { calls++; return impl(); } };
  return { s, calls: () => calls };
}

describe('readBisLists and syncBisLists', () => {
  const slug = 'guardian-druid';

  it('reads loading on a cold cache and asks for a sync', async () => {
    const db = await openTestDb();
    expect(await readBisLists(db, 'method', slug, 1)).toEqual({ lists: null, fetchedAt: null, error: null, status: 'loading', due: true });
  });

  it('syncs once, then reads ready until a day passes', async () => {
    const db = await openTestDb();
    const { s, calls } = source(async () => lists);
    expect(await syncBisLists({ db, source: s, sourceId: 'method', blizzard: noBlizzard, region: 'eu', now: 1000 }, slug)).toBe(true);
    expect(await readBisLists(db, 'method', slug, 1000 + DAY_MS - 1)).toEqual({ lists, fetchedAt: 1000, error: null, status: 'ready', due: false });
    expect(await syncBisLists({ db, source: s, sourceId: 'method', blizzard: noBlizzard, region: 'eu', now: 1000 + DAY_MS - 1 }, slug)).toBe(false);
    expect(calls()).toBe(1);
    expect((await readBisLists(db, 'method', slug, 1000 + DAY_MS)).due).toBe(true);
    expect(await syncBisLists({ db, source: s, sourceId: 'method', blizzard: noBlizzard, region: 'eu', now: 1000 + DAY_MS }, slug)).toBe(true);
    expect(calls()).toBe(2);
  });

  it('reads stale with the error after a failed refresh, and backs off for an hour', async () => {
    const db = await openTestDb();
    await syncBisLists({ db, source: source(async () => lists).s, sourceId: 'method', blizzard: noBlizzard, region: 'eu', now: 1000 }, slug);
    const down = source(async () => { throw new Error('down'); });
    const expired = 1000 + DAY_MS;
    expect(await syncBisLists({ db, source: down.s, sourceId: 'method', blizzard: noBlizzard, region: 'eu', now: expired }, slug)).toBe(true);
    expect(await readBisLists(db, 'method', slug, expired + 1)).toEqual({ lists, fetchedAt: 1000, error: 'BiS list couldn’t be updated', status: 'stale', due: false });
    expect(await syncBisLists({ db, source: down.s, sourceId: 'method', blizzard: noBlizzard, region: 'eu', now: expired + RETRY_MS - 1 }, slug)).toBe(false);
    expect(down.calls()).toBe(1);
    expect((await readBisLists(db, 'method', slug, expired + RETRY_MS)).due).toBe(true);
  });

  it('logs why a refresh failed, so a Method rename reads differently from an outage', async () => {
    const db = await openTestDb();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const renamed = new Error('Method table "dungeon_bis_table" is unknown');
    await syncBisLists({ db, source: source(async () => { throw renamed; }).s, sourceId: 'method', blizzard: noBlizzard, region: 'eu', now: 1000 }, slug);
    expect(log).toHaveBeenCalledWith(expect.stringContaining(slug), renamed);
    log.mockRestore();
  });

  it('keeps the previous list when the page has no BiS tables', async () => {
    const db = await openTestDb();
    await syncBisLists({ db, source: source(async () => lists).s, sourceId: 'method', blizzard: noBlizzard, region: 'eu', now: 1000 }, slug);
    await syncBisLists({ db, source: source(async () => ({ overall: [], raid: [], mythicPlus: [] })).s, sourceId: 'method', blizzard: noBlizzard, region: 'eu', now: 1000 + DAY_MS }, slug);
    expect(await readBisLists(db, 'method', slug, 1000 + DAY_MS)).toMatchObject({ lists, fetchedAt: 1000, error: 'BiS list couldn’t be updated', status: 'stale' });
  });

  it('reads failed with the missing-page message on a cold 404, and recovers after the backoff', async () => {
    const db = await openTestDb();
    await syncBisLists({ db, source: source(async () => { throw new HttpError(404, 'u', ''); }).s, sourceId: 'method', blizzard: noBlizzard, region: 'eu', now: 1 }, 'nope-nope');
    expect(await readBisLists(db, 'method', 'nope-nope', 2)).toEqual({
      lists: null, fetchedAt: null, error: 'Fake has no gearing page for "nope-nope"', status: 'failed', due: false,
    });
    await syncBisLists({ db, source: source(async () => lists).s, sourceId: 'method', blizzard: noBlizzard, region: 'eu', now: 1 + RETRY_MS }, 'nope-nope');
    expect(await readBisLists(db, 'method', 'nope-nope', 2 + RETRY_MS)).toMatchObject({ lists, status: 'ready', error: null, due: false });
  });

  it('backs off per spec, so one failing spec does not stop another', async () => {
    const db = await openTestDb();
    await syncBisLists({ db, source: source(async () => { throw new Error('down'); }).s, sourceId: 'method', blizzard: noBlizzard, region: 'eu', now: 1 }, slug);
    expect((await readBisLists(db, 'method', 'feral-druid', 2)).due).toBe(true);
    const other = source(async () => lists);
    expect(await syncBisLists({ db, source: other.s, sourceId: 'method', blizzard: noBlizzard, region: 'eu', now: 2 }, 'feral-druid')).toBe(true);
    expect(other.calls()).toBe(1);
  });
});

describe('BiS sources', () => {
  const slug = 'guardian-druid';
  const row = (slotLabel: string, slots: SlotType[], itemId: number, isCatalyst = false): BisRow =>
    ({ kind: 'item', slotLabel, slots, itemId, name: `Item ${itemId}`, bonusIds: [], isTier: isCatalyst, isCatalyst, source: 'Boss' });
  const ivLists: BisLists = { overall: [row('Head', ['HEAD'], 300), row('Neck', ['NECK'], 301), row('Hands', ['HANDS'], 302, true)], raid: [], mythicPlus: [] };
  const details = (answer: (id: number) => { quality: 'EPIC'; isTier: boolean }) => {
    const asked: number[] = [];
    const blizzard = { getItemDetails: async (_r: string, id: number) => { asked.push(id); return answer(id); } } as unknown as BlizzardClient;
    return { blizzard, asked };
  };

  it('keeps failures per source', async () => {
    const db = await openTestDb();
    const down = source(async () => { throw new Error('down'); });
    await syncBisLists({ db, source: down.s, sourceId: 'icyVeins', blizzard: noBlizzard, region: 'eu', now: 1000 }, slug);
    expect(await readBisLists(db, 'method', slug, 1001)).toMatchObject({ status: 'loading', due: true, error: null });
    expect(await readBisLists(db, 'icyVeins', slug, 1001)).toMatchObject({ status: 'failed', due: false });
    const method = source(async () => lists);
    expect(await syncBisLists({ db, source: method.s, sourceId: 'method', blizzard: noBlizzard, region: 'eu', now: 1001 }, slug)).toBe(true);
    expect(await readBisLists(db, 'icyVeins', slug, 1002)).toMatchObject({ lists: null, status: 'failed' });
  });

  it('marks Icy Veins tier rows from item details, looking up only non-catalyst tier slots', async () => {
    const db = await openTestDb();
    const { blizzard, asked } = details((id) => ({ quality: 'EPIC', isTier: id === 300 }));
    await syncBisLists({ db, source: source(async () => ivLists).s, sourceId: 'icyVeins', blizzard, region: 'us', now: 1 }, slug);
    const stored = (await readBisLists(db, 'icyVeins', slug, 1)).lists!.overall;
    expect(stored.map((r) => r.kind === 'item' && r.isTier)).toEqual([true, false, true]);
    expect(asked).toEqual([300]);
  });

  it('leaves Method rows alone', async () => {
    const db = await openTestDb();
    await syncBisLists({ db, source: source(async () => ivLists).s, sourceId: 'method', blizzard: noBlizzard, region: 'eu', now: 1 }, slug);
    expect((await readBisLists(db, 'method', slug, 1)).lists).toEqual(ivLists);
  });

  it('a failed tier lookup records the failure and keeps the old list', async () => {
    const db = await openTestDb();
    const ok = details(() => ({ quality: 'EPIC', isTier: false }));
    await syncBisLists({ db, source: source(async () => lists).s, sourceId: 'icyVeins', blizzard: ok.blizzard, region: 'eu', now: 1000 }, slug);
    const down = { getItemDetails: async () => { throw new Error('down'); } } as unknown as BlizzardClient;
    await syncBisLists({ db, source: source(async () => ivLists).s, sourceId: 'icyVeins', blizzard: down, region: 'eu', now: 1000 + DAY_MS }, slug);
    expect(await readBisLists(db, 'icyVeins', slug, 1000 + DAY_MS)).toMatchObject({
      lists, fetchedAt: 1000, status: 'stale', error: 'BiS list couldn’t be updated', due: false,
    });
  });
});
