import type { BlizzardClient } from '../blizzard/client';
import type { ItemDetails, ItemInfo } from '../blizzard/types';
import type { Db } from '../db/client';
import { getBisLists, replaceBisLists } from '../db/queries/bis-lists';
import { getClassIconMap, upsertClassIcons, getItemDetailsMap, upsertItemDetails, getItemIcons, upsertItemIcons, getTierTargetRows, upsertTierTargets, type TierTargetRow } from '../db/queries/media';
import { getBonusQualityMap, replaceBonusQualities, getTrackMap, replaceTracks } from '../db/queries/tracks';
import { getMeta, setMeta } from '../db/queries/meta';
import { isHttpError } from '../http';
import type { RaidbotsData } from '../raidbots/tracks';
import { LIST_TYPES, type BisLists, type BisSource, type Quality, type Region, type TierTarget, type Track } from '../types';

export const DAY_MS = 86_400_000;
// The version in the key marks the stored data's format. Bump it when Raidbots data gains fields,
// so data cached by an older version of the app is refetched instead of trusted for a day.
const TRACKS_META_KEY = 'tracks.v3.fetchedAt';
const TRACKS_FAILED_META_KEY = 'tracks.failedAt';
const RETRY_MS = 60 * 60 * 1000;
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

export const BIS_RETRY_MS = RETRY_MS;
// One entry per spec: the value is the error message, so a skipped retry can repeat it.
const bisFailedKey = (specSlug: string) => `bis.${specSlug}.failed`;

export type ReferenceStatus = 'loading' | 'failed' | 'ready' | 'stale';
type MetaRow = Awaited<ReturnType<typeof getMeta>>;

/** One rule for the page and the sync: due when the data is missing or a day old, unless the last attempt failed within the hour. */
function timing(storedAt: number | null, failed: MetaRow, now: number) {
  const lastFailed = failed !== null && (storedAt === null || failed.updatedAt > storedAt);
  const fresh = storedAt !== null && now - storedAt < DAY_MS;
  const backingOff = lastFailed && now - failed!.updatedAt < RETRY_MS;
  return { lastFailed, due: !fresh && !backingOff };
}

const statusOf = (stored: boolean, lastFailed: boolean): ReferenceStatus =>
  stored ? (lastFailed ? 'stale' : 'ready') : (lastFailed ? 'failed' : 'loading');

export interface BisRead extends BisResult { status: ReferenceStatus; due: boolean }

/** A spec's stored BiS lists and what the page should say about them. Reads the database only. */
export async function readBisLists(db: Db, specSlug: string, now: number): Promise<BisRead> {
  const cached = await getBisLists(db, specSlug);
  const failed = await getMeta(db, bisFailedKey(specSlug));
  const { lastFailed, due } = timing(cached?.fetchedAt ?? null, failed, now);
  return {
    lists: cached?.lists ?? null,
    fetchedAt: cached?.fetchedAt ?? null,
    error: lastFailed ? failed!.value : null,
    status: statusOf(cached !== null, lastFailed),
    due,
  };
}

/** Refreshes a spec's BiS lists when due. On failure keeps what it has and records why; never throws for an upstream failure. */
export async function syncBisLists(deps: { db: Db; source: BisSource; now: number }, specSlug: string): Promise<boolean> {
  const { db, source, now } = deps;
  const cached = await getBisLists(db, specSlug);
  const failed = await getMeta(db, bisFailedKey(specSlug));
  if (!timing(cached?.fetchedAt ?? null, failed, now).due) return false;
  try {
    const lists = await source.fetchLists(specSlug);
    if (lists.overall.length + lists.raid.length + lists.mythicPlus.length === 0) throw new Error('No BiS tables found');
    await replaceBisLists(db, specSlug, lists, now);
  } catch (err) {
    const error = isHttpError(err) && err.status === 404 && !cached
      ? `${source.name} has no gearing page for "${specSlug}"`
      : 'BiS list couldn’t be updated';
    await setMeta(db, bisFailedKey(specSlug), error, now);
  }
  return true;
}

/** Refreshes a spec's BiS lists daily. On failure keeps what it has, and retries that spec at most hourly. */
export async function ensureBisLists(deps: { db: Db; source: BisSource; now: number }, specSlug: string): Promise<BisResult> {
  const { db, source, now } = deps;
  const cached = await getBisLists(db, specSlug);
  if (cached && now - cached.fetchedAt < DAY_MS) return { lists: cached.lists, fetchedAt: cached.fetchedAt, error: null };
  const failed = await getMeta(db, bisFailedKey(specSlug));
  if (failed && now - failed.updatedAt < BIS_RETRY_MS) {
    return { lists: cached?.lists ?? null, fetchedAt: cached?.fetchedAt ?? null, error: failed.value };
  }
  try {
    const lists = await source.fetchLists(specSlug);
    if (lists.overall.length + lists.raid.length + lists.mythicPlus.length === 0) throw new Error('No BiS tables found');
    await replaceBisLists(db, specSlug, lists, now);
    return { lists, fetchedAt: now, error: null };
  } catch (err) {
    const error = isHttpError(err) && err.status === 404 && !cached
      ? `${source.name} has no gearing page for "${specSlug}"`
      : 'BiS list couldn’t be updated';
    await setMeta(db, bisFailedKey(specSlug), error, now);
    return { lists: cached?.lists ?? null, fetchedAt: cached?.fetchedAt ?? null, error };
  }
}

export interface TracksRead extends TracksResult { status: ReferenceStatus; due: boolean }

