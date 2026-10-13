import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../client';
import { bisItems, bisLists } from '../schema';
import { LIST_TYPES, type BisLists, type BisRow, type FetchedSourceId } from '../../types';
import { withWriteLock } from './write-lock';

type RowColumns = Omit<typeof bisItems.$inferSelect, 'id' | 'listId' | 'position'>;

/** A row's `bis_items` columns, without `listId` and `position`. Manual lists store the same shape. */
export const rowColumns = (row: BisRow): RowColumns => row.kind === 'item'
  ? { slotLabel: row.slotLabel, slots: row.slots, source: row.source, itemId: row.itemId, name: row.name,
      bonusIds: row.bonusIds, isTier: row.isTier, isCatalyst: row.isCatalyst, minItemLevel: null }
  : { slotLabel: row.slotLabel, slots: row.slots, source: row.source, itemId: null, name: `Any ${row.minItemLevel}`,
      bonusIds: [], isTier: false, isCatalyst: false, minItemLevel: row.minItemLevel };

export const rowFromColumns = (r: RowColumns): BisRow => r.minItemLevel !== null
  ? { kind: 'any', slotLabel: r.slotLabel, slots: r.slots, minItemLevel: r.minItemLevel, source: r.source }
  : { kind: 'item', slotLabel: r.slotLabel, slots: r.slots, itemId: r.itemId!, name: r.name, bonusIds: r.bonusIds,
      isTier: r.isTier, isCatalyst: r.isCatalyst, source: r.source };

const ofSource = (source: FetchedSourceId, specSlug: string) => and(eq(bisLists.source, source), eq(bisLists.specSlug, specSlug));

export async function replaceBisLists(db: Db, source: FetchedSourceId, specSlug: string, lists: BisLists, now: number) {
  await withWriteLock(db, () => db.transaction(async (tx) => {
    await tx.delete(bisLists).where(ofSource(source, specSlug));
    for (const listType of LIST_TYPES) {
      const [list] = await tx.insert(bisLists).values({ source, specSlug, listType, fetchedAt: now }).returning({ id: bisLists.id });
      const rows = lists[listType];
      if (rows.length > 0) await tx.insert(bisItems).values(rows.map((row, position) => ({ listId: list!.id, position, ...rowColumns(row) })));
    }
  }));
}

export async function getBisLists(db: Db, source: FetchedSourceId, specSlug: string): Promise<{ lists: BisLists; fetchedAt: number } | null> {
  const listRows = await db.select().from(bisLists).where(ofSource(source, specSlug));
  if (listRows.length === 0) return null;
  const lists: BisLists = { overall: [], raid: [], mythicPlus: [] };
  for (const list of listRows) {
    const rows = await db.select().from(bisItems).where(eq(bisItems.listId, list.id)).orderBy(asc(bisItems.position));
    lists[list.listType] = rows.map(rowFromColumns);
  }
  return { lists, fetchedAt: Math.min(...listRows.map((l) => l.fetchedAt)) };
}
