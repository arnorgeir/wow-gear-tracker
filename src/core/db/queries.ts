import { createHash } from 'node:crypto';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { BonusQuality } from '../raidbots/tracks';
import type { Db } from './client';
import { bisItems, bisLists, characters, gearSnapshots, items, meta, snapshotItems, upgradeTracks, bonusQualities } from './schema';
import {
  LIST_TYPES, type BisLists, type GearItem, type ItemLocation, type Quality, type Region, type SlotType, type SnapshotSource, type Track,
} from '../types';

export type CharacterRow = typeof characters.$inferSelect;

// Every write in this module runs through this lock, one at a time per database.
// libsql's SQLite driver runs synchronously on the main thread: a write that waits on another
// connection's lock blocks the event loop, so the lock holder can never finish. An in-memory
// database also has one connection, which an open transaction holds (TRANSACTION_ACTIVE).
// The client's busy timeout still covers other processes writing to the same file.
const writeLocks = new WeakMap<Db, Promise<unknown>>();

function withWriteLock<T>(db: Db, task: () => Promise<T>): Promise<T> {
  const previous = writeLocks.get(db) ?? Promise.resolve();
  const next = previous.then(task, task);
  writeLocks.set(db, next.catch(() => undefined));
  return next;
}

export interface NewCharacter {
  region: Region;
  realmId: number;
  realmSlug: string;
  realmName: string;
  name: string;
  className: string;
  specName: string;
}

const nameKeyOf = (name: string) => name.toLocaleLowerCase('en');

export function insertCharacter(db: Db, input: NewCharacter, now: number): Promise<{ id: number; created: boolean }> {
  return withWriteLock(db, async () => {
    const nameKey = nameKeyOf(input.name);
    const existing = await db.select({ id: characters.id }).from(characters)
      .where(and(eq(characters.region, input.region), eq(characters.realmId, input.realmId), eq(characters.nameKey, nameKey)))
      .get();
    if (existing) return { id: existing.id, created: false };
    const [row] = await db.insert(characters).values({ ...input, nameKey, addedAt: now }).returning({ id: characters.id });
    return { id: row!.id, created: true };
  });
}

export const listCharacters = (db: Db) => db.select().from(characters).orderBy(asc(characters.addedAt), asc(characters.id));

export const getCharacter = (db: Db, id: number) => db.select().from(characters).where(eq(characters.id, id)).get();

export async function updateCharacter(db: Db, id: number, patch: Partial<Omit<CharacterRow, 'id' | 'addedAt' | 'nameKey'>>) {
  await withWriteLock(db, () => db.update(characters).set(patch).where(eq(characters.id, id)));
}

export async function deleteCharacter(db: Db, id: number) {
  await withWriteLock(db, () => db.delete(characters).where(eq(characters.id, id)));
}

export interface SnapshotItemInput {
  location: ItemLocation;
  slot: string;
  itemId: number;
  name: string;
  itemLevel: number | null;
  quality: Quality;
  bonusIds: number[];
  isTier: boolean;
}

export interface Snapshot {
  id: number;
  source: SnapshotSource;
  createdAt: number;
  items: SnapshotItemInput[];
}

export const gearToSnapshotItems = (gear: GearItem[]): SnapshotItemInput[] =>
  gear.map((g) => ({ location: 'equipped', slot: g.slot, itemId: g.itemId, name: g.name, itemLevel: g.itemLevel, quality: g.quality, bonusIds: g.bonusIds, isTier: g.isTier }));

