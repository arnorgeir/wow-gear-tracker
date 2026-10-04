import { describe, expect, it } from 'vitest';
import type { GearRowView } from '@/server/views/types';
import { cellNote, needText } from './cell-note';

const row = (bis: GearRowView['bis'], state: GearRowView['state'] = 'missing'): GearRowView =>
  ({ slotLabel: 'Head', slot: 'HEAD', state, equipped: null, upgrade: null, bis });
const named = { kind: 'item' as const, itemId: 1, name: 'Greathelm', itemLevel: null, quality: 'EPIC' as const, bonusIds: [], iconUrl: null, trackLabel: null, isTier: false, isCatalyst: false, source: '' };

describe('cellNote', () => {
  it('fills cells for members without rows, dimming the ones still waiting', () => {
    expect(cellNote('ready', true)).toBeNull();
    expect(cellNote('ready', false)).toEqual({ text: 'No BiS list', dim: false });
    expect(cellNote('untracked', false)).toEqual({ text: 'Not tracked', dim: true });
    expect(cellNote('syncing', false)).toEqual({ text: 'Syncing…', dim: true });
    expect(cellNote('noGear', false)).toEqual({ text: 'No gear yet', dim: true });
    expect(cellNote('notFound', false)).toEqual({ text: 'Not found', dim: true });
  });
});

describe('needText', () => {
  it('names what is still needed, and nothing once the BiS item is worn', () => {
    expect(needText(row(named))).toBe('Need: Greathelm');
    expect(needText(row({ ...named, isTier: true }))).toBe('Need: Greathelm (tier, via catalyst)');
    expect(needText(row({ kind: 'any', minItemLevel: 334, source: '' }))).toBe('Need: any item, level 334+');
    expect(needText(row(named, 'done'))).toBeNull();
    expect(needText(row(named, 'inBags'))).toBe('Need: Greathelm, in your bags');
  });
});
