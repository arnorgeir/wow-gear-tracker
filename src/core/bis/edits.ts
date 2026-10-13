import type { BlizzardClient } from '../blizzard/client';
import type { Db } from '../db/client';
import { SOURCE_CHANGED, deleteOverrideIfCurrent, upsertOverrideIfCurrent } from '../db/queries/bis-settings';
import { listCharacters } from '../db/queries/characters';
import { findLocalItem, searchLocalItems, upsertCatalogItem } from '../db/queries/item-catalog';
import { getSpec } from '../db/queries/specs';
import { UserError, isUserError } from '../errors';
import { methodSpecSlug } from '../method/method';
import { SOURCE_NAMES, type BisRow, type BisSourceId, type CatalogItem, type ListType, type Region } from '../types';
import { canCatalyst, classCanUse, type CanUse } from './class-can-use';
import { parseItemInput } from './item-input';
import { slotKeys } from './slot-keys';
import { readSpecBase } from './spec-base';

export interface EditDeps { db: Db; blizzard: BlizzardClient; now: number; accountId: number }
/** A slot of the list a page shows.  is the source that page showed, checked against the current one. */
export interface RowRef { specSlug: string; source: BisSourceId; listType: ListType; slotKey: string }
type ReadDeps = Pick<EditDeps, 'db' | 'accountId' | 'now'>;
/** `source` is the season dungeon the item drops in; null for an item looked up by ID or link. */
export interface ItemChoice extends CatalogItem { canUse: CanUse; canCatalyst: boolean; source: string | null }

const SEARCH_LIMIT = 20;

export async function classForSpec(db: Db, specSlug: string): Promise<string | null> {
  const spec = await getSpec(db, specSlug);
  if (spec) return spec.className;
  const tracked = (await listCharacters(db)).find((c) => methodSpecSlug(c.specOverride || c.specName, c.className) === specSlug);
  return tracked?.className ?? null;
}

/** The region of the spec's first tracked character, for Blizzard item lookups. EU when none is tracked. */
export async function regionForSpec(db: Db, specSlug: string): Promise<Region> {
  const tracked = (await listCharacters(db)).find((c) => methodSpecSlug(c.specOverride || c.specName, c.className) === specSlug);
  return tracked?.region ?? 'eu';
}

export const knownSpecSlug = async (db: Db, specSlug: string) => (await classForSpec(db, specSlug)) !== null;

/** The row a ref points at in the spec's chosen list, with the spec's class. Throws the user-facing reason when anything is missing or stale. */
async function resolveRow({ db, accountId, now }: ReadDeps, ref: RowRef): Promise<{ row: BisRow; className: string }> {
  const className = await classForSpec(db, ref.specSlug);
  if (!className) throw new UserError('Unknown spec.');
  const base = await readSpecBase(db, accountId, ref.specSlug, now);
  if (base.source !== ref.source) throw new UserError(SOURCE_CHANGED);
  const name = SOURCE_NAMES[base.source];
  if (!base.lists) throw new UserError(`${name} has no list for this spec yet. Fetch it first.`);
  const rows = base.lists[ref.listType];
  const index = slotKeys(rows).indexOf(ref.slotKey);
  if (index === -1) throw new UserError(`That slot isn't in ${name}'s list.`);
  return { row: rows[index]!, className };
}

const choice = (item: CatalogItem & { source?: string | null }, className: string, row: BisRow): ItemChoice =>
  ({ ...item, source: item.source ?? null, canUse: classCanUse(item, className, row), canCatalyst: canCatalyst(item, row.slots) });

/** The item from local data, else one Blizzard request, cached. Writes nothing when Blizzard fails. */
async function ensureItem(deps: EditDeps, itemId: number): Promise<CatalogItem> {
  const local = await findLocalItem(deps.db, itemId);
  if (local) {
    // Season loot is a complete source too; the catalog row keeps the item after a season change.
    await upsertCatalogItem(deps.db, local, deps.now);
    return local;
  }
  let info;
  try {
    info = await deps.blizzard.getItemDetails('eu', itemId);
  } catch (err) {
    if (isUserError(err)) throw err;
    throw new UserError("Couldn't reach Blizzard. Try again.");
  }
  if (!info) throw new UserError(`No item with ID ${itemId}.`);
  if (!info.name || !info.inventoryType) throw new UserError("Couldn't read that item from Blizzard.");
  const item: CatalogItem = { itemId, name: info.name, inventoryType: info.inventoryType, armorType: info.armorType, quality: info.quality, isTier: info.isTier };
  await upsertCatalogItem(deps.db, item, deps.now);
  return item;
}

export async function searchItems(deps: ReadDeps, ref: RowRef, query: string) {
  const { row, className } = await resolveRow(deps, ref);
  const all = (await searchLocalItems(deps.db, query)).map((i) => choice(i, className, row));
  const exactId = parseItemInput(query);
  return {
    results: all.filter((i) => i.canUse.ok).slice(0, SEARCH_LIMIT),
    unusable: all.find((i) => i.itemId === exactId && !i.canUse.ok) ?? null,
  };
}

export async function lookupItem(deps: EditDeps, ref: RowRef, input: string): Promise<ItemChoice> {
  const itemId = parseItemInput(input);
  if (itemId === null) throw new UserError('Not a Wowhead item link or ID.');
  const { row, className } = await resolveRow(deps, ref);
  return choice(await ensureItem(deps, itemId), className, row);
}

export async function saveOverride(deps: EditDeps, ref: RowRef, itemId: number, catalyst: boolean) {
  const { row, className } = await resolveRow(deps, ref);
  const item = await ensureItem(deps, itemId);
  const canUse = classCanUse(item, className, row);
  if (!canUse.ok) throw new UserError(canUse.reason);
  if (catalyst && !canCatalyst(item, row.slots)) throw new UserError('Only regular items in tier slots can be catalyzed.');
  // The source is checked again inside the write lock: resolveRow's check ran before the Blizzard lookup.
  await upsertOverrideIfCurrent(deps.db, deps.accountId, ref.specSlug, ref.source, ref.listType, { slotKey: ref.slotKey, itemId, catalyst });
}

/** Removes even an orphan, so it skips the row check; the source check still applies, inside the write lock. */
export async function removeOverride(deps: EditDeps, ref: RowRef) {
  await deleteOverrideIfCurrent(deps.db, deps.accountId, ref.specSlug, ref.source, ref.listType, ref.slotKey);
}
