import { describe, expect, it } from 'vitest';
import { searchPlan } from './search-plan';

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
