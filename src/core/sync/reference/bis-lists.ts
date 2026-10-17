import type { BlizzardClient } from '../../blizzard/client';
import type { Db } from '../../db/client';
import { getBisLists, replaceBisLists } from '../../db/queries/bis-lists';
import { getMeta, setMeta } from '../../db/queries/meta';
import { isHttpError } from '../../http';
import { TIER_SLOTS } from '../../priority/slots';
import { LIST_TYPES, type BisLists, type BisRow, type BisSource, type FetchedSourceId, type Region } from '../../types';
import { cacheTiming, referenceStatus, type ReferenceStatus } from '../freshness';
import { ensureItemDetails } from './item-details';

export interface BisResult {
  lists: BisLists | null;
  fetchedAt: number | null;
  error: string | null;
}

// One entry per source and spec: the value is the error message, so a skipped retry can repeat it.
const bisFailedKey = (source: FetchedSourceId, specSlug: string) => `bis.${source}.${specSlug}.failed`;

export interface BisRead extends BisResult { status: ReferenceStatus; due: boolean }

/** A spec's stored BiS lists and what the page should say about them. Reads the database only. */
export async function readBisLists(db: Db, source: FetchedSourceId, specSlug: string, now: number): Promise<BisRead> {
  const cached = await getBisLists(db, source, specSlug);
  const failed = await getMeta(db, bisFailedKey(source, specSlug));
  const { lastFailed, due } = cacheTiming(cached?.fetchedAt ?? null, failed?.updatedAt ?? null, now);
  return {
    lists: cached?.lists ?? null,
    fetchedAt: cached?.fetchedAt ?? null,
    error: lastFailed ? failed!.value : null,
    status: referenceStatus(cached !== null, lastFailed),
    due,
  };
}

/** Icy Veins names tier pieces without saying so: looks up non-catalyst rows on tier slots. Throws when a lookup fails. */
async function withTierFlags(deps: { db: Db; blizzard: BlizzardClient; now: number }, region: Region, lists: BisLists): Promise<BisLists> {
  const ids = LIST_TYPES.flatMap((l) => lists[l]).flatMap((r) =>
    r.kind === 'item' && !r.isCatalyst && r.slots.some((slot) => TIER_SLOTS.has(slot)) ? [r.itemId] : []);
  const details = await ensureItemDetails(deps, region, ids);
  const missing = ids.filter((id) => !details.has(id));
  if (missing.length > 0) throw new Error(`No item details for ${missing.join(', ')}`);
  const mark = (r: BisRow): BisRow => (r.kind === 'item' && details.get(r.itemId)?.isTier ? { ...r, isTier: true } : r);
  return { overall: lists.overall.map(mark), raid: lists.raid.map(mark), mythicPlus: lists.mythicPlus.map(mark) };
}

export interface BisSyncDeps { db: Db; source: BisSource; sourceId: FetchedSourceId; blizzard: BlizzardClient; region: Region; now: number }

/** Refreshes a spec's BiS lists from one source when due. On failure keeps what it has and records why; never throws for an upstream failure. */
export async function syncBisLists(deps: BisSyncDeps, specSlug: string): Promise<boolean> {
  const { db, source, sourceId, blizzard, region, now } = deps;
  const cached = await getBisLists(db, sourceId, specSlug);
  const failed = await getMeta(db, bisFailedKey(sourceId, specSlug));
  if (!cacheTiming(cached?.fetchedAt ?? null, failed?.updatedAt ?? null, now).due) return false;
  try {
    let lists = await source.fetchLists(specSlug);
    if (lists.overall.length + lists.raid.length + lists.mythicPlus.length === 0) throw new Error('No BiS tables found');
    if (sourceId === 'icyVeins') lists = await withTierFlags({ db, blizzard, now }, region, lists);
    await replaceBisLists(db, sourceId, specSlug, lists, now);
  } catch (err) {
    console.error(`${source.name} BiS lists for ${specSlug} couldn’t be updated`, err);
    const error = isHttpError(err) && err.status === 404 && !cached
      ? `${source.name} has no gearing page for "${specSlug}"`
      : 'BiS list couldn’t be updated';
    await setMeta(db, bisFailedKey(sourceId, specSlug), error, now);
  }
  return true;
}
