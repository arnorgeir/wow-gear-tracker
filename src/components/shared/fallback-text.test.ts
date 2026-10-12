import { describe, expect, it } from 'vitest';
import { fallbackText } from './fallback-text';

describe('fallbackText', () => {
  it('names the source and the missing list, for each notice to finish', () => {
    expect(fallbackText('icyVeins', 'raid')).toBe('Icy Veins has no Raid list');
    expect(fallbackText('manual', 'mythicPlus')).toBe('Your copy has no Mythic+ list');
  });
});
