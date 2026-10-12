import { describe, expect, it } from 'vitest';
import { copyChoices, copyConfirm } from './copy-again';

describe('copy again', () => {
  it('offers both fetched sources, the copied one first', () => {
    expect(copyChoices('icyVeins')).toEqual(['icyVeins', 'method']);
    expect(copyChoices('method')).toEqual(['method', 'icyVeins']);
    expect(copyChoices(null)).toEqual(['method', 'icyVeins']);
  });

  it('warns that edits are lost', () => {
    expect(copyConfirm('icyVeins')).toBe("Replace your manual list with Icy Veins's? Your edits on it are lost.");
  });
});
