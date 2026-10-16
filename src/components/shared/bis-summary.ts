import type { CharacterCardView } from '@/server/views/types';

type Counts = NonNullable<CharacterCardView['counts']>;

/**
 * The card's BiS total and its words under the bar. A wrong-stats piece isn't BiS, and is named only when there is one.
 * Without track data a matched item can't be told from one needing crests or the vault, so the words are left out.
 */
export function bisSummary(counts: CharacterCardView['counts'], tracksKnown = true): { bis: number; text: string } {
  if (!counts) return { bis: 0, text: '' };
  const bis = counts.done + counts.mythUpgradable + counts.belowMyth;
  if (!tracksKnown) return { bis, text: '' };
  const parts = [`${counts.done} done`, `${counts.mythUpgradable} need crests`, `${counts.belowMyth} vault targets`];
  if (counts.wrongStats > 0) parts.push(`${counts.wrongStats} wrong stats`);
  if (counts.inBags > 0) parts.push(`${counts.inBags} in bags`);
  return { bis, text: parts.join(', ') };
}

/** The bar's segment sizes. Without track data the track-dependent states fold into one BiS segment. */
export function barSegments(counts: Counts, tracksKnown: boolean) {
  const rest = counts.missing + counts.inBags;
  if (tracksKnown) return { done: counts.done, mythUpgradable: counts.mythUpgradable, belowMyth: counts.belowMyth, wrongStats: counts.wrongStats, rest };
  return { done: counts.done + counts.mythUpgradable + counts.belowMyth, mythUpgradable: 0, belowMyth: 0, wrongStats: counts.wrongStats, rest };
}
