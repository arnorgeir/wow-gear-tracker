import type { BlizzardClient } from '../blizzard/client';
import type { ItemDetails } from '../blizzard/types';
import type { Db } from '../db/client';
import { getBisLists, replaceBisLists } from '../db/queries/bis-lists';
import { getClassIconMap, upsertClassIcons, getItemDetailsMap, upsertItemDetails, getItemIcons, upsertItemIcons } from '../db/queries/media';
import { getBonusQualityMap, replaceBonusQualities, getTrackMap, replaceTracks } from '../db/queries/tracks';
import { getMeta, setMeta } from '../db/queries/meta';
import { isHttpError } from '../http';
import type { RaidbotsData } from '../raidbots/tracks';
import type { BisLists, BisSource, Quality, Region, Track } from '../types';

export const DAY_MS = 86_400_000;
// The version in the key marks the stored data's format. Bump it when Raidbots data gains fields,
// so data cached by an older version of the app is refetched instead of trusted for a day.
const TRACKS_META_KEY = 'tracks.v2.fetchedAt';
const TRACKS_FAILED_META_KEY = 'tracks.failedAt';
const TRACKS_RETRY_MS = 60 * 60 * 1000;
const TRACKS_ERROR = 'Upgrade track data couldn’t be loaded, so upgrade states may be wrong';

export interface TracksResult {
  tracks: Map<number, Track>;
  qualities: Map<number, Quality>;
  error: string | null;
}

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
    const error = isHttpError(err) && err.status === 404 && !cached
      ? `${source.name} has no gearing page for "${specSlug}"`
      : 'BiS list couldn’t be updated';
    return { lists: cached?.lists ?? null, fetchedAt: cached?.fetchedAt ?? null, error };
  }
}

/** Refreshes Raidbots data daily. On failure keeps what it has, and retries at most hourly. */
export async function ensureTracks(deps: { db: Db; fetchRaidbots: () => Promise<RaidbotsData>; now: number }): Promise<TracksResult> {
  const { db, fetchRaidbots, now } = deps;
  const fetchedAt = await getMeta(db, TRACKS_META_KEY);
  const failedAt = await getMeta(db, TRACKS_FAILED_META_KEY);
  const fresh = fetchedAt && now - fetchedAt.updatedAt < DAY_MS;
  const backingOff = failedAt && now - failedAt.updatedAt < TRACKS_RETRY_MS;
  if (!fresh && !backingOff) {
    try {
      const data = await fetchRaidbots();
      if (data.tracks.length === 0) throw new Error('No upgrade tracks in the Raidbots data');
      await replaceTracks(db, data.tracks);
      await replaceBonusQualities(db, data.qualities);
      await setMeta(db, TRACKS_META_KEY, String(now), now);
    } catch {
      await setMeta(db, TRACKS_FAILED_META_KEY, String(now), now);
    }
  }
  const tracks = await getTrackMap(db);
  const qualities = await getBonusQualityMap(db);
  return { tracks, qualities, error: tracks.size === 0 ? TRACKS_ERROR : null };
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

export async function ensureItemDetails(
  deps: { db: Db; blizzard: BlizzardClient; now: number }, region: Region, itemIds: number[],
): Promise<Map<number, ItemDetails>> {
  const { db, blizzard, now } = deps;
  const unique = [...new Set(itemIds)];
  const known = await getItemDetailsMap(db, unique);
  const unknown = unique.filter((id) => !known.has(id));
  const fetched = await Promise.all(unknown.map(async (itemId) => {
    try {
      const details = await blizzard.getItemDetails(region, itemId);
      return { itemId, ...(details ?? { quality: null, isTier: false }) };
    } catch {
      return null;
    }
  }));
  const found = fetched.filter((entry): entry is { itemId: number } & ItemDetails => entry !== null);
  if (found.length > 0) await upsertItemDetails(db, found, now);
  return getItemDetailsMap(db, unique);
}

const CLASS_ICONS_META_KEY = 'classIcons.v1.fetchedAt';
const CLASS_ICONS_FAILED_META_KEY = 'classIcons.failedAt';
const CLASS_ICONS_TTL_MS = 30 * DAY_MS;
const CLASS_ICONS_RETRY_MS = 60 * 60 * 1000;

/**
 * Class icons change rarely: refresh every 30 days. A failed call never overwrites a cached icon,
 * and after any failure the next attempt waits an hour, so a Blizzard outage can't slow every page.
 */
export async function ensureClassIcons(
  deps: { db: Db; blizzard: BlizzardClient; now: number }, region: Region,
): Promise<Map<string, string | null>> {
  const { db, blizzard, now } = deps;
  const fetchedAt = await getMeta(db, CLASS_ICONS_META_KEY);
  const failedAt = await getMeta(db, CLASS_ICONS_FAILED_META_KEY);
  const fresh = fetchedAt && now - fetchedAt.updatedAt < CLASS_ICONS_TTL_MS;
  const backingOff = failedAt && now - failedAt.updatedAt < CLASS_ICONS_RETRY_MS;
  if (!fresh && !backingOff) {
    try {
      const classes = await blizzard.getClasses(region);
      const results = await Promise.all(classes.map(async (cls) => {
        try {
          // null here means Blizzard has no icon for the class (404), which is safe to store.
          return { className: cls.name, classId: cls.id, iconUrl: await blizzard.getClassIconUrl(region, cls.id) };
        } catch {
          return null;
        }
      }));
      const found = results.filter((entry): entry is { className: string; classId: number; iconUrl: string | null } => entry !== null);
      if (found.length > 0) await upsertClassIcons(db, found, now);
      await setMeta(db, found.length === classes.length ? CLASS_ICONS_META_KEY : CLASS_ICONS_FAILED_META_KEY, String(now), now);
    } catch {
      await setMeta(db, CLASS_ICONS_FAILED_META_KEY, String(now), now);
    }
  }
  return getClassIconMap(db);
}
