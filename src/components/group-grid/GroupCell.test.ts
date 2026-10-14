import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GearRowView } from '@/server/views/types';
import { GroupCell } from './GroupCell';

const equipped = { itemId: 271526, name: 'Enigmatic Dreamwatcher’s Plumage', itemLevel: 334, quality: 'EPIC' as const, bonusIds: [12], iconUrl: 'https://i/1.jpg', trackLabel: 'Myth 6/6' };
const tier: GearRowView = {
  slotLabel: 'Shoulders', slot: 'SHOULDER', state: 'done', equipped, equippedStats: null, statsUnverified: false, upgrade: null,
  bis: { kind: 'item', ...equipped, isTier: true, isCatalyst: true, source: '', targetStats: null, targetIsTierPiece: false },
};
// The cell only: the details card after it has its own links.
const render = (cell: GearRowView) => {
  const html = renderToStaticMarkup(createElement(GroupCell, { cell, tracksKnown: true, slotLabel: 'Shoulders', memberName: 'Birkibjörn', character: null })).replace(/<link[^>]*\/>/g, '');
  return html.slice(0, html.indexOf('popover="auto"'));
};

describe('GroupCell', () => {
  it('covers an equipped cell with one empty Wowhead link, and no link round the icon', () => {
    const html = render(tier);
    expect(html.match(/<a /g)).toHaveLength(1);
    const link = html.match(/<a [^>]*>/)![0];
    expect(link).toContain('data-wowhead=');
    expect(link).toContain('absolute inset-0 z-10 rounded-lg');
    expect(link).toContain('tabindex="-1"');
    expect(link).toContain('aria-hidden="true"');
    expect(html).toContain('></a>');
    expect(html).toContain('aria-label="Birkibjörn, Shoulders:');
  });

  it('keeps the button label and hover title on an empty cell, with no link', () => {
    const html = render({ ...tier, state: 'missing', equipped: null, equippedStats: null });
    expect(html).not.toContain('<a ');
    expect(html).toContain('aria-label="Birkibjörn, Shoulders:');
    expect(html).toMatch(/<button[^>]* title="/);
  });
});
