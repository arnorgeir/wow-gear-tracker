import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MainNav } from './MainNav';

// usePathname needs the App Router context, which a static render doesn't have. vi.mock is hoisted above the imports.
vi.mock('next/navigation', () => ({ usePathname: () => '/group' }));

describe('MainNav', () => {
  const html = renderToStaticMarkup(createElement(MainNav));
  const links = html.split('<a ').slice(1);

  it('shows each decorative icon at every width, with the label as the link text', () => {
    expect(links).toHaveLength(2);
    for (const [link, label] of [[links[0]!, 'Characters'], [links[1]!, 'Group']] as const) {
      expect(link).toMatch(/<svg[^>]*aria-hidden="true"[^>]*class="shrink-0"/);
      expect(link).toContain(`</svg>${label}`);
    }
  });

  it('marks only the current page, in gold, with the diamond', () => {
    const [characters, group] = [links[0]!, links[1]!];
    expect(group).toContain('aria-current="page"');
    expect(group).toContain('text-gold');
    expect(group).toMatch(/<span aria-hidden="true" class="[^"]*rotate-45[^"]*"><\/span><\/a>/);
    expect(characters).not.toContain('aria-current');
    expect(characters).not.toContain('text-gold');
    expect(characters).not.toContain('rotate-45');
    expect(characters).toContain('hover:text-ink');
    expect(group).not.toContain('hover:text-ink');
  });
});
