import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../client';
import { bisOverrides, manualBisItems, manualBisLists, specSettings } from '../schema';
import { LIST_TYPES, type BisLists, type FetchedSourceId } from '../../types';
import { rowColumns, rowFromColumns } from './bis-lists';

export interface ManualLists { lists: BisLists; copiedFrom: FetchedSourceId; copiedAt: number }

const ofSpec = (accountId: number, specSlug: string) =>
  and(eq(manualBisItems.accountId, accountId), eq(manualBisItems.specSlug, specSlug));

/** An account's manual lists for a spec, or null before the first copy. */
export async function getManualLists(db: Db, accountId: number, specSlug: string): Promise<ManualLists | null> {
  const head = await db.select().from(manualBisLists)
    .where(and(eq(manualBisLists.accountId, accountId), eq(manualBisLists.specSlug, specSlug))).get();
  if (!head) return null;
  const rows = await db.select().from(manualBisItems).where(ofSpec(accountId, specSlug)).orderBy(asc(manualBisItems.position));
  const lists: BisLists = { overall: [], raid: [], mythicPlus: [] };
  for (const r of rows) lists[r.listType].push(rowFromColumns(r));
  return { lists, copiedFrom: head.copiedFrom, copiedAt: head.copiedAt };
}

/** Tier items in any account's manual lists for a spec, so reference sync fetches their stats. */
export async function manualTierItemIds(db: Db, specSlug: string): Promise<number[]> {
  const rows = await db.selectDistinct({ itemId: manualBisItems.itemId }).from(manualBisItems)
    .where(and(eq(manualBisItems.specSlug, specSlug), eq(manualBisItems.isTier, true)));
  return rows.flatMap((r) => (r.itemId === null ? [] : [r.itemId]));
}

// The two writes below take no lock: callers in src/core/bis/spec-base.ts hold it around their reads too.

/** Sets the spec's source to Manual. The caller holds the write lock. */
export async function setManualSource(db: Db, accountId: number, specSlug: string) {
  await db.insert(specSettings).values({ accountId, specSlug, source: 'manual' })
    .onConflictDoUpdate({ target: [specSettings.accountId, specSettings.specSlug], set: { source: 'manual' } });
}

/** Replaces the manual lists with a copy, clears the manual overrides and sets the source to Manual, in one transaction. The caller holds the write lock. */
export async function writeManualCopy(db: Db, accountId: number, specSlug: string, from: FetchedSourceId, lists: BisLists, now: number) {
  await db.transaction(async (tx) => {
    await tx.delete(manualBisItems).where(ofSpec(accountId, specSlug));
    await tx.delete(bisOverrides).where(and(
      eq(bisOverrides.accountId, accountId), eq(bisOverrides.specSlug, specSlug), eq(bisOverrides.source, 'manual'),
    ));
    const rows = LIST_TYPES.flatMap((listType) => lists[listType].map((row, position) => ({ accountId, specSlug, listType, position, ...rowColumns(row) })));
    if (rows.length > 0) await tx.insert(manualBisItems).values(rows);
    await tx.insert(manualBisLists).values({ accountId, specSlug, copiedFrom: from, copiedAt: now })
      .onConflictDoUpdate({ target: [manualBisLists.accountId, manualBisLists.specSlug], set: { copiedFrom: from, copiedAt: now } });
    await tx.insert(specSettings).values({ accountId, specSlug, source: 'manual' })
      .onConflictDoUpdate({ target: [specSettings.accountId, specSettings.specSlug], set: { source: 'manual' } });
  });
}
