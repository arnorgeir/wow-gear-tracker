import { createHash } from 'node:crypto';
import { and, asc, desc, eq } from 'drizzle-orm';
import type { Db } from '../client';
import { gearSnapshots, snapshotItems, snapshotCurrencies } from '../schema';
import { type GearItem, type ItemLocation, type Quality, type SlotType, type SnapshotSource } from '../../types';
import { withWriteLock } from './write-lock';

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

export interface SnapshotCurrency {
  kind: 'upgrade' | 'catalyst';
  currencyId: number;
  quantity: number;
}

export interface Snapshot {
  id: number;
  source: SnapshotSource;
  createdAt: number;
  items: SnapshotItemInput[];
  currencies: SnapshotCurrency[];
}

export const gearToSnapshotItems = (gear: GearItem[]): SnapshotItemInput[] =>
  gear.map((g) => ({ location: 'equipped', slot: g.slot, itemId: g.itemId, name: g.name, itemLevel: g.itemLevel, quality: g.quality, bonusIds: g.bonusIds, isTier: g.isTier }));

function hashSnapshot(list: SnapshotItemInput[], currencies: SnapshotCurrency[]): string {
  const items = list
    .map((i) => [i.location, i.slot, i.itemId, i.itemLevel, i.bonusIds.join(':'), i.isTier].join('|'))
    .sort();
  const money = currencies.map((c) => [c.kind, c.currencyId, c.quantity].join('|')).sort();
  // Snapshots without currencies hash exactly as they did before currencies existed.
  const payload = money.length > 0 ? JSON.stringify([items, money]) : JSON.stringify(items);
  return createHash('sha256').update(payload).digest('hex');
}

function latestSnapshotRow(db: Db, characterId: number, source?: SnapshotSource) {
  const where = source
    ? and(eq(gearSnapshots.characterId, characterId), eq(gearSnapshots.source, source))
    : eq(gearSnapshots.characterId, characterId);
  return db.select().from(gearSnapshots).where(where).orderBy(desc(gearSnapshots.createdAt), desc(gearSnapshots.id)).get();
}

/**
 * Saves a snapshot unless nothing changed.
 * A Blizzard sync compares with the last Blizzard snapshot, so an unchanged Blizzard profile never
 * replaces a newer SimC paste. Blizzard only updates after a logout, so changed Blizzard data is at
 * least as new as the paste. A paste compares with whatever snapshot is current.
 */
export async function saveSnapshotIfChanged(
  db: Db, characterId: number, source: SnapshotSource, list: SnapshotItemInput[], now: number, currencies: SnapshotCurrency[] = [],
): Promise<{ snapshotId: number; changed: boolean }> {
  return withWriteLock(db, async () => {
    const contentHash = hashSnapshot(list, currencies);
    const previous = await latestSnapshotRow(db, characterId, source === 'blizzard' ? 'blizzard' : undefined);
    if (previous && previous.contentHash === contentHash && previous.source === source) return { snapshotId: previous.id, changed: false };
    return db.transaction(async (tx) => {
      const [snapshot] = await tx.insert(gearSnapshots).values({ characterId, source, createdAt: now, contentHash }).returning({ id: gearSnapshots.id });
      if (list.length > 0) await tx.insert(snapshotItems).values(list.map((i) => ({ ...i, snapshotId: snapshot!.id })));
      if (currencies.length > 0) await tx.insert(snapshotCurrencies).values(currencies.map((c) => ({ ...c, snapshotId: snapshot!.id })));
      return { snapshotId: snapshot!.id, changed: true };
    });
  });
}

export async function getLatestSnapshot(db: Db, characterId: number, source?: SnapshotSource): Promise<Snapshot | null> {
  const latest = await latestSnapshotRow(db, characterId, source);
  if (!latest) return null;
  const rows = await db.select().from(snapshotItems).where(eq(snapshotItems.snapshotId, latest.id)).orderBy(asc(snapshotItems.id));
  const money = await db.select().from(snapshotCurrencies).where(eq(snapshotCurrencies.snapshotId, latest.id)).orderBy(asc(snapshotCurrencies.id));
  return {
    id: latest.id,
    source: latest.source,
    createdAt: latest.createdAt,
    items: rows.map(({ location, slot, itemId, name, itemLevel, quality, bonusIds, isTier }) =>
      ({ location, slot, itemId, name, itemLevel, quality, bonusIds, isTier })),
    currencies: money.map(({ kind, currencyId, quantity }) => ({ kind, currencyId, quantity })),
  };
}

export const equippedGear = (snapshot: Snapshot): GearItem[] =>
  snapshot.items
    .filter((i) => i.location === 'equipped')
    .map((i) => ({ slot: i.slot as SlotType, itemId: i.itemId, name: i.name, itemLevel: i.itemLevel, quality: i.quality, bonusIds: i.bonusIds, isTier: i.isTier }));
