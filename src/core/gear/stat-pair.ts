import type { StatMatch } from '../types';

/** Stored form: sorted types joined by commas, '' for an item with no secondaries, null when unknown. */
export const encodeStats = (stats: readonly string[] | null | undefined): string | null =>
  (stats == null ? null : [...stats].sort().join(','));

export const decodeStats = (text: string | null): string[] | null =>
  (text === null ? null : text === '' ? [] : text.split(','));

interface Side { itemId: number; stats: readonly string[] | null | undefined }

/**
 * Whether an item carries the target's secondary stats. Known pairs win over item IDs: a catalyzed
 * tier piece can share the Method tier piece's ID and still carry another base item's stats.
 */
export function compareStats(target: Side, item: Side): StatMatch {
  if (target.stats != null && item.stats != null) return encodeStats(target.stats) === encodeStats(item.stats) ? 'same' : 'different';
  return target.itemId === item.itemId ? 'same' : 'unknown';
}

interface Statted { itemId: number; bonusIds: number[]; secondaryStats?: string[] | null }

const itemKey = (i: Statted) => `${i.itemId}:${[...i.bonusIds].sort((a, b) => a - b).join(':')}`;

/**
 * Fills unknown pairs from another snapshot's copy of the same item: same item ID and bonus IDs. SimC pastes
 * carry no stats, but the Blizzard snapshot of the same piece does.
 */
export function borrowStats<T extends Statted>(items: T[], from: readonly Statted[]): T[] {
  const known = new Map(from.filter((i) => i.secondaryStats != null).map((i) => [itemKey(i), i.secondaryStats!]));
  return items.map((i) => (i.secondaryStats == null && known.has(itemKey(i)) ? { ...i, secondaryStats: known.get(itemKey(i))! } : i));
}
