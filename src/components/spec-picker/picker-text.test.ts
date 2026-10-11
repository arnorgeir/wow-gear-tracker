import { describe, expect, it } from 'vitest';
import { classSummary, trackedLine } from './picker-text';

describe('picker text', () => {
  it('summarizes a class by tracked specs, else by spec count', () => {
    expect(classSummary(2, 4)).toBe('2 tracked');
    expect(classSummary(0, 3)).toBe('3 specs');
  });

  it('names the character and list on a tracked phone row', () => {
    expect(trackedLine('Birkibjörn', 'mythicPlus')).toBe('Tracked: Birkibjörn · compares Mythic+');
  });
});
