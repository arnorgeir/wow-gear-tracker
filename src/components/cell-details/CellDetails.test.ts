import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GearRowView } from '@/server/views/types';
import { NO_TRACK_HINT } from '@/components/shared/track-label';
import { CellDetails } from './CellDetails';

const equipped = { itemId: 271526, name: 'Enigmatic Dreamwatcher’s Plumage', itemLevel: 334, quality: 'EPIC' as const, bonusIds: [12], iconUrl: null, trackLabel: 'Myth 6/6' };
const tier: GearRowView = {
  slotLabel: 'Shoulders', slot: 'SHOULDER', state: 'done', equipped, equippedStats: ['CRIT_RATING', 'HASTE_RATING'], statsUnverified: false, upgrade: null,
  bis: { kind: 'item', ...equipped, isTier: true, isCatalyst: true, source: '', targetStats: ['CRIT_RATING', 'HASTE_RATING'], targetIsTierPiece: false },
};
const render = (cell: GearRowView, tracksKnown = true) =>
  renderToStaticMarkup(createElement(CellDetails, { id: 'cell', tracksKnown, anchor: { current: null }, cell, slotLabel: 'Shoulders', character: null, memberName: 'Birkibjörn' })).replace(/<link[^>]*\/>/g, '');
const withEquipped = (over: Partial<NonNullable<GearRowView['equipped']>>): GearRowView => ({ ...tier, equipped: { ...equipped, ...over } });

describe('CellDetails equipped item link', () => {
  it('holds the icon, name and detail line in one Wowhead link', () => {
    const html = render(withEquipped({ iconUrl: 'https://i/1.jpg' }));
    const start = html.indexOf('data-wowhead=');
    const end = html.indexOf('</a>', start);
    expect(html.slice(start, end)).toContain('<img src="https://i/1.jpg"');
    expect(html.slice(start, end)).toContain('Enigmatic Dreamwatcher’s Plumage');
  });

  it('says what No track means as visible text outside the link, never as a title', () => {
    const html = render(withEquipped({ trackLabel: null }));
    expect(html.indexOf(NO_TRACK_HINT)).toBeGreaterThan(html.indexOf('</a>'));
    expect(html).not.toContain('title="Not on a current season');
  });

  it('shows no hint without track data or on a track', () => {
    expect(render(withEquipped({ trackLabel: null }), false)).not.toContain(NO_TRACK_HINT);
    expect(render(withEquipped({ trackLabel: 'Myth 6/6' }))).not.toContain(NO_TRACK_HINT);
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
