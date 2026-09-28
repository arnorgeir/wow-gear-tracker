import type { BonusQuality } from '../../raidbots/tracks';
import type { Db } from '../client';
import { upgradeTracks, bonusQualities } from '../schema';
import { type Quality, type Track } from '../../types';
import { withWriteLock } from './write-lock';

export async function replaceTracks(db: Db, tracks: Track[]) {
  await withWriteLock(db, () => db.transaction(async (tx) => {
    await tx.delete(upgradeTracks);
    for (let i = 0; i < tracks.length; i += 500) await tx.insert(upgradeTracks).values(tracks.slice(i, i + 500));
  }));
}

export async function getTrackMap(db: Db): Promise<Map<number, Track>> {
  const rows = await db.select().from(upgradeTracks);
  return new Map(rows.map((t) => [t.bonusId, t]));
}

export async function replaceBonusQualities(db: Db, entries: BonusQuality[]) {
  await withWriteLock(db, () => db.transaction(async (tx) => {
    await tx.delete(bonusQualities);
    for (let i = 0; i < entries.length; i += 500) await tx.insert(bonusQualities).values(entries.slice(i, i + 500));
  }));
}

export async function getBonusQualityMap(db: Db): Promise<Map<number, Quality>> {
  const rows = await db.select().from(bonusQualities);
  return new Map(rows.map((r) => [r.bonusId, r.quality]));
}
