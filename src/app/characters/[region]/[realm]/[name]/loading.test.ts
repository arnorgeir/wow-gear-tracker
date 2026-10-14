import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Loading from './loading';

describe('character route skeleton', () => {
  it('announces once, keeps the back link real and shows every section', () => {
    const html = renderToStaticMarkup(createElement(Loading));
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).toContain('<p role="status" class="sr-only">Loading character…</p>');
    expect(html).toMatch(/<a [^>]*href="\/"[^>]*>← All characters<\/a>/);
    expect(html).toContain('aria-label="Gear by slot"');
    expect(html).toContain('aria-label="Dungeon priority"');
    expect(html).toContain('aria-label="Great Vault"');
  });
});
