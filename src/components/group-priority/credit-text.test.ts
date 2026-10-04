import { describe, expect, it } from 'vitest';
import { needText } from './credit-text';

describe('needText', () => {
  it('names a tier need and an Any need with its real minimum', () => {
    expect(needText({ kind: 'tier', slotLabel: 'Chest', weight: 5, item: { itemId: 80, name: 'Tier Robe', itemLevel: null, quality: 'EPIC', bonusIds: [], iconUrl: null, trackLabel: null } })).toBe('Tier via catalyst');
    expect(needText({ kind: 'any', slotLabel: 'Feet', weight: 3, minItemLevel: 341 })).toBe('Any item, level 341+');
  });
});
