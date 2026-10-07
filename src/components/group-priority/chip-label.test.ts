import { describe, expect, it } from 'vitest';
import { chipLabel } from './chip-label';

const item = (name: string) => ({ itemId: 1, name, itemLevel: null, quality: 'EPIC' as const, bonusIds: [], iconUrl: null, trackLabel: null });

describe('chipLabel', () => {
  it('names an item and its slot', () => {
    expect(chipLabel({ kind: 'item', slotLabel: 'Cloak', weight: 3, item: item('Cloak of the Restless Tribes') })).toBe('Cloak of the Restless Tribes (Cloak)');
  });

  it('names the tier piece and how it is earned', () => {
    expect(chipLabel({ kind: 'tier', slotLabel: 'Shoulders', weight: 5, fit: 'unverified', dropStats: null, targetName: 'BiS', targetStats: null, item: item('Enigmatic Dreamwatcher’s Plumage') }))
      .toBe('Enigmatic Dreamwatcher’s Plumage (Shoulders), tier: catalyst a shoulders drop from this dungeon');
  });

  it('describes an Any need by slot and level', () => {
    expect(chipLabel({ kind: 'any', slotLabel: 'Ring', weight: 2, minItemLevel: 334 })).toBe('Any ring, level 334+');
  });
});
