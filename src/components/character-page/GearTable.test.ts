import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GearRowView } from '@/server/views/types';
import { GearTable } from './GearTable';

const equipped = { itemId: 271528, name: 'Enigmatic Dreamwatcher’s Somnolent Stare', itemLevel: 321, quality: 'EPIC' as const, bonusIds: [12], iconUrl: null, trackLabel: 'Myth 2/6' };
const row: GearRowView = {
  slotLabel: 'Head', slot: 'HEAD', state: 'done', equipped, equippedStats: null, upgrade: null,
  bis: { kind: 'item', ...equipped, isTier: false, isCatalyst: false, source: '', targetStats: null, targetIsTierPiece: false },
};
const render = (rows: GearRowView[], bisLoading: boolean) =>
  renderToStaticMarkup(createElement(GearTable, { rows, tracksKnown: true, bisLoading })).replace(/<link[^>]*\/>/g, '');

describe('GearTable loading', () => {
  it('shows skeleton rows under the real header while the BiS list loads', () => {
    const html = render([], true);
    expect(html).toContain('>Equipped<');
    expect((html.match(/animate-pulse/g) ?? []).length).toBeGreaterThanOrEqual(16 * 3);
    expect(html).toMatch(/<span role="status" class="sr-only">Loading BiS list…<\/span>/);
    expect(html.match(/role="status"/g)).toHaveLength(1);
  });

  it('keeps real rows when it has them, even while the BiS list reloads', () => {
    const html = render([row], true);
    expect(html).toContain('Enigmatic Dreamwatcher’s Somnolent Stare');
    expect(html).not.toContain('animate-pulse');
  });

  it('says there is no list when nothing is loading', () => {
    expect(render([], false)).toContain('No BiS list to compare against yet.');
  });
});
