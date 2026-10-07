import { describe, expect, it } from 'vitest';
import type { PriorityCreditView } from '@/server/views/types';
import { creditDetail } from './credit-detail';

const item = { itemId: 1, name: 'Hoarded Harvest Wrap', itemLevel: null, quality: 'EPIC' as const, bonusIds: [], iconUrl: null, trackLabel: null };
const HM = ['HASTE_RATING', 'MASTERY_RATING'];
const MV = ['MASTERY_RATING', 'VERSATILITY'];
const tier = (fit: 'bis' | 'unverified' | 'alternative', weight: number, targetStats: string[] | null = HM, dropStats: string[] | null = HM): PriorityCreditView =>
  ({ kind: 'tier', slotLabel: 'Chest', weight, fit, item, dropStats, targetName: 'Primordial Robe of Rites', targetStats });

describe('creditDetail', () => {
  it('describes each tier fit', () => {
    expect(creditDetail(tier('bis', 5) as never)).toBe('Chest · Method BiS stats · weight 5');
    expect(creditDetail(tier('bis', 5, null, null) as never)).toBe('Chest · Method BiS item · weight 5');
    expect(creditDetail(tier('alternative', 4, HM, MV) as never)).toBe('Chest · catalyst alternative (Mastery/Vers, BiS Haste/Mastery) · weight 4');
    expect(creditDetail(tier('unverified', 5, HM, null) as never)).toBe('Chest · stats unverified · weight 5');
  });

  it('keeps named items as they were', () => {
    expect(creditDetail({ kind: 'item', slotLabel: 'Neck', weight: 2, item })).toBe('Neck · weight 2');
  });
});
