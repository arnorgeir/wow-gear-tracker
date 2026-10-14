'use client';

import { useEffect, useState } from 'react';
import type { ItemChoice, RowRef } from '@/core/bis/edits';
import { parseItemInput } from '@/core/bis/item-input';
import { runApiAction } from '@/components/shared/api-action';
import { isSearching, searchKey, searchPlan } from './search-plan';

const DEBOUNCE_MS = 250;

interface SearchReply { results: ItemChoice[]; unusable: ItemChoice | null }
/** `busy` runs from the moment the query or row changes until its answer arrives. `looking` is the item ID being fetched from Blizzard, while a lookup for the current query is in flight. */
export interface ItemSearchState { results: ItemChoice[]; unusable: ItemChoice | null; busy: boolean; looking: number | null; error: string | null }

/** `key` is the search the stored answer or error is for; `lookingKey` the search the running lookup belongs to. */
interface Stored { results: ItemChoice[]; unusable: ItemChoice | null; error: string | null; looking: number | null; key: string | null; lookingKey: string | null }

const NONE: Stored = { results: [], unusable: null, error: null, looking: null, key: null, lookingKey: null };
const IDLE: ItemSearchState = { results: [], unusable: null, busy: false, looking: null, error: null };

/** Debounced search of local items for one slot, falling through to a Blizzard lookup for an unknown ID or link. */
export function useItemSearch(row: RowRef, query: string): ItemSearchState {
  const [state, setState] = useState<Stored>(NONE);
  const { specSlug, source, listType, slotKey } = row;
  const idle = searchPlan(query, null).kind === 'idle';
  const key = searchKey({ specSlug, source, listType, slotKey }, query);
  // An answered key, a failed one included, is shown again rather than searched again; changing the text retries.
  const cached = key === state.key;

  useEffect(() => {
    if (idle || cached) return;
    let stale = false;
    const timer = setTimeout(async () => {
      const ref = { specSlug, source, listType, slotKey };
      const local = await runApiAction<SearchReply>(fetch, `/api/items/search?${new URLSearchParams({ ...ref, q: query.trim() })}`);
      if (stale) return;
      if (!local.ok || !local.data) return setState({ ...NONE, error: local.error, key });
      const next = local.data;
      const plan = searchPlan(query, next.unusable ? 1 : next.results.length);
      if (plan.kind !== 'lookup') return setState({ ...NONE, ...next, key });
      // The lookup replaces the answered key, so returning to an earlier query searches again.
      setState({ ...NONE, looking: parseItemInput(plan.input), lookingKey: key });
      const found = await runApiAction<ItemChoice>(fetch, '/api/items/lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...ref, input: plan.input }),
      });
      if (stale) return;
      if (!found.ok || !found.data) return setState({ ...NONE, error: found.error, key });
      setState(found.data.canUse.ok
        ? { ...NONE, results: [found.data], key }
        : { ...NONE, unusable: found.data, key });
    }, DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query, idle, cached, key, specSlug, source, listType, slotKey]);

  if (idle) return IDLE;
  return {
    results: state.results,
    unusable: state.unusable,
    error: cached ? state.error : null,
    looking: state.lookingKey === key ? state.looking : null,
    busy: isSearching(key, state.key, idle),
  };
}
