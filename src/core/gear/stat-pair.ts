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
