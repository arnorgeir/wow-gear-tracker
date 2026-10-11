import { formatAge } from '@/core/format';
import type { SpecFetchState } from '@/server/views/types';

export function fetchStateLabel(state: SpecFetchState, now: number): string {
  switch (state.kind) {
    case 'tracked': return 'Tracked';
    case 'notFetched': return 'Not fetched';
    case 'failed': return 'Fetch failed, try again';
    case 'fetched': return `Fetched ${formatAge(state.at, now)}`;
  }
}
