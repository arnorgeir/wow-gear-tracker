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
  members: [{ ...credits, credits: [{ kind: 'tier', slotLabel: 'Chest', weight: 5, item: { itemId: 80, name: 'Tier Robe', itemLevel: null, quality: 'EPIC', bonusIds: [], iconUrl: null, trackLabel: null } }] }], ...over,
});
const band: PriorityCreditView = { kind: 'item', slotLabel: 'Ring 1', weight: 4,
  item: { itemId: 101, name: 'Vanished Band', itemLevel: null, quality: 'EPIC', bonusIds: [], iconUrl: null, trackLabel: null } };

const plumage = { itemId: 271526, name: 'Enigmatic Dreamwatcher’s Plumage', itemLevel: null, quality: 'EPIC' as const, bonusIds: [], iconUrl: 'https://render.worldofwarcraft.com/icons/56/plumage.jpg', trackLabel: null };

describe('GroupPriority', () => {
  it('ranks dungeons with each member’s needs, and marks only split ones', () => {
    const html = render({ ...base, ranking: { nothingFrom: ['Delta Deep'], dungeons: [
      { challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', imageUrl: null, score: 5, split: false, members: [{ ...credits, credits: [{ kind: 'tier', slotLabel: 'Chest', weight: 5, item: { itemId: 80, name: 'Tier Robe', itemLevel: null, quality: 'EPIC', bonusIds: [], iconUrl: null, trackLabel: null } }] }] },
      { challengeModeId: 502, name: 'Streets of Beta', shortName: 'STRT', imageUrl: null, score: 3, split: true, members: [{ ...credits, credits: [{ kind: 'any', slotLabel: 'Boots', weight: 3, minItemLevel: 334 }] }] },
    ] } });
    expect(html).toContain('Alpha Hollow');
    expect(html).toContain('Tier Robe (Chest), tier: catalyst a chest drop from this dungeon');
    expect(html).toContain('Any boots, level 334+');
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

  it('makes each dungeon a details row, the first one open, in rank order', () => {
    const html = render({ ...base, ranking: { nothingFrom: [], dungeons: [
      dungeon({ challengeModeId: 501, name: 'Alpha Hollow', score: 8 }),
      dungeon({ challengeModeId: 502, name: 'Streets of Beta', score: 3 }),
    ] } });
    expect(html).toContain('<ol');
    expect(html.match(/<details/g)).toHaveLength(2);
    expect(html.match(/<details open=""/g)).toHaveLength(1);
    expect(html.indexOf('<details open=""')).toBeLessThan(html.indexOf('Alpha Hollow'));
    expect(html.indexOf('Alpha Hollow')).toBeLessThan(html.indexOf('Streets of Beta'));
    expect(html.match(/<h3/g)).toHaveLength(2);
    expect(html).toContain('<span class="sr-only">Score </span>8');
    expect(html).toContain('Score = weighted upgrades');
  });

  it('shows a lazy decorative thumbnail, or the short-name tile without one', () => {
    const html = render({ ...base, ranking: { nothingFrom: [], dungeons: [
      dungeon({ challengeModeId: 501 }),
      dungeon({ challengeModeId: 502, name: 'Streets of Beta', shortName: 'STRT', imageUrl: null }),
      dungeon({ challengeModeId: 503, name: 'Unlisted Depths', shortName: '', imageUrl: null }),
    ] } });
    expect(html).toContain(`src="${AH}"`);
    expect(html).toMatch(/<img[^>]*alt=""[^>]*width="48"[^>]*height="36"[^>]*loading="lazy"/);
    expect(html).toContain('decoding="async"');
    expect(html).toMatch(/aria-hidden="true"[^>]*>STRT</);
    expect(html).toMatch(/aria-hidden="true"[^>]*>M[+]</);
  });

  it('shows each benefiting member in the summary with an avatar and their need count', () => {
    const html = render({ ...base, ranking: { nothingFrom: [], dungeons: [dungeon({ members: [{ ...credits, credits: [band, band] }] })] } });
    const summary = html.slice(html.indexOf('<summary'), html.indexOf('</summary>'));
    expect(summary).toContain('title="Birkibjörn: 2 needs"');
    expect(summary).toContain('<span class="sr-only">Birkibjörn: </span>2');
    expect(summary).toContain('<span aria-hidden="true"');
  });

  it('lists each member under their name, one chip per need, with the slot under each', () => {
    const html = render({ ...base, ranking: { nothingFrom: [], dungeons: [dungeon({ members: [
      { ...credits, credits: [band, { kind: 'any', slotLabel: 'Feet', weight: 3, minItemLevel: 334 }] },
      { ...credits, key: 'eu.argent-dawn.hrafnhildur', name: 'Hrafnhildur', credits: [band] },
    ] })] } });
    const body = html.slice(html.indexOf('</summary>'));
    expect(body.split(`href="https://www.wowhead.com/item=101"`).length - 1).toBe(2);
    expect(body).toContain('aria-label="Vanished Band (Ring 1)"');
    expect(body).toContain('>Ring 1</span>');
    expect(body).toContain('>Feet</span>');
    expect(body.indexOf('Birkibjörn')).toBeLessThan(body.indexOf('Any feet, level 334+'));
    expect(body.indexOf('Any feet, level 334+')).toBeLessThan(body.indexOf('Hrafnhildur'));
  });

  it('shows a tier need as the tier piece with a T badge and its short slot, labeled in full', () => {
    const tier: PriorityCreditView = { kind: 'tier', slotLabel: 'Shoulders', weight: 5, item: plumage };
    const html = render({ ...base, ranking: { nothingFrom: [], dungeons: [dungeon({ members: [{ ...credits, credits: [tier] }] })] } });
    expect(html).toContain('href="https://www.wowhead.com/item=271526"');
    expect(html).toContain('aria-label="Enigmatic Dreamwatcher’s Plumage (Shoulders), tier: catalyst a shoulders drop from this dungeon"');
    expect(html).toContain('src="https://render.worldofwarcraft.com/icons/56/plumage.jpg"');
    expect(html).toContain('>T</span>');
    expect(html).toContain('>Shldr</span>');
  });

  it('falls back to a labeled T tile for a tier piece without an icon', () => {
    const tier: PriorityCreditView = { kind: 'tier', slotLabel: 'Chest', weight: 5, item: { ...plumage, iconUrl: null, name: 'Enigmatic Dreamwatcher’s Robe' } };
    const html = render({ ...base, ranking: { nothingFrom: [], dungeons: [dungeon({ members: [{ ...credits, credits: [tier] }] })] } });
    expect(html).not.toContain('<img src="null"');
    expect(html).toContain('aria-label="Enigmatic Dreamwatcher’s Robe (Chest), tier: catalyst a chest drop from this dungeon"');
    expect(html).toContain('>T</span>');
  });

  it('shows an Any need as its item level, with the slot and the weight on hover', () => {
    const any: PriorityCreditView = { kind: 'any', slotLabel: 'Ring', weight: 2, minItemLevel: 334 };
    const html = render({ ...base, ranking: { nothingFrom: [], dungeons: [dungeon({ members: [{ ...credits, credits: [any] }] })] } });
    expect(html).toContain('>334<');
    expect(html).toContain('Any ring, level 334+');
    expect(html).toContain('title="Any ring, level 334+ · weight 2"');
  });

  it('keeps two members with the same display name apart', () => {
    const html = render({ ...base, ranking: { nothingFrom: [], dungeons: [dungeon({ members: [
      { ...credits, credits: [band] },
      { ...credits, key: 'eu.silvermoon.birkibjörn', credits: [band] },
    ] })] } });
    const body = html.slice(html.indexOf('</summary>'));
    expect(body.split(`href="https://www.wowhead.com/item=101"`).length - 1).toBe(2);
    expect(body.match(/>Birkibjörn</g)).toHaveLength(2);
  });

  it('puts the split warning inside its own row, above its members', () => {
    const html = render({ ...base, ranking: { nothingFrom: [], dungeons: [
      dungeon({ challengeModeId: 501 }),
      dungeon({ challengeModeId: 502, name: 'Streets of Beta', split: true }),
    ] } });
    const second = html.slice(html.lastIndexOf('<details'));
    expect(second.indexOf('Split dungeon: loot shown for the whole instance.')).toBeGreaterThan(second.indexOf('</summary>'));
    expect(html.match(/Split dungeon/g)).toHaveLength(1);
  });
});
