import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import type { Db } from '../db/client';
import { replaceBisLists } from '../db/queries/bis-lists';
import { getSpecSettings, listOverrides, updateSpecSettings, upsertOverride } from '../db/queries/bis-settings';
import { upsertCatalogItem } from '../db/queries/item-catalog';
import { getManualLists } from '../db/queries/manual-lists';
import { accounts } from '../db/schema';
import type { BisLists, BisRow } from '../types';
import { setMeta } from '../db/queries/meta';
import { chooseManual, copyManual, readSpecBase } from './spec-base';

const SLUG = 'frost-mage';
const row = (slotLabel: string, itemId: number): BisRow =>
  ({ kind: 'item', slotLabel, slots: slotLabel === 'Head' ? ['HEAD'] : ['NECK'], itemId, name: `Item ${itemId}`, bonusIds: [], isTier: false, isCatalyst: false, source: 'Vexmaw' });
const methodLists: BisLists = { overall: [row('Head', 1)], raid: [], mythicPlus: [row('Head', 2), row('Neck', 3)] };
const icyLists: BisLists = { overall: [row('Head', 11)], raid: [row('Neck', 12)], mythicPlus: [] };
const ids = (rows: BisRow[]) => rows.map((r) => r.kind === 'item' && r.itemId);

async function seeded(): Promise<Db> {
  const db = await openTestDb();
  await db.insert(accounts).values({ id: 2, name: 'Other' });
  await replaceBisLists(db, 'method', SLUG, methodLists, 1);
  for (const itemId of [900, 901]) {
    await upsertCatalogItem(db, { itemId, name: `Woven Hood ${itemId}`, inventoryType: 'HEAD', armorType: 'cloth', quality: 'EPIC', isTier: false }, 1);
  }
  return db;
}

describe('manual lists', () => {
  it('copies the effective list of the current source, with edits applied', async () => {
    const db = await seeded();
    await upsertOverride(db, 1, SLUG, 'method', 'mythicPlus', { slotKey: 'Head#1', itemId: 900, catalyst: false });
    await chooseManual(db, 1, SLUG, 50);
    expect(await getSpecSettings(db, 1, SLUG)).toMatchObject({ source: 'manual' });
    const manual = (await getManualLists(db, 1, SLUG))!;
    expect(manual).toMatchObject({ copiedFrom: 'method', copiedAt: 50 });
    expect(ids(manual.lists.mythicPlus)).toEqual([900, 3]);
    expect(manual.lists.mythicPlus[0]).toEqual({ ...row('Head', 900), name: 'Woven Hood 900', source: 'Vexmaw' });
    expect(ids(manual.lists.overall)).toEqual([1]);
  });

  it('keeps the copy when Manual is chosen again', async () => {
    const db = await seeded();
    await upsertOverride(db, 1, SLUG, 'method', 'mythicPlus', { slotKey: 'Head#1', itemId: 900, catalyst: false });
    await chooseManual(db, 1, SLUG, 50);
    await updateSpecSettings(db, 1, SLUG, { source: 'method' });
    await upsertOverride(db, 1, SLUG, 'method', 'mythicPlus', { slotKey: 'Head#1', itemId: 901, catalyst: false });
    await chooseManual(db, 1, SLUG, 60);
    expect(await getSpecSettings(db, 1, SLUG)).toMatchObject({ source: 'manual' });
    expect(await getManualLists(db, 1, SLUG)).toMatchObject({ copiedAt: 50 });
    expect(ids((await getManualLists(db, 1, SLUG))!.lists.mythicPlus)).toEqual([900, 3]);
  });

  it('refuses and changes nothing when the current source has no rows', async () => {
    const db = await seeded();
    await updateSpecSettings(db, 1, SLUG, { source: 'icyVeins', listType: 'raid' });
    await expect(chooseManual(db, 1, SLUG, 1)).rejects.toThrow('Fetch a list first, then copy it.');
    expect(await getSpecSettings(db, 1, SLUG)).toEqual({ source: 'icyVeins', listType: 'raid', statsMatter: true });
    expect(await getManualLists(db, 1, SLUG)).toBeNull();
  });

  it('copy again replaces the rows and clears manual overrides, keeping other sources\' overrides', async () => {
    const db = await seeded();
    await upsertOverride(db, 1, SLUG, 'method', 'mythicPlus', { slotKey: 'Head#1', itemId: 900, catalyst: false });
    await chooseManual(db, 1, SLUG, 50);
    await upsertOverride(db, 1, SLUG, 'manual', 'overall', { slotKey: 'Head#1', itemId: 901, catalyst: false });
    await replaceBisLists(db, 'icyVeins', SLUG, icyLists, 70);
    await copyManual(db, 1, SLUG, 'icyVeins', 99);
    const manual = (await getManualLists(db, 1, SLUG))!;
    expect(manual).toMatchObject({ copiedFrom: 'icyVeins', copiedAt: 99 });
    expect(manual.lists).toEqual(icyLists);
    expect(await listOverrides(db, 1, SLUG, 'manual')).toEqual({ overall: [], raid: [], mythicPlus: [] });
    expect((await listOverrides(db, 1, SLUG, 'method')).mythicPlus).toHaveLength(1);
    expect(await getSpecSettings(db, 1, SLUG)).toMatchObject({ source: 'manual' });
  });

  it('copy again from a source with no rows refuses and keeps the copy', async () => {
    const db = await seeded();
    await chooseManual(db, 1, SLUG, 50);
    await expect(copyManual(db, 1, SLUG, 'icyVeins', 99)).rejects.toThrow('Fetch a list first, then copy it.');
    expect(await getManualLists(db, 1, SLUG)).toMatchObject({ copiedFrom: 'method', copiedAt: 50, lists: methodLists });
  });

  it('never shows one account another account\'s manual lists', async () => {
    const db = await seeded();
    await chooseManual(db, 1, SLUG, 50);
    expect(await getManualLists(db, 2, SLUG)).toBeNull();
    expect(await getSpecSettings(db, 2, SLUG)).toMatchObject({ source: 'method' });
  });
});

