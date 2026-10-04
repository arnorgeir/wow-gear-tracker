import { fetchJson, type FetchFn } from '../http';
import type { Quality, Track } from '../types';

export const RAIDBOTS_BONUSES_URL = 'https://www.raidbots.com/static/data/live/bonuses.json';

/** Raidbots stores quality as a rank number: 0 is Poor, 4 is Epic, 7 is Heirloom. */
export const QUALITY_BY_RANK: readonly Quality[] = ['POOR', 'COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'ARTIFACT', 'HEIRLOOM'];

export interface BonusQuality {
  bonusId: number;
  quality: Quality;
}

export interface RaidbotsData {
  tracks: Track[];
  qualities: BonusQuality[];
}

interface RawUpgrade {
  name?: string;
  level?: number;
  max?: number;
  group?: number;
  costs?: { amounts?: { currencyId?: number; amount?: number; name?: string }[] }[];
}

export function parseRaidbotsBonuses(data: Record<string, unknown>): Track[] {
  const tracks: Track[] = [];
  for (const [key, value] of Object.entries(data)) {
    const upgrade = (value as { upgrade?: RawUpgrade } | null)?.upgrade;
    if (!upgrade?.name || typeof upgrade.level !== 'number' || typeof upgrade.max !== 'number') continue;
    // The cost of reaching a step is stored on that step's bonus; step 1 has none.
    const amount = upgrade.costs?.[0]?.amounts?.[0];
    tracks.push({
      bonusId: Number(key),
      name: upgrade.name,
      step: upgrade.level,
      max: upgrade.max,
      group: upgrade.group ?? null,
      currencyId: amount?.currencyId ?? null,
      currencyName: amount?.name ?? null,
      currencyIcon: null,
      costPerStep: amount?.amount ?? null,
    });
  }
  return tracks;
}

export function parseBonusQualities(data: Record<string, unknown>): BonusQuality[] {
  const qualities: BonusQuality[] = [];
  for (const [key, value] of Object.entries(data)) {
    const rank = (value as { quality?: unknown } | null)?.quality;
    if (typeof rank !== 'number' || !QUALITY_BY_RANK[rank]) continue;
    qualities.push({ bonusId: Number(key), quality: QUALITY_BY_RANK[rank]! });
  }
  return qualities;
}

export function qualityFromBonuses(bonusIds: number[], qualities: ReadonlyMap<number, Quality>): Quality | null {
  let best: Quality | null = null;
  for (const id of bonusIds) {
    const quality = qualities.get(id);
    if (quality && (best === null || QUALITY_BY_RANK.indexOf(quality) > QUALITY_BY_RANK.indexOf(best))) best = quality;
  }
  return best;
}

export function decodeTrack(bonusIds: number[], tracks: ReadonlyMap<number, Track>): Track | null {
  for (const id of bonusIds) {
    const track = tracks.get(id);
    if (track) return track;
  }
  return null;
}

export const trackLabel = (track: Track) => `${track.name} ${track.step}/${track.max}`;

export function createRaidbotsFetcher(fetchFn: FetchFn = fetch) {
  return async (): Promise<RaidbotsData> => {
    const data = await fetchJson<Record<string, unknown>>(fetchFn, RAIDBOTS_BONUSES_URL);
    return { tracks: parseRaidbotsBonuses(data), qualities: parseBonusQualities(data) };
  };
}
