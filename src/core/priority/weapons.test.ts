import { describe, expect, it } from 'vitest';
import { weaponUse } from './weapons';

const bad = (reason: string) => ({ ok: false, reason });

describe('weaponUse', () => {
  it('refuses a weapon type outside the class set, in words', () => {
    expect(weaponUse({ inventoryType: 'TWOHWEAPON', weaponType: 'axe2h' }, 'Mage', 'MAIN_HAND')).toEqual(bad("Mage can't use two-handed axes."));
    expect(weaponUse({ inventoryType: 'WEAPON', weaponType: 'dagger' }, 'Mage', 'MAIN_HAND')).toEqual({ ok: true });
  });

  it('allows a two-hander in the main hand for a class that has it', () => {
    expect(weaponUse({ inventoryType: 'TWOHWEAPON', weaponType: 'axe2h' }, 'Warrior', 'MAIN_HAND')).toEqual({ ok: true });
  });

  it('applies the shield and held-in-off-hand rules', () => {
    expect(weaponUse({ inventoryType: 'SHIELD', weaponType: null }, 'Mage', 'OFF_HAND')).toEqual(bad("Mage can't use shields."));
    expect(weaponUse({ inventoryType: 'SHIELD', weaponType: null }, 'Warrior', 'OFF_HAND')).toEqual({ ok: true });
    expect(weaponUse({ inventoryType: 'HOLDABLE', weaponType: null }, 'Warrior', 'OFF_HAND')).toEqual(bad("Warrior doesn't use off-hand items."));
    expect(weaponUse({ inventoryType: 'HOLDABLE', weaponType: null }, 'Mage', 'OFF_HAND')).toEqual({ ok: true });
  });

  it('refuses a weapon in the off hand when the class cannot dual wield', () => {
    expect(weaponUse({ inventoryType: 'WEAPON', weaponType: 'dagger' }, 'Druid', 'OFF_HAND')).toEqual(bad("Druid can't dual wield."));
    expect(weaponUse({ inventoryType: 'WEAPONOFFHAND', weaponType: 'fist' }, 'Monk', 'OFF_HAND')).toEqual({ ok: true });
  });

  it('allows an unknown weapon type and an unknown class', () => {
    expect(weaponUse({ inventoryType: 'WEAPON', weaponType: null }, 'Mage', 'MAIN_HAND')).toEqual({ ok: true });
    expect(weaponUse({ inventoryType: 'WEAPON', weaponType: 'axe2h' }, 'Gnome', 'OFF_HAND')).toEqual({ ok: true });
  });
});
