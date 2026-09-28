import { SLOT_TYPES, type GearItem, type Quality, type SlotType } from '../types';
import type { CharacterProfile } from './types';

export interface RawEquipment {
  equipped_items?: {
    slot: { type: string };
    item: { id: number };
    name: string;
    level?: { value: number };
    quality?: { type: string };
    bonus_list?: number[];
    set?: unknown;
  }[];
}

export interface RawProfile {
  name: string;
  realm: { id: number; name: string; slug: string };
  character_class: { name: string };
  active_spec?: { name: string };
  race?: { name: string };
  faction?: { type: string };
}

const GEAR_SLOTS = new Set<string>(SLOT_TYPES);

export function parseProfile(raw: RawProfile): CharacterProfile {
  return {
    name: raw.name,
    realmId: raw.realm.id,
    realmSlug: raw.realm.slug,
    realmName: raw.realm.name,
    className: raw.character_class.name,
    specName: raw.active_spec?.name ?? '',
    raceName: raw.race?.name ?? '',
    faction: raw.faction?.type === 'HORDE' || raw.faction?.type === 'ALLIANCE' ? raw.faction.type : null,
  };
}

/** Equipped gear in the slots this app compares; tabards and shirts are cosmetic and dropped. */
export function parseEquipment(raw: RawEquipment): GearItem[] {
  return (raw.equipped_items ?? [])
    .filter((item) => GEAR_SLOTS.has(item.slot.type))
    .map((item) => ({
      slot: item.slot.type as SlotType,
      itemId: item.item.id,
      name: item.name,
      itemLevel: item.level?.value ?? null,
      quality: (item.quality?.type ?? 'COMMON') as Quality,
      bonusIds: item.bonus_list ?? [],
      isTier: Boolean(item.set),
    }));
}
