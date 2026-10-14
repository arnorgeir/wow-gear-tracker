const SLOT_NAMES: Record<string, string> = {
  HEAD: 'head', NECK: 'neck', SHOULDER: 'shoulders', CLOAK: 'cloak', CHEST: 'chest', ROBE: 'chest', WRIST: 'wrist', HAND: 'hands',
  WAIST: 'belt', LEGS: 'legs', FEET: 'boots', FINGER: 'ring', TRINKET: 'trinket', WEAPON: 'weapon', TWOHWEAPON: 'two-hand weapon',
  SHIELD: 'shield', HOLDABLE: 'off hand', WEAPONMAINHAND: 'main hand', WEAPONOFFHAND: 'off hand', RANGED: 'ranged', RANGEDRIGHT: 'ranged',
};

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Armor type and slot as one phrase: "Leather wrist", "Trinket". Null when the slot is unknown. */
export function itemKind(item: { armorType: string | null; inventoryType: string | null }): string | null {
  if (item.inventoryType === null) return null;
  const slot = SLOT_NAMES[item.inventoryType] ?? item.inventoryType.toLowerCase().replace(/_/g, ' ');
  return capitalized([item.armorType, slot].filter(Boolean).join(' '));
}
