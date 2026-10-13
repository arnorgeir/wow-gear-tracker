import { and, eq, or } from 'drizzle-orm';
import type { Db } from '../client';
import { accounts, bisOverrides, itemCatalog, specSettings } from '../schema';
import { UserError } from '../../errors';
import { FETCHED_SOURCES, type BisOverride, type BisSourceId, type FetchedSourceId, type ListType, type SpecSettings } from '../../types';
import { withWriteLock } from './write-lock';

export const DEFAULT_SPEC_SETTINGS: SpecSettings = { source: 'method', listType: 'mythicPlus', statsMatter: true };

export async function getSpecSettings(db: Db, accountId: number, specSlug: string): Promise<SpecSettings> {
  const row = await db.select().from(specSettings)
    .where(and(eq(specSettings.accountId, accountId), eq(specSettings.specSlug, specSlug))).get();
  return row ? { source: row.source, listType: row.listType, statsMatter: row.statsMatter } : DEFAULT_SPEC_SETTINGS;
}

export async function updateSpecSettings(db: Db, accountId: number, specSlug: string, patch: Partial<SpecSettings>) {
  // Read inside the lock: overlapping partial patches must each see the other's write.
  await withWriteLock(db, async () => {
    const next = { ...(await getSpecSettings(db, accountId, specSlug)), ...patch };
    await db.insert(specSettings).values({ accountId, specSlug, ...next })
      .onConflictDoUpdate({ target: [specSettings.accountId, specSettings.specSlug], set: next });
  });
}

const ofSource = (accountId: number, specSlug: string, source: BisSourceId) =>
  and(eq(bisOverrides.accountId, accountId), eq(bisOverrides.specSlug, specSlug), eq(bisOverrides.source, source));

export async function listOverrides(db: Db, accountId: number, specSlug: string, source: BisSourceId): Promise<Record<ListType, BisOverride[]>> {
  const rows = await db.select().from(bisOverrides).where(ofSource(accountId, specSlug, source));
  const result: Record<ListType, BisOverride[]> = { overall: [], raid: [], mythicPlus: [] };
  for (const r of rows) result[r.listType].push({ slotKey: r.slotKey, itemId: r.itemId, catalyst: r.catalyst });
  return result;
}

export const SOURCE_CHANGED = 'The BiS source changed. Reload the page.';

const insertOverride = (db: Db, accountId: number, specSlug: string, source: BisSourceId, listType: ListType, o: BisOverride) =>
  db.insert(bisOverrides).values({ accountId, specSlug, source, listType, ...o })
    .onConflictDoUpdate({
      target: [bisOverrides.accountId, bisOverrides.specSlug, bisOverrides.source, bisOverrides.listType, bisOverrides.slotKey],
      set: { itemId: o.itemId, catalyst: o.catalyst },
    });

const removeOverrideRow = (db: Db, accountId: number, specSlug: string, source: BisSourceId, listType: ListType, slotKey: string) =>
  db.delete(bisOverrides).where(and(ofSource(accountId, specSlug, source), eq(bisOverrides.listType, listType), eq(bisOverrides.slotKey, slotKey)));

export async function upsertOverride(db: Db, accountId: number, specSlug: string, source: BisSourceId, listType: ListType, o: BisOverride) {
  await withWriteLock(db, () => insertOverride(db, accountId, specSlug, source, listType, o));
}

export async function deleteOverride(db: Db, accountId: number, specSlug: string, source: BisSourceId, listType: ListType, slotKey: string) {
  await withWriteLock(db, () => removeOverrideRow(db, accountId, specSlug, source, listType, slotKey));
}

/** Throws when the spec's chosen source isn't `source`. Reads inside the lock, so a source switch queued ahead of the write is seen. */
async function requireCurrentSource(db: Db, accountId: number, specSlug: string, source: BisSourceId) {
  if ((await getSpecSettings(db, accountId, specSlug)).source !== source) throw new UserError(SOURCE_CHANGED);
}

/** Saves only while `source` is still the spec's chosen one, checked in the same lock task as the write. */
export async function upsertOverrideIfCurrent(db: Db, accountId: number, specSlug: string, source: BisSourceId, listType: ListType, o: BisOverride) {
  await withWriteLock(db, async () => {
    await requireCurrentSource(db, accountId, specSlug, source);
    await insertOverride(db, accountId, specSlug, source, listType, o);
  });
}

/** Removes only while `source` is still the spec's chosen one, checked in the same lock task as the delete. */
export async function deleteOverrideIfCurrent(db: Db, accountId: number, specSlug: string, source: BisSourceId, listType: ListType, slotKey: string) {
  await withWriteLock(db, async () => {
    await requireCurrentSource(db, accountId, specSlug, source);
    await removeOverrideRow(db, accountId, specSlug, source, listType, slotKey);
  });
}

/** The fetched sources any account uses for a spec. An account without a settings row uses Method. */
export async function sourcesInUse(db: Db, specSlug: string): Promise<FetchedSourceId[]> {
  const rows = await db.select({ source: specSettings.source }).from(accounts)
    .leftJoin(specSettings, and(eq(specSettings.accountId, accounts.id), eq(specSettings.specSlug, specSlug)));
  const used = new Set<BisSourceId>(rows.map((r) => r.source ?? 'method'));
  return FETCHED_SOURCES.filter((s) => used.has(s));
}

/** Tier targets every account's overrides add for a spec: catalyst overrides, and overrides naming a tier item. */
export async function overrideTierItemIds(db: Db, specSlug: string): Promise<number[]> {
  const rows = await db.selectDistinct({ itemId: bisOverrides.itemId }).from(bisOverrides)
    .leftJoin(itemCatalog, eq(itemCatalog.itemId, bisOverrides.itemId))
    .where(and(eq(bisOverrides.specSlug, specSlug), or(eq(bisOverrides.catalyst, true), eq(itemCatalog.isTier, true))));
  return rows.map((r) => r.itemId);
}
