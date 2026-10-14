import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Quality } from '@/core/types';
import { ItemLink } from './ItemLink';

const item = { itemId: 9, name: 'Ironvein Girdle', iconUrl: null };
const render = (quality: Quality) =>
  renderToStaticMarkup(createElement(ItemLink, { item, quality }, 'Leather · Waist'));

describe('ItemLink', () => {
  it('is one content-sized Wowhead link holding the ring, the name and the detail', () => {
    const html = render('RARE');
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain('data-wowhead="item=9"');
    expect(html).toMatch(/<a [^>]*class="[^"]*inline-flex max-w-full/);
    expect(html).toContain('border-color:#0070dd');
    expect(html).toContain('color:#5eaaff');
    expect(html.indexOf('Leather · Waist')).toBeLessThan(html.indexOf('</a>'));
  });

  it('colors the name by the quality it is given', () => {
    expect(render('EPIC')).toContain('color:#c58cf5');
  });
});
