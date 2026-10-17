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

describe('classCanUse weapons', () => {
  const mainRow = { slotLabel: 'Main Hand', slots: ['MAIN_HAND' as const] };
  const offRow = { slotLabel: 'Off Hand', slots: ['OFF_HAND' as const] };

  it('refuses a weapon type the class cannot use', () => {
    expect(classCanUse({ inventoryType: 'TWOHWEAPON', armorType: null, weaponType: 'axe2h' }, 'Mage', mainRow)).toEqual({ ok: false, reason: "Mage can't use two-handed axes." });
  });

  it('allows a shield in the off hand for a Warrior', () => {
    expect(classCanUse({ inventoryType: 'SHIELD', armorType: null, weaponType: null }, 'Warrior', offRow)).toEqual({ ok: true });
  });

  it('refuses a one-hander in the off hand for a Druid', () => {
    expect(classCanUse({ inventoryType: 'WEAPON', armorType: null, weaponType: 'mace1h' }, 'Druid', offRow)).toEqual({ ok: false, reason: "Druid can't dual wield." });
  });
});

describe('canCatalyst', () => {
  it('allows a regular item in a tier slot only', () => {
    expect(canCatalyst({ isTier: false }, ['CHEST'])).toBe(true);
    expect(canCatalyst({ isTier: true }, ['CHEST'])).toBe(false);
    expect(canCatalyst({ isTier: false }, ['FINGER_1', 'FINGER_2'])).toBe(false);
  });
});
