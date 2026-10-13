import { SLOT_TYPES, type GearItem, type SlotType } from '../types';

/**
 * The equipped item level the game shows, cut to one decimal: the 16 slots averaged, an empty slot counting 0.
 * Null without gear, or when any item's level is unknown, since a wrong number is worse than none.
 */
export function equippedItemLevel(equipped: readonly GearItem[]): number | null {
  if (equipped.length === 0 || equipped.some((g) => g.itemLevel === null)) return null;
  const level = new Map<SlotType, number>(equipped.map((g) => [g.slot, g.itemLevel ?? 0]));
  // The game counts a two-hander in both weapon slots. ponytail: GearItem has no inventory type, so a lone
  // one-hander counts twice too (overstates by its level / 16), and a Fury warrior's two two-handers each count
  // once. Storing the weapon's inventory type fixes both.
  const offHand = level.get('OFF_HAND') ?? level.get('MAIN_HAND') ?? 0;
  const sum = SLOT_TYPES.reduce((total, slot) => total + (slot === 'OFF_HAND' ? offHand : level.get(slot) ?? 0), 0);
  // sum / 16 has at most four binary fraction digits, so × 10 is exact and the floor never slips a step.
  return Math.floor((sum / SLOT_TYPES.length) * 10) / 10;
}
