import type { BlizzardClient } from '../blizzard/client';
import type { JournalInstance } from '../blizzard/types';
import type { Db } from '../db/client';
import { getMeta, setMeta } from '../db/queries/meta';
import { getSeasonLoot, replaceSeason, type DungeonLootRow, type SeasonData, type SeasonDungeonRow } from '../db/queries/season';
import type { FetchFn } from '../http';
import { fetchMainSeason, type MainSeason } from '../raiderio/season';
import type { Region, SeasonLoot } from '../types';
import { DAY_MS } from './reference-sync';

// The version in the key marks the stored tables' format. Bump it when season_dungeons or
// dungeon_loot gain columns, so installs reload the season instead of trusting old rows.
export const SEASON_META_KEY = 'season.v1';
const SEASON_FAILED_META_KEY = 'season.failedAt';
const SEASON_RETRY_MS = 60 * 60 * 1000;

export type SeasonSyncResult = 'skipped' | 'current' | 'loaded' | 'failed';
export interface SeasonSyncDeps { db: Db; blizzard: BlizzardClient; fetchFn: FetchFn; now: number; region: Region }
export interface SeasonState { status: 'loading' | 'failed' | 'ready' | 'stale'; needsSync: boolean; dungeons: SeasonLoot[] }

type MetaRow = Awaited<ReturnType<typeof getMeta>>;

/** One rule for both the sync and the page: a sync is due unless the season loaded within a day, or the last load failed within the hour. */
function seasonTiming(loaded: MetaRow, failed: MetaRow, now: number) {
  const lastFailed = failed !== null && (loaded === null || failed.updatedAt > loaded.updatedAt);
  const fresh = loaded !== null && now - loaded.updatedAt < DAY_MS;
  const backingOff = lastFailed && now - failed!.updatedAt < SEASON_RETRY_MS;
  return { lastFailed, due: !fresh && !backingOff };
}

/**
 * Loads one season's loot: each dungeon's challenge mode → keystone dungeon → map → the journal
 * instance with that map → its encounters → their items, then each item's slot and armor type.
 * Two halves of a split dungeon share an instance, so encounters and items are fetched once.
 */
export async function loadSeasonLoot(blizzard: BlizzardClient, region: Region, season: MainSeason): Promise<SeasonData> {
  const index = await blizzard.getJournalInstances(region);
  const dungeons: (SeasonDungeonRow & { encounterIds: number[] })[] = [];
  for (const d of season.dungeons) {
    const keystone = await blizzard.getKeystoneDungeon(region, d.challengeModeId);
    let instance: JournalInstance | null = null;
    for (const candidate of index.filter((i) => i.name === keystone.mapName || i.name === keystone.name)) {
      const loaded = await blizzard.getJournalInstance(region, candidate.id);
      if (loaded.mapId === keystone.mapId) { instance = loaded; break; }
    }
    if (!instance) throw new Error(`No Encounter Journal instance has the map of ${d.name}`);
    dungeons.push({ challengeModeId: d.challengeModeId, name: d.name, shortName: d.shortName, journalInstanceId: instance.id, mapId: keystone.mapId, encounterIds: instance.encounterIds });
  }

  const encounterIds = [...new Set(dungeons.flatMap((d) => d.encounterIds))];
  const encounters = new Map(await Promise.all(encounterIds.map(async (id) => [id, await blizzard.getJournalEncounter(region, id)] as const)));
  const itemIds = [...new Set([...encounters.values()].flatMap((e) => e.items.map((i) => i.itemId)))];
  const infos = new Map(await Promise.all(itemIds.map(async (id) => [id, await blizzard.getItemDetails(region, id)] as const)));

  const loot: DungeonLootRow[] = dungeons.flatMap((d) => d.encounterIds.flatMap((encounterId) => {
    const encounter = encounters.get(encounterId)!;
    return encounter.items.map((item) => ({
      challengeModeId: d.challengeModeId,
      encounterId,
      encounterName: encounter.name,
      itemId: item.itemId,
      itemName: item.name,
      inventoryType: infos.get(item.itemId)?.inventoryType ?? null,
      armorType: infos.get(item.itemId)?.armorType ?? null,
    }));
  }));
  const rows: SeasonDungeonRow[] = dungeons.map((d) => ({
    challengeModeId: d.challengeModeId, name: d.name, shortName: d.shortName, journalInstanceId: d.journalInstanceId, mapId: d.mapId,
  }));
  return { slug: season.slug, dungeons: rows, loot };
}

async function runSync({ db, blizzard, fetchFn, now, region }: SeasonSyncDeps): Promise<SeasonSyncResult> {
  const loaded = await getMeta(db, SEASON_META_KEY);
  const failed = await getMeta(db, SEASON_FAILED_META_KEY);
  if (!seasonTiming(loaded, failed, now).due) return 'skipped';
  try {
    const season = await fetchMainSeason(fetchFn, now);
    if (loaded?.value === season.slug) {
      await setMeta(db, SEASON_META_KEY, season.slug, now);
      return 'current';
    }
    await replaceSeason(db, await loadSeasonLoot(blizzard, region, season));
    await setMeta(db, SEASON_META_KEY, season.slug, now);
    return 'loaded';
  } catch (err) {
    console.error('The season’s loot couldn’t be loaded', err);
    await setMeta(db, SEASON_FAILED_META_KEY, String(now), now);
    return 'failed';
  }
}

const inFlight = new WeakMap<Db, Promise<SeasonSyncResult>>();

/** Checks for a new season at most daily and loads its loot. Requests arriving together share one load. */
export function syncSeason(deps: SeasonSyncDeps): Promise<SeasonSyncResult> {
  const running = inFlight.get(deps.db);
  if (running) return running;
  const run = runSync(deps).finally(() => inFlight.delete(deps.db));
  inFlight.set(deps.db, run);
  return run;
}

/** The stored season and what the page should say about it. */
export async function readSeason(db: Db, now: number): Promise<SeasonState> {
  const loaded = await getMeta(db, SEASON_META_KEY);
  const failed = await getMeta(db, SEASON_FAILED_META_KEY);
  const dungeons = await getSeasonLoot(db);
  const { lastFailed, due } = seasonTiming(loaded, failed, now);
  const status = dungeons.length === 0 ? (lastFailed ? 'failed' : 'loading') : (lastFailed ? 'stale' : 'ready');
  return { status, needsSync: due, dungeons };
}
