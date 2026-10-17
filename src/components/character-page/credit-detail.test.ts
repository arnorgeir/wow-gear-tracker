import { describe, expect, it } from 'vitest';
import type { PriorityCreditView } from '@/server/views/types';
import { creditDetail } from './credit-detail';

const item = { itemId: 1, name: 'Hoarded Harvest Wrap', itemLevel: null, quality: 'EPIC' as const, bonusIds: [], iconUrl: null, trackLabel: null };
const HM = ['HASTE_RATING', 'MASTERY_RATING'];
const MV = ['MASTERY_RATING', 'VERSATILITY'];
const tier = (fit: 'bis' | 'unverified' | 'alternative' | 'any', weight: number, targetStats: string[] | null = HM, dropStats: string[] | null = HM): PriorityCreditView =>
  ({ kind: 'tier', slotLabel: 'Chest', weight, fit, item, dropStats, targetName: 'Primordial Robe of Rites', targetStats });

describe('creditDetail', () => {
  it('describes each tier fit', () => {
    expect(creditDetail(tier('bis', 5) as never)).toBe('Chest · BiS stats');
    expect(creditDetail(tier('bis', 5, null, null) as never)).toBe('Chest · BiS item');
    expect(creditDetail(tier('alternative', 4, HM, MV) as never)).toBe('Chest · catalyst alternative (Mastery/Vers, BiS Haste/Mastery)');
    expect(creditDetail(tier('unverified', 5, HM, null) as never)).toBe('Chest · stats unverified');
    expect(creditDetail(tier('any', 5, null, MV) as never)).toBe('Chest · catalyst into tier');
  });

  it('names only the slot for named items: the weight sits in the card corner', () => {
    expect(creditDetail({ kind: 'item', slotLabel: 'Neck', weight: 2, item })).toBe('Neck');
  });
});
