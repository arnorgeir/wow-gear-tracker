import type { Db } from '@/core/db/client';
import { equippedGear, getLatestSnapshot, type Snapshot, type SnapshotItemInput } from '@/core/db/queries/snapshots';
import { getCharacter, listCharacters, type CharacterRow } from '@/core/db/queries/characters';
import { affordableUpgrade, crestCostsByGroup, summarizeCrests, type CrestBalance, type CrestCost, type UpgradeOption } from '@/core/gear/crests';
import { countStates, evaluateGear, type GearRow } from '@/core/gear/evaluate';
import { methodSpecSlug } from '@/core/method/method';
import { decodeTrack, trackLabel } from '@/core/raidbots/tracks';
import { identityLine } from '@/core/characters/identity';
import { ensureBisLists, ensureClassIcons, ensureItemIcons, ensureTracks, type BisResult } from '@/core/sync/reference-sync';
import {
  LIST_TYPES, type Faction, type GearItem, type ItemState, type ListType, type Quality, type Region, type SlotType, type SnapshotSource, type Track,
} from '@/core/types';
import type { Services } from './services';

export interface ItemView {
  itemId: number;
  name: string;
  itemLevel: number | null;
  quality: Quality;
  bonusIds: number[];
  iconUrl: string | null;
  trackLabel: string | null;
}

export interface GearRowView {
  slotLabel: string;
  slot: SlotType;
  state: ItemState;
  equipped: ItemView | null;
  bis: ItemView & { isTier: boolean; isCatalyst: boolean; source: string };
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
}

interface GearContext {
  current: Snapshot | null;
  simc: Snapshot | null;
  equipped: GearItem[];
  bagItemIds: Set<number>;
  balances: Map<number, number>;
}

async function loadGear(db: Db, characterId: number): Promise<GearContext> {
  const current = await getLatestSnapshot(db, characterId);
  const simc = current?.source === 'simc' ? current : await getLatestSnapshot(db, characterId, 'simc');
  return {
    current,
    simc,
    equipped: current ? equippedGear(current) : [],
    // Bag contents are only known while the current gear comes from a paste.
    bagItemIds: new Set(current?.source === 'simc' ? current.items.filter((i) => i.location === 'bag').map((i) => i.itemId) : []),
    // Crests only come from pastes, so the latest paste's balances stay useful after Blizzard takes over.
    balances: new Map((simc?.currencies ?? []).filter((c) => c.kind === 'upgrade').map((c) => [c.currencyId, c.quantity])),
  };
}

function summarize(c: CharacterRow, snapshot: Snapshot | null, classIcons: ReadonlyMap<string, string | null> = new Map()): CharacterSummary {
  const spec = c.specOverride || c.specName;
  return {
    id: c.id, name: c.name, realmName: c.realmName, region: c.region, className: c.className,
    activeSpec: c.specName, spec, specSlug: methodSpecSlug(spec, c.className),
    status: c.status, lastSyncedAt: c.lastSyncedAt, lastSyncError: c.lastSyncError, priorityList: c.priorityList,
    snapshot: snapshot && { source: snapshot.source, createdAt: snapshot.createdAt },
    sourceAt: !snapshot ? null : snapshot.source === 'simc' ? snapshot.createdAt : c.lastSyncedAt ?? snapshot.createdAt,
    race: c.race,
    faction: c.faction,
    avatarUrl: c.avatarUrl,
    classIconUrl: classIcons.get(c.className) ?? null,
    identity: identityLine(c.race, spec, c.className),
  };
}

/** Only BiS items the character already wears on a track get a flag; crests spent elsewhere are wasted. */
const upgradeFor = (row: GearRow, costs: ReadonlyMap<number, CrestCost>, balances: ReadonlyMap<number, number>) =>
  row.matched && (row.state === 'mythUpgradable' || row.state === 'belowMyth') ? affordableUpgrade(row.track, costs, balances) : null;

const crestView = (gear: GearContext, costs: ReadonlyMap<number, CrestCost>): CrestView | null =>
  gear.simc ? { balances: summarizeCrests(gear.balances, costs), pastedAt: gear.simc.createdAt } : null;

const bisCount = (rows: GearRow[]) => rows.filter((r) => r.matched).length;

