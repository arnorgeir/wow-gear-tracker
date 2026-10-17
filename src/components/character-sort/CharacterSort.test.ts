import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CharacterSort } from './CharacterSort';
import type { CharactersSort } from './characters-sort';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }) }));

const render = (sort: CharactersSort) => renderToStaticMarkup(createElement(CharacterSort, { sort }));

describe('CharacterSort', () => {
  it('has a visible Sort by label tied to a select with eight options', () => {
    const html = render({ key: 'added', dir: 'asc' });
    expect(html).toMatch(/<label[^>]*for="(characters-sort)"[^>]*>Sort by<\/label>/);
    expect(html).toMatch(/<select[^>]*id="characters-sort"/);
    expect(html.match(/<option/g)).toHaveLength(8);
    for (const label of ['Date added', 'Name', 'Class', 'Spec', 'Item level', 'BiS progress', 'Last synced', 'Realm']) expect(html).toContain(`>${label}</option>`);
  });

  it('selects the given key', () => {
    const html = render({ key: 'itemLevel', dir: 'desc' });
    expect(html.match(/selected=""/g)).toHaveLength(1);
    expect(html).toMatch(/<option[^>]*value="itemLevel"[^>]*selected=""|<option[^>]*selected=""[^>]*value="itemLevel"/);
  });

  it.each([['asc', 'Ascending'], ['desc', 'Descending']] as const)('names the %s direction in words and in the accessible name', (dir, word) => {
    const html = render({ key: 'name', dir });
    expect(html).toContain(`aria-label="Sort direction: ${word}"`);
    expect(html).toContain(word);
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it('is not busy at rest', () => {
    expect(render({ key: 'name', dir: 'asc' })).not.toContain('aria-busy="true"');
  });
});
