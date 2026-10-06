interface ListState {
  open: boolean;
  manual: boolean;
  term: string;
  resultCount: number;
  /** The term the current results answer, or null before any search came back. */
  searchedTerm: string | null;
}

/**
 * Raider.IO only knows characters it has crawled, so a real character can return no matches.
 * The list still opens then, once the search for the current term is back, because it holds
 * the link to pick the realm by hand.
 */
export function showResultList(s: ListState): boolean {
  const term = s.term.trim();
  if (!s.open || s.manual || term.length < 3) return false;
  return s.resultCount > 0 || s.searchedTerm === term;
}

/** A search runs, or waits out its debounce, until results for the current term come back. */
export function isSearching(s: Pick<ListState, 'manual' | 'term' | 'searchedTerm'>): boolean {
  const term = s.term.trim();
  return !s.manual && term.length >= 3 && s.searchedTerm !== term;
}
