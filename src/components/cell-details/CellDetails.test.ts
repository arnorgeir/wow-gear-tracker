import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterSummary, GearRowView } from '@/server/views/types';
import { CellDetails } from './CellDetails';

// Client children need the App Router context, which a static render doesn't have. vi.mock is hoisted above the imports.
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }) }));

const equipped = { itemId: 271526, name: 'Enigmatic Dreamwatcher’s Plumage', itemLevel: 334, quality: 'EPIC' as const, bonusIds: [12], iconUrl: null, trackLabel: 'Myth 6/6' };
const tier: GearRowView = {
  slotLabel: 'Shoulders', slot: 'SHOULDER', state: 'done', equipped, equippedStats: ['CRIT_RATING', 'HASTE_RATING'], statsUnverified: false, statsMark: null, upgrade: null,
  bis: { kind: 'item', ...equipped, isTier: true, isCatalyst: true, source: '', targetStats: ['CRIT_RATING', 'HASTE_RATING'], targetIsTierPiece: false },
};
const render = (cell: GearRowView) =>
  renderToStaticMarkup(createElement(CellDetails, { id: 'cell', tracksKnown: true, anchor: { current: null }, cell, slotLabel: 'Shoulders', character: null, memberName: 'Birkibjörn' }));

describe('CellDetails stat marks', () => {
  const unverified: GearRowView = { ...tier, equippedStats: null, statsUnverified: true };
  const character = { id: 7, name: 'Birkibjörn', className: 'Druid', avatarUrl: null, classIconUrl: null } as CharacterSummary;
  const renderWith = (cell: GearRowView, who: CharacterSummary | null) =>
    renderToStaticMarkup(createElement(CellDetails, { id: 'cell', tracksKnown: true, anchor: { current: null }, cell, slotLabel: 'Shoulders', character: who, memberName: 'Birkibjörn' }));

  it('offers marks only with a character', () => {
    expect(renderWith(unverified, character)).toContain('Right stats');
    expect(renderWith(unverified, null)).not.toContain('Right stats');
  });
});

describe('CellDetails', () => {
  it("adds a tier piece's stat pair after the item level", () => {
    expect(render(tier)).toContain(' · Crit/Haste');
  });

  it('adds no pair for a non-tier row', () => {
    const plain: GearRowView = { ...tier, bis: { ...tier.bis, isTier: false, isCatalyst: false, targetStats: null } as GearRowView['bis'] };
    expect(render(plain)).not.toContain('Crit/Haste');
  });

  it("says Stats unverified on a Done tier cell and never lists it as Needed", () => {
    const html = render({ ...tier, equippedStats: null, statsUnverified: true });
    expect(html).toContain("Stats unverified");
    expect(html).not.toContain("Needed");
  });
});
