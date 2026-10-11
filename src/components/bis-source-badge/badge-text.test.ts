import { describe, expect, it } from 'vitest';
import { badgeText } from './badge-text';

describe('badgeText', () => {
  it('names the source and counts edits', () => {
    expect(badgeText('Method', 0)).toBe('Method');
    expect(badgeText('Method', 2)).toBe('Method · 2 edited');
  });
});
