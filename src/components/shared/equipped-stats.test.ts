import { describe, expect, it } from 'vitest';
import type { ItemState } from '@/core/types';
import type { BisView } from '@/server/views/types';
import { equippedStatText } from './equipped-stats';

const item = { itemId: 251223, name: 'Somber Spaulders', itemLevel: 334, quality: 'EPIC' as const, bonusIds: [], iconUrl: null, trackLabel: null };
const tierBis: BisView = { kind: 'item', ...item, isTier: true, isCatalyst: true, source: '', targetStats: ['CRIT_RATING', 'HASTE_RATING'], targetIsTierPiece: false };
const plainBis: BisView = { ...tierBis, isTier: false, isCatalyst: false };
const anyBis: BisView = { kind: 'any', minItemLevel: 330, source: '' };
const CRIT_HASTE = ['CRIT_RATING', 'HASTE_RATING'];
const row = (state: ItemState, equippedStats: string[] | null, bis: BisView = tierBis, statsUnverified = false, statsMark: 'right' | 'wrong' | null = null) => ({ bis, state, equippedStats, statsUnverified, statsMark });

describe('equippedStatText marks', () => {
  it('says a mark was made by hand', () => {
    expect(equippedStatText(row('done', null, tierBis, false, 'right'))).toBe('Stats confirmed by hand');
    expect(equippedStatText(row('wrongStats', null, tierBis, false, 'wrong'))).toBe('Stats marked wrong by hand');
  });
});

describe('equippedStatText', () => {
  it('words the pair of a tier piece that fills the slot', () => {
    expect(equippedStatText(row('done', CRIT_HASTE))).toBe('Crit/Haste');
  });

  it('gives the pair in every filled state', () => {
    for (const state of ['wrongStats', 'mythUpgradable', 'belowMyth'] as const) expect(equippedStatText(row(state, CRIT_HASTE))).toBe('Crit/Haste');
  });

  it('gives no pair when no tier piece fills the slot', () => {
    expect(equippedStatText(row('missing', CRIT_HASTE))).toBeNull();
    expect(equippedStatText(row('inBags', CRIT_HASTE))).toBeNull();
  });

  it('gives no pair while the stats are unknown', () => {
    expect(equippedStatText(row('done', null))).toBeNull();
  });

  it('says so when the stats could not be checked, even with no equipped stats', () => {
    expect(equippedStatText(row('done', null, tierBis, true))).toBe('Stats unverified');
    expect(equippedStatText(row('missing', null, tierBis, true))).toBeNull();
  });

  it('gives no pair on non-tier rows', () => {
    expect(equippedStatText(row('done', CRIT_HASTE, plainBis))).toBeNull();
    expect(equippedStatText(row('done', CRIT_HASTE, anyBis))).toBeNull();
  });

  it('words a piece with no secondary stats', () => {
    expect(equippedStatText(row('done', []))).toBe('no secondary stats');
  });
});
