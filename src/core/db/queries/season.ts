import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../client';
import { dungeonEncounters, dungeonLoot, seasonDungeons } from '../schema';
import type { ArmorType, WeaponType, JournalSection, Quality, SeasonLoot } from '../../types';
import { withWriteLock } from './write-lock';
import { decodeStats } from '../../gear/stat-pair';

export interface SeasonDungeonRow { challengeModeId: number; name: string; shortName: string; journalInstanceId: number; mapId: number; imageUrl: string | null }
export interface DungeonLootRow {
  challengeModeId: number;
  encounterId: number;
  encounterName: string;
  itemId: number;
  itemName: string;
  inventoryType: string | null;
  armorType: ArmorType | null;
  weaponType?: WeaponType | null;
  /** Encoded as in snapshot_items; absent or null when unknown. */
  secondaryStats?: string | null;
  quality?: Quality | null;
  isTier?: boolean;
}
export interface EncounterRow { encounterId: number; name: string; description: string | null; sections: JournalSection[] }
export interface SeasonData { slug: string; dungeons: SeasonDungeonRow[]; loot: DungeonLootRow[]; encounters?: EncounterRow[] }

/** Replaces the stored season in one transaction, so a reader never sees half of one. */
export async function replaceSeason(db: Db, data: SeasonData): Promise<void> {
  await withWriteLock(db, () => db.transaction(async (tx) => {
    await tx.delete(dungeonLoot);
    await tx.delete(dungeonEncounters);
    await tx.delete(seasonDungeons);
    if (data.dungeons.length > 0) await tx.insert(seasonDungeons).values(data.dungeons.map((d) => ({ ...d, seasonSlug: data.slug })));
    if (data.loot.length > 0) await tx.insert(dungeonLoot).values(data.loot);
    if (data.encounters?.length) await tx.insert(dungeonEncounters).values(data.encounters.map((e) => ({ ...e, sections: JSON.stringify(e.sections) })));
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
      .map((l) => ({ itemId: l.itemId, name: l.itemName, inventoryType: l.inventoryType, armorType: l.armorType, weaponType: l.weaponType, secondaryStats: decodeStats(l.secondaryStats) })),
  }));
}

/** The stored season's dungeons by name, as getSeasonLoot lists them (the key is the row id, so insertion order isn't kept). */
export async function getSeasonDungeons(db: Db): Promise<SeasonDungeonRow[]> {
  return db.select().from(seasonDungeons).orderBy(asc(seasonDungeons.name));
}

/** One stored season dungeon with its loot rows in boss order, or null when the season doesn't list it. */
export async function getSeasonDungeon(db: Db, challengeModeId: number):
  Promise<{ dungeon: SeasonDungeonRow; split: boolean; loot: DungeonLootRow[]; encounters: Map<number, { description: string | null; sections: JournalSection[] }> } | null> {
  const [dungeon] = await db.select().from(seasonDungeons).where(eq(seasonDungeons.challengeModeId, challengeModeId));
  if (!dungeon) return null;
  const sharing = await db.select({ id: seasonDungeons.challengeModeId }).from(seasonDungeons)
    .where(eq(seasonDungeons.journalInstanceId, dungeon.journalInstanceId));
  // rowid is insertion order, which is the journal's boss order (encounter IDs are not).
  const loot = await db.select().from(dungeonLoot).where(eq(dungeonLoot.challengeModeId, challengeModeId)).orderBy(sql`rowid`);
  const rows = await db.select().from(dungeonEncounters).where(inArray(dungeonEncounters.encounterId, [...new Set(loot.map((l) => l.encounterId))]));
  const encounters = new Map<number, { description: string | null; sections: JournalSection[] }>();
  for (const r of rows) {
    try {
      const sections = JSON.parse(r.sections);
      if (Array.isArray(sections)) encounters.set(r.encounterId, { description: r.description, sections });
    } catch { /* malformed counts as missing */ }
  }
  return { dungeon, split: sharing.some((x) => x.id !== challengeModeId), loot, encounters };
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
