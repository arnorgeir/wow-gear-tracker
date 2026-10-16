import { describe, expect, it } from 'vitest';
import { parseCharactersView } from './characters-view';

describe('parseCharactersView', () => {
  it('reads list as list', () => expect(parseCharactersView('list')).toBe('list'));
  it.each(['grid', undefined, '', 'LIST', 'junk'])('reads %j as grid', (v) => expect(parseCharactersView(v)).toBe('grid'));
});
