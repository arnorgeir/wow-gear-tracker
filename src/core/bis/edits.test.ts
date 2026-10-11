import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { isUserError } from '../errors';
import type { BlizzardClient } from '../blizzard/client';
import type { ItemInfo } from '../blizzard/types';
import { replaceBisLists } from '../db/queries/bis-lists';
import { replaceSpecs } from '../db/queries/specs';
import { getCatalogItems } from '../db/queries/item-catalog';
import { listOverrides } from '../db/queries/bis-settings';
import { replaceSeason } from '../db/queries/season';
import type { BisLists } from '../types';
import { knownSpecSlug, lookupItem, removeOverride, saveOverride, searchItems } from './edits';

const lists: BisLists = {
  overall: [],
  raid: [],
  mythicPlus: [
    { kind: 'item', slotLabel: 'Chest', slots: ['CHEST'], itemId: 10, name: 'Method Robe', bonusIds: [], isTier: true, isCatalyst: false, source: 'Raid' },
    { kind: 'item', slotLabel: 'Ring', slots: ['FINGER_1', 'FINGER_2'], itemId: 20, name: 'Band', bonusIds: [], isTier: false, isCatalyst: false, source: 'AH' },
  ],
};
const chest = { specSlug: 'frost-mage', listType: 'mythicPlus' as const, slotKey: 'Chest#1' };
const ring = { ...chest, slotKey: 'Ring#1' };

const info = (over: Partial<ItemInfo>): ItemInfo => ({ name: 'Woven Robe', quality: 'EPIC', isTier: false, inventoryType: 'ROBE', armorType: 'cloth', secondaryStats: null, ...over });

async function setup(getItemDetails: BlizzardClient['getItemDetails'] = async () => info({})) {
  const db = await openTestDb();
  await replaceSpecs(db, [{ methodSlug: 'frost-mage', classId: 8, className: 'Mage', specName: 'Frost' }, { methodSlug: 'fire-mage', classId: 8, className: 'Mage', specName: 'Fire' }], 1);
  await replaceBisLists(db, 'frost-mage', lists, 1);
  const blizzard = { getItemDetails } as unknown as BlizzardClient;
  return { db, deps: { db, blizzard, now: 5, accountId: 1 } };
}

const userError = async (p: Promise<unknown>) => {
  const err = await p.catch((e: unknown) => e);
  expect(isUserError(err)).toBe(true);
  return (err as Error).message;
};

describe('knownSpecSlug', () => {
  it('accepts catalog slugs only', async () => {
    const { db } = await setup();
    expect(await knownSpecSlug(db, 'frost-mage')).toBe(true);
    expect(await knownSpecSlug(db, '../etc')).toBe(false);
  });
});

describe('saveOverride', () => {
  it('fills the catalog from Blizzard and saves', async () => {
    const { db, deps } = await setup();
    await saveOverride(deps, chest, 50, false);
    expect((await getCatalogItems(db, [50])).get(50)).toMatchObject({ name: 'Woven Robe', quality: 'EPIC', isTier: false });
    expect((await listOverrides(db, 1, 'frost-mage')).mythicPlus).toEqual([{ slotKey: 'Chest#1', itemId: 50, catalyst: false }]);
  });

  it('fills the catalog from season loot without calling Blizzard', async () => {
    const calls: number[] = [];
    const { db, deps } = await setup(async (_r, id) => { calls.push(id); return null; });
    await replaceSeason(db, { slug: 's', dungeons: [{ challengeModeId: 1, name: 'AH', shortName: 'AH', journalInstanceId: 1, mapId: 1, imageUrl: null }],
      loot: [{ challengeModeId: 1, encounterId: 1, encounterName: 'B', itemId: 60, itemName: 'Loot Band', inventoryType: 'FINGER', armorType: null, quality: 'EPIC', isTier: false }] });
    await saveOverride(deps, ring, 60, false);
    expect(calls).toEqual([]);
    expect((await getCatalogItems(db, [60])).get(60)).toMatchObject({ name: 'Loot Band' });
  });

  it('saves a catalyst override on a tier slot', async () => {
    const { db, deps } = await setup();
    await saveOverride(deps, chest, 50, true);
    expect((await listOverrides(db, 1, 'frost-mage')).mythicPlus[0]).toMatchObject({ catalyst: true });
  });

  it('rejects what the class or slot cannot use, and bad catalysts', async () => {
    const { deps } = await setup(async () => info({ armorType: 'plate' }));
    expect(await userError(saveOverride(deps, chest, 50, false))).toBe("Mage can't wear plate.");
    const ringDeps = (await setup(async () => info({ inventoryType: 'FINGER', armorType: null }))).deps;
    expect(await userError(saveOverride(ringDeps, ring, 51, true))).toBe('Only regular items in tier slots can be catalyzed.');
    expect(await userError(saveOverride(ringDeps, { ...ring, slotKey: 'Gone#1' }, 51, false))).toBe("That slot isn't in Method's list.");
  });

  it('writes nothing when Blizzard fails or has no such item', async () => {
    const down = await setup(async () => { throw new Error('socket hang up'); });
    expect(await userError(saveOverride(down.deps, chest, 50, false))).toBe("Couldn't reach Blizzard. Try again.");
    expect(await getCatalogItems(down.db, [50])).toEqual(new Map());
    expect((await listOverrides(down.db, 1, 'frost-mage')).mythicPlus).toEqual([]);
    const missing = await setup(async () => null);
    expect(await userError(saveOverride(missing.deps, chest, 50, false))).toBe('No item with ID 50.');
    const nameless = await setup(async () => info({ name: null }));
    expect(await userError(saveOverride(nameless.deps, chest, 50, false))).toBe("Couldn't read that item from Blizzard.");
  });

  it('asks for a fetch when the spec has no list', async () => {
    const { deps } = await setup();
    expect(await userError(saveOverride(deps, { ...chest, specSlug: 'fire-mage' }, 50, false))).toBe('Method has no list for this spec yet. Fetch it first.');
  });
});

describe('searchItems and lookupItem', () => {
  it('returns usable local matches and an unusable exact ID with its reason', async () => {
    const { db, deps } = await setup(async () => info({ armorType: 'plate', name: 'Plate Robe' }));
    await lookupItem(deps, chest, 'https://www.wowhead.com/item=70/plate-robe');
    const out = await searchItems(db, chest, '70');
    expect(out.results).toEqual([]);
    expect(out.unusable).toMatchObject({ itemId: 70, canUse: { ok: false, reason: "Mage can't wear plate." } });
  });

  it('rejects input that is not an ID or link', async () => {
    const { deps } = await setup();
    expect(await userError(lookupItem(deps, chest, 'robe'))).toBe('Not a Wowhead item link or ID.');
  });
});

describe('removeOverride', () => {
  it('removes even an orphan', async () => {
    const { db, deps } = await setup();
    await saveOverride(deps, chest, 50, false);
    await removeOverride(deps, chest);
    expect((await listOverrides(db, 1, 'frost-mage')).mythicPlus).toEqual([]);
  });
});
