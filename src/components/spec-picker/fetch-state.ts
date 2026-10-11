import { formatAge } from '@/core/format';
import type { SpecFetchState } from '@/server/views/types';

export type FetchAction = 'Fetch' | 'Refresh' | 'Try again';

export function fetchStateLabel(state: SpecFetchState, now: number): string {
  switch (state.kind) {
    case 'tracked': return 'Tracked';
    case 'notFetched': return 'Not fetched';
    case 'failed': return 'Fetch failed';
    case 'fetched': return `Fetched ${formatAge(state.at, now)}`;
  }
}

/** The button a spec row offers. A tracked spec is kept fresh by the reference sync. */
export function fetchAction(state: SpecFetchState): FetchAction | null {
  switch (state.kind) {
    case 'notFetched': return 'Fetch';
    case 'fetched': return 'Refresh';
    case 'failed': return 'Try again';
    case 'tracked': return null;
  }
}
