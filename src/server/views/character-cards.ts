import { listCharacters } from '@/core/db/queries/characters';
import { crestCostsByGroup } from '@/core/gear/crests';
import { countStates, evaluateGear } from '@/core/gear/evaluate';
import { ensureClassIcons, readTracks } from '@/core/sync/reference-sync';
import { createBisLookup, referenceDue, type SpecBis } from './bis-lookup';
import type { Services } from '../services';
import type { CharacterCardView } from './types';
import { loadGear, summarize, upgradeFor, crestView } from './summarize';

export async function getCharacterCards(services: Services): Promise<{ cards: CharacterCardView[]; referenceDue: string | null }> {
  const { db, blizzard, now } = services;
  const time = now();
  const tracksRead = await readTracks(db, time);
  const { tracks } = tracksRead;
  const tracksKnown = tracks.size > 0;
  const costs = crestCostsByGroup(tracks.values());
  const characters = await listCharacters(db);
  const classIcons = await ensureClassIcons({ db, blizzard, now: time }, characters[0]?.region ?? 'eu');
  const bisFor = createBisLookup(db, time);
  const specs: SpecBis[] = [];
  const cards = await Promise.all(characters.map(async (c) => {
    const gear = await loadGear(db, c.id);
    const summary = summarize(c, gear.current, classIcons);
    const bis = await bisFor(summary.specSlug, c.region);
    specs.push(bis);
    const bisRows = bis.lists?.[c.priorityList] ?? [];
    const rows = evaluateGear({ equipped: gear.equipped, bisRows, tracks, bagItemIds: gear.bagItemIds, targets: bis.targets });
    return {
      ...summary,
      counts: bis.lists ? countStates(rows) : null,
      total: rows.length,
      bisError: bis.error,
      tracksError: tracksRead.error,
      tracksKnown,
      tracksLoading: tracksRead.status === 'loading',
      crests: crestView(gear, costs),
      upgradesReady: rows.filter((r) => upgradeFor(r, costs, gear.balances)).length,
    };
  }));
  return { cards, referenceDue: referenceDue(tracksRead.due, specs) };
}
