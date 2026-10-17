import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { DAY_MS, RETRY_MS } from '../freshness';
import { ensureItemDetails } from './item-details';
import { ensureItemStats, readTierTargets, syncTierTargets } from './tier-stats';
import type { BlizzardClient } from '../../blizzard/client';

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

  it('covers extra item IDs beside the lists', async () => {
    const db = await openTestDb();
    const { blizzard } = blizzardWith(() => ({ ...robe, isTier: false }));
    const extra = { ...scope([]), extraItemIds: [77] };
    expect((await readTierTargets(db, extra, 1)).due).toBe(true);
    expect(await syncTierTargets({ db, blizzard, now: 1 }, extra)).toBe(true);
    expect([...(await readTierTargets(db, extra, 2)).targets.keys()]).toEqual([77]);
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
    expect(await syncTierTargets({ db, blizzard, now: 1000 + RETRY_MS - 1 }, one)).toBe(false);
    expect(asked).toEqual([31]);
    expect((await readTierTargets(db, one, 1000 + RETRY_MS)).due).toBe(true);
    down = false;
    expect(await syncTierTargets({ db, blizzard, now: 1000 + RETRY_MS }, one)).toBe(true);
    expect(await readTierTargets(db, one, 1001 + RETRY_MS)).toEqual({ targets: new Map([[31, { secondaryStats: HM, isTier: true }]]), due: false });
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

describe('ensureItemStats', () => {
  const HM = ['HASTE_RATING', 'MASTERY_RATING'];
  const robe = { quality: 'EPIC', isTier: true, inventoryType: 'ROBE', armorType: 'cloth', secondaryStats: HM };
  function blizzardWith(answer: (id: number) => unknown) {
    const asked: number[] = [];
    const blizzard = { getItemDetails: async (_r: string, id: number) => { asked.push(id); return answer(id); } } as unknown as BlizzardClient;
    return { blizzard, asked };
  }

  it('requests an uncached item, stores it, and asks nothing for a cached one', async () => {
    const db = await openTestDb();
    const { blizzard, asked } = blizzardWith(() => robe);
    expect(await ensureItemStats({ db, blizzard, now: 1 }, 'eu', [60, 60])).toEqual(new Map([[60, HM]]));
    expect(await ensureItemStats({ db, blizzard, now: 2 }, 'eu', [60])).toEqual(new Map([[60, HM]]));
    expect(asked).toEqual([60]);
  });

  it('returns null for a 404 and asks again only after a day', async () => {
    const db = await openTestDb();
    const { blizzard, asked } = blizzardWith(() => null);
    expect(await ensureItemStats({ db, blizzard, now: 1 }, 'eu', [61])).toEqual(new Map([[61, null]]));
    await ensureItemStats({ db, blizzard, now: 2 }, 'eu', [61]);
    expect(asked).toEqual([61]);
    await ensureItemStats({ db, blizzard, now: 1 + DAY_MS }, 'eu', [61]);
    expect(asked).toEqual([61, 61]);
  });

  it('returns null for a thrown request, stores nothing, and asks again next time', async () => {
    const db = await openTestDb();
    const { blizzard, asked } = blizzardWith(() => { throw new Error('down'); });
    expect(await ensureItemStats({ db, blizzard, now: 1 }, 'eu', [62])).toEqual(new Map([[62, null]]));
    await ensureItemStats({ db, blizzard, now: 2 }, 'eu', [62]);
    expect(asked).toEqual([62, 62]);
  });
});
