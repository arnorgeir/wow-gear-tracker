import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GroupDungeonView, GroupPriorityView, PriorityCreditView } from '@/server/views/types';
import { GroupPriority } from './GroupPriority';

const render = (priority: GroupPriorityView) =>
  renderToStaticMarkup(createElement(GroupPriority, { priority })).replace(/<link[^>]*\/>/g, '');
const base: GroupPriorityView = { season: 'ready', approximate: false, covered: ['Birkibjörn'], excluded: [], fellBack: [], ranking: { dungeons: [], nothingFrom: [] } };
const credits = { key: 'eu.argent-dawn.birkibjörn', name: 'Birkibjörn', className: 'Druid', avatarUrl: null, classIconUrl: null };

const AH = 'https://cdn.raiderio.net/images/dungeons/alpha-hollow.jpg';
const dungeon = (over: Partial<GroupDungeonView>): GroupDungeonView => ({
  challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', imageUrl: AH, score: 5, split: false,
  members: [{ ...credits, credits: [{ kind: 'tier', slotLabel: 'Chest', weight: 5 }] }], ...over,
});
const band: PriorityCreditView = { kind: 'item', slotLabel: 'Ring 1', weight: 4,
  item: { itemId: 101, name: 'Vanished Band', itemLevel: null, quality: 'EPIC', bonusIds: [], iconUrl: null, trackLabel: null } };

describe('GroupPriority', () => {
  it('ranks dungeons with each member’s needs, and marks only split ones', () => {
    const html = render({ ...base, ranking: { nothingFrom: ['Delta Deep'], dungeons: [
      { challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', imageUrl: null, score: 5, split: false, members: [{ ...credits, credits: [{ kind: 'tier', slotLabel: 'Chest', weight: 5 }] }] },
      { challengeModeId: 502, name: 'Streets of Beta', shortName: 'STRT', imageUrl: null, score: 3, split: true, members: [{ ...credits, credits: [{ kind: 'any', slotLabel: 'Boots', weight: 3, minItemLevel: 334 }] }] },
    ] } });
    expect(html).toContain('Alpha Hollow');
    expect(html).toContain('Tier via catalyst');
    expect(html).toContain('Any item, level 334+');
    expect(html.match(/Split dungeon/g)).toHaveLength(1);
    expect(html).toContain('Nothing anyone needs from: Delta Deep.');
  });

  it('says the ranking is unavailable when nobody is eligible, without claiming nothing is needed', () => {
    const html = render({ ...base, covered: [], excluded: [{ name: 'Sólrún', reason: 'no gear yet' }], ranking: null });
    expect(html).toContain('Dungeon priority needs at least one member with gear and a BiS list.');
    expect(html).toContain('Sólrún (no gear yet)');
    expect(html).not.toContain('still needs');
  });

  it('names who a partial ranking covers and who it leaves out', () => {
    const html = render({ ...base, covered: ['Birkibjörn', 'Hrafnhildur'], excluded: [{ name: 'Sólrún', reason: 'no gear yet' }] });
    expect(html).toContain('Covers Birkibjörn and Hrafnhildur. Left out: Sólrún (no gear yet).');
  });

  it('says the group needs nothing only when eligible members need nothing', () => {
    expect(render(base)).toContain('No season dungeon drops anything the group still needs.');
  });

  it('shows the season states, the fallback and approximate weights', () => {
    expect(render({ ...base, season: 'loading' })).toContain('Loading this season’s loot…');
    expect(render({ ...base, season: 'failed' })).toContain('It will retry within the hour.');
    const html = render({ ...base, season: 'stale', approximate: true, fellBack: ['Hrafnhildur'] });
    expect(html).toContain('Showing older loot data');
    expect(html).toContain('Weights are approximate');
    expect(html).toContain('Hrafnhildur uses the Overall list: Method has no Mythic+ list for that spec.');
  });

  it('gives each ranked dungeon its own card and heading, in rank order', () => {
    const html = render({ ...base, ranking: { nothingFrom: [], dungeons: [
      dungeon({ challengeModeId: 501, name: 'Alpha Hollow', score: 8 }),
      dungeon({ challengeModeId: 502, name: 'Streets of Beta', score: 3 }),
    ] } });
    expect(html).toContain('<ol');
    expect(html.match(/<article/g)).toHaveLength(2);
    expect(html.match(/<h3/g)).toHaveLength(2);
    expect(html.indexOf('Alpha Hollow')).toBeLessThan(html.indexOf('Streets of Beta'));
    expect(html).toMatch(/Score<\/span> 8/);
    expect(html).toContain('Score = weighted upgrades');
  });

  it('shows a lazy decorative thumbnail, or the short-name tile without one', () => {
    const html = render({ ...base, ranking: { nothingFrom: [], dungeons: [
      dungeon({ challengeModeId: 501 }),
      dungeon({ challengeModeId: 502, name: 'Streets of Beta', shortName: 'STRT', imageUrl: null }),
      dungeon({ challengeModeId: 503, name: 'Unlisted Depths', shortName: '', imageUrl: null }),
    ] } });
    expect(html).toContain(`src="${AH}"`);
    expect(html).toMatch(/<img[^>]*alt=""[^>]*width="64"[^>]*height="48"[^>]*loading="lazy"/);
    expect(html).toContain('decoding="async"');
    expect(html).toMatch(/aria-hidden="true"[^>]*>STRT</);
    expect(html).toMatch(/aria-hidden="true"[^>]*>M\+</);
  });

  it('lists each member under their name, one card per need, with slots visible', () => {
    const html = render({ ...base, ranking: { nothingFrom: [], dungeons: [dungeon({ members: [
      { ...credits, credits: [band, { kind: 'any', slotLabel: 'Feet', weight: 3, minItemLevel: 334 }] },
      { ...credits, key: 'eu.argent-dawn.hrafnhildur', name: 'Hrafnhildur', credits: [band] },
    ] })] } });
    expect(html.match(/Vanished Band/g)).toHaveLength(2);
    expect(html).toContain('Ring 1');
    expect(html).toContain('Feet');
    expect(html.indexOf('Birkibjörn')).toBeLessThan(html.indexOf('Any item, level 334+'));
    expect(html.indexOf('Any item, level 334+')).toBeLessThan(html.indexOf('Hrafnhildur'));
  });

  it('keeps two members with the same display name apart', () => {
    const html = render({ ...base, ranking: { nothingFrom: [], dungeons: [dungeon({ members: [
      { ...credits, credits: [band] },
      { ...credits, key: 'eu.silvermoon.birkibjörn', credits: [band] },
    ] })] } });
    expect(html.match(/Vanished Band/g)).toHaveLength(2);
    expect(html.match(/>Birkibjörn</g)).toHaveLength(2);
  });

  it('puts the split warning inside its own dungeon’s card, above its members', () => {
    const html = render({ ...base, ranking: { nothingFrom: [], dungeons: [
      dungeon({ challengeModeId: 501 }),
      dungeon({ challengeModeId: 502, name: 'Streets of Beta', split: true }),
    ] } });
    const split = html.indexOf('Split dungeon');
    expect(split).toBeGreaterThan(html.indexOf('Streets of Beta'));
    expect(split).toBeLessThan(html.lastIndexOf('Birkibjörn'));
    expect(html.match(/Split dungeon/g)).toHaveLength(1);
  });
});
