import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { BisSourceId, ListType } from '@/core/types';
import type { GearRowView } from '@/server/views/types';
import { GearTable } from './GearTable';

const equipped = { itemId: 271528, name: 'Enigmatic Dreamwatcher’s Somnolent Stare', itemLevel: 321, quality: 'EPIC' as const, bonusIds: [12], iconUrl: null, trackLabel: 'Myth 2/6' };
const row: GearRowView = {
  slotLabel: 'Head', slot: 'HEAD', state: 'done', equipped, equippedStats: null, statsUnverified: false, statsMark: null, upgrade: null,
  bis: { kind: 'item', ...equipped, isTier: false, isCatalyst: false, source: '', targetStats: null, targetIsTierPiece: false },
};
const render = (rows: GearRowView[], bisLoading: boolean, fellBackFrom: ListType | null = null, source: BisSourceId = 'method') =>
  renderToStaticMarkup(createElement(GearTable, { rows, tracksKnown: true, bisLoading, listType: 'raid', specSlug: 'guardian-druid', editedCount: 2, doneCount: 1, fellBackFrom, source })).replace(/<link[^>]*\/>/g, '');

describe('GearTable source', () => {
  it('names the compared list and links the source badge to its settings', () => {
    const html = render([row], false);
    expect(html).toContain('>Raid BiS<');
    expect(html).toContain('href="/settings/bis/guardian-druid"');
    expect(html).toContain('From Method');
    expect(html).toContain('2 edited');
  });

  it('counts done rows against the list', () => {
    expect(render([row, row, row], false)).toContain('1/3 done');
  });

  it('says when the chosen list is missing and Overall is shown', () => {
    const html = render([row], false, 'raid');
    expect(html).toContain('Method has no Raid list for this spec. Showing Overall.');
    expect(render([row], false)).not.toContain('Showing Overall');
    expect(render([row], false, 'raid', 'icyVeins')).toContain('Icy Veins has no Raid list for this spec. Showing Overall.');
    expect(render([row], false, 'raid', 'manual')).toContain('Your copy has no Raid list for this spec. Showing Overall.');
  });
});

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

describe('GearTable equipped stats', () => {
  const tier: GearRowView = {
    ...row, equippedStats: ['CRIT_RATING', 'HASTE_RATING'],
    bis: { kind: 'item', ...equipped, isTier: true, isCatalyst: true, source: '', targetStats: ['CRIT_RATING', 'HASTE_RATING'], targetIsTierPiece: false },
  };

  it("shows a tier row's pair on its own line", () => {
    const html = render([tier], false);
    expect(html).toMatch(/<span class="[^"]*font-mono[^"]*">Crit\/Haste<\/span>/);
    expect(html).not.toContain('321 · Crit/Haste');
  });

  it('shows no pair on a non-tier row', () => {
    expect(render([{ ...row, equippedStats: ['CRIT_RATING', 'HASTE_RATING'] }], false)).not.toContain('Crit/Haste');
  });
});
