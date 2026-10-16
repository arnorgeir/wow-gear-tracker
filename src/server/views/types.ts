import type { TierFit } from '@/core/priority/rank';
import { type CrestBalance, type UpgradeOption } from '@/core/gear/crests';
import { type BisSourceId, type FetchedSourceId, type Faction, type ArmorType, type ItemState, type ListType, type Quality, type Region, type SlotType, type SnapshotSource } from '@/core/types';

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
  | (ItemView & { kind: 'item'; isTier: boolean; isCatalyst: boolean; source: string; targetStats: string[] | null; targetIsTierPiece: boolean })
  | { kind: 'any'; minItemLevel: number; source: string };

export interface GearRowView {
  slotLabel: string;
  slot: SlotType;
  state: ItemState;
  equipped: ItemView | null;
  /** The equipped item's secondary stat types; null when unknown. */
  equippedStats: string[] | null;
  /** A tier piece whose stats could not be checked against the target's. */
  statsUnverified: boolean;
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
  /** The character page's path, for example `/characters/eu/tarren-mill/rust%C3%BD`. */
  href: string;
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
  /** Equipped item level cut to one decimal, from the current snapshot; null without gear or with an unknown item level. */
  itemLevel: number | null;
}

export interface CharacterCardView extends CharacterSummary {
  /** The list the card's counts come from: the spec's choice, or Overall after a fallback. */
  listType: ListType;
  counts: Record<ItemState, number> | null;
  tracksError: string | null;
  /** False until Raidbots data is stored: states that depend on upgrade tracks can't be told apart. */
  tracksKnown: boolean;
  tracksLoading: boolean;
  total: number;
  bisError: string | null;
  crests: CrestView | null;
  upgradesReady: number;
}

export type PriorityCreditView =
  | { kind: 'item'; slotLabel: string; weight: number; item: ItemView }
  | { kind: 'tier'; slotLabel: string; weight: number; fit: TierFit; item: ItemView; dropStats: string[] | null; targetName: string; targetStats: string[] | null }
  | { kind: 'any'; slotLabel: string; weight: number; minItemLevel: number };
export interface DungeonPriorityView { challengeModeId: number; name: string; shortName: string; imageUrl: string | null; score: number; split: boolean; credits: PriorityCreditView[] }
export interface PriorityView {
  listType: ListType;
  /** The list the spec asked for when its source has none and Overall is ranked instead; otherwise null. */
  fellBackFrom: ListType | null;
  /** Where the spec's list comes from, for the fallback notice. */
  source: BisSourceId;
  season: 'loading' | 'failed' | 'ready' | 'stale';
  needsSync: boolean;
  bisLoading: boolean;
  approximate: boolean;
  dungeons: DungeonPriorityView[];
  nothingFrom: { challengeModeId: number; name: string }[];
}

export interface CharacterPageView extends CharacterSummary {
  listType: ListType;
  rows: GearRowView[];
  vault: GearRowView[];
  vaultChoices: VaultChoiceView[];
  vaultChoicesAt: number | null;
  crests: CrestView | null;
  /** Rows an account override replaced on this spec's lists. */
  editedCount: number;
  /** Rows in the compared list that are done, out of `rows.length`. */
  doneCount: number;
  /** The list the spec asked for when its source has none and Overall is shown instead; otherwise null. */
  fellBackFrom: ListType | null;
  /** Where the compared list comes from. */
  bisSource: BisSourceId;
  /** The spec's icon, else the class icon. */
  specIconUrl: string | null;
  bisFetchedAt: number | null;
  bisError: string | null;
  bisLoading: boolean;
  tracksError: string | null;
  tracksKnown: boolean;
  tracksLoading: boolean;
  referenceDue: string | null;
  specs: string[];
  priority: PriorityView;
}

