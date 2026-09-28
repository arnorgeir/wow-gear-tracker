import { listCharacters } from '@/core/db/queries/characters';
import { crestCostsByGroup } from '@/core/gear/crests';
import { countStates, evaluateGear } from '@/core/gear/evaluate';
import { ensureBisLists, ensureClassIcons, ensureTracks, type BisResult } from '@/core/sync/reference-sync';
import type { Services } from '../services';
import type { CharacterCardView } from './types';
import { loadGear, summarize, upgradeFor, crestView } from './summarize';

export async function getCharacterCards(services: Services): Promise<CharacterCardView[]> {
  const { db, blizzard, bisSource, fetchRaidbots, now } = services;
  const time = now();
  const { tracks, error: tracksError } = await ensureTracks({ db, fetchRaidbots, now: time });
  const costs = crestCostsByGroup(tracks.values());
  const characters = await listCharacters(db);
  const classIcons = await ensureClassIcons({ db, blizzard, now: time }, characters[0]?.region ?? 'eu');
  const bisBySlug = new Map<string, Promise<BisResult>>();
  return Promise.all(characters.map(async (c) => {
    const gear = await loadGear(db, c.id);
    const summary = summarize(c, gear.current, classIcons);
    if (!bisBySlug.has(summary.specSlug)) bisBySlug.set(summary.specSlug, ensureBisLists({ db, source: bisSource, now: time }, summary.specSlug));
    const bis = await bisBySlug.get(summary.specSlug)!;
    const bisRows = bis.lists?.[c.priorityList] ?? [];
    const rows = evaluateGear({ equipped: gear.equipped, bisRows, tracks, bagItemIds: gear.bagItemIds });
    return {
      ...summary,
      counts: bis.lists ? countStates(rows) : null,
      total: rows.length,
      bisError: bis.error,
      tracksError,
      crests: crestView(gear, costs),
      upgradesReady: rows.filter((r) => upgradeFor(r, costs, gear.balances)).length,
    };
  }));
}