export async function getCharacterCards(services: Services): Promise<CharacterCardView[]> {
  const { db, blizzard, bisSource, fetchRaidbots, now } = services;
  const time = now();
  const { tracks, error: tracksError } = await ensureTracks({ db, fetchRaidbots, now: time });
  const costs = crestCostsByGroup(tracks.values());
  const characters = await listCharacters(db);
  const classIcons = await ensureClassIcons({ db, blizzard, now: time }, characters[0]?.region ?? 'eu');
  const bisBySlug = new Map<string, Promise<BisResult>>();
  return Promise.all(characters.map(async (c) => {
    const gear = await loadGear(db, c.id);
    const summary = summarize(c, gear.current, classIcons);
    if (!bisBySlug.has(summary.specSlug)) bisBySlug.set(summary.specSlug, ensureBisLists({ db, source: bisSource, now: time }, summary.specSlug));
    const bis = await bisBySlug.get(summary.specSlug)!;
    const bisRows = bis.lists?.[c.priorityList] ?? [];
    const rows = evaluateGear({ equipped: gear.equipped, bisRows, tracks, bagItemIds: gear.bagItemIds });
    return {
      ...summary,
      counts: bis.lists ? countStates(rows) : null,
      total: rows.length,
      bisError: bis.error,
      tracksError,
      crests: crestView(gear, costs),
      upgradesReady: rows.filter((r) => upgradeFor(r, costs, gear.balances)).length,
    };
  }));
}

function itemView(
  item: { itemId: number; name: string; itemLevel: number | null; quality: Quality; bonusIds: number[] },
  icons: ReadonlyMap<number, string | null>, track: Track | null,
): ItemView {
  return {
    itemId: item.itemId,
    name: item.name,
    itemLevel: item.itemLevel,
    quality: item.quality,
    bonusIds: item.bonusIds,
    iconUrl: icons.get(item.itemId) ?? null,
    trackLabel: track ? trackLabel(track) : null,
  };
}

export async function getCharacterPage(services: Services, id: number, listType?: ListType): Promise<CharacterPageView | null> {
  const { db, blizzard, bisSource, fetchRaidbots, now } = services;
  const character = await getCharacter(db, id);
  if (!character) return null;
  const time = now();
  const gear = await loadGear(db, id);
  const summary = summarize(character, gear.current);
  const list = listType ?? character.priorityList;

  const specsPromise = blizzard.getClasses(character.region)
    .then((classes) => classes.find((cls) => cls.name === character.className)?.specs ?? [summary.spec])
    .catch(() => [summary.spec]);
  // Database work runs in sequence: an in-memory libsql database can't serve a read while a write transaction is open.
  const { tracks, error: tracksError } = await ensureTracks({ db, fetchRaidbots, now: time });
  const bis = await ensureBisLists({ db, source: bisSource, now: time }, summary.specSlug);
  const specs = await specsPromise;
  const classIcons = await ensureClassIcons({ db, blizzard, now: time }, character.region);
  const costs = crestCostsByGroup(tracks.values());

  const evaluate = (l: ListType) => evaluateGear({ equipped: gear.equipped, bisRows: bis.lists?.[l] ?? [], tracks, bagItemIds: gear.bagItemIds });
  const gearRows = evaluate(list);
  const vaultItems = gear.simc?.items.filter((i) => i.location === 'vault') ?? [];

  const iconIds = [...gear.equipped.map((g) => g.itemId), ...gearRows.map((r) => r.row.itemId), ...vaultItems.map((i) => i.itemId)];
  const icons = await ensureItemIcons({ db, blizzard, now: time }, character.region, iconIds);

  const rows: GearRowView[] = gearRows.map((r) => ({
    slotLabel: r.row.slotLabel,
    slot: r.slot,
    state: r.state,
    equipped: r.equipped && itemView(r.equipped, icons, r.track),
    bis: {
      ...itemView({ itemId: r.row.itemId, name: r.row.name, itemLevel: null, quality: 'EPIC', bonusIds: r.row.bonusIds }, icons, null),
      isTier: r.row.isTier,
      isCatalyst: r.row.isCatalyst,
      source: r.row.source,
    },
    upgrade: upgradeFor(r, costs, gear.balances),
  }));

  const listRows = bis.lists?.[list] ?? [];
  const isBis = (item: SnapshotItemInput) =>
    listRows.some((r) => r.itemId === item.itemId || (r.isTier && item.isTier && r.slots.includes(item.slot as SlotType)));
  const vaultChoices = vaultItems.map((item) => ({ ...itemView(item, icons, decodeTrack(item.bonusIds, tracks)), isBis: isBis(item) }));

  const counts = Object.fromEntries(LIST_TYPES.map((l) => {
    const evaluated = l === list ? gearRows : evaluate(l);
    return [l, { bis: bisCount(evaluated), total: evaluated.length }];
  })) as Record<ListType, { bis: number; total: number }>;

  return {
    ...summary,
    classIconUrl: classIcons.get(character.className) ?? null,
    listType: list,
    rows,
    vault: rows.filter((r) => r.state === 'belowMyth'),
    vaultChoices,
    vaultChoicesAt: gear.simc?.createdAt ?? null,
    crests: crestView(gear, costs),
    counts,
    bisFetchedAt: bis.fetchedAt,
    bisError: bis.error,
    tracksError,
    specs,
  };
}
