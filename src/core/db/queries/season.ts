import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../client';
import { dungeonLoot, seasonDungeons } from '../schema';
import type { ArmorType, SeasonLoot } from '../../types';
import { withWriteLock } from './write-lock';

export interface SeasonDungeonRow { challengeModeId: number; name: string; shortName: string; journalInstanceId: number; mapId: number; imageUrl: string | null }
export interface DungeonLootRow {
  challengeModeId: number;
  encounterId: number;
  encounterName: string;
  itemId: number;
  itemName: string;
  inventoryType: string | null;
  armorType: ArmorType | null;
}
export interface SeasonData { slug: string; dungeons: SeasonDungeonRow[]; loot: DungeonLootRow[] }

/** Replaces the stored season in one transaction, so a reader never sees half of one. */
export async function replaceSeason(db: Db, data: SeasonData): Promise<void> {
  await withWriteLock(db, () => db.transaction(async (tx) => {
    await tx.delete(dungeonLoot);
    await tx.delete(seasonDungeons);
    if (data.dungeons.length > 0) await tx.insert(seasonDungeons).values(data.dungeons.map((d) => ({ ...d, seasonSlug: data.slug })));
    if (data.loot.length > 0) await tx.insert(dungeonLoot).values(data.loot);
  }));
}

/** The stored season's dungeons with their loot. Dungeons sharing one journal instance are halves of one: split. */
export async function getSeasonLoot(db: Db): Promise<SeasonLoot[]> {
  const dungeons = await db.select().from(seasonDungeons).orderBy(asc(seasonDungeons.name));
  const loot = await db.select().from(dungeonLoot).orderBy(asc(dungeonLoot.encounterId), asc(dungeonLoot.itemId));
  return dungeons.map((d) => ({
    challengeModeId: d.challengeModeId,
    name: d.name,
    shortName: d.shortName,
    imageUrl: d.imageUrl,
    split: dungeons.some((x) => x !== d && x.journalInstanceId === d.journalInstanceId),
    loot: loot.filter((l) => l.challengeModeId === d.challengeModeId)
      .map((l) => ({ itemId: l.itemId, name: l.itemName, inventoryType: l.inventoryType, armorType: l.armorType })),
  }));
}

/**
 * Refreshes stored artwork for the season already loaded, so a corrected URL reaches existing
 * installs without reloading loot. Rows it doesn't name keep theirs; it never adds a row.
 */
export async function updateSeasonArtwork(db: Db, slug: string, art: { challengeModeId: number; imageUrl: string | null }[]): Promise<void> {
  await withWriteLock(db, () => db.transaction(async (tx) => {
    for (const a of art) {
      await tx.update(seasonDungeons).set({ imageUrl: a.imageUrl })
        .where(and(eq(seasonDungeons.challengeModeId, a.challengeModeId), eq(seasonDungeons.seasonSlug, slug)));
    }
  }));
}
