import { describe, expect, it } from 'vitest';
import { overrideLabel } from './slot-row';

describe('overrideLabel', () => {
  it('says when an override is catalyzed into tier', () => {
    expect(overrideLabel({ name: 'Woven Robe', catalyst: true })).toBe('Woven Robe → catalyst into tier');
    expect(overrideLabel({ name: 'Woven Robe', catalyst: false })).toBe('Woven Robe');
  });
});
