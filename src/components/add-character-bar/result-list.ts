interface ListState {
  open: boolean;
  manual: boolean;
  region: string;
  term: string;
  resultCount: number;
  /** The `searchKey` the current results answer, or null before any search came back. */
  searchedKey: string | null;
}

/** Names one search: the same term in another region is another search. */
export const searchKey = (region: string, term: string) => `${region}:${term.trim()}`;

/**
 * Raider.IO only knows characters it has crawled, so a real character can return no matches.
 * The list still opens then, once the search for the current term is back, because it holds
 * the link to pick the realm by hand.
 */
export function showResultList(s: ListState): boolean {
  if (!s.open || s.manual || s.term.trim().length < 3) return false;
  return s.resultCount > 0 || s.searchedKey === searchKey(s.region, s.term);
}

/** A search runs, or waits out its debounce, until results for the current term and region come back. */
export function isSearching(s: Pick<ListState, 'manual' | 'region' | 'term' | 'searchedKey'>): boolean {
  return !s.manual && s.term.trim().length >= 3 && s.searchedKey !== searchKey(s.region, s.term);
}
