import { asc, eq } from 'drizzle-orm';
import type { Db } from '../client';
import { bisItems, bisLists } from '../schema';
import { LIST_TYPES, type BisLists } from '../../types';
import { withWriteLock } from './write-lock';

export async function replaceBisLists(db: Db, specSlug: string, lists: BisLists, now: number) {
  await withWriteLock(db, () => db.transaction(async (tx) => {
    await tx.delete(bisLists).where(eq(bisLists.specSlug, specSlug));
    for (const listType of LIST_TYPES) {
      const [list] = await tx.insert(bisLists).values({ specSlug, listType, fetchedAt: now }).returning({ id: bisLists.id });
      const rows = lists[listType];
      if (rows.length > 0) await tx.insert(bisItems).values(rows.map((row, position) => ({ ...row, listId: list!.id, position })));
    }
  }));
}

export async function getBisLists(db: Db, specSlug: string): Promise<{ lists: BisLists; fetchedAt: number } | null> {
  const listRows = await db.select().from(bisLists).where(eq(bisLists.specSlug, specSlug));
  if (listRows.length === 0) return null;
  const lists: BisLists = { overall: [], raid: [], mythicPlus: [] };
  for (const list of listRows) {
    const rows = await db.select().from(bisItems).where(eq(bisItems.listId, list.id)).orderBy(asc(bisItems.position));
    lists[list.listType] = rows.map(({ slotLabel, slots, itemId, name, bonusIds, isTier, isCatalyst, source }) =>
      ({ slotLabel, slots, itemId, name, bonusIds, isTier, isCatalyst, source }));
  }
  return { lists, fetchedAt: Math.min(...listRows.map((l) => l.fetchedAt)) };
}
