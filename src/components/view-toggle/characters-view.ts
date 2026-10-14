export const CHARACTERS_VIEW_COOKIE = 'characters-view';

export type CharactersView = 'grid' | 'list';

/** The remembered layout. Anything but `list` is the default grid. */
export function parseCharactersView(value?: string): CharactersView {
  return value === 'list' ? 'list' : 'grid';
}
