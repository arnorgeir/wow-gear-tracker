import { compareStats } from '../gear/stat-pair';
import type { BisRow, LootItem, TierTarget } from '../types';
import { FIT, fitsSlot, isOpenRow, type PriorityCharacter, type TierFit } from './rank';

interface DropNeedBase { characterId: number; characterName: string; slotLabel: string; reason: 'missing' | 'wrongStats' }
/** Why a character wants one drop: the item itself, or a tier piece to catalyze (`fit` says how its stats compare). */
export type DropNeed = (DropNeedBase & { via: 'drop' }) | (DropNeedBase & { via: 'catalyst'; fit: TierFit });

/**
 * Who needs each drop, by item ID. Unlike `rankDungeons`, which scores one drop per row, this walks every
 * drop, so two same-slot candidates on different bosses are both credited. Any rows add nothing: they fit
 * nearly every drop of a slot. One entry per character (the first matching row), ordered by name.
 */
export function needsByDrop(characters: PriorityCharacter[], loot: LootItem[]): Map<number, DropNeed[]> {
  const out = new Map<number, DropNeed[]>();
  for (const c of [...characters].sort((a, b) => a.name.localeCompare(b.name))) {
    const seen = new Set<number>();
    for (const r of c.rows.filter(isOpenRow)) {
      if (r.row.kind !== 'item') continue;
      const reason = r.state === 'wrongStats' ? 'wrongStats' : 'missing';
      const row = r.row;
      for (const l of loot) {
        if (seen.has(l.itemId)) continue;
        const base = { characterId: c.id, characterName: c.name, slotLabel: row.slotLabel, reason } as const;
        let need: DropNeed | null = null;
        if (!row.isTier) {
          if (l.itemId === row.itemId) need = { ...base, via: 'drop' };
        } else if (fitsSlot(row, c.className, l)) {
          const fit: TierFit = c.statsMatter
            ? FIT[compareStats({ itemId: row.itemId, stats: c.targets.get(row.itemId)?.secondaryStats ?? null }, { itemId: l.itemId, stats: l.secondaryStats })]
            : 'any';
          if (!(reason === 'wrongStats' && fit !== 'bis')) need = { ...base, via: 'catalyst', fit };
        }
        if (!need) continue;
        seen.add(l.itemId);
        out.set(l.itemId, [...(out.get(l.itemId) ?? []), need]);
      }
    }
  }
  return out;
}

/**
 * The drops a spec's list names: an item row's ID, or a tier row's slot in the spec's armor type with the
 * target's verified stats (any stats when they don't matter). Unknown and different pairs, and Any rows, don't count.
 */
export function bisMatches(rows: BisRow[], targets: ReadonlyMap<number, TierTarget>, statsMatter: boolean, className: string, loot: LootItem[]): Set<number> {
  const out = new Set<number>();
  for (const row of rows) {
    if (row.kind !== 'item') continue;
    for (const l of loot) {
      if (l.itemId === row.itemId) out.add(l.itemId);
      else if (row.isTier && fitsSlot(row, className, l)
        && (!statsMatter || compareStats({ itemId: row.itemId, stats: targets.get(row.itemId)?.secondaryStats ?? null }, { itemId: l.itemId, stats: l.secondaryStats }) === 'same')) out.add(l.itemId);
    }
  }
  return out;
}
