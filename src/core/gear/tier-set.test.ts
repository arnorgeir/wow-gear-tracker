import { describe, expect, it } from 'vitest';
import { countTierPieces, tierSetBonus } from './tier-set';

describe('countTierPieces', () => {
  it('is 0 for no gear', () => expect(countTierPieces([])).toBe(0));
  it('counts only tier items', () => {
    expect(countTierPieces([{ isTier: true }, { isTier: false }, { isTier: true }])).toBe(2);
  });
});

describe('tierSetBonus', () => {
  it.each([[0, null], [1, null], [2, 2], [3, 2], [4, 4], [5, 4]] as const)('%i pieces gives %s', (pieces, bonus) => {
    expect(tierSetBonus(pieces)).toBe(bonus);
  });
});
