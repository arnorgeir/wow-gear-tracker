import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { BossTacticsView, DungeonPageView } from '@/server/views/types';
import { DungeonPage } from './DungeonPage';
import type { GuideState } from './guide-state';

const render = (v: DungeonPageView, state: GuideState = { boss: null, tab: 'overview' }) =>
  renderToStaticMarkup(createElement(DungeonPage, { view: v, state })).replace(/<link[^>]*\/>/g, '');
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
  abilities: [
    { name: 'Umbral Rupture', spellId: 11, blocks: [], abilities: [{ name: 'Void Fissure', spellId: null, blocks: [], abilities: [] }] },
    { name: 'Hollow Spawn', spellId: null, blocks: [{ kind: 'paragraph', parts: [{ text: 'Adds arrive.' }] }], abilities: [{ name: 'Gnaw', spellId: 13, blocks: [], abilities: [] }] },
    { name: 'Lone Strike', spellId: null, blocks: [], abilities: [] },
  ],
};
const withTactics: DungeonPageView = { ...view, bosses: [{ ...view.bosses[0]!, tactics }, view.bosses[1]!] };

describe('boss overview', () => {
  const html = render(withTactics, { boss: 9, tab: 'overview' });

  it('shows the description, the overview, and each role as an open disclosure', () => {
    expect(html).toContain('A king of hollow things.');
    expect(html.match(/<details[^>]* open/g)).toHaveLength(1);
    expect(html).toMatch(/<summary[^>]*>Tanks<\/summary>/);
    expect(html).toContain('<li>Face away.</li>');
  });

  it('links spells with a Wowhead tooltip, and shows an unknown spell as bold text', () => {
    expect(html).toMatch(/<a[^>]*href="https:\/\/www\.wowhead\.com\/spell=12"[^>]*data-wowhead="spell=12"[^>]*>Void Fissure<\/a>/);
    expect(html).toContain('<strong>Mystery</strong>');
  });

  it('renders journal text as text, never as markup', () => {
    expect(html).toContain('&lt;b&gt;Not html&lt;/b&gt;');
    expect(html).not.toContain('<b>Not html');
  });

  it('says so when the boss has no journal entry, and the loot tab still lists its items', () => {
    const empty = render(view, { boss: 9, tab: 'overview' });
    expect(empty).toContain('No journal entry for this boss yet.');
    expect(render(view, { boss: 9, tab: 'loot' })).toContain('Hollow Robe');
  });
});

describe('boss abilities', () => {
  const html = render(withTactics, { boss: 9, tab: 'abilities' });

  it('links a spell in the summary, and keeps a spell-less group named with its text and children', () => {
    expect(html).toMatch(/<summary[^>]*><a[^>]*href="https:\/\/www\.wowhead\.com\/spell=11"[^>]*rel="noreferrer"[^>]*>Umbral Rupture<\/a><\/summary>/);
    expect(html).toMatch(/<summary[^>]*>Hollow Spawn<\/summary>[\s\S]*Adds arrive\.[\s\S]*Gnaw/);
  });

  it('shows a leaf ability with no text as a plain list item', () => {
    expect(html).toMatch(/<li><span[^>]*>Lone Strike<\/span><\/li>/);
    expect(html.match(/<details/g)).toHaveLength(2);
  });
});

describe('DungeonPage', () => {
  it('names the dungeon, then lists the bosses in order as banners', () => {
    const html = render(view, { boss: null, tab: 'loot' });
    expect(html).toMatch(/<h1[^>]*>Alpha Hollow<\/h1>/);
    expect(html).toMatch(/<h2[^>]*>Alpha Hollow<\/h2>/);
    expect([...html.matchAll(/href="\/dungeons\/501\?boss=(\d+)&amp;tab=loot"/g)].map((m) => m[1])).toEqual(['9', '3']);
    expect(html.indexOf('First Boss')).toBeLessThan(html.indexOf('Second Boss'));
  });

  it('has a breadcrumb that ends on the current item', () => {
    const dungeon = render(view);
    expect(dungeon).toMatch(/<nav aria-label="Breadcrumb"[^>]*>[\s\S]*<a[^>]*href="\/dungeons"[^>]*>Dungeons<\/a>/);
    expect(dungeon).toMatch(/<span aria-current="page">Alpha Hollow<\/span>/);
    const boss = render(view, { boss: 3, tab: 'overview' });
    expect(boss).toMatch(/<a[^>]*href="\/dungeons\/501"[^>]*>Alpha Hollow<\/a>/);
    expect(boss).toMatch(/<span aria-current="page">Second Boss<\/span>/);
  });

  it('marks the chosen banner and ribbon, and shows Abilities only with a boss', () => {
    const dungeon = render(view);
    expect(dungeon).not.toContain('Abilities');
    expect(dungeon.match(/aria-current="page"/g)).toHaveLength(3); // breadcrumb, Overview row, Overview ribbon
    const boss = render(view, { boss: 3, tab: 'loot' });
    expect(boss).toMatch(/<a[^>]*aria-current="page"[^>]*>(<[^>]+>)*2(<[^>]+>)*Second Boss/);
    expect(boss).toMatch(/<a[^>]*aria-current="page"[^>]*>Loot<\/a>/);
    expect(boss).toMatch(/<a[^>]*href="\/dungeons\/501\?boss=3&amp;tab=abilities"[^>]*>Abilities<\/a>/);
    expect(boss.match(/aria-current="page"/g)).toHaveLength(3); // breadcrumb, banner, ribbon
  });

  it('keeps the tab when moving to another boss', () => {
    expect(render(view, { boss: 3, tab: 'loot' })).toContain('href="/dungeons/501?boss=9&amp;tab=loot"');
  });

  it('shows the dungeon overview as art and one entry per boss, with its description', () => {
    const html = render(withTactics);
    expect(html).toMatch(/<h3[^>]*><a[^>]*href="\/dungeons\/501\?boss=9"[^>]*>First Boss<\/a><\/h3>/);
    expect(html).toContain('A king of hollow things.');
  });

  it('lists every item on the dungeon loot tab with its boss, and one boss only on a boss', () => {
    const all = render(view, { boss: null, tab: 'loot' });
    expect([...all.matchAll(/href="https:\/\/www\.wowhead\.com\/item=(\d+)"/g)].map((m) => m[1])).toEqual(['100', '101', '102']);
    expect(all).toContain('Leather chest, First Boss');
    expect(all).toContain('Trinket, First Boss');
    expect(all).toContain('Plate head, Second Boss');
    const one = render(view, { boss: 3, tab: 'loot' });
    expect([...one.matchAll(/href="https:\/\/www\.wowhead\.com\/item=(\d+)"/g)].map((m) => m[1])).toEqual(['102']);
    expect(one).toContain('Plate head');
    expect(one).not.toContain('Plate head, ');
  });

  it('shows the split note on every tab and with a boss chosen', () => {
    const split = { ...view, split: true };
    expect(render(view)).not.toContain('Split dungeon');
    for (const state of [{ boss: null, tab: 'overview' }, { boss: null, tab: 'loot' }, { boss: 9, tab: 'overview' }] as GuideState[]) {
      expect(render(split, state)).toContain('Split dungeon');
    }
  });

  it('shows a stats line only for an item with stats', () => {
    const html = render(view, { boss: null, tab: 'loot' });
    expect(html).toContain('Haste/Mastery');
    expect(html.match(/Haste\/Mastery|Vers|Crit/g)).toHaveLength(1);
  });
});
