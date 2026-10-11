import { applyOverrides } from '@/core/bis/overlay';
import { slotKeys } from '@/core/bis/slot-keys';
import { getSpecSettings, listOverrides } from '@/core/db/queries/bis-settings';
import { listCharacters } from '@/core/db/queries/characters';
import { getCatalogItems } from '@/core/db/queries/item-catalog';
import { getItemIcons } from '@/core/db/queries/media';
import { getSpec } from '@/core/db/queries/specs';
import { TIER_SLOTS } from '@/core/priority/slots';
import { readBisLists } from '@/core/sync/reference-sync';
import { LIST_TYPES, type BisOverride, type CatalogItem, type ListType, type TierTarget } from '@/core/types';
import type { Services } from '../services';
import { itemView } from './item-view';
import { bisView } from './member';
import { fetchStateOf, trackedSlug } from './settings-bis';
import type { SettingsSlotView, SettingsSpecView } from './types';

const NO_TARGETS: ReadonlyMap<number, TierTarget> = new Map();

/** The spec's class and name from the catalog, else a tracked character. Null for an unknown slug. */
async function identify(services: Services, slug: string) {
  const spec = await getSpec(services.db, slug);
  const characters = await listCharacters(services.db);
  const tracked = characters.find((c) => trackedSlug(c) === slug);
  if (spec) return { className: spec.className, specName: spec.specName, tracked: tracked !== undefined };
  return tracked ? { className: tracked.className, specName: tracked.specOverride || tracked.specName, tracked: true } : null;
}

const orphanView = (o: BisOverride, catalog: ReadonlyMap<number, CatalogItem>, icons: ReadonlyMap<number, string | null>) => {
  const item = catalog.get(o.itemId);
  return { slotKey: o.slotKey, ...itemView({ itemId: o.itemId, name: item?.name ?? `Item ${o.itemId}`, itemLevel: null, quality: item?.quality ?? 'EPIC', bonusIds: [] }, icons, null) };
};

export async function getSettingsSpec(services: Services, slug: string, editing: ListType): Promise<SettingsSpecView | null> {
  const { db, now } = services;
  const who = await identify(services, slug);
  if (!who) return null;
  const accountId = services.currentAccountId();
  const read = await readBisLists(db, slug, now());
  const settings = await getSpecSettings(db, accountId, slug);
  const overrides = await listOverrides(db, accountId, slug);
  const catalog = await getCatalogItems(db, LIST_TYPES.flatMap((l) => overrides[l].map((o) => o.itemId)));
  const rowsByList = (l: ListType) => read.lists?.[l] ?? [];
  const iconIds = LIST_TYPES.flatMap((l) => [
    ...rowsByList(l).flatMap((r) => (r.kind === 'item' ? [r.itemId] : [])),
    ...overrides[l].map((o) => o.itemId),
  ]);
  const icons = await getItemIcons(db, iconIds);

  const lists = Object.fromEntries(LIST_TYPES.map((l) => {
    const rows = rowsByList(l);
    const keys = slotKeys(rows);
    const out = applyOverrides(rows, overrides[l], catalog);
    const slots = rows.map((row, i): SettingsSlotView => {
      const shown = out.rows[i]!;
      return {
        slotKey: keys[i]!,
        slotLabel: row.slotLabel,
        method: bisView(row, icons, NO_TARGETS),
        override: shown.kind === 'item' && shown.edited
          ? { ...itemView({ itemId: shown.itemId, name: shown.name, itemLevel: null, quality: catalog.get(shown.itemId)?.quality ?? 'EPIC', bonusIds: [] }, icons, null), catalyst: shown.isCatalyst }
          : null,
        tierSlot: row.slots.some((s) => TIER_SLOTS.has(s)),
      };
    });
    return [l, { slots, orphans: out.orphans.map((o) => orphanView(o, catalog, icons)) }];
  })) as SettingsSpecView['lists'];

  return {
    slug, className: who.className, specName: who.specName,
    listType: settings.listType, statsMatter: settings.statsMatter, editing,
    hasLists: read.lists !== null, fetchState: fetchStateOf(read, who.tracked), lists,
  };
}
