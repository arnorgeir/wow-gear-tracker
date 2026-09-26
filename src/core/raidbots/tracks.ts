import { fetchJson, type FetchFn } from '../http';
import type { Track } from '../types';

export const RAIDBOTS_BONUSES_URL = 'https://www.raidbots.com/static/data/live/bonuses.json';

interface RawUpgrade {
  name?: string;
  level?: number;
  max?: number;
  costs?: { amounts?: { currencyId?: number; amount?: number }[] }[];
}

export function parseRaidbotsBonuses(data: Record<string, unknown>): Track[] {
  const tracks: Track[] = [];
  for (const [key, value] of Object.entries(data)) {
    const upgrade = (value as { upgrade?: RawUpgrade } | null)?.upgrade;
    if (!upgrade?.name || typeof upgrade.level !== 'number' || typeof upgrade.max !== 'number') continue;
    const amount = upgrade.costs?.[0]?.amounts?.[0];
    tracks.push({
      bonusId: Number(key),
      name: upgrade.name,
      step: upgrade.level,
      max: upgrade.max,
      currencyId: amount?.currencyId ?? null,
      costPerStep: amount?.amount ?? null,
    });
  }
  return tracks;
}

export function decodeTrack(bonusIds: number[], tracks: ReadonlyMap<number, Track>): Track | null {
  for (const id of bonusIds) {
    const track = tracks.get(id);
    if (track) return track;
  }
  return null;
}

export const trackLabel = (track: Track) => `${track.name} ${track.step}/${track.max}`;

export function createRaidbotsTracksFetcher(fetchFn: FetchFn = fetch) {
  return async () => parseRaidbotsBonuses(await fetchJson<Record<string, unknown>>(fetchFn, RAIDBOTS_BONUSES_URL));
}
