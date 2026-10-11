import type { BisOverride, BisRow, CatalogItem } from '../types';
import { slotKeys } from './slot-keys';

export interface Overlaid { rows: BisRow[]; editedCount: number; orphans: BisOverride[] }

/** Method's rows with an account's overrides applied. Overrides that no longer fit a row are returned, not applied. */
export function applyOverrides(rows: BisRow[], overrides: BisOverride[], catalog: ReadonlyMap<number, CatalogItem>): Overlaid {
  const keys = slotKeys(rows);
  const usable = new Map(overrides.filter((o) => keys.includes(o.slotKey) && catalog.has(o.itemId)).map((o) => [o.slotKey, o]));
  const out = rows.map((row, i): BisRow => {
    const o = usable.get(keys[i]!);
    if (!o) return row;
    const item = catalog.get(o.itemId)!;
    return {
      kind: 'item', slotLabel: row.slotLabel, slots: row.slots, source: row.source,
      itemId: item.itemId, name: item.name, bonusIds: [],
      // A catalyst override reads like Method's catalyst base: any tier piece fills it, stats from the base.
      isTier: o.catalyst || item.isTier, isCatalyst: o.catalyst,
      edited: { methodPick: row },
    };
  });
  return { rows: out, editedCount: usable.size, orphans: overrides.filter((o) => usable.get(o.slotKey) !== o) };
}
