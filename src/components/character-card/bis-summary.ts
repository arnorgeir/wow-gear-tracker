import type { CharacterCardView } from '@/server/views/types';

/** The card's BiS total and its words under the bar. A wrong-stats piece isn't BiS, and is named only when there is one. */
export function bisSummary(counts: CharacterCardView['counts']): { bis: number; text: string } {
  if (!counts) return { bis: 0, text: '' };
  const parts = [`${counts.done} done`, `${counts.mythUpgradable} need crests`, `${counts.belowMyth} vault targets`];
  if (counts.wrongStats > 0) parts.push(`${counts.wrongStats} wrong stats`);
  if (counts.inBags > 0) parts.push(`${counts.inBags} in bags`);
  return { bis: counts.done + counts.mythUpgradable + counts.belowMyth, text: parts.join(', ') };
}
