import { describe, expect, it } from 'vitest';
import { SLOT_TYPES, type GearItem, type SlotType } from '../types';
import { equippedItemLevel } from './item-level';

const item = (slot: SlotType, itemLevel: number | null): GearItem =>
  ({ slot, itemId: 1, name: 'Piece', itemLevel, quality: 'EPIC', bonusIds: [], isTier: false });
const ARMOR = SLOT_TYPES.filter((s) => s !== 'MAIN_HAND' && s !== 'OFF_HAND');
const set = (level: number, slots: readonly SlotType[] = SLOT_TYPES) => slots.map((s) => item(s, level));

describe('equippedItemLevel', () => {
  it('averages a full set', () => {
    expect(equippedItemLevel(set(330))).toBe(330);
  });

  it('cuts to one decimal, never rounds up', () => {
    // 15 at 334 and one at 345: 5355 / 16 = 334.6875, shown 334.6.
    expect(equippedItemLevel([...set(334, SLOT_TYPES.slice(0, 15)), item('OFF_HAND', 345)])).toBe(334.6);
  });

  it('counts an empty slot as 0', () => {
    // 15 at 320, no HEAD: 4800 / 16 = 300.
    expect(equippedItemLevel(set(320, SLOT_TYPES.filter((s) => s !== 'HEAD')))).toBe(300);
  });

  it('counts a two-hander in both weapon slots', () => {
    // (14 × 330 + 2 × 346) / 16 = 332, not (14 × 330 + 346) / 15 = 331.
    expect(equippedItemLevel([...set(330, ARMOR), item('MAIN_HAND', 346)])).toBe(332);
  });

  it('counts each weapon once when both hands are filled', () => {
    // (14 × 330 + 346 + 314) / 16 = 330.
    expect(equippedItemLevel([...set(330, ARMOR), item('MAIN_HAND', 346), item('OFF_HAND', 314)])).toBe(330);
  });

  it('counts a lone one-hander twice too, the documented gap', () => {
    // The game shows 309.3 here: it can't be told from a two-hander without the inventory type.
    expect(equippedItemLevel([...set(330, ARMOR), item('MAIN_HAND', 330)])).toBe(330);
  });

  it('gives no number when any item level is unknown', () => {
    expect(equippedItemLevel([...set(330, SLOT_TYPES.slice(0, 15)), item('OFF_HAND', null)])).toBeNull();
  });

  it('gives no number without gear', () => {
    expect(equippedItemLevel([])).toBeNull();
  });
});
