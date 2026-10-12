import { and, eq } from 'drizzle-orm';
import type { Db } from '../client';
import { manualBisItems } from '../schema';

/** Tier items in any account's manual lists for a spec, so reference sync fetches their stats. */
export async function manualTierItemIds(db: Db, specSlug: string): Promise<number[]> {
  const rows = await db.selectDistinct({ itemId: manualBisItems.itemId }).from(manualBisItems)
    .where(and(eq(manualBisItems.specSlug, specSlug), eq(manualBisItems.isTier, true)));
  return rows.flatMap((r) => (r.itemId === null ? [] : [r.itemId]));
}
