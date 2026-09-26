import { decodeTrack } from '../raidbots/tracks';
import { ITEM_STATES, type BisRow, type GearItem, type ItemState, type SlotType, type Track } from '../types';

export interface GearRow {
  row: BisRow;
  slot: SlotType;
  equipped: GearItem | null;
  track: Track | null;
  matched: boolean;
  state: ItemState;
}

interface Input {
  equipped: GearItem[];
  bisRows: BisRow[];
  tracks: ReadonlyMap<number, Track>;
  bagItemIds?: ReadonlySet<number>;
}

const isMatch = (row: BisRow, item: GearItem | undefined) =>
  item !== undefined && (row.isTier ? item.isTier : item.itemId === row.itemId);

function stateFor(row: BisRow, matched: boolean, track: Track | null, bagItemIds: ReadonlySet<number>): ItemState {
  if (!matched) return !row.isTier && bagItemIds.has(row.itemId) ? 'inBags' : 'missing';
  if (!track) return 'done';
  if (track.name === 'Myth') return track.step >= track.max ? 'done' : 'mythUpgradable';
  return 'belowMyth';
}

export function evaluateGear({ equipped, bisRows, tracks, bagItemIds = new Set() }: Input): GearRow[] {
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
    return { row, slot, equipped: item, track, matched, state: stateFor(row, matched, track, bagItemIds) };
  });
}

export function countStates(rows: GearRow[]): Record<ItemState, number> {
  const counts = Object.fromEntries(ITEM_STATES.map((s) => [s, 0])) as Record<ItemState, number>;
  for (const row of rows) counts[row.state]++;
  return counts;
}
