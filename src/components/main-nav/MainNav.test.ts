import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MainNav } from './MainNav';

// usePathname needs the App Router context, which a static render doesn't have. vi.mock is hoisted above the imports.
vi.mock('next/navigation', () => ({ usePathname: () => '/group' }));

describe('MainNav', () => {
  it('keeps each label as the link text, with a decorative icon hidden on phones', () => {
    const html = renderToStaticMarkup(createElement(MainNav));
    const links = html.split('<a ').slice(1);
    expect(links).toHaveLength(2);
    for (const [link, label] of [[links[0]!, 'Characters'], [links[1]!, 'Group']] as const) {
      expect(link).toMatch(/<svg[^>]*aria-hidden="true"[^>]*class="shrink-0 hidden sm:block"/);
      expect(link).toContain(`</svg>${label}</a>`);
    }
    expect(links[1]).toContain('aria-current="page"');
  });
});
