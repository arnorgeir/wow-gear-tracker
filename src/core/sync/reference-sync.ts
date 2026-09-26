import type { BlizzardClient } from '../blizzard/client';
import type { Db } from '../db/client';
import { getBisLists, getItemIcons, getMeta, getTrackMap, replaceBisLists, replaceTracks, setMeta, upsertItemIcons } from '../db/queries';
import { HttpError } from '../http';
import type { BisLists, BisSource, Region, Track } from '../types';

export const DAY_MS = 86_400_000;
const TRACKS_META_KEY = 'tracks.fetchedAt';

export interface BisResult {
  lists: BisLists | null;
  fetchedAt: number | null;
  error: string | null;
}

export async function ensureBisLists(deps: { db: Db; source: BisSource; now: number }, specSlug: string): Promise<BisResult> {
  const { db, source, now } = deps;
  const cached = await getBisLists(db, specSlug);
  if (cached && now - cached.fetchedAt < DAY_MS) return { lists: cached.lists, fetchedAt: cached.fetchedAt, error: null };
  try {
    const lists = await source.fetchLists(specSlug);
    if (lists.overall.length + lists.raid.length + lists.mythicPlus.length === 0) throw new Error('No BiS tables found');
    await replaceBisLists(db, specSlug, lists, now);
    return { lists, fetchedAt: now, error: null };
  } catch (err) {
    const error = err instanceof HttpError && err.status === 404 && !cached
      ? `${source.name} has no gearing page for "${specSlug}"`
      : 'BiS list couldn’t be updated';
    return { lists: cached?.lists ?? null, fetchedAt: cached?.fetchedAt ?? null, error };
  }
}

export async function ensureTracks(deps: { db: Db; fetchTracks: () => Promise<Track[]>; now: number }): Promise<Map<number, Track>> {
  const { db, fetchTracks, now } = deps;
  const fetchedAt = await getMeta(db, TRACKS_META_KEY);
  if (fetchedAt && now - fetchedAt.updatedAt < DAY_MS) return getTrackMap(db);
  try {
    const tracks = await fetchTracks();
    if (tracks.length > 0) {
      await replaceTracks(db, tracks);
      await setMeta(db, TRACKS_META_KEY, String(now), now);
    }
  } catch {
    // Keep the tracks we already have. Items without a track show their item level only.
  }
  return getTrackMap(db);
}

export async function ensureItemIcons(
  deps: { db: Db; blizzard: BlizzardClient; now: number }, region: Region, itemIds: number[],
): Promise<Map<number, string | null>> {
  const { db, blizzard, now } = deps;
  const unique = [...new Set(itemIds)];
  const known = await getItemIcons(db, unique);
  const unknown = unique.filter((id) => !known.has(id));
  const fetched = await Promise.all(unknown.map(async (itemId) => {
    try {
      return { itemId, iconUrl: await blizzard.getItemIconUrl(region, itemId) };
    } catch {
      return null;
    }
  }));
  const found = fetched.filter((entry): entry is { itemId: number; iconUrl: string | null } => entry !== null);
  if (found.length > 0) await upsertItemIcons(db, found, now);
  return getItemIcons(db, unique);
}
