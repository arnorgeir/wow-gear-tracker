import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FetchButton } from './FetchButton';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }) }));

const render = (label: 'Fetch' | 'Refresh', link?: boolean) =>
  renderToStaticMarkup(createElement(FetchButton, { specSlug: 'guardian-druid', label, link }));

describe('FetchButton width', () => {
  it('gives Fetch and Refresh buttons one min width, centered', () => {
    for (const label of ['Fetch', 'Refresh'] as const) {
      const html = render(label);
      expect(html).toContain('min-w-[6.5rem]');
      expect(html).toContain('justify-center');
    }
  });

  it('leaves the link variant to its text', () => {
    const html = render('Fetch', true);
    expect(html).not.toContain('min-w-[6.5rem]');
    expect(html).not.toContain('justify-center');
  });
});
