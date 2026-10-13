import { describe, expect, it } from 'vitest';
import type { BlizzardClient } from '@/core/blizzard/client';
import { openTestDb } from '@/test/db';
import type { Services } from '../services';
import { replaceBisLists } from '@/core/db/queries/bis-lists';
import { updateSpecSettings, upsertOverride } from '@/core/db/queries/bis-settings';
import { insertCharacter } from '@/core/db/queries/characters';
import { upsertCatalogItem } from '@/core/db/queries/item-catalog';
import { upsertClassIcons } from '@/core/db/queries/media';
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
  { methodSlug: 'balance-druid', classId: 11, className: 'Druid', specName: 'Balance', iconUrl: null },
  { methodSlug: 'feral-druid', classId: 11, className: 'Druid', specName: 'Feral', iconUrl: null },
  { methodSlug: 'guardian-druid', classId: 11, className: 'Druid', specName: 'Guardian', iconUrl: null },
  { methodSlug: 'restoration-druid', classId: 11, className: 'Druid', specName: 'Restoration', iconUrl: null },
  { methodSlug: 'frost-mage', classId: 8, className: 'Mage', specName: 'Frost', iconUrl: null },
];

async function setup(withCatalog = true) {
  const db = await openTestDb();
  const s = { db, now: () => 1000, currentAccountId: () => 1 } as unknown as Services;
  if (withCatalog) await replaceSpecs(db, SPECS, 1);
  await insertCharacter(db, { region: 'eu', realmId: 1, realmSlug: 'test-realm', realmName: 'Test Realm', name: 'Birkibjörn', className: 'Druid', specName: 'Guardian' }, 1);
  return { db, s };
}

describe('getSpecPicker tracked cards', () => {
  it('lists each tracked spec with its compared list, edit count, character and icon', async () => {
    const { db, s } = await setup();
    await replaceBisLists(db, 'method', 'guardian-druid', lists, 500);
    await upsertCatalogItem(db, { itemId: 21, name: 'Other Neck', inventoryType: 'NECK', armorType: null, quality: 'EPIC', isTier: false }, 1);
    await upsertOverride(db, 1, 'guardian-druid', 'method', 'mythicPlus', { slotKey: 'Neck#1', itemId: 21, catalyst: false });
    await upsertOverride(db, 1, 'guardian-druid', 'method', 'mythicPlus', { slotKey: 'Gone#1', itemId: 21, catalyst: false });
    await upsertClassIcons(db, [{ className: 'Druid', classId: 11, iconUrl: 'https://render/druid.jpg' }], 1);
    const view = await getSpecPicker(s);
    expect(view.tracked).toEqual([expect.objectContaining({
      slug: 'guardian-druid', specName: 'Guardian', className: 'Druid', compares: 'mythicPlus', editedCount: 1, iconUrl: 'https://render/druid.jpg',
      characters: [expect.objectContaining({ name: 'Birkibjörn', className: 'Druid', href: '/characters/eu/test-realm/birkibj%C3%B6rn' })],
    })]);
  });

  it('follows the spec setting for the compared list and uses the spec icon when it has one', async () => {
    const { db, s } = await setup();
    await replaceSpecs(db, SPECS.map((x) => (x.methodSlug === 'guardian-druid' ? { ...x, iconUrl: 'https://render/guardian.jpg' } : x)), 2);
    await updateSpecSettings(db, 1, 'guardian-druid', { listType: 'raid' });
    const [card] = (await getSpecPicker(s)).tracked;
    expect(card).toMatchObject({ compares: 'raid', editedCount: 0, iconUrl: 'https://render/guardian.jpg' });
  });

  it('puts the tracked characters on their spec row, and the tracked count on the class', async () => {
    const { s } = await setup();
    const druid = (await getSpecPicker(s)).classes.find((c) => c.className === 'Druid')!;
    expect(druid.trackedCount).toBe(1);
    expect(druid.specs.find((x) => x.slug === 'guardian-druid')).toMatchObject({ tracked: true, compares: 'mythicPlus', characters: [expect.objectContaining({ name: 'Birkibjörn' })] });
    expect(druid.specs.find((x) => x.slug === 'feral-druid')!.characters).toEqual([]);
  });
});

describe('getSpecPicker', () => {
  it('marks tracked, not fetched, fetched and failed specs, grouped by class', async () => {
    const { db, s } = await setup();
    await replaceBisLists(db, 'method', 'feral-druid', lists, 500);
    await syncBisLists({ db, source: { name: 'Fake', fetchLists: async () => { throw new Error('down'); } }, sourceId: 'method', blizzard: {} as BlizzardClient, region: 'eu', now: 600 }, 'balance-druid');
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
    await replaceBisLists(db, 'method', 'guardian-druid', lists, 500);
    await upsertCatalogItem(db, { itemId: 21, name: 'Other Neck', inventoryType: 'NECK', armorType: null, quality: 'EPIC', isTier: false }, 1);
    await upsertOverride(db, 1, 'guardian-druid', 'method', 'mythicPlus', { slotKey: 'Neck#1', itemId: 21, catalyst: false });
    await upsertOverride(db, 1, 'guardian-druid', 'method', 'mythicPlus', { slotKey: 'Gone#1', itemId: 21, catalyst: false });
    const view = await getSettingsSpec(s, 'guardian-druid', 'mythicPlus');
    expect(view).toMatchObject({ slug: 'guardian-druid', className: 'Druid', specName: 'Guardian', listType: 'mythicPlus', statsMatter: true, editing: 'mythicPlus', hasLists: true });
    expect(view!.lists.mythicPlus.slots.map((x) => [x.slotKey, x.override?.itemId ?? null, x.tierSlot])).toEqual([['Head#1', null, true], ['Neck#1', 21, false]]);
    expect(view!.lists.mythicPlus.orphans.map((o) => o.slotKey)).toEqual(['Gone#1']);
    expect(view!.lists.mythicPlus.editedCount).toBe(1);
    expect(view!.lists.raid.editedCount).toBe(0);
  });

  it('names who uses the spec, when its list was fetched, and its icons', async () => {
    const { db, s } = await setup();
    await replaceBisLists(db, 'method', 'guardian-druid', lists, 500);
    await upsertClassIcons(db, [{ className: 'Druid', classId: 11, iconUrl: 'https://render/druid.jpg' }], 1);
    const view = await getSettingsSpec(s, 'guardian-druid', 'mythicPlus');
    expect(view).toMatchObject({ fetchedAt: 500, iconUrl: 'https://render/druid.jpg', classIconUrl: 'https://render/druid.jpg' });
    expect(view!.characters.map((c) => c.name)).toEqual(['Birkibjörn']);
    expect((await getSettingsSpec(s, 'frost-mage', 'overall'))!.characters).toEqual([]);
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
