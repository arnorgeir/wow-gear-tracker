import { type CrestBalance, type UpgradeOption } from '@/core/gear/crests';
import { type Faction, type ItemState, type ListType, type Quality, type Region, type SlotType, type SnapshotSource } from '@/core/types';

export interface ItemView {
  itemId: number;
  name: string;
  itemLevel: number | null;
  quality: Quality;
  bonusIds: number[];
  iconUrl: string | null;
  trackLabel: string | null;
}

export type BisView =
  | (ItemView & { kind: 'item'; isTier: boolean; isCatalyst: boolean; source: string })
  | { kind: 'any'; minItemLevel: number; source: string };

export interface GearRowView {
  slotLabel: string;
  slot: SlotType;
  state: ItemState;
  equipped: ItemView | null;
  bis: BisView;
  upgrade: UpgradeOption | null;
}

export interface VaultChoiceView extends ItemView {
  isBis: boolean;
}

export interface CrestView {
  balances: CrestBalance[];
  pastedAt: number;
}

export interface CharacterSummary {
  id: number;
  name: string;
  realmName: string;
  realmId: number;
  region: Region;
  className: string;
  activeSpec: string;
  spec: string;
  specSlug: string;
  status: 'ok' | 'notFound';
  lastSyncedAt: number | null;
  lastSyncError: string | null;
  priorityList: 'mythicPlus' | 'overall';
  snapshot: { source: SnapshotSource; createdAt: number } | null;
  /** When the current gear was captured: the paste time for SimC, the last sync for Blizzard. */
  sourceAt: number | null;
  race: string | null;
  faction: Faction | null;
  avatarUrl: string | null;
  /** Fallback when there's no avatar. */
  classIconUrl: string | null;
  /** Race, spec and class, for example "Troll Guardian Druid". */
  identity: string;
}

export interface CharacterCardView extends CharacterSummary {
  counts: Record<ItemState, number> | null;
  tracksError: string | null;
  total: number;
  bisError: string | null;
  crests: CrestView | null;
  upgradesReady: number;
}

export type PriorityCreditView =
  | { kind: 'item'; slotLabel: string; weight: number; item: ItemView }
  | { kind: 'tier'; slotLabel: string; weight: number }
  | { kind: 'any'; slotLabel: string; weight: number; minItemLevel: number };
export interface DungeonPriorityView { challengeModeId: number; name: string; score: number; split: boolean; credits: PriorityCreditView[] }
export interface PriorityView {
  listType: 'mythicPlus' | 'overall';
  fellBack: boolean;
  season: 'loading' | 'failed' | 'ready' | 'stale';
  needsSync: boolean;
  approximate: boolean;
  dungeons: DungeonPriorityView[];
  nothingFrom: string[];
}

export interface CharacterPageView extends CharacterSummary {
  listType: ListType;
  rows: GearRowView[];
  vault: GearRowView[];
  vaultChoices: VaultChoiceView[];
  vaultChoicesAt: number | null;
  crests: CrestView | null;
  counts: Record<ListType, { bis: number; total: number }>;
  bisFetchedAt: number | null;
  bisError: string | null;
  tracksError: string | null;
  specs: string[];
  priority: PriorityView;
}
