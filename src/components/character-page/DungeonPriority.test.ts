import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PriorityView } from '@/server/views/types';
import { DungeonPriority } from './DungeonPriority';

// React 19 hoists <link rel="preload"> tags for images ahead of the markup.
const render = (priority: PriorityView) =>
  renderToStaticMarkup(createElement(DungeonPriority, { priority, specLabel: 'Feral Druid' })).replace(/<link[^>]*\/>/g, '');
const base: PriorityView = { listType: 'mythicPlus', fellBack: false, season: 'ready', needsSync: false, bisLoading: false, approximate: false, dungeons: [], nothingFrom: [] };

describe('DungeonPriority', () => {
  it('ranks dungeons with their credits and lists the rest apart', () => {
    const html = render({
      ...base,
      dungeons: [{ challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', imageUrl: null, score: 7, split: false, credits: [
        { kind: 'tier', slotLabel: 'Chest', weight: 4, fit: 'alternative', dropStats: ['MASTERY_RATING', 'VERSATILITY'], targetName: 'Primordial Robe of Rites', targetStats: ['HASTE_RATING', 'MASTERY_RATING'],
          item: { itemId: 80, name: 'Hoarded Harvest Wrap', itemLevel: null, quality: 'EPIC', bonusIds: [], iconUrl: null, trackLabel: null } },
        { kind: 'any', slotLabel: 'Shoulders', weight: 3, minItemLevel: 334 },
      ] }],
      nothingFrom: ['Beta Spire', 'Gamma Deep'],
    });
    expect(html).toContain('Mythic+ list');
    expect(html).toContain('Alpha Hollow');
    expect(html).toContain('Hoarded Harvest Wrap');
    expect(html).toContain('Chest · catalyst alternative (Mastery/Vers, BiS Haste/Mastery) · weight 4');
    expect(html).toContain('Any item, level 334+');
    expect(html).toContain('Nothing you need from: Beta Spire, Gamma Deep.');
  });

  it('says so while the season loads, and when it could not load', () => {
    expect(render({ ...base, season: 'loading' })).toContain('Loading this season’s loot…');
    const failed = render({ ...base, season: 'failed' });
    expect(failed).toContain('couldn’t be loaded. It will retry within the hour.');
    expect(failed).not.toContain('Nothing you need from');
  });

  it('explains the fallback, approximate weights, older data and an empty ranking', () => {
    const html = render({ ...base, listType: 'overall', fellBack: true, approximate: true, season: 'stale', nothingFrom: ['Alpha Hollow'] });
    expect(html).toContain('Using the Overall list: Method has no Mythic+ list for Feral Druid.');
    expect(html).toContain('Weights are approximate while upgrade track data is unavailable.');
    expect(html).toContain('Showing older loot data');
    expect(html).toContain('No season dungeon drops anything you still need.');
    expect(html).not.toContain('Nothing you need from');
  });

  it('says the BiS list is loading instead of ranking', () => {
    const html = render({ ...base, bisLoading: true, season: 'loading' });
    expect(html).toContain('Loading BiS list…');
    expect(html).not.toContain('Loading this season’s loot…');
  });

  it('shows skeleton rows under the real heading while the season or BiS list loads', () => {
    for (const p of [{ ...base, season: 'loading' as const }, { ...base, bisLoading: true }]) {
      const html = render(p);
      expect(html).toContain('Dungeon priority</h2>');
      expect(html).toContain('animate-pulse');
      expect(html.match(/role="status"/g)).toHaveLength(1);
    }
    expect(render({ ...base, season: 'loading' })).toMatch(/<span role="status" class="sr-only">Loading this season’s loot…<\/span>/);
  });

  it('marks a split dungeon', () => {
    const html = render({ ...base, dungeons: [{ challengeModeId: 502, name: 'Streets of Beta', shortName: 'STRT', imageUrl: null, score: 3, split: true, credits: [] }] });
    expect(html).toContain('Split dungeon');
  });

  it('puts a gold dungeons icon in the heading, beside its text', () => {
    const html = render(base);
    expect(html).toMatch(/<h2 class="flex items-center gap-2\.5[^"]*"><svg[^>]*aria-hidden="true"[^>]*class="shrink-0 text-gold"[^>]*>.*<\/svg>Dungeon priority<\/h2>/);
  });

  it('makes each dungeon a details row like the group page, the first one open', () => {
    const d = (challengeModeId: number, name: string, score: number, split = false) =>
      ({ challengeModeId, name, shortName: '', imageUrl: null, score, split, credits: [{ kind: 'any' as const, slotLabel: 'Boots', weight: score, minItemLevel: 334 }] });
    const html = render({ ...base, dungeons: [d(501, 'Alpha Hollow', 8), d(502, 'Streets of Beta', 3, true)] });
    expect(html.match(/<details/g)).toHaveLength(2);
    expect(html.match(/<details open=""/g)).toHaveLength(1);
    expect(html.indexOf('<details open=""')).toBeLessThan(html.indexOf('Alpha Hollow'));
    expect(html).toMatch(/<h3 class="min-w-0 truncate[^"]*">Alpha Hollow<\/h3>/);
    expect(html).toContain('<span class="sr-only">Score </span>8');
    expect(html).toMatch(/>2<\/span>/);
    const second = html.slice(html.lastIndexOf('<details'));
    expect(second.indexOf('Split dungeon')).toBeGreaterThan(second.indexOf('</summary>'));
    expect(second.indexOf('Any item, level 334+')).toBeGreaterThan(second.indexOf('</summary>'));
  });
});
