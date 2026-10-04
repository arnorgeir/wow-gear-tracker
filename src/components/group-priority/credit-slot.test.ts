import { describe, expect, it } from 'vitest';
import { creditSlot } from './credit-slot';

describe('creditSlot', () => {
  it('shortens Method’s long slot labels', () => {
    expect(['Shoulder', 'Shoulders', 'Trinket', 'Weapon', 'Main Hand', 'Main-Hand', 'Off Hand', 'Off-Hand'].map(creditSlot))
      .toEqual(['Shldr', 'Shldr', 'Trink', 'Weap', 'Weap', 'Weap', 'Off-h', 'Off-h']);
  });

  it('keeps the other Method labels as they are, rings unnumbered', () => {
    const kept = ['Head', 'Neck', 'Cloak', 'Back', 'Chest', 'Wrist', 'Wrists', 'Gloves', 'Hands', 'Belt', 'Waist', 'Legs', 'Boots', 'Feet', 'Ring'];
    expect(kept.map(creditSlot)).toEqual(kept);
  });

  it('returns an unknown label unchanged', () => {
    expect(creditSlot('Relic')).toBe('Relic');
  });
});
