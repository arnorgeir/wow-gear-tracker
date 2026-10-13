import { describe, expect, it } from 'vitest';
import type { BlizzardClient } from '@/core/blizzard/client';
import { openTestDb } from '@/test/db';
import { syncBisLists } from '@/core/sync/reference-sync';
import { replaceBisLists } from '@/core/db/queries/bis-lists';
import { updateSpecSettings, upsertOverride } from '@/core/db/queries/bis-settings';
import { upsertCatalogItem } from '@/core/db/queries/item-catalog';
import { accounts } from '@/core/db/schema';
import type { BisLists } from '@/core/types';
import { createBisLookup, referenceDue, type SpecBis } from './bis-lookup';

const lists: BisLists = {
  overall: [],
  raid: [],
  mythicPlus: [{ kind: 'item', slotLabel: 'Head', slots: ['HEAD'], itemId: 10, name: 'Tier Helm', bonusIds: [], isTier: true, isCatalyst: false, source: 'Dungeon A' }],
};

describe('createBisLookup', () => {
  it('names a missing list as due work', async () => {
    const lookup = createBisLookup(await openTestDb(), 1000, 1);
    expect(await lookup('guardian-druid', 'eu')).toMatchObject({ lists: null, status: 'loading', due: true, targetsDue: false, dueKeys: ['bis:guardian-druid'] });
  });

  it('names each region’s missing tier stats once the list is stored', async () => {
    const db = await openTestDb();
    await syncBisLists({ db, source: { name: 'Fake', fetchLists: async () => lists }, sourceId: 'method', blizzard: {} as BlizzardClient, region: 'eu', now: 1000 }, 'guardian-druid');
    const lookup = createBisLookup(db, 1000, 1);
    const [eu, us] = await Promise.all([lookup('guardian-druid', 'eu'), lookup('guardian-druid', 'us')]);
    expect(eu).toMatchObject({ lists, status: 'ready', due: false, targetsDue: true, dueKeys: ['tiers:eu:guardian-druid'] });
    expect(us.dueKeys).toEqual(['tiers:us:guardian-druid']);
  });
});

describe('overrides', () => {
  const neck = { kind: 'item' as const, slotLabel: 'Neck', slots: ['NECK' as const], itemId: 11, name: 'Method Chain', bonusIds: [], isTier: false, isCatalyst: false, source: '' };
  const withNeck: BisLists = { ...lists, mythicPlus: [...lists.mythicPlus, neck] };

  it('returns overlaid lists, settings, counts and orphans for the account', async () => {
    const db = await openTestDb();
    await db.insert(accounts).values({ id: 2, name: 'Other' });
    await replaceBisLists(db, 'method', 'frost-mage', withNeck, 1);
    await upsertCatalogItem(db, { itemId: 30, name: 'Birkibjörn Band', inventoryType: 'NECK', armorType: null, quality: 'EPIC', isTier: false }, 1);
    await upsertOverride(db, 1, 'frost-mage', 'method', 'mythicPlus', { slotKey: 'Neck#1', itemId: 30, catalyst: false });
    await upsertOverride(db, 1, 'frost-mage', 'method', 'mythicPlus', { slotKey: 'Gone#1', itemId: 30, catalyst: false });
    await updateSpecSettings(db, 1, 'frost-mage', { listType: 'raid', statsMatter: false });
    const bis = await createBisLookup(db, 2, 1)('frost-mage', 'eu');
    expect(bis).toMatchObject({ listType: 'raid', statsMatter: false, editedCount: 1 });
    expect(bis.orphans.mythicPlus).toEqual([{ slotKey: 'Gone#1', itemId: 30, catalyst: false }]);
    expect(bis.lists!.mythicPlus.find((r) => r.slotLabel === 'Neck')).toMatchObject({ itemId: 30, edited: expect.anything() });
    expect((await createBisLookup(db, 2, 2)('frost-mage', 'eu')).editedCount).toBe(0);
  });

  it('reports tier targets due for a catalyst override with no stats', async () => {
    const db = await openTestDb();
    await replaceBisLists(db, 'method', 'frost-mage', { ...lists, mythicPlus: [{ ...lists.mythicPlus[0]!, isTier: false } as BisLists['mythicPlus'][number]] }, 1);
    await upsertCatalogItem(db, { itemId: 31, name: 'Woven Hood', inventoryType: 'HEAD', armorType: 'cloth', quality: 'EPIC', isTier: false }, 1);
    await upsertOverride(db, 1, 'frost-mage', 'method', 'mythicPlus', { slotKey: 'Head#1', itemId: 31, catalyst: true });
    expect((await createBisLookup(db, 2, 1)('frost-mage', 'eu')).targetsDue).toBe(true);
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
