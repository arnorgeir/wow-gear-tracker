import { describe, expect, it } from 'vitest';
import { isSearching, searchKey, showResultList } from './result-list';

const base = { open: true, manual: false, region: 'eu', term: 'Birkibjörn', resultCount: 0, searchedKey: null };

describe('showResultList', () => {
  it('shows matches', () => {
    expect(showResultList({ ...base, resultCount: 2 })).toBe(true);
  });

  it('shows an empty list once the search for the current term came back, so the manual fallback is reachable', () => {
    expect(showResultList({ ...base, searchedKey: searchKey('eu', 'Birkibjörn') })).toBe(true);
  });

  it('hides an empty list while the search for the current term is still pending', () => {
    expect(showResultList(base)).toBe(false);
    expect(showResultList({ ...base, searchedKey: searchKey('eu', 'Birki') })).toBe(false);
  });

  it('hides an empty list that answers another region', () => {
    expect(showResultList({ ...base, region: 'us', searchedKey: searchKey('eu', 'Birkibjörn') })).toBe(false);
  });

  it('hides when closed, in manual mode, or under three characters', () => {
    expect(showResultList({ ...base, resultCount: 2, open: false })).toBe(false);
    expect(showResultList({ ...base, resultCount: 2, manual: true })).toBe(false);
    expect(showResultList({ ...base, resultCount: 2, term: 'Bi' })).toBe(false);
  });
});

describe('isSearching', () => {
  const idle = { manual: false, region: 'eu', term: 'Birkibjörn ' };

  it('is true until the search for the current term comes back', () => {
    expect(isSearching({ ...idle, searchedKey: searchKey('eu', 'Birki') })).toBe(true);
    expect(isSearching({ ...idle, searchedKey: searchKey('eu', 'Birkibjörn') })).toBe(false);
  });

  it('is true after a region change until that region answers', () => {
    expect(isSearching({ ...idle, region: 'us', searchedKey: searchKey('eu', 'Birkibjörn') })).toBe(true);
  });

  it('is false under three characters or in manual mode, where no search runs', () => {
    expect(isSearching({ ...idle, term: 'Bi', searchedKey: null })).toBe(false);
    expect(isSearching({ ...idle, manual: true, searchedKey: null })).toBe(false);
  });
});
