import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Loading from './loading';

describe('home route skeleton', () => {
  it('announces once, keeps the heading real and shows four card shapes', () => {
    const html = renderToStaticMarkup(createElement(Loading));
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).toContain('<p role="status" class="sr-only">Loading characters…</p>');
    expect(html).toContain('>Characters</h1>');
    expect(html.match(/<article/g)).toHaveLength(4);
  });
});
