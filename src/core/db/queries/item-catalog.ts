import { eq, inArray } from 'drizzle-orm';
import type { Db } from '../client';
import { dungeonLoot, itemCatalog, seasonDungeons } from '../schema';
import type { CatalogItem, WeaponType } from '../../types';
import { withWriteLock } from './write-lock';

const fromCatalog = (r: typeof itemCatalog.$inferSelect): CatalogItem =>
  ({ itemId: r.itemId, name: r.name, inventoryType: r.inventoryType, armorType: r.armorType, weaponType: r.weaponType, quality: r.quality, isTier: r.isTier });

const fromLoot = (r: typeof dungeonLoot.$inferSelect): CatalogItem =>
  ({ itemId: r.itemId, name: r.itemName, inventoryType: r.inventoryType, armorType: r.armorType, weaponType: r.weaponType, quality: r.quality, isTier: r.isTier });

// Catalog rows from before weapon types have none; the season loot may know it already.
const withLootWeapon = (item: CatalogItem, fromLootRow: WeaponType | null): CatalogItem =>
  item.weaponType === null && fromLootRow !== null ? { ...item, weaponType: fromLootRow } : item;

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
  // A row without an inventory type or quality predates season.v4 or lost its details: not complete enough to trust.
  const loot = await db.select().from(dungeonLoot).where(eq(dungeonLoot.itemId, itemId)).get();
  const fromSeason = loot && loot.inventoryType !== null && loot.quality !== null ? fromLoot(loot) : null;
  if (cataloged) return withLootWeapon(fromCatalog(cataloged), loot?.weaponType ?? null);
  return fromSeason;
}

// ponytail: loads the whole catalog and season loot per search (a few hundred rows); index by name if it grows.
export async function searchLocalItems(db: Db, query: string): Promise<(CatalogItem & { source: string | null })[]> {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return [];
  const dungeonOf = new Map<number, string>();
  const loot = await db.select({ loot: dungeonLoot, dungeon: seasonDungeons.name }).from(dungeonLoot)
    .innerJoin(seasonDungeons, eq(seasonDungeons.challengeModeId, dungeonLoot.challengeModeId));
  for (const r of loot) if (!dungeonOf.has(r.loot.itemId)) dungeonOf.set(r.loot.itemId, r.dungeon);
  const byId = new Map<number, CatalogItem & { source: string | null }>();
  const lootWeapon = new Map(loot.map((r) => [r.loot.itemId, r.loot.weaponType]));
  for (const r of await db.select().from(itemCatalog)) byId.set(r.itemId, { ...withLootWeapon(fromCatalog(r), lootWeapon.get(r.itemId) ?? null), source: dungeonOf.get(r.itemId) ?? null });
  for (const r of loot) if (!byId.has(r.loot.itemId)) byId.set(r.loot.itemId, { ...fromLoot(r.loot), source: r.dungeon });
  return [...byId.values()]
    .filter((i) => String(i.itemId) === q || i.name.toLocaleLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
}
