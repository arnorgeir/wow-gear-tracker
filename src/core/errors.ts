// Next bundles each server entry separately, so a module can exist in several copies at once, each
// with its own classes. The cached services hand objects built by one copy to code in another, and
// there `instanceof` quietly fails. A brand under a `Symbol.for` key survives the trip, because
// every copy shares the one global symbol registry. Check our errors with the `is…` guards, never
// with `instanceof`.

/** Marks an error so that every copy of its module recognizes it. */
export function brand(err: Error, key: symbol): void {
  Object.defineProperty(err, key, { value: true });
}

export const hasBrand = (err: unknown, key: symbol): boolean =>
  typeof err === 'object' && err !== null && (err as Record<symbol, unknown>)[key] === true;

const USER_ERROR = Symbol.for('wow-gear-tracker.UserError');

/** An error whose message is safe and useful to show to the user. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
    brand(this, USER_ERROR);
  }
}

export const isUserError = (err: unknown): err is UserError => hasBrand(err, USER_ERROR);
