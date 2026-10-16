import { formatAge } from '@/core/format';
import type { CharacterCardView } from '@/server/views/types';

/** The "SimC, pasted 2h ago" line under a character's progress. */
export function sourceText(card: Pick<CharacterCardView, 'snapshot' | 'sourceAt'>, now: number): string {
  return card.snapshot && card.sourceAt !== null
    ? `${card.snapshot.source === 'simc' ? 'SimC, pasted' : 'Blizzard, synced'} ${formatAge(card.sourceAt, now)}`
    : 'Not synced yet';
}
