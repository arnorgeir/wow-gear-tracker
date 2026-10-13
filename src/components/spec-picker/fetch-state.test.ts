import { describe, expect, it } from 'vitest';
import { DAY_MS } from '@/core/sync/reference-sync';
import { fetchAction, fetchStateLabel } from './fetch-state';

describe('fetchStateLabel', () => {
  it('says each state in words', () => {
    expect(fetchStateLabel({ kind: 'tracked' }, 0)).toBe('Tracked');
    expect(fetchStateLabel({ kind: 'notFetched' }, 0)).toBe('Not fetched');
    expect(fetchStateLabel({ kind: 'failed' }, 0)).toBe('Fetch failed');
    expect(fetchStateLabel({ kind: 'fetched', at: 0 }, 3 * DAY_MS)).toBe('Fetched 3 days ago');
    expect(fetchStateLabel({ kind: 'manual' }, 0)).toBe('Manual');
  });
});

describe('fetchAction', () => {
  it('offers Fetch, Refresh or Try again, and nothing for a tracked spec', () => {
    expect(fetchAction({ kind: 'notFetched' })).toBe('Fetch');
    expect(fetchAction({ kind: 'fetched', at: 0 })).toBe('Refresh');
    expect(fetchAction({ kind: 'failed' })).toBe('Try again');
    expect(fetchAction({ kind: 'tracked' })).toBeNull();
    expect(fetchAction({ kind: 'manual' })).toBeNull();
  });
});
