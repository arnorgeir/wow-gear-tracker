import type { Faction, Quality, Region } from '../types';

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
export interface PlayableClass { id: number; name: string; specs: string[] }

export interface ItemDetails { quality: Quality | null; isTier: boolean }
