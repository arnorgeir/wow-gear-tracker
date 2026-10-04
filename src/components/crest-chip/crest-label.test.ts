import { describe, expect, it } from 'vitest';
import { crestLabel, crestShortName } from './crest-label';

const myth = { currencyId: 3446, name: 'Myth Mistcrest', quantity: 85, steps: 4, iconUrl: null };

describe('crestLabel', () => {
  it('names the crest, its count and the steps it pays for', () => {
    expect(crestLabel(myth)).toBe('Myth Mistcrest: 85, 4 steps');
    expect(crestLabel({ ...myth, quantity: 20, steps: 1 })).toBe('Myth Mistcrest: 20, 1 step');
  });

  it('shortens the name to its first word for the fallback', () => {
    expect(crestShortName(myth)).toBe('Myth');
  });
});
