import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import type { BisLists } from '../../types';
import { replaceBisLists, getBisLists } from './bis-lists';

describe('BiS lists', () => {
  const lists: BisLists = {
    overall: [{ kind: 'item', slotLabel: 'Head', slots: ['HEAD'], itemId: 5, name: 'Helm', bonusIds: [], isTier: true, isCatalyst: true, source: 'Boss' }],
    raid: [],
    mythicPlus: [{ kind: 'item', slotLabel: 'Ring', slots: ['FINGER_1', 'FINGER_2'], itemId: 6, name: 'Ring', bonusIds: [1, 2], isTier: false, isCatalyst: false, source: 'Dungeon' }],
  };

  it('replaces and reads lists in order', async () => {
    const db = await openTestDb();
    expect(await getBisLists(db, 'method', 'guardian-druid')).toBeNull();
    await replaceBisLists(db, 'method', 'guardian-druid', lists, 50);
    await replaceBisLists(db, 'method', 'guardian-druid', lists, 60);
    expect(await getBisLists(db, 'method', 'guardian-druid')).toEqual({ lists, fetchedAt: 60 });
  });
});

describe('any rows', () => {
  it('stores and reads back an any row beside an item row', async () => {
    const db = await openTestDb();
    const lists: BisLists = {
      overall: [
        { kind: 'item', slotLabel: 'Head', slots: ['HEAD'], itemId: 271875, name: 'Gaze of the Coiled Watcher', bonusIds: [], isTier: true, isCatalyst: true, source: 'Ula’tek' },
        { kind: 'any', slotLabel: 'Shoulders', slots: ['SHOULDER'], minItemLevel: 334, source: '' },
      ],
      raid: [],
      mythicPlus: [],
    };
    await replaceBisLists(db, 'method', 'feral-druid', lists, 1);
    expect((await getBisLists(db, 'method', 'feral-druid'))!.lists.overall).toEqual(lists.overall);
  });
});

describe('sources', () => {
  const row = (itemId: number): BisLists['overall'][number] =>
    ({ kind: 'item', slotLabel: 'Head', slots: ['HEAD'], itemId, name: 'Helm', bonusIds: [], isTier: false, isCatalyst: false, source: 'Boss' });
  const ids = (l: BisLists['overall']) => l.map((r) => r.kind === 'item' && r.itemId);

  it("keeps each source's lists apart", async () => {
    const db = await openTestDb();
    await replaceBisLists(db, 'method', 'frost-mage', { overall: [row(1)], raid: [], mythicPlus: [] }, 10);
    await replaceBisLists(db, 'icyVeins', 'frost-mage', { overall: [row(2)], raid: [], mythicPlus: [] }, 20);
    expect(ids((await getBisLists(db, 'method', 'frost-mage'))!.lists.overall)).toEqual([1]);
    expect(ids((await getBisLists(db, 'icyVeins', 'frost-mage'))!.lists.overall)).toEqual([2]);
    await replaceBisLists(db, 'icyVeins', 'frost-mage', { overall: [row(3)], raid: [], mythicPlus: [] }, 30);
    expect(await getBisLists(db, 'method', 'frost-mage')).toEqual({ lists: { overall: [row(1)], raid: [], mythicPlus: [] }, fetchedAt: 10 });
  });
});
