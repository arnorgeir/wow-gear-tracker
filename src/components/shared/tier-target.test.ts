import { describe, expect, it } from 'vitest';
import { tierTargetText } from './tier-target';

const HM = ['HASTE_RATING', 'MASTERY_RATING'];

describe('tierTargetText', () => {
  it('names the pair and the base to catalyze', () => {
    expect(tierTargetText({ name: 'Primordial Robe of Rites', targetStats: HM, targetIsTierPiece: false })).toBe('tier, Haste/Mastery (catalyst Primordial Robe of Rites)');
    expect(tierTargetText({ name: 'Primordial Robe of Rites', targetStats: null, targetIsTierPiece: false })).toBe('tier (catalyst Primordial Robe of Rites)');
  });

  it('names the tier piece itself for a tier-token row', () => {
    const MV = ['MASTERY_RATING', 'VERSATILITY'];
    expect(tierTargetText({ name: 'Enigmatic Dreamwatcher’s Gauntlets', targetStats: MV, targetIsTierPiece: true })).toBe('Enigmatic Dreamwatcher’s Gauntlets (tier, Mastery/Vers)');
    expect(tierTargetText({ name: 'Enigmatic Dreamwatcher’s Gauntlets', targetStats: null, targetIsTierPiece: true })).toBe('Enigmatic Dreamwatcher’s Gauntlets (tier)');
  });
});
