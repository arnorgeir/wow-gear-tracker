import { createElement } from 'react';
import Link from 'next/link';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LinkPending } from './LinkPending';

describe('LinkPending', () => {
  it('renders one hidden, idle ring inside a link, with no status', () => {
    const html = renderToStaticMarkup(createElement(Link, { href: '/characters/eu/argent-dawn/birkibj%C3%B6rn' }, 'Birkibjörn', createElement(LinkPending)));
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(1);
    expect(html).toContain('opacity-0');
    expect(html).not.toContain('role="status"');
  });
});
