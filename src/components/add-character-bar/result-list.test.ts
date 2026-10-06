import { describe, expect, it } from 'vitest';
import { isSearching, showResultList } from './result-list';

const base = { open: true, manual: false, term: 'Birkibjörn', resultCount: 0, searchedTerm: null };

describe('showResultList', () => {
  it('shows matches', () => {
    expect(showResultList({ ...base, resultCount: 2 })).toBe(true);
  });

  it('shows an empty list once the search for the current term came back, so the manual fallback is reachable', () => {
    expect(showResultList({ ...base, searchedTerm: 'Birkibjörn' })).toBe(true);
  });

  it('hides an empty list while the search for the current term is still pending', () => {
    expect(showResultList(base)).toBe(false);
    expect(showResultList({ ...base, searchedTerm: 'Birki' })).toBe(false);
  });

  it('hides when closed, in manual mode, or under three characters', () => {
    expect(showResultList({ ...base, resultCount: 2, open: false })).toBe(false);
    expect(showResultList({ ...base, resultCount: 2, manual: true })).toBe(false);
    expect(showResultList({ ...base, resultCount: 2, term: 'Bi' })).toBe(false);
  });
});

describe('isSearching', () => {
  it('is true until the search for the current term comes back', () => {
    expect(isSearching({ manual: false, term: 'Birkibjörn ', searchedTerm: 'Birki' })).toBe(true);
    expect(isSearching({ manual: false, term: 'Birkibjörn ', searchedTerm: 'Birkibjörn' })).toBe(false);
  });

  it('is false under three characters or in manual mode, where no search runs', () => {
    expect(isSearching({ manual: false, term: 'Bi', searchedTerm: null })).toBe(false);
    expect(isSearching({ manual: true, term: 'Birkibjörn', searchedTerm: null })).toBe(false);
  });
});
