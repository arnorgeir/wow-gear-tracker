import { describe, expect, it } from 'vitest';
import { isUserError } from '@/core/errors';
import { parseSpecOverride } from './route-helpers';

const SPECS = ['Balance', 'Feral', 'Guardian', 'Restoration'];

function thrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  return undefined;
}

describe('parseSpecOverride', () => {
  it('leaves the field alone when absent', () => {
    expect(parseSpecOverride(undefined, SPECS)).toBeUndefined();
  });

  it.each([null, ''])('clears the override for %o', (value) => {
    expect(parseSpecOverride(value, SPECS)).toBeNull();
  });

  it('returns a listed spec', () => {
    expect(parseSpecOverride('Feral', SPECS)).toBe('Feral');
  });

  it.each(['Nonsense', 'feral', 42, 'x'.repeat(10_000)])('rejects %o with a UserError', (value) => {
    const err = thrown(() => parseSpecOverride(value, SPECS));
    expect(isUserError(err)).toBe(true);
    expect((err as Error).message).toBe('Unknown spec for this class.');
  });

  it('accepts only clearing with an empty list', () => {
    expect(parseSpecOverride(null, [])).toBeNull();
    expect(parseSpecOverride('', [])).toBeNull();
    expect(isUserError(thrown(() => parseSpecOverride('Feral', [])))).toBe(true);
  });
});
