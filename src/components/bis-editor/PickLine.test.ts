import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PickLine } from './PickLine';

// React 19 hoists <link rel="preload"> tags for images ahead of the markup.
const render = (props: Partial<Parameters<typeof PickLine>[0]>) =>
  renderToStaticMarkup(createElement(PickLine, { itemId: 249337, name: 'Ironvein Girdle', quality: 'EPIC', iconUrl: 'https://i/2.jpg', detail: 'Kings’ Rest', ...props })).replace(/<link[^>]*\/>/g, '');

describe('PickLine', () => {
  it('is one content-sized Wowhead link holding the icon and the name', () => {
    const html = render({});
    expect(html.startsWith('<a ')).toBe(true);
    expect(html).toMatch(/^<a [^>]*class="[^"]*group inline-flex w-fit max-w-full/);
    expect(html).toContain('data-wowhead=');
    expect(html.indexOf('<img')).toBeLessThan(html.indexOf('</a>'));
    expect(html).toMatch(/<span class="[^"]*group-hover:underline[^"]*"[^>]*>Ironvein Girdle/);
  });

  it('links nothing for an Any pick', () => {
    expect(render({ itemId: null, quality: null, iconUrl: null, name: 'Any' })).not.toContain('<a ');
  });

  it('keeps a replaced pick readable: struck through at 80 percent, not 60', () => {
    const html = render({ replaced: true });
    expect(html).toContain('opacity-80');
    expect(html).toContain('line-through');
    // Hover must not swap the strikethrough for an underline.
    expect(html).not.toContain('group-hover:underline');
    expect(html).not.toContain('opacity-60');
  });
});
