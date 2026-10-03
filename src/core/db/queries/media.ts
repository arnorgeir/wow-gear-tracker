import { inArray } from 'drizzle-orm';
import type { ItemDetails } from '../../blizzard/types';
import type { Db } from '../client';
import { items, itemDetails, classMedia } from '../schema';
import { withWriteLock } from './write-lock';

export async function upsertItemIcons(db: Db, entries: { itemId: number; iconUrl: string | null }[], now: number) {
  await withWriteLock(db, async () => {
    for (const entry of entries) {
      await db.insert(items).values({ ...entry, fetchedAt: now })
        .onConflictDoUpdate({ target: items.itemId, set: { iconUrl: entry.iconUrl, fetchedAt: now } });
    }
  });
}

export async function getItemIcons(db: Db, ids: number[]): Promise<Map<number, string | null>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(items).where(inArray(items.itemId, [...new Set(ids)]));
  return new Map(rows.map((r) => [r.itemId, r.iconUrl]));
}

export async function upsertItemDetails(db: Db, entries: ({ itemId: number } & ItemDetails)[], now: number) {
  await withWriteLock(db, async () => {
    for (const entry of entries) {
      await db.insert(itemDetails).values({ itemId: entry.itemId, quality: entry.quality, isTier: entry.isTier, fetchedAt: now })
        .onConflictDoUpdate({ target: itemDetails.itemId, set: { quality: entry.quality, isTier: entry.isTier, fetchedAt: now } });
    }
  });
}

export async function getItemDetailsMap(db: Db, ids: number[]): Promise<Map<number, ItemDetails>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(itemDetails).where(inArray(itemDetails.itemId, [...new Set(ids)]));
  return new Map(rows.map((r) => [r.itemId, { quality: r.quality, isTier: r.isTier }]));
}

export async function upsertClassIcons(db: Db, entries: { className: string; classId: number; iconUrl: string | null }[], now: number) {
  await withWriteLock(db, async () => {
    for (const entry of entries) {
      await db.insert(classMedia).values({ ...entry, fetchedAt: now })
        .onConflictDoUpdate({ target: classMedia.className, set: { classId: entry.classId, iconUrl: entry.iconUrl, fetchedAt: now } });
    }
  });
}

export async function getClassIconMap(db: Db): Promise<Map<string, string | null>> {
  const rows = await db.select().from(classMedia);
  return new Map(rows.map((r) => [r.className, r.iconUrl]));
}
