import { describe, expect, it } from 'vitest';
import { sameMembers } from './same-members';

describe('sameMembers', () => {
  it('ignores order', () => {
    expect(sameMembers(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameMembers([], [])).toBe(true);
  });

  it('is false for an added, removed or swapped member', () => {
    expect(sameMembers(['a', 'b'], ['a'])).toBe(false);
    expect(sameMembers(['a'], ['a', 'b'])).toBe(false);
    expect(sameMembers(['a', 'b'], ['a', 'c'])).toBe(false);
  });
});
