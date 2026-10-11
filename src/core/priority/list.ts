import type { BisLists, ListType } from '../types';

/** The list that drives priority: the spec's choice, or Overall when Method has no rows for the chosen list. */
export function choosePriorityList(lists: BisLists | null, chosen: ListType): { listType: ListType; fellBack: boolean } {
  if (chosen !== 'overall' && lists && lists[chosen].length === 0 && lists.overall.length > 0) {
    return { listType: 'overall', fellBack: true };
  }
  return { listType: chosen, fellBack: false };
}