/** A character path that names no tracked character. `name` is the path's folded name. */
export interface UntrackedCharacterView { status: 'untracked'; region: Region; realmSlug: string; name: string }

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
  bisLoading: boolean;
  /** Ready but without rows: no BiS list to compare against. */
  hasRows: boolean;
  listType: ListType;
  fellBack: boolean;
  source: BisSourceId;
  crests: CrestView | null;
}
export interface GroupGridRow { slot: SlotType; label: string; cells: (GearRowView | null)[] }
export interface GroupMemberCreditsView { key: string; name: string; className: string; avatarUrl: string | null; classIconUrl: string | null; credits: PriorityCreditView[] }
export interface GroupDungeonView { challengeModeId: number; name: string; shortName: string; imageUrl: string | null; score: number; split: boolean; members: GroupMemberCreditsView[] }
export interface GroupPriorityView {
  season: 'loading' | 'failed' | 'ready' | 'stale';
  approximate: boolean;
  covered: string[];
  excluded: { name: string; reason: string }[];
  /** Members ranked on Overall because their spec's source has no rows for the list it chose. */
  fellBack: { name: string; from: ListType; source: BisSourceId }[];
  /** Null when no member is eligible: the ranking is unavailable, which is not the same as nothing needed. */
  ranking: { dungeons: GroupDungeonView[]; nothingFrom: { challengeModeId: number; name: string }[] } | null;
}
export interface GroupVaultView { key: string; name: string; className: string; avatarUrl: string | null; classIconUrl: string | null; pastedAt: number | null; choices: VaultChoiceView[] }
export interface GroupPageView {
  region: Region | null;
  keys: string[];
  members: GroupMemberView[];
  grid: GroupGridRow[];
  tracksKnown: boolean;
  tracksLoading: boolean;
  priority: GroupPriorityView;
  needsSeasonSync: boolean;
  referenceDue: string | null;
  vault: GroupVaultView[];
  dropped: { name: string; region: Region }[];
  available: { key: string; label: string }[];
  tracked: { region: Region; realmId: number; name: string }[];
  staleIds: number[];
}

export type SpecFetchState = { kind: 'tracked' } | { kind: 'manual' } | { kind: 'notFetched' } | { kind: 'fetched'; at: number } | { kind: 'failed' };

/** A tracked character, as a chip or portrait that links to its page. */
export interface CharacterChipView { name: string; href: string; className: string; avatarUrl: string | null; classIconUrl: string | null }

export interface PickerSpecView {
  slug: string;
  specName: string;
  /** The spec's icon, or its class icon when Blizzard gave none. */
  iconUrl: string | null;
  tracked: boolean;
  state: SpecFetchState;
  characters: CharacterChipView[];
  /** The list this spec compares against; only shown for a tracked spec. */
  compares: ListType;
  source: BisSourceId;
}

export interface SpecPickerView {
  /** One card per tracked spec. */
  tracked: (PickerSpecView & { className: string; editedCount: number })[];
  classes: { className: string; iconUrl: string | null; trackedCount: number; specs: PickerSpecView[] }[];
}

export interface SettingsSlotView {
  slotKey: string;
  slotLabel: string;
  /** The source's own pick for the slot. */
  method: BisView;
  override: (ItemView & { catalyst: boolean }) | null;
  /** Whether the catalyst can turn an item here into a tier piece. */
  tierSlot: boolean;
}

export interface SettingsSpecView {
  slug: string;
  className: string;
  specName: string;
  /** The list the account compares against. */
  listType: ListType;
  statsMatter: boolean;
  /** The list the editor shows. */
  editing: ListType;
  hasLists: boolean;
  fetchState: SpecFetchState;
  /** Where the spec's list comes from. */
  source: BisSourceId;
  /** When the fetched source's lists were last stored, whether or not the spec is tracked. Null on Manual. */
  fetchedAt: number | null;
  /** On Manual: the source the copy came from, and when. */
  copiedFrom: FetchedSourceId | null;
  copiedAt: number | null;
  iconUrl: string | null;
  classIconUrl: string | null;
  characters: CharacterChipView[];
  lists: Record<ListType, { slots: SettingsSlotView[]; orphans: (ItemView & { slotKey: string })[]; editedCount: number }>;
}

export interface DungeonLootItemView {
  itemId: number;
  name: string;
  quality: Quality;
  iconUrl: string | null;
  inventoryType: string | null;
  armorType: ArmorType | null;
  /** Secondary stat types; null when unknown or the item has none. */
  stats: string[] | null;
}
export interface DungeonBossView { encounterId: number; name: string; items: DungeonLootItemView[] }
export interface DungeonPageView {
  challengeModeId: number;
  name: string;
  shortName: string;
  imageUrl: string | null;
  split: boolean;
  bosses: DungeonBossView[];
}
