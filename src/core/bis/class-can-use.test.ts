import { describe, expect, it } from 'vitest';
import { canCatalyst, classCanUse } from './class-can-use';

const chestRow = { slotLabel: 'Chest', slots: ['CHEST' as const] };
const backRow = { slotLabel: 'Back', slots: ['BACK' as const] };
const ringRow = { slotLabel: 'Ring', slots: ['FINGER_1' as const, 'FINGER_2' as const] };

describe('classCanUse', () => {
  it('rejects a cloth chest for a Warrior', () => {
    expect(classCanUse({ inventoryType: 'ROBE', armorType: 'cloth' }, 'Warrior', chestRow)).toEqual({ ok: false, reason: "Warrior can't wear cloth." });
  });

  it('accepts a cloth cloak for a Warrior', () => {
    expect(classCanUse({ inventoryType: 'CLOAK', armorType: 'cloth' }, 'Warrior', backRow)).toEqual({ ok: true });
  });

  it('rejects an item for another slot', () => {
    expect(classCanUse({ inventoryType: 'FINGER', armorType: null }, 'Mage', chestRow)).toEqual({ ok: false, reason: "That item doesn't fit the Chest slot." });
  });

  it('accepts non-armor items in their slot', () => {
    expect(classCanUse({ inventoryType: 'FINGER', armorType: null }, 'Mage', ringRow)).toEqual({ ok: true });
  });
});

describe('canCatalyst', () => {
  it('allows a regular item in a tier slot only', () => {
    expect(canCatalyst({ isTier: false }, ['CHEST'])).toBe(true);
    expect(canCatalyst({ isTier: true }, ['CHEST'])).toBe(false);
    expect(canCatalyst({ isTier: false }, ['FINGER_1', 'FINGER_2'])).toBe(false);
  });
});
