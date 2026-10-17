import { describe, expect, it } from 'vitest';
import type { Region } from '../types';
import { formatWeek, weekStart } from './week';

const D = 24 * 3600 * 1000;
// 2026-10-13 is a Tuesday, 14 a Wednesday, 15 a Thursday.
const resets: Record<Region, number> = {
  us: Date.UTC(2026, 9, 13, 15),
  eu: Date.UTC(2026, 9, 14, 4),
  kr: Date.UTC(2026, 9, 14, 23),
  tw: Date.UTC(2026, 9, 14, 23),
};

describe('weekStart', () => {
  for (const region of ['us', 'eu', 'kr', 'tw'] as const) {
    const r = resets[region];
    it(`${region}: reset boundary`, () => {
      expect(weekStart(region, r - 1)).toBe(r - 7 * D);
      expect(weekStart(region, r)).toBe(r);
      expect(weekStart(region, r + 1)).toBe(r);
      expect(weekStart(region, r + 3 * D)).toBe(r);
    });
  }

  it('stays at or before a time near the epoch', () => {
    const s = weekStart('eu', 1000);
    expect(s).toBeLessThanOrEqual(1000);
    expect(s).toBeGreaterThan(1000 - 7 * D);
  });
});

describe('formatWeek', () => {
  it('names the reset date in the region zone', () => {
    expect(formatWeek('eu', Date.UTC(2026, 9, 14, 4))).toBe('Week of Wed 14 Oct');
    expect(formatWeek('kr', Date.UTC(2026, 9, 14, 23))).toBe('Week of Thu 15 Oct');
  });
});
