import { describe, expect, it } from 'vitest';
import { sourceText } from './source-text';

const now = 1_000_000_000;
describe('sourceText', () => {
  it('names a SimC paste and its age', () => {
    const text = sourceText({ snapshot: { source: 'simc' }, sourceAt: now - 7_200_000 } as never, now);
    expect(text).toMatch(/^SimC, pasted /);
  });
  it('names a Blizzard sync and its age', () => {
    const text = sourceText({ snapshot: { source: 'blizzard' }, sourceAt: now - 7_200_000 } as never, now);
    expect(text).toMatch(/^Blizzard, synced /);
  });
  it('says so when never synced', () => {
    expect(sourceText({ snapshot: null, sourceAt: null }, now)).toBe('Not synced yet');
  });
});
