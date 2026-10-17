import { describe, expect, it } from 'vitest';
import { DAY_MS, RETRY_MS, cacheTiming, referenceStatus } from './freshness';

const t = 1_000_000_000_000;

describe('cacheTiming', () => {
  it('is due when nothing is stored', () => {
    expect(cacheTiming(null, null, t)).toEqual({ lastFailed: false, fresh: false, backingOff: false, due: true });
  });

  it('is fresh until the TTL, due at it', () => {
    expect(cacheTiming(t, null, t + DAY_MS - 1)).toMatchObject({ fresh: true, due: false });
    expect(cacheTiming(t, null, t + DAY_MS)).toMatchObject({ fresh: false, due: true });
  });

  it('backs off for the hour after a failure newer than the data, then is due again', () => {
    const failedAt = t + DAY_MS + 5;
    expect(cacheTiming(t, failedAt, failedAt + RETRY_MS - 1)).toMatchObject({ lastFailed: true, backingOff: true, due: false });
    expect(cacheTiming(t, failedAt, failedAt + RETRY_MS)).toMatchObject({ lastFailed: true, backingOff: false, due: true });
  });

  it('ignores a failure older than or equal to the data', () => {
    expect(cacheTiming(t, t - 1, t + DAY_MS).lastFailed).toBe(false);
    expect(cacheTiming(t, t, t + DAY_MS).lastFailed).toBe(false);
  });

  it('counts any failure when nothing is stored', () => {
    expect(cacheTiming(null, t, t + RETRY_MS - 1)).toMatchObject({ lastFailed: true, backingOff: true, due: false });
  });

  it('takes a custom TTL', () => {
    expect(cacheTiming(t, null, t + 29 * DAY_MS).fresh).toBe(false);
    expect(cacheTiming(t, null, t + 30 * DAY_MS, 30 * DAY_MS).due).toBe(true);
    expect(cacheTiming(t, null, t + 29 * DAY_MS, 30 * DAY_MS).due).toBe(false);
  });
});

describe('referenceStatus', () => {
  it('names all four states', () => {
    expect(referenceStatus(false, false)).toBe('loading');
    expect(referenceStatus(false, true)).toBe('failed');
    expect(referenceStatus(true, false)).toBe('ready');
    expect(referenceStatus(true, true)).toBe('stale');
  });
});
