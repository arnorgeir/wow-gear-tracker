import { listCharacters } from '@/core/db/queries/characters';
import { crestCostsByGroup } from '@/core/gear/crests';
import { countStates, evaluateGear } from '@/core/gear/evaluate';
import { ensureClassIcons, ensureTracks } from '@/core/sync/reference-sync';
import { createBisLookup } from './bis-lookup';
import type { Services } from '../services';
import type { CharacterCardView } from './types';
import { loadGear, summarize, upgradeFor, crestView } from './summarize';

export async function getCharacterCards(services: Services): Promise<CharacterCardView[]> {
  const { db, blizzard, fetchRaidbots, now } = services;
  const time = now();
  const { tracks, error: tracksError } = await ensureTracks({ db, fetchRaidbots, now: time });
  const costs = crestCostsByGroup(tracks.values());
  const characters = await listCharacters(db);
  const classIcons = await ensureClassIcons({ db, blizzard, now: time }, characters[0]?.region ?? 'eu');
  const bisFor = createBisLookup(services, time);
  return Promise.all(characters.map(async (c) => {
    const gear = await loadGear(db, c.id);
    const summary = summarize(c, gear.current, classIcons);
    const bis = await bisFor(summary.specSlug, c.region);
    const bisRows = bis.lists?.[c.priorityList] ?? [];
    const rows = evaluateGear({ equipped: gear.equipped, bisRows, tracks, bagItemIds: gear.bagItemIds, targets: bis.targets });
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
