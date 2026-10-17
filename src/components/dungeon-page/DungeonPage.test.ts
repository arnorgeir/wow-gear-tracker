import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BossTacticsView, DungeonPageView, LootBisView, LootNeedView } from '@/server/views/types';
import { DungeonPage } from './DungeonPage';
import type { GuideState } from './guide-state';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }) }));

const render = (v: DungeonPageView, state: Pick<GuideState, 'boss' | 'tab'> & Partial<GuideState> = { boss: null, tab: 'overview' }) =>
  renderToStaticMarkup(createElement(DungeonPage, { view: v, state: { show: 'wanted', who: 'all', ...state } })).replace(/<link[^>]*\/>/g, '');
const view: DungeonPageView = {
  challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', imageUrl: null, split: false,
  neededCount: 0, coverage: { evaluated: 0, excluded: [] }, lens: { who: 'all', groupRemembered: false },
  bosses: [
    { encounterId: 9, name: 'First Boss', items: [
      { itemId: 100, name: 'Hollow Robe', quality: 'EPIC', iconUrl: null, inventoryType: 'ROBE', armorType: 'leather', stats: ['HASTE_RATING', 'MASTERY_RATING'], neededBy: [], bisFor: [] },
      { itemId: 101, name: 'Vanished Charm', quality: 'EPIC', iconUrl: null, inventoryType: 'TRINKET', armorType: null, stats: null, neededBy: [], bisFor: [] },
    ], tactics: null, neededCount: 0 },
    { encounterId: 3, name: 'Second Boss', items: [{ itemId: 102, name: 'Warden Helm', quality: 'EPIC', iconUrl: null, inventoryType: 'HEAD', armorType: 'plate', stats: null, neededBy: [], bisFor: [] }], tactics: null, neededCount: 0 },
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
    expect(render(view, { boss: 9, tab: 'loot', show: 'all' })).toContain('Hollow Robe');
  });
});

describe('boss abilities', () => {
  const html = render(withTactics, { boss: 9, tab: 'abilities' });

  it('links a spell in the summary, and keeps a spell-less group named with its text and children', () => {
    expect(html).toMatch(/<summary[^>]*>(<svg[\s\S]*?<\/svg>)?<a[^>]*href="https:\/\/www\.wowhead\.com\/spell=11"[^>]*rel="noreferrer"[^>]*>Umbral Rupture<\/a><\/summary>/);
    expect(html).toMatch(/<summary[^>]*>(<svg[\s\S]*?<\/svg>)?Hollow Spawn<\/summary>[\s\S]*Adds arrive\.[\s\S]*Gnaw/);
  });

  it('marks every expandable ability with a chevron that turns when open', () => {
    const summaries = [...html.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>/g)].map((m) => m[1]);
    expect(summaries).toHaveLength(2);
    for (const s of summaries) expect(s).toMatch(/^<svg[^>]*aria-hidden="true"[^>]*class="[^"]*\[details\[open\]&gt;summary&gt;&amp;\]:rotate-90/);
  });

  it('shows a leaf ability with no text as a plain list item', () => {
    expect(html).toMatch(/<li[^>]*><span[^>]*>Lone Strike<\/span><\/li>/);
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
    // The picked ribbon carries more than a color change: a gold edge bar on a gold-soft fill.
    const loot = boss.match(/<a[^>]*>Loot<\/a>/)![0];
    expect(loot).toMatch(/bg-gold-soft/);
    expect(loot).toMatch(/shadow-\[inset/);
    expect(boss).toMatch(/<a[^>]*href="\/dungeons\/501\?boss=3&amp;tab=abilities"[^>]*>Abilities<\/a>/);
    expect(boss.match(/aria-current="page"/g)).toHaveLength(5); // breadcrumb, banner, ribbon, and the Wanted and Everyone switches
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
    const all = render(view, { boss: null, tab: 'loot', show: 'all' });
    expect([...all.matchAll(/href="https:\/\/www\.wowhead\.com\/item=(\d+)"/g)].map((m) => m[1])).toEqual(['100', '101', '102']);
    expect(all).toContain('Leather chest, First Boss');
    expect(all).toContain('Trinket, First Boss');
    expect(all).toContain('Plate head, Second Boss');
    const one = render(view, { boss: 3, tab: 'loot', show: 'all' });
    expect([...one.matchAll(/href="https:\/\/www\.wowhead\.com\/item=(\d+)"/g)].map((m) => m[1])).toEqual(['102']);
    expect(one).toContain('Plate head');
    expect(one).not.toContain('Plate head, ');
  });

  it('shows the split note on every tab and with a boss chosen', () => {
    const split = { ...view, split: true };
    expect(render(view)).not.toContain('Split dungeon');
    for (const state of [{ boss: null, tab: 'overview', show: 'wanted', who: 'all' }, { boss: null, tab: 'loot' }, { boss: 9, tab: 'overview' }] as GuideState[]) {
      expect(render(split, state)).toContain('Split dungeon');
    }
  });

  it('shows a stats line only for an item with stats', () => {
    const html = render(view, { boss: null, tab: 'loot', show: 'all' });
    expect(html).toContain('Haste/Mastery');
    expect(html.match(/Haste\/Mastery|Vers|Crit/g)).toHaveLength(1);
  });
});

