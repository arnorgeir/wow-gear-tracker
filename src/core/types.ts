export type Region = 'eu' | 'us' | 'kr' | 'tw';
export const REGIONS: readonly Region[] = ['eu', 'us', 'kr', 'tw'];

export const SLOT_TYPES = [
  'HEAD', 'NECK', 'SHOULDER', 'BACK', 'CHEST', 'WRIST', 'HANDS', 'WAIST', 'LEGS', 'FEET',
  'FINGER_1', 'FINGER_2', 'TRINKET_1', 'TRINKET_2', 'MAIN_HAND', 'OFF_HAND',
] as const;
export type SlotType = (typeof SLOT_TYPES)[number];

export type Quality = 'POOR' | 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'ARTIFACT' | 'HEIRLOOM';

export type ArmorType = 'cloth' | 'leather' | 'mail' | 'plate';

export type ListType = 'overall' | 'raid' | 'mythicPlus';
export const LIST_TYPES: readonly ListType[] = ['overall', 'raid', 'mythicPlus'];

export type ItemLocation = 'equipped' | 'bag' | 'vault';
export type SnapshotSource = 'blizzard' | 'simc';
export type Faction = 'HORDE' | 'ALLIANCE';

export interface GearItem {
  slot: SlotType;
  itemId: number;
  name: string;
  itemLevel: number | null;
  quality: Quality;
  bonusIds: number[];
  isTier: boolean;
  /** Secondary stat types, sorted. Null or absent when unknown, as for SimC items. */
  secondaryStats?: string[] | null;
}

interface BisRowBase { slotLabel: string; slots: SlotType[]; source: string }
export interface BisItemRow extends BisRowBase {
  kind: 'item'; itemId: number; name: string; bonusIds: number[]; isTier: boolean; isCatalyst: boolean;
  /** Set when an account override replaced Method's row; holds Method's row for display. */
  edited?: { methodPick: BisRow };
}
export interface BisAnyRow extends BisRowBase { kind: 'any'; minItemLevel: number }
export type BisRow = BisItemRow | BisAnyRow;

export type BisLists = Record<ListType, BisRow[]>;

export interface BisOverride { slotKey: string; itemId: number; catalyst: boolean }
export interface CatalogItem { itemId: number; name: string; inventoryType: string | null; armorType: ArmorType | null; quality: Quality | null; isTier: boolean }
export type BisSourceId = 'method' | 'icyVeins' | 'manual';
export type FetchedSourceId = Exclude<BisSourceId, 'manual'>;
export const FETCHED_SOURCES: readonly FetchedSourceId[] = ['method', 'icyVeins'];
/** The one place a source's display name lives: sources, views and components all read it. */
export const SOURCE_NAMES: Record<BisSourceId, string> = { method: 'Method', icyVeins: 'Icy Veins', manual: 'Manual' };
// Icy Veins' Cloudflare challenges our fetch, so it is not offered until the site agrees to it. Its code stays.
export const OFFERED_SOURCES: readonly BisSourceId[] = ['method', 'manual'];
export const isOfferedSource = (v: unknown): v is BisSourceId => (OFFERED_SOURCES as readonly unknown[]).includes(v);
export const isBisSourceId = (v: unknown): v is BisSourceId => typeof v === 'string' && Object.hasOwn(SOURCE_NAMES, v);
export interface SpecSettings { source: BisSourceId; listType: ListType; statsMatter: boolean }
export const LOCAL_ACCOUNT_ID = 1;

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
  /** Wowhead's icon name for the crest currency, such as `inv_121_crest_myth`. Absent or null when unknown. */
  currencyIcon?: string | null;
  costPerStep: number | null;
}

export type ItemState = 'missing' | 'inBags' | 'wrongStats' | 'belowMyth' | 'mythUpgradable' | 'done';
export const ITEM_STATES: readonly ItemState[] = ['done', 'mythUpgradable', 'wrongStats', 'belowMyth', 'inBags', 'missing'];

export type StatMatch = 'same' | 'different' | 'unknown';
/** A tier row's Method item: its secondary stat pair, and whether it is the tier piece itself (bought with a tier token). */
export interface TierTarget { secondaryStats: string[] | null; isTier: boolean }

export interface LootItem { itemId: number; name: string; inventoryType: string | null; armorType: ArmorType | null; secondaryStats?: string[] | null }
/** One season dungeon and what it drops. `split` marks half of a dungeon credited with the whole instance's loot. */
export interface SeasonLoot { challengeModeId: number; name: string; shortName: string; imageUrl: string | null; split: boolean; loot: LootItem[] }
