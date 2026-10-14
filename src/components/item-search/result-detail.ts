import { itemKind } from '@/components/shared/item-kind';

/** Armor type and slot, then where the item comes from: "Leather wrist · Den of Nalorakk". */
export function resultDetail(item: { armorType: string | null; inventoryType: string | null; source: string | null }): string {
  const what = itemKind(item);
  return [what, item.source ?? (what === null ? null : 'looked up earlier')].filter(Boolean).join(' · ');
}
