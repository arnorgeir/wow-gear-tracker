import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DungeonList } from './DungeonList';

const render = (dungeons: { challengeModeId: number; name: string; shortName: string; imageUrl: string | null }[]) =>
  renderToStaticMarkup(createElement(DungeonList, { view: { dungeons } }));

describe('DungeonList', () => {
  it('shows one card per dungeon, in the given order, each linking to its page', () => {
    const html = render([
      { challengeModeId: 502, name: 'Streets of Beta', shortName: 'SB', imageUrl: null },
      { challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', imageUrl: 'https://cdn.raiderio.net/a.jpg' },
    ]);
    expect([...html.matchAll(/<a[^>]*href="(\/dungeons\/\d+)"/g)].map((m) => m[1])).toEqual(['/dungeons/502', '/dungeons/501']);
    expect(html.indexOf('Streets of Beta')).toBeLessThan(html.indexOf('Alpha Hollow'));
    expect(html).toMatch(/<h1[^>]*>Dungeons<\/h1>/);
    expect(html).toContain('src="https://cdn.raiderio.net/a.jpg"');
  });

  it('says the season loads from a character page when none is stored', () => {
    const html = render([]);
    expect(html).toContain('loads from a character page');
    expect(html).toMatch(/<a[^>]*href="\/"/);
    expect(html).not.toContain('/dungeons/');
  });
});
