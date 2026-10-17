import type { GearItem } from '../types';

/** Equipped tier pieces; the one count both dungeon priority and the tier set chip use. */
export const countTierPieces = (equipped: readonly Pick<GearItem, 'isTier'>[]): number => equipped.filter((item) => item.isTier).length;

/** The game grants the 4-piece bonus for any 4 of the 5 tier slots. */
export const tierSetBonus = (pieces: number): 2 | 4 | null => (pieces >= 4 ? 4 : pieces >= 2 ? 2 : null);
