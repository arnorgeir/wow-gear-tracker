import { describe, expect, it } from 'vitest';
import { copyChoices, copyConfirm } from './copy-again';

describe('copy again', () => {
  it('offers the fetched sources on offer, the copied one first', () => {
    expect(copyChoices('method')).toEqual(['method']);
    expect(copyChoices(null)).toEqual(['method']);
    expect(copyChoices('icyVeins')).toEqual(['method']);
  });

  it('warns that edits are lost', () => {
    expect(copyConfirm('icyVeins')).toBe("Replace your manual list with Icy Veins's? Your edits on it are lost.");
  });
});
