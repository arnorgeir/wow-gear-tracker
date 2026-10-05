import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BrandMark } from './BrandMark';

describe('BrandMark', () => {
  it('draws the four Open Crest shapes in the current colour at the given size', () => {
    const html = renderToStaticMarkup(createElement(BrandMark, { size: 32, className: 'text-gold' }));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
    expect(html).toContain('viewBox="0 0 256 256"');
    expect(html).toContain('width="32" height="32"');
    expect(html).toContain('fill="currentColor"');
    expect(html).toContain('class="text-gold"');
    expect(html.match(/<path /g)).toHaveLength(4);
  });
});
