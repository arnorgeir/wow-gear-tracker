import { describe, expect, it } from 'vitest';
import { bisSummary } from './bis-summary';

const counts = { done: 3, mythUpgradable: 2, belowMyth: 1, wrongStats: 0, missing: 4, inBags: 0 };

describe('bisSummary', () => {
  it('counts done, crest and vault pieces as BiS and names no wrong stats at zero', () => {
    expect(bisSummary(counts)).toEqual({ bis: 6, text: '3 done, 2 need crests, 1 vault targets' });
  });

  it('keeps wrong-stats pieces out of the BiS total and names them when present', () => {
    expect(bisSummary({ ...counts, wrongStats: 2 })).toEqual({ bis: 6, text: '3 done, 2 need crests, 1 vault targets, 2 wrong stats' });
  });

  it('names bagged pieces last', () => {
    expect(bisSummary({ ...counts, wrongStats: 1, inBags: 2 }).text).toBe('3 done, 2 need crests, 1 vault targets, 1 wrong stats, 2 in bags');
  });

  it('is zero without counts', () => {
    expect(bisSummary(null)).toEqual({ bis: 0, text: '' });
  });
});
