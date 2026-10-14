import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ViewToggle } from './ViewToggle';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }) }));

const render = (view: 'grid' | 'list') => renderToStaticMarkup(createElement(ViewToggle, { view }));

describe('ViewToggle', () => {
  it('has two radios named Grid and List and an sr-only legend', () => {
    const html = render('grid');
    expect(html.match(/type="radio"/g)).toHaveLength(2);
    expect(html).toContain('Grid');
    expect(html).toContain('List');
    expect(html).toMatch(/<legend class="sr-only">Layout<\/legend>/);
  });

  it.each([['grid', 'Grid'], ['list', 'List']] as const)('checks the given view %s', (view, label) => {
    const html = render(view);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toMatch(new RegExp(`<input[^>]*checked=""[^>]*value="${view}"|<input[^>]*value="${view}"[^>]*checked=""`));
    expect(html).toContain(label);
  });

  it('is not busy at rest', () => {
    expect(render('grid')).not.toContain('aria-busy="true"');
  });
});
