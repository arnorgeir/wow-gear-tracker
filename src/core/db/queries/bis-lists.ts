import { asc, eq } from 'drizzle-orm';
import type { Db } from '../client';
import { bisItems, bisLists } from '../schema';
import { LIST_TYPES, type BisLists, type BisRow } from '../../types';
import { withWriteLock } from './write-lock';

const toColumns = (row: BisRow, listId: number, position: number) => row.kind === 'item'
  ? { listId, position, slotLabel: row.slotLabel, slots: row.slots, source: row.source, itemId: row.itemId, name: row.name,
      bonusIds: row.bonusIds, isTier: row.isTier, isCatalyst: row.isCatalyst, minItemLevel: null }
  : { listId, position, slotLabel: row.slotLabel, slots: row.slots, source: row.source, itemId: null, name: `Any ${row.minItemLevel}`,
      bonusIds: [], isTier: false, isCatalyst: false, minItemLevel: row.minItemLevel };

const fromColumns = (r: typeof bisItems.$inferSelect): BisRow => r.minItemLevel !== null
  ? { kind: 'any', slotLabel: r.slotLabel, slots: r.slots, minItemLevel: r.minItemLevel, source: r.source }
  : { kind: 'item', slotLabel: r.slotLabel, slots: r.slots, itemId: r.itemId!, name: r.name, bonusIds: r.bonusIds,
      isTier: r.isTier, isCatalyst: r.isCatalyst, source: r.source };

export async function replaceBisLists(db: Db, specSlug: string, lists: BisLists, now: number) {
  await withWriteLock(db, () => db.transaction(async (tx) => {
    await tx.delete(bisLists).where(eq(bisLists.specSlug, specSlug));
    for (const listType of LIST_TYPES) {
      const [list] = await tx.insert(bisLists).values({ specSlug, listType, fetchedAt: now }).returning({ id: bisLists.id });
      const rows = lists[listType];
      if (rows.length > 0) await tx.insert(bisItems).values(rows.map((row, position) => toColumns(row, list!.id, position)));
    }
  }));
}

export async function getBisLists(db: Db, specSlug: string): Promise<{ lists: BisLists; fetchedAt: number } | null> {
  const listRows = await db.select().from(bisLists).where(eq(bisLists.specSlug, specSlug));
  if (listRows.length === 0) return null;
  const lists: BisLists = { overall: [], raid: [], mythicPlus: [] };
  for (const list of listRows) {
    const rows = await db.select().from(bisItems).where(eq(bisItems.listId, list.id)).orderBy(asc(bisItems.position));
    lists[list.listType] = rows.map(fromColumns);
  }
  return { lists, fetchedAt: Math.min(...listRows.map((l) => l.fetchedAt)) };
}
