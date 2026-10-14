import { describe, expect, it } from 'vitest';
import type { RowRef } from '@/core/bis/edits';
import { isSearching, searchKey, searchPlan } from './search-plan';

describe('searchPlan', () => {
  it('does nothing for blank input and searches names', () => {
    expect(searchPlan('  ', null)).toEqual({ kind: 'idle' });
    expect(searchPlan('robe', null)).toEqual({ kind: 'search', q: 'robe' });
  });

  it('looks up an ID or link only when nothing local matched', () => {
    expect(searchPlan('212401', 0)).toEqual({ kind: 'lookup', input: '212401' });
    expect(searchPlan('https://www.wowhead.com/item=212401', 0)).toEqual({ kind: 'lookup', input: 'https://www.wowhead.com/item=212401' });
    expect(searchPlan('212401', 1)).toEqual({ kind: 'search', q: '212401' });
  });

  it('never looks up a name', () => {
    expect(searchPlan('robe', 0)).toEqual({ kind: 'search', q: 'robe' });
  });
});

const row: RowRef = { specSlug: 'frost-mage', source: 'method', listType: 'mythicPlus', slotKey: 'Head#1' };

describe('searchKey', () => {
  it('ignores surrounding spaces and tells rows and queries apart', () => {
    expect(searchKey(row, ' hood ')).toBe(searchKey(row, 'hood'));
    expect(searchKey(row, 'hood')).not.toBe(searchKey(row, 'hoodx'));
    expect(searchKey(row, 'hood')).not.toBe(searchKey({ ...row, slotKey: 'Neck#1' }, 'hood'));
    expect(searchKey(row, 'hood')).not.toBe(searchKey({ ...row, listType: 'raid' }, 'hood'));
  });
});

describe('isSearching', () => {
  const A = searchKey(row, 'hood');
  const B = searchKey(row, 'hoodx');

  it('is never true for an idle box', () => {
    expect(isSearching(A, null, true)).toBe(false);
  });

  it('is true until the answer for the current key arrives', () => {
    expect(isSearching(A, null, false)).toBe(true);
    expect(isSearching(A, A, false)).toBe(false);
  });

  it('follows answered A, pending B, back to A, whether A succeeded or failed', () => {
    // The hook stores the key of every answer, result or error alike.
    expect(isSearching(B, A, false)).toBe(true);
    expect(isSearching(A, A, false)).toBe(false);
  });

  it('is true for the same query on another row', () => {
    expect(isSearching(searchKey({ ...row, slotKey: 'Neck#1' }, 'hood'), A, false)).toBe(true);
  });

  it('is true after a lookup cleared the answered key, even when returning to an earlier query', () => {
    // A lookup starts: the hook stores key null, so no earlier query counts as answered.
    expect(isSearching(B, null, false)).toBe(true);
    expect(isSearching(A, null, false)).toBe(true);
  });
});
