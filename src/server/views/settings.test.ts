import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import type { Services } from '../services';
import { replaceBisLists } from '@/core/db/queries/bis-lists';
import { upsertOverride } from '@/core/db/queries/bis-settings';
import { insertCharacter } from '@/core/db/queries/characters';
import { upsertCatalogItem } from '@/core/db/queries/item-catalog';
import { replaceSpecs } from '@/core/db/queries/specs';
import { syncBisLists } from '@/core/sync/reference-sync';
import type { BisLists } from '@/core/types';
import { getSpecPicker } from './settings-bis';
import { getSettingsSpec } from './settings-spec';

const lists: BisLists = {
  overall: [],
  raid: [],
  mythicPlus: [
    { kind: 'item', slotLabel: 'Head', slots: ['HEAD'], itemId: 10, name: 'Tier Catalyst Helm', bonusIds: [], isTier: true, isCatalyst: true, source: 'Raid' },
    { kind: 'item', slotLabel: 'Neck', slots: ['NECK'], itemId: 20, name: 'Best Neck', bonusIds: [], isTier: false, isCatalyst: false, source: 'Dungeon B' },
  ],
};
const SPECS = [
  { methodSlug: 'balance-druid', classId: 11, className: 'Druid', specName: 'Balance' },
  { methodSlug: 'feral-druid', classId: 11, className: 'Druid', specName: 'Feral' },
  { methodSlug: 'guardian-druid', classId: 11, className: 'Druid', specName: 'Guardian' },
  { methodSlug: 'restoration-druid', classId: 11, className: 'Druid', specName: 'Restoration' },
  { methodSlug: 'frost-mage', classId: 8, className: 'Mage', specName: 'Frost' },
];

async function setup(withCatalog = true) {
  const db = await openTestDb();
  const s = { db, now: () => 1000, currentAccountId: () => 1 } as unknown as Services;
  if (withCatalog) await replaceSpecs(db, SPECS, 1);
  await insertCharacter(db, { region: 'eu', realmId: 1, realmSlug: 'test-realm', realmName: 'Test Realm', name: 'Birkibjörn', className: 'Druid', specName: 'Guardian' }, 1);
  return { db, s };
}

describe('getSpecPicker', () => {
  it('marks tracked, not fetched, fetched and failed specs, grouped by class', async () => {
    const { db, s } = await setup();
    await replaceBisLists(db, 'feral-druid', lists, 500);
    await syncBisLists({ db, source: { name: 'Fake', fetchLists: async () => { throw new Error('down'); } }, now: 600 }, 'balance-druid');
    const view = await getSpecPicker(s);
    expect(view.classes.map((c) => c.className)).toEqual(['Druid', 'Mage']);
    const druid = view.classes.find((c) => c.className === 'Druid')!;
    expect(druid.specs.map((x) => [x.slug, x.state.kind])).toEqual([
      ['balance-druid', 'failed'], ['feral-druid', 'fetched'], ['guardian-druid', 'tracked'], ['restoration-druid', 'notFetched'],
    ]);
    expect(druid.specs.find((x) => x.slug === 'guardian-druid')!.tracked).toBe(true);
  });

  it('falls back to tracked specs when the catalog is empty', async () => {
    const { s } = await setup(false);
    expect((await getSpecPicker(s)).classes).toEqual([expect.objectContaining({ className: 'Druid', specs: [expect.objectContaining({ slug: 'guardian-druid' })] })]);
  });
});

describe('getSettingsSpec', () => {
  it('pairs each Method slot with its override and lists orphans', async () => {
    const { db, s } = await setup();
    await replaceBisLists(db, 'guardian-druid', lists, 500);
    await upsertCatalogItem(db, { itemId: 21, name: 'Other Neck', inventoryType: 'NECK', armorType: null, quality: 'EPIC', isTier: false }, 1);
    await upsertOverride(db, 1, 'guardian-druid', 'mythicPlus', { slotKey: 'Neck#1', itemId: 21, catalyst: false });
    await upsertOverride(db, 1, 'guardian-druid', 'mythicPlus', { slotKey: 'Gone#1', itemId: 21, catalyst: false });
    const view = await getSettingsSpec(s, 'guardian-druid', 'mythicPlus');
    expect(view).toMatchObject({ slug: 'guardian-druid', className: 'Druid', specName: 'Guardian', listType: 'mythicPlus', statsMatter: true, editing: 'mythicPlus', hasLists: true });
    expect(view!.lists.mythicPlus.slots.map((x) => [x.slotKey, x.override?.itemId ?? null, x.tierSlot])).toEqual([['Head#1', null, true], ['Neck#1', 21, false]]);
    expect(view!.lists.mythicPlus.orphans.map((o) => o.slotKey)).toEqual(['Gone#1']);
  });

  it('reports a spec with no cached list as not having lists', async () => {
    const { s } = await setup();
    expect(await getSettingsSpec(s, 'frost-mage', 'overall')).toMatchObject({ hasLists: false, fetchState: { kind: 'notFetched' } });
  });

  it('returns null for an unknown slug', async () => {
    const { s } = await setup();
    expect(await getSettingsSpec(s, '../etc', 'mythicPlus')).toBeNull();
  });
});