/** Stored Raidbots data and what the page should say about it. Reads the database only. Stale data shows no error: it is still usable. */
export async function readTracks(db: Db, now: number): Promise<TracksRead> {
  const fetchedAt = await getMeta(db, TRACKS_META_KEY);
  const failed = await getMeta(db, TRACKS_FAILED_META_KEY);
  const tracks = await getTrackMap(db);
  const qualities = await getBonusQualityMap(db);
  const { lastFailed, due } = timing(fetchedAt?.updatedAt ?? null, failed, now);
  const status = statusOf(tracks.size > 0, lastFailed);
  return { tracks, qualities, status, due, error: status === 'failed' ? TRACKS_ERROR : null };
}

/** Refreshes Raidbots data when due. On failure keeps what it has and records the attempt; never throws for an upstream failure. */
export async function syncTracks(deps: { db: Db; fetchRaidbots: () => Promise<RaidbotsData>; now: number }): Promise<boolean> {
  const { db, fetchRaidbots, now } = deps;
  const fetchedAt = await getMeta(db, TRACKS_META_KEY);
  const failed = await getMeta(db, TRACKS_FAILED_META_KEY);
  if (!timing(fetchedAt?.updatedAt ?? null, failed, now).due) return false;
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
      return { itemId, quality: details?.quality ?? null, isTier: details?.isTier ?? false };
    } catch {
      return null;
    }
  }));
  const found = fetched.filter((entry): entry is { itemId: number } & ItemDetails => entry !== null);
  if (found.length > 0) await upsertItemDetails(db, found, now);
  return getItemDetailsMap(db, unique);
}

/**
 * Stat pairs for the Method items of a spec's tier rows. Each item is fetched once; a lookup that found
 * no stats (a 404, or no stats in the response) retries after a day, and a failed request stores nothing.
 */
export async function ensureTierTargets(
  deps: { db: Db; blizzard: BlizzardClient; now: number }, region: Region, lists: BisLists | null,
): Promise<Map<number, TierTarget>> {
  const { db, blizzard, now } = deps;
  const ids = lists ? [...new Set(LIST_TYPES.flatMap((l) => lists[l]).flatMap((r) => (r.kind === 'item' && r.isTier ? [r.itemId] : [])))] : [];
  const known = await getTierTargetRows(db, ids);
  const due = ids.filter((id) => {
    const row = known.get(id);
    return !row || row.statsFetchedAt === null || (row.secondaryStats === null && now - row.statsFetchedAt >= DAY_MS);
  });
  const fetched = await Promise.all(due.map(async (itemId) => {
    try {
      return { itemId, info: await blizzard.getItemDetails(region, itemId) };
    } catch {
      return null;
    }
  }));
  const found = fetched.filter((entry): entry is { itemId: number; info: ItemInfo | null } => entry !== null);
  if (found.length > 0) await upsertTierTargets(db, found, now);
  const rows = found.length > 0 ? await getTierTargetRows(db, ids) : known;
  return new Map([...rows].map(([id, r]) => [id, { secondaryStats: r.secondaryStats, isTier: r.isTier }]));
}

export interface TierScope { region: Region; specSlug: string; lists: BisLists | null }

// One entry per spec and region: a thrown tier request stores no row, so this is what holds the retry back.
const tierFailedKey = ({ region, specSlug }: TierScope) => `tiers.${region}.${specSlug}.failedAt`;

const tierItemIds = (lists: BisLists | null) =>
  lists ? [...new Set(LIST_TYPES.flatMap((l) => lists[l]).flatMap((r) => (r.kind === 'item' && r.isTier ? [r.itemId] : [])))] : [];

// Never fetched, or found no stats a day ago or more (a 404 stores an empty result).
const needsStats = (row: TierTargetRow | undefined, now: number) =>
  !row || row.statsFetchedAt === null || (row.secondaryStats === null && now - row.statsFetchedAt >= DAY_MS);

/** The scope's stored rows, and the items a sync would request now: none while a failure is within the hour. */
async function tierState(db: Db, scope: TierScope, now: number) {
  const ids = tierItemIds(scope.lists);
  const rows = await getTierTargetRows(db, ids);
  const failed = await getMeta(db, tierFailedKey(scope));
  const backingOff = failed !== null && now - failed.updatedAt < RETRY_MS;
  return { rows, pending: backingOff ? [] : ids.filter((id) => needsStats(rows.get(id), now)) };
}

const toTargets = (rows: Map<number, TierTargetRow>) =>
  new Map([...rows].map(([id, r]) => [id, { secondaryStats: r.secondaryStats, isTier: r.isTier }]));

/** Stat pairs for a spec's tier items in one region. Reads the database only. */
export async function readTierTargets(db: Db, scope: TierScope, now: number): Promise<{ targets: Map<number, TierTarget>; due: boolean }> {
  const { rows, pending } = await tierState(db, scope, now);
  return { targets: toTargets(rows), due: pending.length > 0 };
}

/**
 * Requests the tier items that need stats. Stores what came back; when any request throws,
 * records the failure so the scope waits an hour. Never throws for an upstream failure.
 */
export async function syncTierTargets(deps: { db: Db; blizzard: BlizzardClient; now: number }, scope: TierScope): Promise<boolean> {
  const { db, blizzard, now } = deps;
  const { pending } = await tierState(db, scope, now);
  if (pending.length === 0) return false;
  const fetched = await Promise.all(pending.map(async (itemId) => {
    try {
      return { itemId, info: await blizzard.getItemDetails(scope.region, itemId) };
    } catch {
      return null;
    }
  }));
  const found = fetched.filter((entry): entry is { itemId: number; info: ItemInfo | null } => entry !== null);
  if (found.length > 0) await upsertTierTargets(db, found, now);
  if (found.length < pending.length) await setMeta(db, tierFailedKey(scope), String(now), now);
  return true;
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
