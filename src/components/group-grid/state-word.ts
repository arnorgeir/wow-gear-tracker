import { STATE_LABELS } from '@/components/state-badge/state-labels';
import type { ItemState } from '@/core/types';

const WORDS: Record<ItemState, string> = { done: 'Done', mythUpgradable: 'Crests', wrongStats: 'Stats', belowMyth: 'Vault', inBags: 'Bags', missing: 'Need' };

/** The compact cell (a question mark when the tier stats could not be checked)'s one word. A missing tier piece says so, since the icon shows the equipped item. */
export function stateWord(state: ItemState, tierNeed: boolean, unverified = false): { word: string; className: string } {
  const word = state === 'missing' && tierNeed ? 'Need tier' : WORDS[state];
  return { word: unverified ? `${word}?` : word, className: STATE_LABELS[state].className };
}
