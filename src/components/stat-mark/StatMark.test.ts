import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { GearRowView } from '@/server/views/types';
import { StatMark } from './StatMark';

// useApiAction calls useRouter, which a static render has no App Router context for. vi.mock is hoisted above the imports.
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }) }));

const equipped = { itemId: 271526, name: 'Enigmatic Dreamwatcher’s Plumage', itemLevel: 334, quality: 'EPIC' as const, bonusIds: [12], iconUrl: null, trackLabel: 'Myth 6/6' };
const unverified: GearRowView = {
  slotLabel: 'Shoulders', slot: 'SHOULDER', state: 'done', equipped, equippedStats: null, statsUnverified: true, statsMark: null, upgrade: null,
  bis: { kind: 'item', ...equipped, isTier: true, isCatalyst: true, source: '', targetStats: ['CRIT_RATING', 'HASTE_RATING'], targetIsTierPiece: false },
};
const render = (row: GearRowView) => renderToStaticMarkup(createElement(StatMark, { characterId: 7, row }));

describe('StatMark', () => {
  it('offers right and wrong on an unverified row', () => {
    const html = render(unverified);
    expect(html).toContain('Right stats');
    expect(html).toContain('Wrong stats');
    expect(html).not.toContain('Clear mark');
  });

  it('offers only Clear mark on a marked row', () => {
    const html = render({ ...unverified, statsUnverified: false, statsMark: 'right' });
    expect(html).toContain('Clear mark');
    expect(html).not.toContain('Right stats');
  });

  it('renders nothing for any other row', () => {
    expect(render({ ...unverified, statsUnverified: false })).toBe('');
    expect(render({ ...unverified, equipped: null })).toBe('');
  });
});
