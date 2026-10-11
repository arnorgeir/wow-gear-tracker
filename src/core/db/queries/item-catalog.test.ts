import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { replaceSeason } from './season';
import { findLocalItem, getCatalogItems, searchLocalItems, upsertCatalogItem } from './item-catalog';
import type { CatalogItem } from '../../types';

const ROBE: CatalogItem = { itemId: 500, name: 'Björnsdóttir Robe', inventoryType: 'ROBE', armorType: 'cloth', quality: 'EPIC', isTier: false };

async function withLoot() {
  const db = await openTestDb();
  await replaceSeason(db, {
    slug: 's2',
    dungeons: [{ challengeModeId: 1, name: 'Alpha Hollow', shortName: 'AH', journalInstanceId: 9, mapId: 7, imageUrl: null }],
    loot: [
      { challengeModeId: 1, encounterId: 3, encounterName: 'Boss', itemId: 600, itemName: 'Æther Band', inventoryType: 'FINGER', armorType: null, quality: 'EPIC', isTier: false },
      { challengeModeId: 1, encounterId: 3, encounterName: 'Boss', itemId: 601, itemName: 'Old Cloak', inventoryType: null, armorType: null, quality: null, isTier: false },
      { challengeModeId: 1, encounterId: 3, encounterName: 'Boss', itemId: 602, itemName: 'Season Three Helm', inventoryType: 'HEAD', armorType: 'cloth', quality: null, isTier: false },
    ],
  });
  return db;
}

describe('item catalog', () => {
  it('stores and reads items', async () => {
    const db = await openTestDb();
    await upsertCatalogItem(db, ROBE, 1);
    expect(await getCatalogItems(db, [500, 999])).toEqual(new Map([[500, ROBE]]));
  });

  it('finds a local item in the catalog, then in complete season loot', async () => {
    const db = await withLoot();
    await upsertCatalogItem(db, ROBE, 1);
    expect(await findLocalItem(db, 500)).toEqual(ROBE);
    expect(await findLocalItem(db, 600)).toEqual({ itemId: 600, name: 'Æther Band', inventoryType: 'FINGER', armorType: null, quality: 'EPIC', isTier: false });
  });

  it('treats a loot row without a slot as unknown', async () => {
    const db = await withLoot();
    expect(await findLocalItem(db, 601)).toBeNull();
  });

  it('treats a loot row from before quality and tier were stored as unknown', async () => {
    const db = await withLoot();
    expect(await findLocalItem(db, 602)).toBeNull();
  });

  it('searches names case-insensitively beyond ASCII, and exact IDs', async () => {
    const db = await withLoot();
    await upsertCatalogItem(db, ROBE, 1);
    expect((await searchLocalItems(db, 'BJÖRN')).map((i) => i.itemId)).toEqual([500]);
    expect((await searchLocalItems(db, 'æther')).map((i) => i.itemId)).toEqual([600]);
    expect((await searchLocalItems(db, '600')).map((i) => i.itemId)).toEqual([600]);
    expect(await searchLocalItems(db, '  ')).toEqual([]);
  });

  it('names the dungeon a season item drops in, and nothing for a looked-up item', async () => {
    const db = await withLoot();
    await upsertCatalogItem(db, ROBE, 1);
    expect((await searchLocalItems(db, 'æther'))[0]!.source).toBe('Alpha Hollow');
    expect((await searchLocalItems(db, 'björn'))[0]!.source).toBeNull();
  });
});
