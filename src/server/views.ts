import { countStates, evaluateGear, type GearRow } from '@/core/gear/evaluate';
import { equippedGear, getCharacter, getLatestSnapshot, listCharacters, type CharacterRow } from '@/core/db/queries';
import { methodSpecSlug } from '@/core/method/method';
import { trackLabel } from '@/core/raidbots/tracks';
import { ensureBisLists, ensureItemIcons, ensureTracks, type BisResult } from '@/core/sync/reference-sync';
import { LIST_TYPES, type ItemState, type ListType, type Quality, type Region, type SlotType, type SnapshotSource } from '@/core/types';
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
}

export interface CharacterCardView extends CharacterSummary {
  counts: Record<ItemState, number> | null;
  total: number;
  bisError: string | null;
}

export interface CharacterPageView extends CharacterSummary {
  listType: ListType;
  rows: GearRowView[];
  vault: GearRowView[];
  counts: Record<ListType, { bis: number; total: number }>;
  bisFetchedAt: number | null;
  bisError: string | null;
  specs: string[];
}

function summarize(c: CharacterRow, snapshot: { source: SnapshotSource; createdAt: number } | null): CharacterSummary {
  const spec = c.specOverride || c.specName;
  return {
    id: c.id, name: c.name, realmName: c.realmName, region: c.region, className: c.className,
    activeSpec: c.specName, spec, specSlug: methodSpecSlug(spec, c.className),
    status: c.status, lastSyncedAt: c.lastSyncedAt, lastSyncError: c.lastSyncError, priorityList: c.priorityList,
    snapshot,
  };
}

const bisCount = (rows: GearRow[]) => rows.filter((r) => r.matched).length;

export async function getCharacterCards(services: Services): Promise<CharacterCardView[]> {
  const { db, bisSource, fetchTracks, now } = services;
  const time = now();
  const tracks = await ensureTracks({ db, fetchTracks, now: time });
  const bisBySlug = new Map<string, Promise<BisResult>>();
  const characters = await listCharacters(db);
  return Promise.all(characters.map(async (c) => {
    const snapshot = await getLatestSnapshot(db, c.id);
    const summary = summarize(c, snapshot && { source: snapshot.source, createdAt: snapshot.createdAt });
    if (!bisBySlug.has(summary.specSlug)) bisBySlug.set(summary.specSlug, ensureBisLists({ db, source: bisSource, now: time }, summary.specSlug));
    const bis = await bisBySlug.get(summary.specSlug)!;
    const bisRows = bis.lists?.[c.priorityList] ?? [];
    const rows = evaluateGear({ equipped: snapshot ? equippedGear(snapshot) : [], bisRows, tracks });
    return { ...summary, counts: bis.lists ? countStates(rows) : null, total: rows.length, bisError: bis.error };
  }));
}

export async function getCharacterPage(services: Services, id: number, listType?: ListType): Promise<CharacterPageView | null> {
  const { db, blizzard, bisSource, fetchTracks, now } = services;
  const character = await getCharacter(db, id);
  if (!character) return null;
  const time = now();
  const snapshot = await getLatestSnapshot(db, id);
  const summary = summarize(character, snapshot && { source: snapshot.source, createdAt: snapshot.createdAt });
  const list = listType ?? character.priorityList;

  const specsPromise = blizzard.getClasses(character.region)
    .then((classes) => classes.find((cls) => cls.name === character.className)?.specs ?? [summary.spec])
    .catch(() => [summary.spec]);
  // Database work runs in sequence: an in-memory libsql database can't serve a read while a write transaction is open.
  const tracks = await ensureTracks({ db, fetchTracks, now: time });
  const bis = await ensureBisLists({ db, source: bisSource, now: time }, summary.specSlug);
  const specs = await specsPromise;

  const equipped = snapshot ? equippedGear(snapshot) : [];
  const evaluate = (l: ListType) => evaluateGear({ equipped, bisRows: bis.lists?.[l] ?? [], tracks });
  const gearRows = evaluate(list);

  const iconIds = [...equipped.map((g) => g.itemId), ...gearRows.map((r) => r.row.itemId)];
  const icons = await ensureItemIcons({ db, blizzard, now: time }, character.region, iconIds);

  const rows: GearRowView[] = gearRows.map((r) => ({
    slotLabel: r.row.slotLabel,
    slot: r.slot,
    state: r.state,
    equipped: r.equipped && {
      itemId: r.equipped.itemId,
      name: r.equipped.name,
      itemLevel: r.equipped.itemLevel,
      quality: r.equipped.quality,
      bonusIds: r.equipped.bonusIds,
      iconUrl: icons.get(r.equipped.itemId) ?? null,
      trackLabel: r.track ? trackLabel(r.track) : null,
    },
    bis: {
      itemId: r.row.itemId,
      name: r.row.name,
      itemLevel: null,
      // Method links the fully upgraded Myth copy, which is always Epic.
      quality: 'EPIC',
      bonusIds: r.row.bonusIds,
      iconUrl: icons.get(r.row.itemId) ?? null,
      trackLabel: null,
      isTier: r.row.isTier,
      isCatalyst: r.row.isCatalyst,
      source: r.row.source,
    },
  }));

  const counts = Object.fromEntries(LIST_TYPES.map((l) => {
    const evaluated = l === list ? gearRows : evaluate(l);
    return [l, { bis: bisCount(evaluated), total: evaluated.length }];
  })) as Record<ListType, { bis: number; total: number }>;

  return {
    ...summary,
    listType: list,
    rows,
    vault: rows.filter((r) => r.state === 'belowMyth'),
    counts,
    bisFetchedAt: bis.fetchedAt,
    bisError: bis.error,
    specs,
  };
}
