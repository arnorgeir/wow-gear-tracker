import { describe, expect, it } from 'vitest';
import { CHARACTERS_SORT_OPTIONS, parseCharactersSort } from './characters-sort';

describe('parseCharactersSort', () => {
  it.each(CHARACTERS_SORT_OPTIONS.map((o) => o.key))('reads %s.desc and %s.asc', (key) => {
    expect(parseCharactersSort(`${key}.desc`)).toEqual({ key, dir: 'desc' });
    expect(parseCharactersSort(`${key}.asc`)).toEqual({ key, dir: 'asc' });
  });
  it.each([undefined, '', 'junk', 'name', 'bogus.asc', 'name.up', 'name.asc.asc', 'NAME.asc'])('reads %j as added.asc', (v) =>
    expect(parseCharactersSort(v)).toEqual({ key: 'added', dir: 'asc' }));
  it('has eight options with the spec default directions', () => {
    expect(CHARACTERS_SORT_OPTIONS.map((o) => [o.key, o.dir])).toEqual([
      ['added', 'asc'], ['name', 'asc'], ['class', 'asc'], ['spec', 'asc'],
      ['itemLevel', 'desc'], ['progress', 'desc'], ['synced', 'asc'], ['realm', 'asc'],
    ]);
  });
});
