import { describe, expect, it } from 'vitest';
import type { GearRowView } from '@/server/views/types';
import { cellNote, needText } from './cell-note';

const row = (bis: GearRowView['bis'], state: GearRowView['state'] = 'missing'): GearRowView =>
  ({ slotLabel: 'Head', slot: 'HEAD', state, equipped: null, equippedStats: null, upgrade: null, bis });
const named = { kind: 'item' as const, itemId: 1, name: 'Greathelm', itemLevel: null, quality: 'EPIC' as const, bonusIds: [], iconUrl: null, trackLabel: null, isTier: false, isCatalyst: false, source: '', targetStats: null, targetIsTierPiece: false };

describe('cellNote', () => {
  it('fills cells for members without rows, with skeletons for the ones still loading', () => {
    expect(cellNote('ready', true)).toBeNull();
    expect(cellNote('ready', false)).toEqual({ text: 'No BiS list', dim: false });
    expect(cellNote('ready', false, true)).toEqual({ skeleton: true });
    expect(cellNote('syncing', false)).toEqual({ skeleton: true });
    expect(cellNote('untracked', false)).toEqual({ text: 'Not tracked', dim: true });
    expect(cellNote('noGear', false)).toEqual({ text: 'No gear yet', dim: true });
    expect(cellNote('notFound', false)).toEqual({ text: 'Not found', dim: true });
  });
});

describe('needText', () => {
  it('names what is still needed, and nothing once the BiS item is worn', () => {
    expect(needText(row(named))).toBe('Need: Greathelm');
    expect(needText(row({ ...named, isTier: true }))).toBe('Need: tier (catalyst Greathelm)');
    expect(needText(row({ kind: 'any', minItemLevel: 334, source: '' }))).toBe('Need: any item, level 334+');
    expect(needText(row(named, 'done'))).toBeNull();
    expect(needText(row(named, 'inBags'))).toBe('Need: Greathelm, in your bags');
  });
});

describe('needText for tier rows', () => {
  const HM = ['HASTE_RATING', 'MASTERY_RATING'];
  const tier = { ...named, name: 'Primordial Robe of Rites', isTier: true, targetStats: HM };

  it('names the pair and base for a missing tier piece', () => {
    expect(needText(row(tier))).toBe('Need: tier, Haste/Mastery (catalyst Primordial Robe of Rites)');
  });

  it('names both pairs for a tier piece with the wrong stats', () => {
    expect(needText({ ...row(tier, 'wrongStats'), equippedStats: ['CRIT_RATING', 'MASTERY_RATING'] })).toBe('Tier, Crit/Mastery; Method BiS wants Haste/Mastery');
  });

  it('says nothing once the tier piece is right', () => {
    expect(needText(row(tier, 'done'))).toBeNull();
  });
});
