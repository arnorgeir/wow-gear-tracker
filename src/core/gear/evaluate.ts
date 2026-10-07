import { decodeTrack } from '../raidbots/tracks';
import { ITEM_STATES, type BisRow, type GearItem, type ItemState, type SlotType, type StatMatch, type TierTarget, type Track } from '../types';
import { compareStats } from './stat-pair';

export interface GearRow {
  row: BisRow;
  slot: SlotType;
  equipped: GearItem | null;
  track: Track | null;
  matched: boolean;
  /** For a matched tier row: whether the piece carries Method's secondary stats. Null otherwise. */
  stats: StatMatch | null;
  state: ItemState;
}

interface Input {
  equipped: GearItem[];
  bisRows: BisRow[];
  tracks: ReadonlyMap<number, Track>;
  bagItemIds?: ReadonlySet<number>;
  targets?: ReadonlyMap<number, TierTarget>;
}

const isMatch = (row: BisRow, item: GearItem | undefined) => {
  if (!item) return false;
  if (row.kind === 'any') return item.itemLevel !== null && item.itemLevel >= row.minItemLevel;
  return row.isTier ? item.isTier : item.itemId === row.itemId;
};

function stateFor(row: BisRow, matched: boolean, track: Track | null, bagItemIds: ReadonlySet<number>, stats: StatMatch | null): ItemState {
  // An "Any" row asks only for an item level, so track states and bags don't apply to it.
  if (row.kind === 'any') return matched ? 'done' : 'missing';
  if (!matched) return !row.isTier && bagItemIds.has(row.itemId) ? 'inBags' : 'missing';
  // The catalyst keeps the base item's stats: a tier piece with other stats fills the set but is not Method's piece.
  if (stats === 'different') return 'wrongStats';
  if (!track) return 'done';
  if (track.name === 'Myth') return track.step >= track.max ? 'done' : 'mythUpgradable';
  return 'belowMyth';
}

export function evaluateGear({ equipped, bisRows, tracks, bagItemIds = new Set(), targets = new Map() }: Input): GearRow[] {
  const bySlot = new Map(equipped.map((item) => [item.slot, item]));
  const used = new Set<SlotType>();
  const rows = bisRows.filter((row) => row.slots.length > 0);

  // First pass: exact matches claim their slot, so one item can't satisfy two rows.
  const matchedSlots = rows.map((row) => {
    const slot = row.slots.find((s) => !used.has(s) && isMatch(row, bySlot.get(s)));
    if (slot) used.add(slot);
    return slot ?? null;
  });

  // Second pass: unmatched rows show what's in their first free slot.
  return rows.map((row, index) => {
    let slot = matchedSlots[index] ?? null;
    const matched = slot !== null;
    if (!slot) {
      slot = row.slots.find((s) => !used.has(s)) ?? row.slots[0]!;
      used.add(slot);
    }
    const item = bySlot.get(slot) ?? null;
    const track = item ? decodeTrack(item.bonusIds, tracks) : null;
    const stats = matched && row.kind === 'item' && row.isTier && item
      ? compareStats({ itemId: row.itemId, stats: targets.get(row.itemId)?.secondaryStats }, { itemId: item.itemId, stats: item.secondaryStats })
      : null;
    return { row, slot, equipped: item, track, matched, stats, state: stateFor(row, matched, track, bagItemIds, stats) };
  });
}

export function countStates(rows: GearRow[]): Record<ItemState, number> {
  const counts = Object.fromEntries(ITEM_STATES.map((s) => [s, 0])) as Record<ItemState, number>;
  for (const row of rows) counts[row.state]++;
  return counts;
}
