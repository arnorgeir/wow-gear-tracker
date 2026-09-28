import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FactionBadge } from './FactionBadge';

// React 19 hoists <link rel="preload"> tags for images ahead of the markup.
const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/<link[^>]*\/>/g, '');

describe('FactionBadge', () => {
  it('names the faction in its title and hides the shape from screen readers', () => {
    const html = render(createElement(FactionBadge, { faction: 'HORDE' }));
    expect(html).toContain('title="Horde"');
    expect(html).toContain('aria-hidden="true"');
    expect(render(createElement(FactionBadge, { faction: 'ALLIANCE' }))).toContain('title="Alliance"');
  });
});
