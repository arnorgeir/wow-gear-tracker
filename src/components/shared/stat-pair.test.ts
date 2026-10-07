import { describe, expect, it } from 'vitest';
import { statPairLabel } from './stat-pair';

describe('statPairLabel', () => {
  it('names a pair in stored order with short words', () => {
    expect(statPairLabel(['HASTE_RATING', 'MASTERY_RATING'])).toBe('Haste/Mastery');
    expect(statPairLabel(['MASTERY_RATING', 'VERSATILITY'])).toBe('Mastery/Vers');
    expect(statPairLabel(['CRIT_RATING'])).toBe('Crit');
  });

  it('says so for an item without secondaries', () => {
    expect(statPairLabel([])).toBe('no secondary stats');
  });
});
