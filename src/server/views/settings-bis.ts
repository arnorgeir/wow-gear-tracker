import { listCharacters, type CharacterRow } from '@/core/db/queries/characters';
import { getClassIconMap } from '@/core/db/queries/media';
import { listSpecs, type SpecRow } from '@/core/db/queries/specs';
import { methodSpecSlug } from '@/core/method/method';
import { readBisLists, type BisRead } from '@/core/sync/reference-sync';
import type { Services } from '../services';
import type { SpecFetchState, SpecPickerView } from './types';

export const trackedSlug = (c: CharacterRow) => methodSpecSlug(c.specOverride || c.specName, c.className);

/** What the picker and the editor say about a spec's Method list. A tracked spec always reads as tracked. */
export function fetchStateOf(read: BisRead, tracked: boolean): SpecFetchState {
  if (tracked) return { kind: 'tracked' };
  if (read.fetchedAt !== null) return { kind: 'fetched', at: read.fetchedAt };
  return read.status === 'failed' ? { kind: 'failed' } : { kind: 'notFetched' };
}

/** Every spec Blizzard knows, or just the tracked ones until the spec catalog has been fetched. */
function specRows(catalog: SpecRow[], characters: CharacterRow[]): SpecRow[] {
  if (catalog.length > 0) return catalog;
  return [...new Map(characters.map((c) => [trackedSlug(c), { methodSlug: trackedSlug(c), classId: 0, className: c.className, specName: c.specOverride || c.specName }])).values()];
}

export async function getSpecPicker(services: Services): Promise<SpecPickerView> {
  const { db, now } = services;
  const time = now();
  const characters = await listCharacters(db);
  const tracked = new Set(characters.map(trackedSlug));
  const rows = specRows(await listSpecs(db), characters);
  const icons = await getClassIconMap(db);
  const byClass = new Map<string, SpecPickerView['classes'][number]>();
  // Reads run in sequence: an in-memory database can't serve two at once.
  for (const row of rows) {
    const isTracked = tracked.has(row.methodSlug);
    const state = fetchStateOf(await readBisLists(db, row.methodSlug, time), isTracked);
    const group = byClass.get(row.className) ?? { className: row.className, iconUrl: icons.get(row.className) ?? null, specs: [] };
    group.specs.push({ slug: row.methodSlug, specName: row.specName, tracked: isTracked, state });
    byClass.set(row.className, group);
  }
  return {
    classes: [...byClass.values()]
      .map((g) => ({ ...g, specs: g.specs.sort((a, b) => a.specName.localeCompare(b.specName)) }))
      .sort((a, b) => a.className.localeCompare(b.className)),
  };
}