describe('loot needs', () => {
  const need = (name: string, extra: Partial<LootNeedView> = {}): LootNeedView =>
    ({ key: `eu.argent-dawn.${name.toLowerCase()}`, name, className: 'Druid', avatarUrl: null, classIconUrl: null, slotLabel: 'Ring', via: 'drop', reason: 'missing', ...extra });
  const spec = (n: number): LootBisView => ({ slug: `spec-${n}`, label: `Spec ${n} Druid`, className: 'Druid', iconUrl: null });
  const base = (): DungeonPageView => ({
    ...view,
    neededCount: 2,
    bosses: [
      { ...view.bosses[0]!, neededCount: 2, items: [
        { ...view.bosses[0]!.items[0]!, neededBy: [need('Birkibjörn'), need('Sólrún', { via: 'catalyst', fit: 'unverified' })], bisFor: [spec(1)] },
        { ...view.bosses[0]!.items[1]!, neededBy: [need('Hrafnhildur', { reason: 'wrongStats' })], bisFor: [] },
      ] },
      { ...view.bosses[1]!, neededCount: 0 },
    ],
  });
  const loot = (v: DungeonPageView, state: Partial<GuideState> = {}, layout: 'grid' | 'list' = 'grid') =>
    renderToStaticMarkup(createElement(DungeonPage, { view: v, layout, state: { boss: null, tab: 'loot', show: 'wanted', who: 'all', ...state } })).replace(/<link[^>]*\/>/g, '');

  it('shows need counts in words on banners and the overview row, and nothing at zero', () => {
    const html = loot(base());
    expect(html).toMatch(/Dungeon overview<\/span><span[^>]*>2 needed</);
    expect(html).toMatch(/First Boss<\/span><span[^>]*>2 needed</);
    expect(html).not.toMatch(/Second Boss<\/span><span[^>]*>0 needed/);
    expect(html.match(/ needed</g)).toHaveLength(2);
    expect(loot({ ...base(), neededCount: 0, bosses: base().bosses.map((b) => ({ ...b, neededCount: 0 })) })).not.toContain(' needed<');
  });

  it('shows the lens switch with Everyone current, and My group as a link', () => {
    const html = loot({ ...base(), lens: { who: 'all', groupRemembered: true } });
    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*>Everyone<\/a>/);
    expect(html).toMatch(/<a[^>]*href="\/dungeons\/501\?tab=loot&amp;who=group"[^>]*>My group<\/a>/);
    const group = loot({ ...base(), lens: { who: 'group', groupRemembered: true } }, { who: 'group' });
    expect(group).toMatch(/<a[^>]*aria-current="page"[^>]*>My group<\/a>/);
  });

  it('sends My group to the group page when no group is remembered', () => {
    const html = loot(base());
    expect(html).toMatch(/<a[^>]*href="\/group"[^>]*>My group<\/a>/);
    expect(html).toContain('Pick a group first');
  });

  it('shows wanted drops by default with the count on the switch, and every drop on request', () => {
    const wanted = loot(base());
    expect([...wanted.matchAll(/href="https:\/\/www\.wowhead\.com\/item=(\d+)"/g)].map((m) => m[1])).toEqual(['100', '101']);
    expect(wanted).toMatch(/<a[^>]*aria-current="page"[^>]*>Wanted \(2\)<\/a>/);
    expect(wanted).toMatch(/<a[^>]*href="\/dungeons\/501\?tab=loot&amp;show=all"[^>]*>All drops<\/a>/);
    const all = loot(base(), { show: 'all' });
    expect([...all.matchAll(/href="https:\/\/www\.wowhead\.com\/item=(\d+)"/g)].map((m) => m[1])).toEqual(['100', '101', '102']);
    expect(all).toMatch(/<a[^>]*aria-current="page"[^>]*>All drops<\/a>/);
  });

  it('words each need, with the route and the stat caveat', () => {
    const html = loot(base());
    expect(html).toContain('Needed by');
    expect(html).toContain('Birkibjörn');
    expect(html).toContain('via Catalyst, stats unverified');
    expect(html).toContain('has wrong stats');
  });

  it('puts characters past the third and specs past the sixth in a disclosure', () => {
    const v = base();
    v.bosses[0]!.items[0] = { ...v.bosses[0]!.items[0]!, neededBy: ['Ásta', 'Birkibjörn', 'Hrafnhildur', 'Sólrún'].map((n) => need(n)), bisFor: [1, 2, 3, 4, 5, 6, 7].map(spec) };
    const html = loot(v);
    expect(html).toMatch(/<summary[^>]*>\+1 more<\/summary>/);
    expect(html).toMatch(/<summary[^>]*>BiS for 7 specs<\/summary>/);
    expect(html).toMatch(/<details[^>]*>(?:(?!<\/details>)[\s\S])*Spec 7 Druid/);
    expect(html.match(/class="sr-only">Spec \d Druid</g)).toHaveLength(6);
    expect(loot(base())).toMatch(/<summary[^>]*>BiS for 1 spec<\/summary>/);
    expect(loot(base()).match(/\+\d+ more/g)).toBeNull();
  });

  it('leaves out a row with nothing to show', () => {
    const html = loot(base(), { boss: 9 });
    expect(html.match(/>BiS for</g)).toHaveLength(1);
    expect(html.match(/>Needed by</g)).toHaveLength(2);
  });

  it('says nobody could be checked, with each name and reason, and still shows BiS for', () => {
    const v = base();
    v.coverage = { evaluated: 0, excluded: [{ name: 'Birkibjörn', reason: 'syncing' }, { name: 'Sólrún', reason: 'no gear yet' }] };
    v.bosses[0]!.items = v.bosses[0]!.items.map((i) => ({ ...i, neededBy: [] }));
    const html = loot(v);
    expect(html).toContain('No character could be checked yet.');
    expect(html).toContain('Birkibjörn (syncing), Sólrún (no gear yet)');
    expect(html).toContain('BiS for 1 spec');
  });

  it('names the characters it left out as one muted line', () => {
    const v = base();
    v.coverage = { evaluated: 1, excluded: [{ name: 'Birkibjörn', reason: 'syncing' }] };
    const html = loot(v);
    expect(html).toContain('Not checked: Birkibjörn (syncing).');
    expect(html).not.toContain('No character could be checked yet.');
  });

  it('explains an empty Wanted list and links to All drops', () => {
    const v = base();
    v.bosses[0]!.items = v.bosses[0]!.items.map((i) => ({ ...i, neededBy: [], bisFor: [] }));
    const html = loot(v);
    expect(html).toContain('Nothing here is wanted by the characters checked or your BiS lists.');
    expect(html).toMatch(/<a[^>]*href="\/dungeons\/501\?tab=loot&amp;show=all"[^>]*>All drops<\/a>/);
    expect(loot(v, { boss: 9 })).toContain('Nothing from this boss is wanted by the characters checked or your BiS lists.');
    expect(loot(v, { show: 'all' })).not.toContain('Nothing here is wanted');
  });

  it('lists in rows with column headers and the spec names as text', () => {
    const html = loot(base(), {}, 'list');
    expect([...html.matchAll(/role="columnheader"[^>]*>([^<]*)</g)].map((m) => m[1])).toEqual(['Item', 'Needed by', 'BiS for']);
    expect(html).toContain('Spec 1 Druid');
    expect(html).toContain('Birkibjörn');
    expect(html.match(/role="row"/g)).toHaveLength(3);
  });

  it('shows the layout toggle on the loot tab only, remembered under its own name', () => {
    expect(loot(base())).toContain('name="dungeon-loot-view"');
    expect(render(base(), { boss: null, tab: 'overview' })).not.toContain('dungeon-loot-view');
  });

  it('keeps the filter and lens when moving between bosses and tabs', () => {
    const html = loot(base(), { show: 'all', who: 'group' });
    expect(html).toContain('href="/dungeons/501?boss=3&amp;tab=loot&amp;show=all&amp;who=group"');
    expect(html).toContain('href="/dungeons/501?show=all&amp;who=group"');
  });
});
