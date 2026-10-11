const SLOT_NAMES: Record<string, string> = {
  HEAD: 'head', NECK: 'neck', SHOULDER: 'shoulders', CLOAK: 'cloak', CHEST: 'chest', ROBE: 'chest', WRIST: 'wrist', HAND: 'hands',
  WAIST: 'belt', LEGS: 'legs', FEET: 'boots', FINGER: 'ring', TRINKET: 'trinket', WEAPON: 'weapon', TWOHWEAPON: 'two-hand weapon',
  SHIELD: 'shield', HOLDABLE: 'off hand', WEAPONMAINHAND: 'main hand', WEAPONOFFHAND: 'off hand', RANGED: 'ranged', RANGEDRIGHT: 'ranged',
};

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Armor type and slot, then where the item comes from: "Leather wrist · Den of Nalorakk". */
export function resultDetail(item: { armorType: string | null; inventoryType: string | null; source: string | null }): string {
  const slot = item.inventoryType === null ? null : SLOT_NAMES[item.inventoryType] ?? item.inventoryType.toLowerCase().replace(/_/g, ' ');
  const what = slot === null ? null : capitalized([item.armorType, slot].filter(Boolean).join(' '));
  return [what, item.source ?? (what === null ? null : 'looked up earlier')].filter(Boolean).join(' · ');
}
