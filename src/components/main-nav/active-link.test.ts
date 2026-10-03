import { describe, expect, it } from 'vitest';
import { isActiveLink } from './active-link';

describe('isActiveLink', () => {
  it('marks Characters on the list and on a character page, and Group on the group page', () => {
    expect(isActiveLink('/', '/')).toBe(true);
    expect(isActiveLink('/', '/characters/12')).toBe(true);
    expect(isActiveLink('/', '/group')).toBe(false);
    expect(isActiveLink('/group', '/group')).toBe(true);
    expect(isActiveLink('/group', '/')).toBe(false);
  });
});
