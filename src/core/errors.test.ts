import { describe, expect, it, vi } from 'vitest';
import { isUserError, UserError } from './errors';

/** A second, separate copy of this module, the way Next gives each server bundle its own. */
async function otherCopy() {
  vi.resetModules();
  return import('./errors');
}

describe('isUserError', () => {
  it('recognizes a UserError from another copy of the module, where instanceof fails', async () => {
    const { UserError: OtherUserError } = await otherCopy();
    const err = new OtherUserError('Pick a realm.');
    expect(err instanceof UserError).toBe(false);
    expect(isUserError(err)).toBe(true);
  });

  it('rejects other errors, even one that only borrows the name', () => {
    expect(isUserError(Object.assign(new Error('x'), { name: 'UserError' }))).toBe(false);
    expect(isUserError(new Error('x'))).toBe(false);
    expect(isUserError('UserError')).toBe(false);
    expect(isUserError(null)).toBe(false);
  });
});
