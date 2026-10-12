import { applyOverrides } from '@/core/bis/overlay';
import { getSpecSettings, listOverrides } from '@/core/db/queries/bis-settings';
import { listCharacters, type CharacterRow } from '@/core/db/queries/characters';
import { getCatalogItems } from '@/core/db/queries/item-catalog';
import { getClassIconMap } from '@/core/db/queries/media';
import { listSpecs, type SpecRow } from '@/core/db/queries/specs';
import { readBisLists } from '@/core/sync/reference-sync';
import { DEFAULT_SPEC_SETTINGS } from '@/core/db/queries/bis-settings';
import type { Services } from '../services';
import { chipOf, fetchStateOf, specIconOf, trackedSlug } from './settings-shared';
import type { PickerSpecView, SpecPickerView } from './types';

/** Every spec Blizzard knows, or just the tracked ones until the spec catalog has been fetched. */
function specRows(catalog: SpecRow[], characters: CharacterRow[]): SpecRow[] {
  if (catalog.length > 0) return catalog;
  return [...new Map(characters.map((c) => [trackedSlug(c), { methodSlug: trackedSlug(c), classId: 0, className: c.className, specName: c.specOverride || c.specName, iconUrl: null }])).values()];
}

export async function getSpecPicker(services: Services): Promise<SpecPickerView> {
  const { db, now } = services;
  const time = now();
  const accountId = services.currentAccountId();
  const characters = await listCharacters(db);
  const rows = specRows(await listSpecs(db), characters);
  const classIcons = await getClassIconMap(db);
  const byClass = new Map<string, SpecPickerView['classes'][number]>();
  const tracked: SpecPickerView['tracked'] = [];
  // Reads run in sequence: an in-memory database can't serve two at once.
  for (const row of rows) {
    const users = characters.filter((c) => trackedSlug(c) === row.methodSlug);
    const isTracked = users.length > 0;
    const read = await readBisLists(db, 'method', row.methodSlug, time);
    const settings = isTracked ? await getSpecSettings(db, accountId, row.methodSlug) : DEFAULT_SPEC_SETTINGS;
    const spec: PickerSpecView = {
      slug: row.methodSlug, specName: row.specName, iconUrl: specIconOf(row.iconUrl, row.className, classIcons),
      tracked: isTracked, state: fetchStateOf(read, isTracked), characters: users.map((c) => chipOf(c, classIcons)), compares: settings.listType,
    };
    if (isTracked) {
      const overrides = (await listOverrides(db, accountId, row.methodSlug, 'method'))[settings.listType];
      const catalog = await getCatalogItems(db, overrides.map((o) => o.itemId));
      const editedCount = applyOverrides(read.lists?.[settings.listType] ?? [], overrides, catalog).editedCount;
      tracked.push({ ...spec, className: row.className, editedCount });
    }
    const group = byClass.get(row.className) ?? { className: row.className, iconUrl: classIcons.get(row.className) ?? null, trackedCount: 0, specs: [] };
    group.specs.push(spec);
    if (isTracked) group.trackedCount++;
    byClass.set(row.className, group);
  }
  const bySpecName = (a: { specName: string }, b: { specName: string }) => a.specName.localeCompare(b.specName);
  return {
    tracked: tracked.sort((a, b) => a.className.localeCompare(b.className) || bySpecName(a, b)),
    classes: [...byClass.values()]
      .map((g) => ({ ...g, specs: g.specs.sort(bySpecName) }))
      .sort((a, b) => a.className.localeCompare(b.className)),
  };
}
