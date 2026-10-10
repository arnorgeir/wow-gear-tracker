import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PendingCharacterProvider } from '@/components/pending-character/PendingCharacterProvider';
import { CharacterGrid } from './CharacterGrid';

const render = (count: number, withProvider = true) => {
  const grid = createElement(CharacterGrid, { count, empty: createElement('p', null, 'No characters yet.') }, createElement('article', null, 'Birkibjörn'));
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

  it('works without a provider', () => {
    expect(render(1, false)).toContain('<article>Birkibjörn</article>');
  });
});
