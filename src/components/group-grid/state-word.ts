import { STATE_LABELS } from '@/components/state-badge/state-labels';
import type { ItemState } from '@/core/types';

const WORDS: Record<ItemState, string> = { done: 'Done', mythUpgradable: 'Crests', wrongStats: 'Stats', belowMyth: 'Vault', inBags: 'Bags', missing: 'Need' };

/** The compact cell's one word. A missing tier piece says so, since the icon shows the equipped item. */
export function stateWord(state: ItemState, tierNeed: boolean): { word: string; className: string } {
  return { word: state === 'missing' && tierNeed ? 'Need tier' : WORDS[state], className: STATE_LABELS[state].className };
}
