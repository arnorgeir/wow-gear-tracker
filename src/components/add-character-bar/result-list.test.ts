import { describe, expect, it } from 'vitest';
import { showResultList } from './result-list';

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