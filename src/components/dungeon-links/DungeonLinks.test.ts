import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DungeonLinks } from './DungeonLinks';

describe('DungeonLinks', () => {
  it('links each dungeon to its page, comma-separated', () => {
    const html = renderToStaticMarkup(createElement(DungeonLinks, { dungeons: [{ challengeModeId: 501, name: 'Alpha Hollow' }, { challengeModeId: 504, name: 'Delta Deep' }] }));
    expect(html).toContain('<a href="/dungeons/501">Alpha Hollow</a>, <a href="/dungeons/504">Delta Deep</a>');
  });
});
