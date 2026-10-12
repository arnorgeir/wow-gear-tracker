import { describe, expect, it } from 'vitest';
import { FETCHED_SOURCES, SOURCE_NAMES, isBisSourceId } from './types';

describe('bis sources', () => {
  it('names every source once and fetches only the web ones', () => {
    expect(SOURCE_NAMES).toEqual({ method: 'Method', icyVeins: 'Icy Veins', manual: 'Manual' });
    expect(FETCHED_SOURCES).toEqual(['method', 'icyVeins']);
  });
  it('recognizes source ids', () => {
    expect(isBisSourceId('icyVeins')).toBe(true);
    expect(isBisSourceId('wowhead')).toBe(false);
    expect(isBisSourceId('toString')).toBe(false);
    expect(isBisSourceId(undefined)).toBe(false);
  });
});
