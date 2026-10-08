import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { syncBisLists } from '@/core/sync/reference-sync';
import type { BisLists } from '@/core/types';
import { createBisLookup, referenceDue, type SpecBis } from './bis-lookup';

const lists: BisLists = {
  overall: [],
  raid: [],
  mythicPlus: [{ kind: 'item', slotLabel: 'Head', slots: ['HEAD'], itemId: 10, name: 'Tier Helm', bonusIds: [], isTier: true, isCatalyst: false, source: 'Dungeon A' }],
};

describe('createBisLookup', () => {
  it('names a missing list as due work', async () => {
    const lookup = createBisLookup(await openTestDb(), 1000);
    expect(await lookup('guardian-druid', 'eu')).toMatchObject({ lists: null, status: 'loading', due: true, targetsDue: false, dueKeys: ['bis:guardian-druid'] });
  });

  it('names each region’s missing tier stats once the list is stored', async () => {
    const db = await openTestDb();
    await syncBisLists({ db, source: { name: 'Fake', fetchLists: async () => lists }, now: 1000 }, 'guardian-druid');
    const lookup = createBisLookup(db, 1000);
    const [eu, us] = await Promise.all([lookup('guardian-druid', 'eu'), lookup('guardian-druid', 'us')]);
    expect(eu).toMatchObject({ lists, status: 'ready', due: false, targetsDue: true, dueKeys: ['tiers:eu:guardian-druid'] });
    expect(us.dueKeys).toEqual(['tiers:us:guardian-druid']);
  });
});

describe('referenceDue', () => {
  it('joins the distinct due names in order, or says nothing is due', () => {
    const spec = (dueKeys: string[]) => ({ dueKeys }) as SpecBis;
    expect(referenceDue(true, [spec(['tiers:eu:guardian-druid']), spec(['bis:feral-druid']), spec(['bis:feral-druid'])]))
      .toBe('bis:feral-druid,tiers:eu:guardian-druid,tracks');
    expect(referenceDue(false, [spec([])])).toBeNull();
  });
});
