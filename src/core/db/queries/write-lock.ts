import type { Db } from '../client';

// Every write in this directory runs through this lock, one at a time per database.
// libsql's SQLite driver runs synchronously on the main thread: a write that waits on another
// connection's lock blocks the event loop, so the lock holder can never finish. An in-memory
// database also has one connection, which an open transaction holds (TRANSACTION_ACTIVE).
// The client's busy timeout still covers other processes writing to the same file.
// There is exactly one lock map, here: a module keeping its own would stop writes serializing.
const writeLocks = new WeakMap<Db, Promise<unknown>>();

export function withWriteLock<T>(db: Db, task: () => Promise<T>): Promise<T> {
  const previous = writeLocks.get(db) ?? Promise.resolve();
  const next = previous.then(task, task);
  writeLocks.set(db, next.catch(() => undefined));
  return next;
}
