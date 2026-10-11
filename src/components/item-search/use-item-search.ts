'use client';

import { useEffect, useState } from 'react';
import type { ItemChoice, RowRef } from '@/core/bis/edits';
import { parseItemInput } from '@/core/bis/item-input';
import { runApiAction } from '@/components/shared/api-action';
import { searchPlan } from './search-plan';

const DEBOUNCE_MS = 250;

interface SearchReply { results: ItemChoice[]; unusable: ItemChoice | null }
/** `looking` is the item ID being fetched from Blizzard, while a lookup is in flight. */
export interface ItemSearchState { results: ItemChoice[]; unusable: ItemChoice | null; busy: boolean; looking: number | null; error: string | null }

const IDLE: ItemSearchState = { results: [], unusable: null, busy: false, looking: null, error: null };

/** Debounced search of local items for one slot, falling through to a Blizzard lookup for an unknown ID or link. */
export function useItemSearch(row: RowRef, query: string): ItemSearchState {
  const [state, setState] = useState<ItemSearchState>(IDLE);
  const { specSlug, listType, slotKey } = row;
  const idle = searchPlan(query, null).kind === 'idle';

  useEffect(() => {
    if (idle) return;
    let stale = false;
    const timer = setTimeout(async () => {
      setState((s) => ({ ...s, busy: true, error: null }));
      const ref = { specSlug, listType, slotKey };
      const local = await runApiAction<SearchReply>(fetch, `/api/items/search?${new URLSearchParams({ ...ref, q: query.trim() })}`);
      if (stale) return;
      if (!local.ok || !local.data) return setState({ ...IDLE, error: local.error });
      const next = local.data;
      const plan = searchPlan(query, next.unusable ? 1 : next.results.length);
      if (plan.kind !== 'lookup') return setState({ ...next, busy: false, looking: null, error: null });
      setState({ ...IDLE, busy: true, looking: parseItemInput(plan.input) });
      const found = await runApiAction<ItemChoice>(fetch, '/api/items/lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...ref, input: plan.input }),
      });
      if (stale) return;
      if (!found.ok || !found.data) return setState({ ...IDLE, error: found.error });
      setState(found.data.canUse.ok
        ? { ...IDLE, results: [found.data] }
        : { ...IDLE, unusable: found.data });
    }, DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query, idle, specSlug, listType, slotKey]);

  return idle ? IDLE : state;
}
