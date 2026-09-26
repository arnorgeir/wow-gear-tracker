import { describe, expect, it } from 'vitest';
import { formatAge } from './format';

const MIN = 60_000;

describe('formatAge', () => {
  it.each([
    [30_000, 'just now'],
    [3 * MIN, '3 min ago'],
    [90 * MIN, '1 h ago'],
    [26 * 60 * MIN, '1 day ago'],
    [6 * 24 * 60 * MIN, '6 days ago'],
  ])('formats %i ms as %s', (age, text) => {
    expect(formatAge(1_000_000_000 - age, 1_000_000_000)).toBe(text);
  });
});
