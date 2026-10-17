import { ARMOR_SLOTS, TIER_SLOTS, armorTypeForClass, slotsForInventoryType } from '../priority/slots';
import { weaponUseIn } from '../priority/weapons';
import type { BisRow, CatalogItem, SlotType, WeaponType } from '../types';

export type CanUse = { ok: true } | { ok: false; reason: string };

/** Whether a class can use an item in a row's slots. Armor type counts only in armor slots, so cloaks fit everyone. */
export function classCanUse(item: Pick<CatalogItem, 'inventoryType' | 'armorType'> & { weaponType?: WeaponType | null }, className: string, row: Pick<BisRow, 'slotLabel' | 'slots'>): CanUse {
  if (!slotsForInventoryType(item.inventoryType).some((s) => row.slots.includes(s))) {
    return { ok: false, reason: `That item doesn't fit the ${row.slotLabel} slot.` };
  }
  const armorSlot = row.slots.some((s) => ARMOR_SLOTS.has(s));
  if (armorSlot && item.armorType !== null && item.armorType !== armorTypeForClass(className)) {
    return { ok: false, reason: `${className} can't wear ${item.armorType}.` };
  }
  return weaponUseIn(item, className, row.slots);
}

export const canCatalyst = (item: Pick<CatalogItem, 'isTier'>, slots: readonly SlotType[]): boolean =>
  !item.isTier && slots.some((s) => TIER_SLOTS.has(s));
