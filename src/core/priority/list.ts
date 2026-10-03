import type { BisLists } from '../types';

export type PriorityListType = 'mythicPlus' | 'overall';

/** The list that drives priority: the character's choice, or Overall when Method has no rows for the Mythic+ list. */
export function choosePriorityList(lists: BisLists | null, chosen: PriorityListType): { listType: PriorityListType; fellBack: boolean } {
  if (chosen === 'mythicPlus' && lists && lists.mythicPlus.length === 0 && lists.overall.length > 0) {
    return { listType: 'overall', fellBack: true };
  }
  return { listType: chosen, fellBack: false };
}
