import { describe, expect, it } from 'vitest';
import { chipLabel } from './chip-label';

const item = (name: string) => ({ itemId: 1, name, itemLevel: null, quality: 'EPIC' as const, bonusIds: [], iconUrl: null, trackLabel: null });

describe('chipLabel', () => {
  it('names an item and its slot', () => {
    expect(chipLabel({ kind: 'item', slotLabel: 'Cloak', weight: 3, item: item('Cloak of the Restless Tribes') })).toBe('Cloak of the Restless Tribes (Cloak)');
  });

  const tier = (fit: 'bis' | 'unverified' | 'alternative', name: string, targetStats: string[] | null, dropStats: string[] | null) =>
    ({ kind: 'tier' as const, slotLabel: 'Chest', weight: 5, fit, item: item(name), dropStats, targetName: 'Primordial Robe of Rites', targetStats });
  const HM = ['HASTE_RATING', 'MASTERY_RATING'];
  const MV = ['MASTERY_RATING', 'VERSATILITY'];

  it('labels each tier fit by the drop’s own name', () => {
    expect(chipLabel(tier('bis', 'Primordial Robe of Rites', HM, HM))).toBe('Primordial Robe of Rites (Chest), Method BiS stats Haste/Mastery: catalyst into tier');
    expect(chipLabel(tier('bis', 'Primordial Robe of Rites', null, null))).toBe('Primordial Robe of Rites (Chest), Method BiS item: catalyst into tier');
    expect(chipLabel(tier('alternative', 'Hoarded Harvest Wrap', HM, MV))).toBe('Hoarded Harvest Wrap (Chest), catalyst alternative: Mastery/Vers, Method BiS wants Haste/Mastery');
    expect(chipLabel(tier('unverified', 'Hoarded Harvest Wrap', HM, null))).toBe('Hoarded Harvest Wrap (Chest), catalyst into tier, stats unverified');
  });

  it('describes an Any need by slot and level', () => {
    expect(chipLabel({ kind: 'any', slotLabel: 'Ring', weight: 2, minItemLevel: 334 })).toBe('Any ring, level 334+');
  });
});