function hashItems(list: SnapshotItemInput[]): string {
  const normalized = list
    .map((i) => [i.location, i.slot, i.itemId, i.itemLevel, i.bonusIds.join(':'), i.isTier].join('|'))
    .sort();
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export async function saveSnapshotIfChanged(
  db: Db, characterId: number, source: SnapshotSource, list: SnapshotItemInput[], now: number,
): Promise<{ snapshotId: number; changed: boolean }> {
  return withWriteLock(db, async () => {
    const contentHash = hashItems(list);
    const latest = await db.select().from(gearSnapshots).where(eq(gearSnapshots.characterId, characterId))
      .orderBy(desc(gearSnapshots.createdAt), desc(gearSnapshots.id)).get();
    if (latest && latest.contentHash === contentHash && latest.source === source) return { snapshotId: latest.id, changed: false };
    return db.transaction(async (tx) => {
      const [snapshot] = await tx.insert(gearSnapshots).values({ characterId, source, createdAt: now, contentHash }).returning({ id: gearSnapshots.id });
      if (list.length > 0) await tx.insert(snapshotItems).values(list.map((i) => ({ ...i, snapshotId: snapshot!.id })));
      return { snapshotId: snapshot!.id, changed: true };
    });
  });
}

export async function getLatestSnapshot(db: Db, characterId: number): Promise<Snapshot | null> {
  const latest = await db.select().from(gearSnapshots).where(eq(gearSnapshots.characterId, characterId))
    .orderBy(desc(gearSnapshots.createdAt), desc(gearSnapshots.id)).get();
  if (!latest) return null;
  const rows = await db.select().from(snapshotItems).where(eq(snapshotItems.snapshotId, latest.id)).orderBy(asc(snapshotItems.id));
  return {
    id: latest.id,
    source: latest.source,
    createdAt: latest.createdAt,
    items: rows.map(({ location, slot, itemId, name, itemLevel, quality, bonusIds, isTier }) =>
      ({ location, slot, itemId, name, itemLevel, quality, bonusIds, isTier })),
  };
}

export const equippedGear = (snapshot: Snapshot): GearItem[] =>
  snapshot.items
    .filter((i) => i.location === 'equipped')
    .map((i) => ({ slot: i.slot as SlotType, itemId: i.itemId, name: i.name, itemLevel: i.itemLevel, quality: i.quality, bonusIds: i.bonusIds, isTier: i.isTier }));

export async function replaceBisLists(db: Db, specSlug: string, lists: BisLists, now: number) {
  await withWriteLock(db, () => db.transaction(async (tx) => {
    await tx.delete(bisLists).where(eq(bisLists.specSlug, specSlug));
    for (const listType of LIST_TYPES) {
      const [list] = await tx.insert(bisLists).values({ specSlug, listType, fetchedAt: now }).returning({ id: bisLists.id });
      const rows = lists[listType];
      if (rows.length > 0) await tx.insert(bisItems).values(rows.map((row, position) => ({ ...row, listId: list!.id, position })));
    }
  }));
}

export async function getBisLists(db: Db, specSlug: string): Promise<{ lists: BisLists; fetchedAt: number } | null> {
  const listRows = await db.select().from(bisLists).where(eq(bisLists.specSlug, specSlug));
  if (listRows.length === 0) return null;
  const lists: BisLists = { overall: [], raid: [], mythicPlus: [] };
  for (const list of listRows) {
    const rows = await db.select().from(bisItems).where(eq(bisItems.listId, list.id)).orderBy(asc(bisItems.position));
    lists[list.listType] = rows.map(({ slotLabel, slots, itemId, name, bonusIds, isTier, isCatalyst, source }) =>
      ({ slotLabel, slots, itemId, name, bonusIds, isTier, isCatalyst, source }));
  }
  return { lists, fetchedAt: Math.min(...listRows.map((l) => l.fetchedAt)) };
}

export async function replaceTracks(db: Db, tracks: Track[]) {
  await withWriteLock(db, () => db.transaction(async (tx) => {
    await tx.delete(upgradeTracks);
    for (let i = 0; i < tracks.length; i += 500) await tx.insert(upgradeTracks).values(tracks.slice(i, i + 500));
  }));
}

export async function getTrackMap(db: Db): Promise<Map<number, Track>> {
  const rows = await db.select().from(upgradeTracks);
  return new Map(rows.map((t) => [t.bonusId, t]));
}

export async function replaceBonusQualities(db: Db, entries: BonusQuality[]) {
  await withWriteLock(db, () => db.transaction(async (tx) => {
    await tx.delete(bonusQualities);
    for (let i = 0; i < entries.length; i += 500) await tx.insert(bonusQualities).values(entries.slice(i, i + 500));
  }));
}

export async function getBonusQualityMap(db: Db): Promise<Map<number, Quality>> {
  const rows = await db.select().from(bonusQualities);
  return new Map(rows.map((r) => [r.bonusId, r.quality]));
}

export async function getMeta(db: Db, key: string) {
  const row = await db.select().from(meta).where(eq(meta.key, key)).get();
  return row ? { value: row.value, updatedAt: row.updatedAt } : null;
}

export async function setMeta(db: Db, key: string, value: string, now: number) {
  await withWriteLock(db, () => db.insert(meta).values({ key, value, updatedAt: now })
    .onConflictDoUpdate({ target: meta.key, set: { value, updatedAt: now } }));
}

export async function upsertItemIcons(db: Db, entries: { itemId: number; iconUrl: string | null }[], now: number) {
  await withWriteLock(db, async () => {
    for (const entry of entries) {
      await db.insert(items).values({ ...entry, fetchedAt: now })
        .onConflictDoUpdate({ target: items.itemId, set: { iconUrl: entry.iconUrl, fetchedAt: now } });
    }
  });
}

export async function getItemIcons(db: Db, ids: number[]): Promise<Map<number, string | null>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(items).where(inArray(items.itemId, [...new Set(ids)]));
  return new Map(rows.map((r) => [r.itemId, r.iconUrl]));
}
