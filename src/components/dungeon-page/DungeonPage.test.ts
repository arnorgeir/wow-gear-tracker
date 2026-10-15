import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DungeonPageView } from '@/server/views/types';
import { DungeonPage } from './DungeonPage';

const render = (view: DungeonPageView) => renderToStaticMarkup(createElement(DungeonPage, { view })).replace(/<link[^>]*\/>/g, '');
const view: DungeonPageView = {
  challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', imageUrl: null, split: false,
  bosses: [
    { encounterId: 9, name: 'First Boss', items: [
      { itemId: 100, name: 'Hollow Robe', quality: 'EPIC', iconUrl: null, inventoryType: 'ROBE', armorType: 'leather', stats: ['HASTE_RATING', 'MASTERY_RATING'] },
      { itemId: 101, name: 'Vanished Charm', quality: 'EPIC', iconUrl: null, inventoryType: 'TRINKET', armorType: null, stats: null },
    ], tactics: null },
    { encounterId: 3, name: 'Second Boss', items: [{ itemId: 102, name: 'Warden Helm', quality: 'EPIC', iconUrl: null, inventoryType: 'HEAD', armorType: 'plate', stats: null }], tactics: null },
  ],
};

describe('DungeonPage', () => {
  it('names the dungeon, then each boss in order with a Wowhead link per item', () => {
    const html = render(view);
    expect(html).toMatch(/<h1[^>]*>Alpha Hollow<\/h1>/);
    expect([...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((m) => m[1])).toEqual(['First Boss', 'Second Boss']);
    expect([...html.matchAll(/href="https:\/\/www\.wowhead\.com\/item=(\d+)"/g)].map((m) => m[1])).toEqual(['100', '101', '102']);
    expect(html).toContain('Leather chest');
    expect(html).toContain('Trinket');
  });

  it('shows the split note only for a split dungeon', () => {
    expect(render(view)).not.toContain('Split dungeon');
    expect(render({ ...view, split: true })).toContain('Split dungeon');
  });

  it('shows a stats line only for an item with stats', () => {
    const html = render(view);
    expect(html).toContain('Haste/Mastery');
    expect(html.match(/Haste\/Mastery|Vers|Crit/g)).toHaveLength(1);
  });
});
