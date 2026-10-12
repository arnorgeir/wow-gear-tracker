import { describe, expect, it } from 'vitest';
import { badgeText } from './badge-text';

describe('badgeText', () => {
  it('names the source and counts edits', () => {
    expect(badgeText('method', 0)).toEqual({ source: 'From Method', edited: null });
    expect(badgeText('icyVeins', 2)).toEqual({ source: 'From Icy Veins', edited: '2 edited' });
  });
  it('calls a manual list Manual', () => {
    expect(badgeText('manual', 0)).toEqual({ source: 'Manual', edited: null });
    expect(badgeText('manual', 1)).toEqual({ source: 'Manual', edited: '1 edited' });
  });
});
