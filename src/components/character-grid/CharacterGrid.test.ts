import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PendingCharacterProvider } from '@/components/pending-character/PendingCharacterProvider';
import { CharacterGrid } from './CharacterGrid';

const render = (count: number, withProvider = true, view: 'grid' | 'list' = 'grid') => {
  const grid = createElement(CharacterGrid, { count, view, empty: createElement('p', null, 'No characters yet.') }, createElement('article', null, 'Birkibjörn'));
  return renderToStaticMarkup(withProvider ? createElement(PendingCharacterProvider, null, grid) : grid);
};

describe('CharacterGrid', () => {
  it('shows the empty text when there are no cards and nothing is being added', () => {
    expect(render(0)).toBe('<p>No characters yet.</p>');
  });

  it('lays the cards out in the grid', () => {
    const html = render(1);
    expect(html).toContain('xl:grid-cols-4');
    expect(html).toContain('<article>Birkibjörn</article>');
    expect(html).not.toContain('Adding');
  });

  it('lays the rows out in a column in list view', () => {
    const html = render(1, true, 'list');
    expect(html).toContain('flex flex-col gap-3');
    expect(html).not.toContain('xl:grid-cols-4');
    expect(html).toContain('<article>Birkibjörn</article>');
  });

  it('shows the same empty text in list view', () => {
    expect(render(0, true, 'list')).toBe('<p>No characters yet.</p>');
  });

  it('works without a provider', () => {
    expect(render(1, false)).toContain('<article>Birkibjörn</article>');
  });
});
