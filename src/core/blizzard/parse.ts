import { SLOT_TYPES, type ArmorType, type GearItem, type Quality, type SlotType } from '../types';
import type {
  CharacterProfile, ItemInfo, JournalEncounter, JournalInstance, JournalInstanceRef, KeystoneDungeon,
} from './types';

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

const ARMOR_CLASS_ID = 4;
const ARMOR_SUBCLASS: Record<number, ArmorType> = { 1: 'cloth', 2: 'leather', 3: 'mail', 4: 'plate' };

export interface RawItem {
  quality?: { type: string };
  preview_item?: { set?: unknown };
  inventory_type?: { type: string };
  item_class?: { id: number };
  item_subclass?: { id: number };
}

/** Item details plus slot and armor type. Only armor (item class 4) has an armor type. */
export function parseItemInfo(raw: RawItem): ItemInfo {
  return {
    quality: (raw.quality?.type as Quality | undefined) ?? null,
    isTier: Boolean(raw.preview_item?.set),
    inventoryType: raw.inventory_type?.type ?? null,
    armorType: raw.item_class?.id === ARMOR_CLASS_ID ? (ARMOR_SUBCLASS[raw.item_subclass?.id ?? -1] ?? null) : null,
  };
}

export interface RawKeystoneDungeon { name: string; map: { id: number; name: string } }
export const parseKeystoneDungeon = (raw: RawKeystoneDungeon): KeystoneDungeon =>
  ({ name: raw.name, mapId: raw.map.id, mapName: raw.map.name });

export interface RawJournalInstanceIndex { instances?: { id: number; name: string }[] }
export const parseJournalInstanceIndex = (raw: RawJournalInstanceIndex): JournalInstanceRef[] =>
  (raw.instances ?? []).map(({ id, name }) => ({ id, name }));

export interface RawJournalInstance { id: number; name: string; map?: { id: number }; encounters?: { id: number }[] }
export const parseJournalInstance = (raw: RawJournalInstance): JournalInstance =>
  ({ id: raw.id, name: raw.name, mapId: raw.map?.id ?? null, encounterIds: (raw.encounters ?? []).map((e) => e.id) });

export interface RawJournalEncounter { id: number; name: string; items?: { item: { id: number; name: string } }[] }
export const parseJournalEncounter = (raw: RawJournalEncounter): JournalEncounter =>
  ({ id: raw.id, name: raw.name, items: (raw.items ?? []).map((i) => ({ itemId: i.item.id, name: i.item.name })) });
