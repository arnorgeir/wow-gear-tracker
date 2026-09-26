export type Region = 'eu' | 'us' | 'kr' | 'tw';
export const REGIONS: readonly Region[] = ['eu', 'us', 'kr', 'tw'];

export const SLOT_TYPES = [
  'HEAD', 'NECK', 'SHOULDER', 'BACK', 'CHEST', 'WRIST', 'HANDS', 'WAIST', 'LEGS', 'FEET',
  'FINGER_1', 'FINGER_2', 'TRINKET_1', 'TRINKET_2', 'MAIN_HAND', 'OFF_HAND',
] as const;
export type SlotType = (typeof SLOT_TYPES)[number];

export type Quality = 'POOR' | 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'ARTIFACT' | 'HEIRLOOM';

export type ListType = 'overall' | 'raid' | 'mythicPlus';
export const LIST_TYPES: readonly ListType[] = ['overall', 'raid', 'mythicPlus'];

export type ItemLocation = 'equipped' | 'bag' | 'vault';
export type SnapshotSource = 'blizzard' | 'simc';

export interface GearItem {
  slot: SlotType;
  itemId: number;
  name: string;
  itemLevel: number | null;
  quality: Quality;
  bonusIds: number[];
  isTier: boolean;
}

export interface BisRow {
  slotLabel: string;
  slots: SlotType[];
  itemId: number;
  name: string;
  bonusIds: number[];
  isTier: boolean;
  isCatalyst: boolean;
  source: string;
}

export type BisLists = Record<ListType, BisRow[]>;

export interface BisSource {
  name: string;
  fetchLists(specSlug: string): Promise<BisLists>;
}

export interface Track {
  bonusId: number;
  name: string;
  step: number;
  max: number;
  /** Raidbots upgrade group, unique per track per season. Upgrade costs are keyed by it. */
  group: number | null;
  currencyId: number | null;
  currencyName: string | null;
  costPerStep: number | null;
}

export type ItemState = 'missing' | 'inBags' | 'belowMyth' | 'mythUpgradable' | 'done';
export const ITEM_STATES: readonly ItemState[] = ['done', 'mythUpgradable', 'belowMyth', 'inBags', 'missing'];
