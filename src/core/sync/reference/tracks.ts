import type { Db } from '../../db/client';
import { getMeta, setMeta } from '../../db/queries/meta';
import { getBonusQualityMap, replaceBonusQualities, getTrackMap, replaceTracks } from '../../db/queries/tracks';
import type { RaidbotsData } from '../../raidbots/tracks';
import type { Quality, Track } from '../../types';
import { cacheTiming, referenceStatus, type ReferenceStatus } from '../freshness';

// The version in the key marks the stored data's format. Bump it when Raidbots data gains fields,
// so data cached by an older version of the app is refetched instead of trusted for a day.
const TRACKS_META_KEY = 'tracks.v3.fetchedAt';
const TRACKS_FAILED_META_KEY = 'tracks.failedAt';
const TRACKS_ERROR = 'Upgrade track data couldn’t be loaded, so upgrade states may be wrong';

export interface TracksResult {
  tracks: Map<number, Track>;
  qualities: Map<number, Quality>;
  error: string | null;
}

export interface TracksRead extends TracksResult { status: ReferenceStatus; due: boolean }

/** Stored Raidbots data and what the page should say about it. Reads the database only. Stale data shows no error: it is still usable. */
export async function readTracks(db: Db, now: number): Promise<TracksRead> {
  const fetchedAt = await getMeta(db, TRACKS_META_KEY);
  const failed = await getMeta(db, TRACKS_FAILED_META_KEY);
  const tracks = await getTrackMap(db);
  const qualities = await getBonusQualityMap(db);
  const { lastFailed, due } = cacheTiming(fetchedAt?.updatedAt ?? null, failed?.updatedAt ?? null, now);
  const status = referenceStatus(tracks.size > 0, lastFailed);
  return { tracks, qualities, status, due, error: status === 'failed' ? TRACKS_ERROR : null };
}

/** Refreshes Raidbots data when due. On failure keeps what it has and records the attempt; never throws for an upstream failure. */
export async function syncTracks(deps: { db: Db; fetchRaidbots: () => Promise<RaidbotsData>; now: number }): Promise<boolean> {
  const { db, fetchRaidbots, now } = deps;
  const fetchedAt = await getMeta(db, TRACKS_META_KEY);
  const failed = await getMeta(db, TRACKS_FAILED_META_KEY);
  if (!cacheTiming(fetchedAt?.updatedAt ?? null, failed?.updatedAt ?? null, now).due) return false;
  try {
    const data = await fetchRaidbots();
    if (data.tracks.length === 0) throw new Error('No upgrade tracks in the Raidbots data');
    await replaceTracks(db, data.tracks);
    await replaceBonusQualities(db, data.qualities);
    await setMeta(db, TRACKS_META_KEY, String(now), now);
  } catch {
    await setMeta(db, TRACKS_FAILED_META_KEY, String(now), now);
  }
  return true;
}

/** Sync then read, for the SimC route: the user already waits on that write, and parsing needs qualities. */
export async function ensureTracks(deps: { db: Db; fetchRaidbots: () => Promise<RaidbotsData>; now: number }): Promise<TracksResult> {
  await syncTracks(deps);
  const { tracks, qualities, error } = await readTracks(deps.db, deps.now);
  return { tracks, qualities, error };
}
