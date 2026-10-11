import { describe, expect, it } from 'vitest';
import { badgeText } from './badge-text';

describe('badgeText', () => {
  it('names the source and counts edits', () => {
    expect(badgeText('Method', 0)).toEqual({ source: 'From Method', edited: null });
    expect(badgeText('Method', 2)).toEqual({ source: 'From Method', edited: '2 edited' });
  });
});
