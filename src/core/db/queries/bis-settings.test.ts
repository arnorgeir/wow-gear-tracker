import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { accounts, itemCatalog } from '../schema';
import { DEFAULT_SPEC_SETTINGS, sourcesInUse, deleteOverride, getSpecSettings, listOverrides, overrideTierItemIds, updateSpecSettings, upsertOverride } from './bis-settings';

const SLUG = 'frost-mage';

async function twoAccounts() {
  const db = await openTestDb();
  await db.insert(accounts).values({ id: 2, name: 'Other' });
  return db;
}

describe('spec settings', () => {
  it('defaults to Mythic+ with stats mattering', async () => {
    const db = await openTestDb();
    expect(await getSpecSettings(db, 1, SLUG)).toEqual(DEFAULT_SPEC_SETTINGS);
    expect(DEFAULT_SPEC_SETTINGS).toEqual({ source: 'method', listType: 'mythicPlus', statsMatter: true });
  });

  it('patches one field without resetting the other', async () => {
    const db = await openTestDb();
    await updateSpecSettings(db, 1, SLUG, { statsMatter: false });
    await updateSpecSettings(db, 1, SLUG, { listType: 'raid' });
    expect(await getSpecSettings(db, 1, SLUG)).toEqual({ source: 'method', listType: 'raid', statsMatter: false });
  });

  it.each([['no row yet', false], ['an existing row', true]])('keeps both fields when partial patches overlap, with %s', async (_label, seeded) => {
    const db = await openTestDb();
    if (seeded) await updateSpecSettings(db, 1, SLUG, { listType: 'overall', statsMatter: true });
    await Promise.all([
      updateSpecSettings(db, 1, SLUG, { listType: 'raid' }),
      updateSpecSettings(db, 1, SLUG, { statsMatter: false }),
    ]);
    expect(await getSpecSettings(db, 1, SLUG)).toEqual({ source: 'method', listType: 'raid', statsMatter: false });
  });

  it('keeps accounts apart', async () => {
    const db = await twoAccounts();
    await updateSpecSettings(db, 1, SLUG, { listType: 'overall' });
    expect(await getSpecSettings(db, 2, SLUG)).toEqual(DEFAULT_SPEC_SETTINGS);
  });
});

describe('overrides', () => {
  it('upserts by slot key and deletes', async () => {
    const db = await openTestDb();
    await upsertOverride(db, 1, SLUG, 'method', 'mythicPlus', { slotKey: 'Ring#2', itemId: 100, catalyst: false });
    await upsertOverride(db, 1, SLUG, 'method', 'mythicPlus', { slotKey: 'Ring#2', itemId: 101, catalyst: false });
    await upsertOverride(db, 1, SLUG, 'method', 'raid', { slotKey: 'Head#1', itemId: 200, catalyst: true });
    expect(await listOverrides(db, 1, SLUG, 'method')).toEqual({
      overall: [],
      raid: [{ slotKey: 'Head#1', itemId: 200, catalyst: true }],
      mythicPlus: [{ slotKey: 'Ring#2', itemId: 101, catalyst: false }],
    });
    await deleteOverride(db, 1, SLUG, 'method', 'mythicPlus', 'Ring#2');
    expect((await listOverrides(db, 1, SLUG, 'method')).mythicPlus).toEqual([]);
  });

  it('never shows one account another account\'s overrides', async () => {
    const db = await twoAccounts();
    await upsertOverride(db, 1, SLUG, 'method', 'mythicPlus', { slotKey: 'Neck#1', itemId: 100, catalyst: false });
    expect(await listOverrides(db, 2, SLUG, 'method')).toEqual({ overall: [], raid: [], mythicPlus: [] });
  });

  it('collects tier targets from every account: catalyst bases and tier items', async () => {
    const db = await twoAccounts();
    await db.insert(itemCatalog).values([
      { itemId: 300, name: 'Frostbound Crown', inventoryType: 'HEAD', armorType: 'cloth', quality: 'EPIC', isTier: true, fetchedAt: 1 },
      { itemId: 301, name: 'Woven Hood', inventoryType: 'HEAD', armorType: 'cloth', quality: 'EPIC', isTier: false, fetchedAt: 1 },
      { itemId: 302, name: 'Plain Band', inventoryType: 'FINGER', armorType: null, quality: 'EPIC', isTier: false, fetchedAt: 1 },
    ]);
    await upsertOverride(db, 1, SLUG, 'method', 'mythicPlus', { slotKey: 'Head#1', itemId: 300, catalyst: false });
    await upsertOverride(db, 2, SLUG, 'method', 'raid', { slotKey: 'Head#1', itemId: 301, catalyst: true });
    await upsertOverride(db, 1, SLUG, 'method', 'mythicPlus', { slotKey: 'Ring#1', itemId: 302, catalyst: false });
    expect((await overrideTierItemIds(db, SLUG)).sort()).toEqual([300, 301]);
  });
});

describe('sources', () => {
  it('keeps overrides per source', async () => {
    const db = await openTestDb();
    await upsertOverride(db, 1, SLUG, 'method', 'raid', { slotKey: 'Head#1', itemId: 100, catalyst: false });
    expect((await listOverrides(db, 1, SLUG, 'icyVeins')).raid).toEqual([]);
    await upsertOverride(db, 1, SLUG, 'icyVeins', 'raid', { slotKey: 'Head#1', itemId: 200, catalyst: false });
    expect((await listOverrides(db, 1, SLUG, 'method')).raid).toEqual([{ slotKey: 'Head#1', itemId: 100, catalyst: false }]);
    await deleteOverride(db, 1, SLUG, 'icyVeins', 'raid', 'Head#1');
    expect((await listOverrides(db, 1, SLUG, 'method')).raid).toHaveLength(1);
  });

  it('lists the fetched sources accounts use, Method when unset, none for Manual', async () => {
    const db = await twoAccounts();
    expect(await sourcesInUse(db, SLUG)).toEqual(['method']);
    await updateSpecSettings(db, 1, SLUG, { source: 'icyVeins' });
    expect(await sourcesInUse(db, SLUG)).toEqual(['method', 'icyVeins']);
    await updateSpecSettings(db, 2, SLUG, { source: 'manual' });
    expect(await sourcesInUse(db, SLUG)).toEqual(['icyVeins']);
  });
});
