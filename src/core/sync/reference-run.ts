import type { BlizzardClient } from '../blizzard/client';
import type { Db } from '../db/client';
import { listCharacters } from '../db/queries/characters';
import { methodSpecSlug } from '../method/method';
import type { RaidbotsData } from '../raidbots/tracks';
import type { BisSource, Region } from '../types';
import { readBisLists, syncBisLists, syncTierTargets, syncTracks } from './reference-sync';

export type ReferenceSyncResult = 'skipped' | 'synced';
export interface ReferenceSyncDeps { db: Db; bisSource: BisSource; fetchRaidbots: () => Promise<RaidbotsData>; blizzard: BlizzardClient; now: number }

/** One pass: tracks, then every tracked spec's lists and, per region, its tier stats. Database steps run in sequence. */
async function runPass({ db, bisSource, fetchRaidbots, blizzard, now }: ReferenceSyncDeps): Promise<ReferenceSyncResult> {
  let requested = await syncTracks({ db, fetchRaidbots, now });
  // The same slug summarize gives the views, so the page and the sync agree on what is due.
  const specs = new Map<string, Set<Region>>();
  for (const c of await listCharacters(db)) {
    const slug = methodSpecSlug(c.specOverride || c.specName, c.className);
    specs.set(slug, (specs.get(slug) ?? new Set<Region>()).add(c.region));
  }
  for (const [specSlug, regions] of specs) {
    if (await syncBisLists({ db, source: bisSource, now }, specSlug)) requested = true;
    const { lists } = await readBisLists(db, specSlug, now);
    for (const region of regions) {
      if (await syncTierTargets({ db, blizzard, now }, { region, specSlug, lists })) requested = true;
    }
  }
  return requested ? 'synced' : 'skipped';
}

interface Slot { running: Promise<ReferenceSyncResult>; queued: Promise<ReferenceSyncResult> | null }
const slots = new WeakMap<Db, Slot>();

function launch(deps: ReferenceSyncDeps): Promise<ReferenceSyncResult> {
  const slot: Slot = { running: Promise.resolve('skipped'), queued: null };
  slot.running = runPass(deps).finally(() => {
    if (slots.get(deps.db) === slot && !slot.queued) slots.delete(deps.db);
  });
  slots.set(deps.db, slot);
  return slot.running;
}

/**
 * Refreshes Method lists, Raidbots tracks and tier stats for the tracked characters. A pass lists
 * characters once, at its start, so a call that arrives mid-pass may need work that pass never saw:
 * every such call shares one follow-up pass, which starts when the running one ends.
 */
export function syncReference(deps: ReferenceSyncDeps): Promise<ReferenceSyncResult> {
  const slot = slots.get(deps.db);
  if (!slot) return launch(deps);
  const again = () => launch(deps);
  slot.queued ??= slot.running.then(again, again);
  return slot.queued;
}
