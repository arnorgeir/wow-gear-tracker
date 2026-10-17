import type { CanUse } from '../bis/class-can-use';
import type { SlotType, WeaponType } from '../types';
import { slotsForInventoryType } from './slots';

interface ClassWeapons { weapons: ReadonlySet<WeaponType>; shield: boolean; holdable: boolean; dualWield: boolean }

const cls = (weapons: WeaponType[], shield: boolean, holdable: boolean, dualWield: boolean): ClassWeapons =>
  ({ weapons: new Set(weapons), shield, holdable, dualWield });

// Weapons, shields and dual wield follow the game's proficiencies. "holdable" is a usage rule: only these classes list one.
export const CLASS_WEAPONS: Record<string, ClassWeapons> = {
  'Death Knight': cls(['axe1h', 'axe2h', 'mace1h', 'mace2h', 'polearm', 'sword1h', 'sword2h'], false, false, true),
  'Demon Hunter': cls(['warglaive', 'axe1h', 'fist', 'sword1h'], false, false, true),
  Druid: cls(['dagger', 'fist', 'mace1h', 'mace2h', 'polearm', 'staff'], false, true, false),
  Evoker: cls(['axe1h', 'axe2h', 'dagger', 'fist', 'mace1h', 'mace2h', 'sword1h', 'sword2h', 'staff'], false, true, false),
  Hunter: cls(['axe1h', 'axe2h', 'bow', 'crossbow', 'dagger', 'fist', 'gun', 'polearm', 'staff', 'sword1h', 'sword2h'], false, false, false),
  Mage: cls(['dagger', 'sword1h', 'staff', 'wand'], false, true, false),
  Monk: cls(['axe1h', 'fist', 'mace1h', 'polearm', 'staff', 'sword1h'], false, true, true),
  Paladin: cls(['axe1h', 'axe2h', 'mace1h', 'mace2h', 'polearm', 'sword1h', 'sword2h'], true, true, false),
  Priest: cls(['dagger', 'mace1h', 'staff', 'wand'], false, true, false),
  Rogue: cls(['axe1h', 'dagger', 'fist', 'mace1h', 'sword1h'], false, false, true),
  Shaman: cls(['axe1h', 'axe2h', 'dagger', 'fist', 'mace1h', 'mace2h', 'staff'], true, true, true),
  Warlock: cls(['dagger', 'staff', 'sword1h', 'wand'], false, true, false),
  Warrior: cls(['axe1h', 'axe2h', 'dagger', 'fist', 'mace1h', 'mace2h', 'polearm', 'staff', 'sword1h', 'sword2h'], true, false, true),
};

export const WEAPON_WORDS: Record<WeaponType, string> = {
  axe1h: 'one-handed axes', axe2h: 'two-handed axes', bow: 'bows', gun: 'guns', mace1h: 'one-handed maces', mace2h: 'two-handed maces',
  polearm: 'polearms', sword1h: 'one-handed swords', sword2h: 'two-handed swords', warglaive: 'warglaives', staff: 'staves',
  fist: 'fist weapons', dagger: 'daggers', crossbow: 'crossbows', wand: 'wands',
};

/** weaponUse for the hand slot an item fills among a row's slots; anything not filling a hand slot passes. */
export function weaponUseIn(item: { inventoryType: string | null; weaponType?: WeaponType | null }, className: string, slots: readonly SlotType[]): CanUse {
  const hand = slotsForInventoryType(item.inventoryType).find((s): s is 'MAIN_HAND' | 'OFF_HAND' => (s === 'MAIN_HAND' || s === 'OFF_HAND') && slots.includes(s));
  return hand ? weaponUse({ inventoryType: item.inventoryType, weaponType: item.weaponType ?? null }, className, hand) : { ok: true };
}

/** Whether a class uses a weapon or off-hand item in a hand slot. Unknown weapon types and classes pass. */
export function weaponUse(item: { inventoryType: string | null; weaponType: WeaponType | null }, className: string, slot: 'MAIN_HAND' | 'OFF_HAND'): CanUse {
  const c = CLASS_WEAPONS[className];
  if (!c) return { ok: true };
  if (item.weaponType !== null && !c.weapons.has(item.weaponType)) return { ok: false, reason: `${className} can't use ${WEAPON_WORDS[item.weaponType]}.` };
  if (item.inventoryType === 'SHIELD' && !c.shield) return { ok: false, reason: `${className} can't use shields.` };
  if (item.inventoryType === 'HOLDABLE' && !c.holdable) return { ok: false, reason: `${className} doesn't use off-hand items.` };
  if (slot === 'OFF_HAND' && (item.inventoryType === 'WEAPON' || item.inventoryType === 'WEAPONOFFHAND') && !c.dualWield) {
    return { ok: false, reason: `${className} can't dual wield.` };
  }
  return { ok: true };
}
