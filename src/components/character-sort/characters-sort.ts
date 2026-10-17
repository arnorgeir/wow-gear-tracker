export const CHARACTERS_SORT_COOKIE = 'characters-sort';

export type SortKey = 'added' | 'name' | 'class' | 'spec' | 'itemLevel' | 'progress' | 'synced' | 'realm';
export type SortDir = 'asc' | 'desc';
export interface CharactersSort { key: SortKey; dir: SortDir }

/** The sort choices in menu order, each with the direction it starts in. */
export const CHARACTERS_SORT_OPTIONS: { key: SortKey; label: string; dir: SortDir }[] = [
  { key: 'added', label: 'Date added', dir: 'asc' },
  { key: 'name', label: 'Name', dir: 'asc' },
  { key: 'class', label: 'Class', dir: 'asc' },
  { key: 'spec', label: 'Spec', dir: 'asc' },
  { key: 'itemLevel', label: 'Item level', dir: 'desc' },
  { key: 'progress', label: 'BiS progress', dir: 'desc' },
  { key: 'synced', label: 'Last synced', dir: 'asc' },
  { key: 'realm', label: 'Realm', dir: 'asc' },
];

/** The cookie value `<key>.<dir>` as a sort. Anything unknown is today's order, `added.asc`. */
export function parseCharactersSort(raw?: string): CharactersSort {
  const [key, dir, ...rest] = (raw ?? '').split('.');
  const option = CHARACTERS_SORT_OPTIONS.find((o) => o.key === key);
  if (!option || rest.length > 0 || (dir !== 'asc' && dir !== 'desc')) return { key: 'added', dir: 'asc' };
  return { key: option.key, dir };
}
