import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ItemCard, wowheadData } from './ItemCard';

describe('wowheadData', () => {
  it('includes bonus IDs and item level so the tooltip matches the item', () => {
    expect(wowheadData(271528, [13440, 12850], 321)).toBe('item=271528&bonus=13440:12850&ilvl=321');
  });

  it('leaves out empty parts', () => {
    expect(wowheadData(5, [], null)).toBe('item=5');
  });
});

describe('ItemCard', () => {
  const html = renderToStaticMarkup(createElement(ItemCard, {
    itemId: 271528, name: 'Test Helm', quality: 'EPIC', iconUrl: 'https://i/1.jpg', bonusIds: [13440, 12850], itemLevel: 321, detail: 'Myth 2/6',
  }));

  it('makes the whole card the Wowhead link, so hovering anywhere shows the tooltip', () => {
    // React 19 hoists a <link rel="preload"> for the icon ahead of the markup.
    expect(html.replace(/^<link[^>]*\/>/, '').startsWith('<a ')).toBe(true);
    expect(html).toContain('data-wowhead="item=271528&amp;bonus=13440:12850&amp;ilvl=321"');
    expect(html.match(/<a /g)).toHaveLength(1);
  });
});
