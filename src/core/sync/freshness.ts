export const DAY_MS = 86_400_000;
/** How long any cached reference dataset waits after a failed refresh before trying again. */
export const RETRY_MS = 60 * 60 * 1000;

export type ReferenceStatus = 'loading' | 'failed' | 'ready' | 'stale';

export interface CacheTiming { lastFailed: boolean; fresh: boolean; backingOff: boolean; due: boolean }

/**
 * Due when the data is missing or older than ttlMs, unless the last attempt failed within RETRY_MS.
 * A failure counts only when it is newer than the stored data. Pass storedAt null for a cache with
 * no single stored time: then any recorded failure counts.
 */
export function cacheTiming(storedAt: number | null, failedAt: number | null, now: number, ttlMs = DAY_MS): CacheTiming {
  const lastFailed = failedAt !== null && (storedAt === null || failedAt > storedAt);
  const fresh = storedAt !== null && now - storedAt < ttlMs;
  const backingOff = lastFailed && now - failedAt! < RETRY_MS;
  return { lastFailed, fresh, backingOff, due: !fresh && !backingOff };
}

/** What the page says about a cache: whether it holds data, and whether the last attempt failed. */
export function referenceStatus(stored: boolean, lastFailed: boolean): ReferenceStatus {
  return stored ? (lastFailed ? 'stale' : 'ready') : (lastFailed ? 'failed' : 'loading');
}
