import { and, eq, or } from 'drizzle-orm';
import type { Db } from '../client';
import { bisOverrides, itemCatalog, specSettings } from '../schema';
import type { BisOverride, ListType, SpecSettings } from '../../types';
import { withWriteLock } from './write-lock';

export const DEFAULT_SPEC_SETTINGS: SpecSettings = { listType: 'mythicPlus', statsMatter: true };

export async function getSpecSettings(db: Db, accountId: number, specSlug: string): Promise<SpecSettings> {
  const row = await db.select().from(specSettings)
    .where(and(eq(specSettings.accountId, accountId), eq(specSettings.specSlug, specSlug))).get();
  return row ? { listType: row.listType, statsMatter: row.statsMatter } : DEFAULT_SPEC_SETTINGS;
}

export async function updateSpecSettings(db: Db, accountId: number, specSlug: string, patch: Partial<SpecSettings>) {
  const next = { ...(await getSpecSettings(db, accountId, specSlug)), ...patch };
  await withWriteLock(db, () => db.insert(specSettings).values({ accountId, specSlug, ...next })
    .onConflictDoUpdate({ target: [specSettings.accountId, specSettings.specSlug], set: next }));
}

export async function listOverrides(db: Db, accountId: number, specSlug: string): Promise<Record<ListType, BisOverride[]>> {
  const rows = await db.select().from(bisOverrides)
    .where(and(eq(bisOverrides.accountId, accountId), eq(bisOverrides.specSlug, specSlug)));
  const result: Record<ListType, BisOverride[]> = { overall: [], raid: [], mythicPlus: [] };
  for (const r of rows) result[r.listType].push({ slotKey: r.slotKey, itemId: r.itemId, catalyst: r.catalyst });
  return result;
}

export async function upsertOverride(db: Db, accountId: number, specSlug: string, listType: ListType, o: BisOverride) {
  await withWriteLock(db, () => db.insert(bisOverrides).values({ accountId, specSlug, listType, ...o })
    .onConflictDoUpdate({
      target: [bisOverrides.accountId, bisOverrides.specSlug, bisOverrides.listType, bisOverrides.slotKey],
      set: { itemId: o.itemId, catalyst: o.catalyst },
    }));
}

export async function deleteOverride(db: Db, accountId: number, specSlug: string, listType: ListType, slotKey: string) {
  await withWriteLock(db, () => db.delete(bisOverrides).where(and(
    eq(bisOverrides.accountId, accountId), eq(bisOverrides.specSlug, specSlug),
    eq(bisOverrides.listType, listType), eq(bisOverrides.slotKey, slotKey),
  )));
}

/** Tier targets every account's overrides add for a spec: catalyst overrides, and overrides naming a tier item. */
export async function overrideTierItemIds(db: Db, specSlug: string): Promise<number[]> {
  const rows = await db.selectDistinct({ itemId: bisOverrides.itemId }).from(bisOverrides)
    .leftJoin(itemCatalog, eq(itemCatalog.itemId, bisOverrides.itemId))
    .where(and(eq(bisOverrides.specSlug, specSlug), or(eq(bisOverrides.catalyst, true), eq(itemCatalog.isTier, true))));
  return rows.map((r) => r.itemId);
}
