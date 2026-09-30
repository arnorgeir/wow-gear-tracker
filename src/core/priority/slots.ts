import type { ArmorType, SlotType } from '../types';

/** Slots where armor type decides who can wear an item. Cloaks are cloth for everyone, so BACK is not one. */
export const ARMOR_SLOTS: ReadonlySet<SlotType> = new Set<SlotType>(['HEAD', 'SHOULDER', 'CHEST', 'WRIST', 'HANDS', 'WAIST', 'LEGS', 'FEET']);

const BY_INVENTORY_TYPE: Record<string, SlotType[]> = {
  HEAD: ['HEAD'], NECK: ['NECK'], SHOULDER: ['SHOULDER'], CLOAK: ['BACK'], CHEST: ['CHEST'], ROBE: ['CHEST'],
  WRIST: ['WRIST'], HAND: ['HANDS'], WAIST: ['WAIST'], LEGS: ['LEGS'], FEET: ['FEET'],
  FINGER: ['FINGER_1', 'FINGER_2'], TRINKET: ['TRINKET_1', 'TRINKET_2'],
  WEAPON: ['MAIN_HAND', 'OFF_HAND'], WEAPONMAINHAND: ['MAIN_HAND'], TWOHWEAPON: ['MAIN_HAND'], RANGED: ['MAIN_HAND'], RANGEDRIGHT: ['MAIN_HAND'],
  WEAPONOFFHAND: ['OFF_HAND'], SHIELD: ['OFF_HAND'], HOLDABLE: ['OFF_HAND'],
};

/** The slots an item of this Blizzard inventory type fits. Shirts, tabards and unknown types fit none. */
export const slotsForInventoryType = (inventoryType: string | null): SlotType[] =>
  (inventoryType && BY_INVENTORY_TYPE[inventoryType]) || [];

const ARMOR_BY_CLASS: Record<string, ArmorType> = {
  Mage: 'cloth', Priest: 'cloth', Warlock: 'cloth',
  'Demon Hunter': 'leather', Druid: 'leather', Monk: 'leather', Rogue: 'leather',
  Evoker: 'mail', Hunter: 'mail', Shaman: 'mail',
  'Death Knight': 'plate', Paladin: 'plate', Warrior: 'plate',
};

export const armorTypeForClass = (className: string): ArmorType | null => ARMOR_BY_CLASS[className] ?? null;
