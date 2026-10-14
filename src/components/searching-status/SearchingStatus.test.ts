import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SearchingStatus } from './SearchingStatus';

const render = (searching: boolean) => renderToStaticMarkup(createElement(SearchingStatus, { searching, className: 'absolute right-11' }));

describe('SearchingStatus', () => {
  it('shows the spinner and text only while searching', () => {
    const html = render(true);
    expect(html).toContain('Searching…');
    expect(html).toContain('animate-spin');
  });

  it('stays mounted as an empty status region otherwise', () => {
    expect(render(false)).toBe('<span role="status" class="absolute right-11"></span>');
  });
});
