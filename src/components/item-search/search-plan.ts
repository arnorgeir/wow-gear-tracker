import type { RowRef } from '@/core/bis/edits';
import { parseItemInput } from '@/core/bis/item-input';

/** What the search box does with its input. */
export type SearchPlan = { kind: 'idle' } | { kind: 'search'; q: string } | { kind: 'lookup'; input: string };

/** `localResults` is null until a local search has answered. Only an ID or link goes on to a Blizzard lookup, never a name. */
export function searchPlan(input: string, localResults: number | null): SearchPlan {
  const text = input.trim();
  if (!text) return { kind: 'idle' };
  if (localResults === 0 && parseItemInput(text) !== null) return { kind: 'lookup', input: text };
  return { kind: 'search', q: text };
}

/** What one search is for: the row's four fields and the trimmed query. */
export const searchKey = (row: RowRef, query: string) => JSON.stringify([row.specSlug, row.source, row.listType, row.slotKey, query.trim()]);

/** True from the moment the key changes until an answer (result or error) for that key arrives. */
export const isSearching = (key: string, answeredKey: string | null, idle: boolean) => !idle && key !== answeredKey;
