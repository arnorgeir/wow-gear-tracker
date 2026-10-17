import type { BlizzardClient } from '../blizzard/client';
import type { JournalInstance } from '../blizzard/types';
import type { Db } from '../db/client';
import { getMeta, setMeta } from '../db/queries/meta';
import { getSeasonLoot, replaceSeason, updateSeasonArtwork, type DungeonLootRow, type SeasonData, type SeasonDungeonRow } from '../db/queries/season';
import type { FetchFn } from '../http';
import { fetchMainSeason, type MainSeason } from '../raiderio/season';
import type { Region, SeasonLoot } from '../types';
import { encodeStats } from '../gear/stat-pair';
import { cacheTiming, referenceStatus, type ReferenceStatus } from './freshness';
import { ensureItemIcons } from './reference/item-icons';

// The version in the key marks the stored tables' format. Bump it when season_dungeons,
// dungeon_loot or dungeon_encounters gain columns, or when a sync starts caching more (v5: loot icons, v6: dungeon_encounters),
// so installs reload the season instead of trusting old rows until the next daily check.
export const SEASON_META_KEY = 'season.v6';
const SEASON_FAILED_META_KEY = 'season.failedAt';

export type SeasonSyncResult = 'skipped' | 'current' | 'loaded' | 'failed';
export interface SeasonSyncDeps { db: Db; blizzard: BlizzardClient; fetchFn: FetchFn; now: number; region: Region }
export interface SeasonState { status: ReferenceStatus; needsSync: boolean; dungeons: SeasonLoot[] }

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
    dungeons.push({ challengeModeId: d.challengeModeId, name: d.name, shortName: d.shortName, imageUrl: d.imageUrl, journalInstanceId: instance.id, mapId: keystone.mapId, encounterIds: instance.encounterIds });
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
      secondaryStats: encodeStats(infos.get(item.itemId)?.secondaryStats),
      quality: infos.get(item.itemId)?.quality ?? null,
      isTier: infos.get(item.itemId)?.isTier ?? false,
    }));
  }));
  const rows: SeasonDungeonRow[] = dungeons.map((d) => ({
    challengeModeId: d.challengeModeId, name: d.name, shortName: d.shortName, imageUrl: d.imageUrl, journalInstanceId: d.journalInstanceId, mapId: d.mapId,
  }));
  const encounterRows = [...encounters.values()].map((e) => ({ encounterId: e.id, name: e.name, description: e.description, sections: e.sections }));
  return { slug: season.slug, dungeons: rows, loot, encounters: encounterRows };
}

const iconRuns = new WeakMap<Db, Promise<void>>();

/**
 * Caches an icon for every loot item, so the override search (a read-only GET) can show them. Runs in the
 * background: a few hundred icons, or a hanging media endpoint, must not hold the season answer back. One
 * run per database at a time; errors are logged, never thrown.
 */
function cacheLootIcons({ db, blizzard, now, region }: SeasonSyncDeps) {
  if (iconRuns.has(db)) return;
  const run = (async () => {
    const loot = (await getSeasonLoot(db)).flatMap((d) => d.loot.map((i) => i.itemId));
    await ensureItemIcons({ db, blizzard, now }, region, loot);
  })()
    .catch((err) => console.error('The season’s item icons couldn’t be cached', err))
    .finally(() => iconRuns.delete(db));
  iconRuns.set(db, run);
}

/** Resolves once a background icon run for this database has finished. For tests. */
export const lootIconsSettled = (db: Db): Promise<void> => iconRuns.get(db) ?? Promise.resolve();

async function runSync(deps: SeasonSyncDeps): Promise<SeasonSyncResult> {
  const { db, blizzard, fetchFn, now, region } = deps;
  const loaded = await getMeta(db, SEASON_META_KEY);
  const failed = await getMeta(db, SEASON_FAILED_META_KEY);
  if (!cacheTiming(loaded?.updatedAt ?? null, failed?.updatedAt ?? null, now).due) return 'skipped';
  try {
    const season = await fetchMainSeason(fetchFn, now);
    if (loaded?.value === season.slug) {
      // Same season: only artwork can have moved, so refresh it without rebuilding loot.
      await updateSeasonArtwork(db, season.slug, season.dungeons);
      await setMeta(db, SEASON_META_KEY, season.slug, now);
      cacheLootIcons(deps);
      return 'current';
    }
    await replaceSeason(db, await loadSeasonLoot(blizzard, region, season));
    await setMeta(db, SEASON_META_KEY, season.slug, now);
    cacheLootIcons(deps);
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
  const { lastFailed, due } = cacheTiming(loaded?.updatedAt ?? null, failed?.updatedAt ?? null, now);
  const status = referenceStatus(dungeons.length > 0, lastFailed);
  return { status, needsSync: due, dungeons };
}
