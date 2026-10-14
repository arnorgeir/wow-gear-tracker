import { describe, expect, it } from 'vitest';
import type { GearRowView } from '@/server/views/types';
import { cellLabel } from './cell-label';

const equipped = { itemId: 1, name: 'Enigmatic Dreamwatcher’s Somnolent Stare', itemLevel: 321, quality: 'EPIC' as const, bonusIds: [], iconUrl: null, trackLabel: 'Myth 2/6' };
const bis = { kind: 'item' as const, ...equipped, isTier: false, isCatalyst: false, source: '', targetStats: null, targetIsTierPiece: false };
const cell = (over: Partial<GearRowView>): GearRowView => ({ slotLabel: 'Head', slot: 'HEAD', state: 'mythUpgradable', equipped, equippedStats: null, statsUnverified: false, statsMark: null, upgrade: null, bis, ...over });

describe('cellLabel', () => {
  it('reads member, slot, item, item level and state in full', () => {
    expect(cellLabel('Birkibjörn', 'Head', cell({}))).toBe('Birkibjörn, Head: Enigmatic Dreamwatcher’s Somnolent Stare, item level 321, upgrade with crests');
  });

  it('adds the upgrade, and says when nothing is equipped', () => {
    const upgrade = { steps: 4, currencyId: 3446, currencyName: 'Myth Mistcrest', costPerStep: 20, iconUrl: null };
    expect(cellLabel('Birkibjörn', 'Head', cell({ upgrade }))).toMatch(/, can upgrade now$/);
    expect(cellLabel('Skjaldbaka', 'Ring 1', cell({ equipped: null, state: 'missing' }))).toBe('Skjaldbaka, Ring 1: nothing equipped, missing');
  });

  it('says when the player marked the stats by hand', () => {
    expect(cellLabel('Birkibjörn', 'Head', cell({ statsMark: 'right' }))).toMatch(/upgrade with crests, stats confirmed by hand$/);
    expect(cellLabel('Birkibjörn', 'Head', cell({ statsMark: 'wrong', state: 'wrongStats' }))).toMatch(/, stats marked wrong by hand$/);
  });

  it('says when the tier stats could not be checked', () => {
    expect(cellLabel('Birkibjörn', 'Head', cell({ statsUnverified: true }))).toMatch(/upgrade with crests, stats unverified$/);
  });
});
