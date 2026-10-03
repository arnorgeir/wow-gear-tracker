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

export type GroupMemberState = 'untracked' | 'notFound' | 'syncing' | 'noGear' | 'ready';
export interface GroupMemberView {
  /** The formatted member key, as in the URL. */
  key: string;
  /** The character's name, or the key's folded name when it isn't tracked here. */
  name: string;
  realmSlug: string;
  character: CharacterSummary | null;
  state: GroupMemberState;
  syncError: string | null;
  bisError: string | null;
  /** Ready but without rows: no BiS list to compare against. */
  hasRows: boolean;
  listType: 'mythicPlus' | 'overall';
  fellBack: boolean;
  crests: CrestView | null;
}
export interface GroupGridRow { slot: SlotType; label: string; cells: (GearRowView | null)[] }
export interface GroupMemberCreditsView { key: string; name: string; className: string; avatarUrl: string | null; classIconUrl: string | null; credits: PriorityCreditView[] }
export interface GroupDungeonView { challengeModeId: number; name: string; score: number; split: boolean; members: GroupMemberCreditsView[] }
export interface GroupPriorityView {
  season: 'loading' | 'failed' | 'ready' | 'stale';
  approximate: boolean;
  covered: string[];
  excluded: { name: string; reason: string }[];
  fellBack: string[];
  /** Null when no member is eligible: the ranking is unavailable, which is not the same as nothing needed. */
  ranking: { dungeons: GroupDungeonView[]; nothingFrom: string[] } | null;
}
export interface GroupVaultView { key: string; name: string; pastedAt: number | null; choices: VaultChoiceView[] }
export interface GroupPageView {
  region: Region | null;
  keys: string[];
  members: GroupMemberView[];
  grid: GroupGridRow[];
  tracksKnown: boolean;
  priority: GroupPriorityView;
  needsSeasonSync: boolean;
  vault: GroupVaultView[];
  dropped: { name: string; region: Region }[];
  available: { key: string; label: string }[];
  tracked: { region: Region; realmId: number; name: string }[];
  staleIds: number[];
}
