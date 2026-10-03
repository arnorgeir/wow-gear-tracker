import { describe, expect, it } from 'vitest';
import { thumbnailLabel } from './thumbnail-label';

describe('thumbnailLabel', () => {
  it('uses the short name, or M+ when it is blank', () => {
    expect(thumbnailLabel('STRT')).toBe('STRT');
    expect(thumbnailLabel('')).toBe('M+');
    expect(thumbnailLabel('  ')).toBe('M+');
  });
});
