import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import type { BisLists } from '../../types';
import { replaceBisLists, getBisLists } from './bis-lists';

describe('BiS lists', () => {
  const lists: BisLists = {
    overall: [{ slotLabel: 'Head', slots: ['HEAD'], itemId: 5, name: 'Helm', bonusIds: [], isTier: true, isCatalyst: true, source: 'Boss' }],
    raid: [],
    mythicPlus: [{ slotLabel: 'Ring', slots: ['FINGER_1', 'FINGER_2'], itemId: 6, name: 'Ring', bonusIds: [1, 2], isTier: false, isCatalyst: false, source: 'Dungeon' }],
  };

  it('replaces and reads lists in order', async () => {
    const db = await openTestDb();
    expect(await getBisLists(db, 'guardian-druid')).toBeNull();
    await replaceBisLists(db, 'guardian-druid', lists, 50);
    await replaceBisLists(db, 'guardian-druid', lists, 60);
    expect(await getBisLists(db, 'guardian-druid')).toEqual({ lists, fetchedAt: 60 });
  });
});
