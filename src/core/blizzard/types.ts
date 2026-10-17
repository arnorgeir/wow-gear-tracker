import type { ArmorType, WeaponType, Faction, JournalSection, Quality, Region } from '../types';

export interface CharacterRef { region: Region; realmSlug: string; name: string }
export interface CharacterProfile {
  name: string;
  realmId: number;
  realmSlug: string;
  realmName: string;
  className: string;
  specName: string;
  raceName: string;
  faction: Faction | null;
}
export interface Realm { id: number; name: string; slug: string }
/** `specIds` runs parallel to `specs`: the specialization IDs the media API is keyed by. */
export interface PlayableClass { id: number; name: string; specs: string[]; specIds: number[] }

export interface ItemDetails { quality: Quality | null; isTier: boolean }

export interface ItemInfo extends ItemDetails { name: string | null; inventoryType: string | null; armorType: ArmorType | null; weaponType: WeaponType | null; secondaryStats: string[] | null }
export interface KeystoneDungeon { name: string; mapId: number; mapName: string }
export interface JournalInstanceRef { id: number; name: string }
export interface JournalInstance { id: number; name: string; mapId: number | null; encounterIds: number[] }
export interface JournalEncounter { id: number; name: string; description: string | null; sections: JournalSection[]; items: { itemId: number; name: string }[] }