// A trigger fails the copy's last insert, after its deletes and item inserts have run.
const failLastCopyWrite = (db: Db) => db.run(sql`CREATE TRIGGER fail_copy BEFORE INSERT ON manual_bis_lists BEGIN SELECT RAISE(ABORT, 'disk full'); END`);

describe('a copy that fails mid-write', () => {
  it('Choose Manual leaves the source, the manual rows and the overrides untouched', async () => {
    const db = await seeded();
    await upsertOverride(db, 1, SLUG, 'method', 'mythicPlus', { slotKey: 'Head#1', itemId: 900, catalyst: false });
    await failLastCopyWrite(db);
    await expect(chooseManual(db, 1, SLUG, 50)).rejects.toThrow();
    expect(await getSpecSettings(db, 1, SLUG)).toMatchObject({ source: 'method' });
    expect(await getManualLists(db, 1, SLUG)).toBeNull();
    expect((await listOverrides(db, 1, SLUG, 'method')).mythicPlus).toHaveLength(1);
  });

  it('Copy again keeps the old copy, its edits and the source', async () => {
    const db = await seeded();
    await chooseManual(db, 1, SLUG, 50);
    await upsertOverride(db, 1, SLUG, 'manual', 'overall', { slotKey: 'Head#1', itemId: 901, catalyst: false });
    await replaceBisLists(db, 'icyVeins', SLUG, icyLists, 70);
    await failLastCopyWrite(db);
    await expect(copyManual(db, 1, SLUG, 'icyVeins', 99)).rejects.toThrow();
    expect(await getManualLists(db, 1, SLUG)).toMatchObject({ copiedFrom: 'method', copiedAt: 50, lists: methodLists });
    expect((await listOverrides(db, 1, SLUG, 'manual')).overall).toHaveLength(1);
    expect(await getSpecSettings(db, 1, SLUG)).toMatchObject({ source: 'manual' });
  });

  it('the write lock is free afterwards', async () => {
    const db = await seeded();
    await failLastCopyWrite(db);
    await expect(chooseManual(db, 1, SLUG, 50)).rejects.toThrow();
    await db.run(sql`DROP TRIGGER fail_copy`);
    await chooseManual(db, 1, SLUG, 60);
    expect(await getManualLists(db, 1, SLUG)).toMatchObject({ copiedAt: 60 });
  });
});

describe('readSpecBase', () => {
  it('reads the chosen fetched source and never another source’s rows', async () => {
    const db = await seeded();
    expect(await readSpecBase(db, 1, SLUG, 2)).toMatchObject({ source: 'method', copiedFrom: null, lists: methodLists, status: 'ready' });
    await updateSpecSettings(db, 1, SLUG, { source: 'icyVeins' });
    expect(await readSpecBase(db, 1, SLUG, 2)).toEqual({ source: 'icyVeins', copiedFrom: null, lists: null, fetchedAt: null, error: null, status: 'loading', due: true });
  });

  it('reads Manual as ready, not due, without errors, aged by its copy', async () => {
    const db = await seeded();
    await chooseManual(db, 1, SLUG, 40);
    await setMeta(db, 'bis.method.frost-mage.failed', 'BiS list couldn’t be updated', 9_000);
    expect(await readSpecBase(db, 1, SLUG, 10_000_000_000)).toEqual({
      source: 'manual', copiedFrom: 'method', lists: methodLists, fetchedAt: 40, error: null, status: 'ready', due: false,
    });
  });
});
