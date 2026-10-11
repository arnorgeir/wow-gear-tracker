import { eq, inArray } from 'drizzle-orm';
import type { Db } from '../client';
import { dungeonLoot, itemCatalog } from '../schema';
import type { CatalogItem } from '../../types';
import { withWriteLock } from './write-lock';

const fromCatalog = (r: typeof itemCatalog.$inferSelect): CatalogItem =>
  ({ itemId: r.itemId, name: r.name, inventoryType: r.inventoryType, armorType: r.armorType, quality: r.quality, isTier: r.isTier });

const fromLoot = (r: typeof dungeonLoot.$inferSelect): CatalogItem =>
  ({ itemId: r.itemId, name: r.itemName, inventoryType: r.inventoryType, armorType: r.armorType, quality: r.quality, isTier: r.isTier });

export async function getCatalogItems(db: Db, ids: number[]): Promise<Map<number, CatalogItem>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(itemCatalog).where(inArray(itemCatalog.itemId, ids));
  return new Map(rows.map((r) => [r.itemId, fromCatalog(r)]));
}

export async function upsertCatalogItem(db: Db, item: CatalogItem, now: number) {
  const values = { ...item, fetchedAt: now };
  await withWriteLock(db, () => db.insert(itemCatalog).values(values)
    .onConflictDoUpdate({ target: itemCatalog.itemId, set: values }));
}

export async function findLocalItem(db: Db, itemId: number): Promise<CatalogItem | null> {
  const cataloged = await db.select().from(itemCatalog).where(eq(itemCatalog.itemId, itemId)).get();
  if (cataloged) return fromCatalog(cataloged);
  // A row without an inventory type or quality predates season.v4 or lost its details: not complete enough to trust.
  const loot = await db.select().from(dungeonLoot).where(eq(dungeonLoot.itemId, itemId)).get();
  return loot && loot.inventoryType !== null && loot.quality !== null ? fromLoot(loot) : null;
}

// ponytail: loads the whole catalog and season loot per search (a few hundred rows); index by name if it grows.
export async function searchLocalItems(db: Db, query: string): Promise<CatalogItem[]> {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return [];
  const byId = new Map<number, CatalogItem>();
  for (const r of await db.select().from(itemCatalog)) byId.set(r.itemId, fromCatalog(r));
  for (const r of await db.select().from(dungeonLoot)) if (!byId.has(r.itemId)) byId.set(r.itemId, fromLoot(r));
  return [...byId.values()]
    .filter((i) => String(i.itemId) === q || i.name.toLocaleLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
}
