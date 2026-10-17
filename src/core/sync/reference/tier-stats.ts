import type { BlizzardClient } from '../../blizzard/client';
import type { ItemInfo } from '../../blizzard/types';
import type { Db } from '../../db/client';
import { getTierTargetRows, upsertTierTargets, type TierTargetRow } from '../../db/queries/media';
import { getMeta, setMeta } from '../../db/queries/meta';
import { LIST_TYPES, type BisLists, type Region, type TierTarget } from '../../types';
import { DAY_MS, cacheTiming } from '../freshness';

export interface TierScope { region: Region; specSlug: string; lists: BisLists | null; extraItemIds?: number[] }

// One entry per spec and region: a thrown tier request stores no row, so this is what holds the retry back.
const tierFailedKey = ({ region, specSlug }: TierScope) => `tiers.${region}.${specSlug}.failedAt`;

const tierItemIds = (lists: BisLists | null) =>
  lists ? [...new Set(LIST_TYPES.flatMap((l) => lists[l]).flatMap((r) => (r.kind === 'item' && r.isTier ? [r.itemId] : [])))] : [];

// Never fetched, or found no stats a day ago or more (a 404 stores an empty result).
const needsStats = (row: TierTargetRow | undefined, now: number) =>
  !row || row.statsFetchedAt === null || (row.secondaryStats === null && now - row.statsFetchedAt >= DAY_MS);

/** The scope's stored rows, and the items a sync would request now: none while a failure is within the hour. */
async function tierState(db: Db, scope: TierScope, now: number) {
  const ids = [...new Set([...tierItemIds(scope.lists), ...(scope.extraItemIds ?? [])])];
  const rows = await getTierTargetRows(db, ids);
  const failed = await getMeta(db, tierFailedKey(scope));
  // Tier stats have no single stored time, so any recorded failure counts (spec, Behavior 2).
  const { backingOff } = cacheTiming(null, failed?.updatedAt ?? null, now);
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

/** Secondary stats for items, from the item_details cache, requesting the ones that need it. Never throws for an upstream failure. */
export async function ensureItemStats(
  deps: { db: Db; blizzard: BlizzardClient; now: number }, region: Region, itemIds: number[],
): Promise<Map<number, string[] | null>> {
  const { db, blizzard, now } = deps;
  const ids = [...new Set(itemIds)];
  const rows = await getTierTargetRows(db, ids);
  const fetched = await Promise.all(ids.filter((id) => needsStats(rows.get(id), now)).map(async (itemId) => {
    try {
      return { itemId, info: await blizzard.getItemDetails(region, itemId) };
    } catch {
      return null;
    }
  }));
  const found = fetched.filter((entry): entry is { itemId: number; info: ItemInfo | null } => entry !== null);
  if (found.length > 0) await upsertTierTargets(db, found, now);
  const after = found.length > 0 ? await getTierTargetRows(db, ids) : rows;
  return new Map(ids.map((id) => [id, after.get(id)?.secondaryStats ?? null]));
}
