import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { BossTacticsView, DungeonPageView } from '@/server/views/types';
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

const tactics: BossTacticsView = {
  description: 'A king of hollow things.',
  overview: [{ kind: 'paragraph', parts: [{ text: 'Mind the ' }, { spell: 'Void Fissure', spellId: 12 }, { text: ' and the ' }, { spell: 'Mystery', spellId: null }, { text: '.' }] }],
  roles: [{ title: 'Tanks', blocks: [{ kind: 'list', items: [[{ text: 'Face away.' }], [{ text: '<b>Not html</b>' }]] }] }],
  abilities: [{ name: 'Umbral Rupture', spellId: 11, blocks: [], abilities: [{ name: 'Void Fissure', spellId: null, blocks: [], abilities: [] }] }],
};

describe('boss tactics', () => {
  const html = render({ ...view, bosses: [{ ...view.bosses[0]!, tactics }, view.bosses[1]!] });

  it('adds one closed Tactics disclosure, only for a boss that has tactics', () => {
    expect(html.match(/<details/g)).toHaveLength(1);
    expect(html).not.toMatch(/<details[^>]* open/);
    expect(html).toMatch(/<summary[^>]*>Tactics<\/summary>/);
  });

  it('shows the description, role headings and the abilities list', () => {
    expect(html).toContain('A king of hollow things.');
    expect([...html.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1])).toEqual(['Tanks', 'Abilities']);
    expect(html).toContain('<li>Face away.</li>');
  });

  it('links spells with a Wowhead tooltip, and shows an unknown spell as bold text', () => {
    expect(html).toMatch(/<a[^>]*href="https:\/\/www\.wowhead\.com\/spell=12"[^>]*data-wowhead="spell=12"[^>]*>Void Fissure<\/a>/);
    expect(html).toMatch(/<a[^>]*href="https:\/\/www\.wowhead\.com\/spell=11"[^>]*rel="noreferrer"[^>]*>Umbral Rupture<\/a>/);
    expect(html).toContain('<strong>Mystery</strong>');
  });

  it('renders journal text as text, never as markup', () => {
    expect(html).toContain('&lt;b&gt;Not html&lt;/b&gt;');
    expect(html).not.toContain('<b>Not html');
  });
});

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
