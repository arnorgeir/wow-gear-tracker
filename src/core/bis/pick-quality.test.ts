import { describe, expect, it } from 'vitest';
import { pickQuality } from './pick-quality';

describe('pickQuality', () => {
  it('raises Rare, Uncommon and unknown base quality to Epic', () => {
    expect(pickQuality('RARE')).toBe('EPIC');
    expect(pickQuality('UNCOMMON')).toBe('EPIC');
    expect(pickQuality(null)).toBe('EPIC');
    expect(pickQuality('EPIC')).toBe('EPIC');
  });

  it('keeps qualities above Epic', () => {
    expect(pickQuality('LEGENDARY')).toBe('LEGENDARY');
    expect(pickQuality('ARTIFACT')).toBe('ARTIFACT');
  });
});
