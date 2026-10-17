import { bisSummary } from '@/components/shared/bis-summary';
import type { CharacterCardView } from '@/server/views/types';
import type { CharactersSort, SortKey } from './characters-sort';

type Sortable = Pick<CharacterCardView, 'name' | 'className' | 'spec' | 'realmName' | 'itemLevel' | 'lastSyncedAt' | 'counts' | 'total'>;
type Value = string | number | null;

const collator = new Intl.Collator('en', { sensitivity: 'base' });

/** BiS share of the card's headline count; null without counts or slots. */
const progress = (c: Sortable) => (c.counts && c.total > 0 ? bisSummary(c.counts).bis / c.total : null);

/** What each key orders by: the key's own value first, then the tie-break values (always ascending). */
const VALUES: Record<SortKey, (c: Sortable) => Value[]> = {
  added: () => [],
  name: (c) => [c.name],
  class: (c) => [c.className, c.spec],
  spec: (c) => [c.spec, c.className],
  itemLevel: (c) => [c.itemLevel],
  progress: (c) => [progress(c)],
  synced: (c) => [c.lastSyncedAt],
  realm: (c) => [c.realmName],
};

const compare = (a: string | number, b: string | number) =>
  typeof a === 'number' && typeof b === 'number' ? a - b : collator.compare(String(a), String(b));

/** The cards in the chosen order. Missing values come last either way; ties fall back to name, then input order. */
export function sortCards<T extends Sortable>(cards: T[], { key, dir }: CharactersSort): T[] {
  const sign = dir === 'desc' ? -1 : 1;
  const get = VALUES[key];
  return cards
    .map((card, index) => ({ card, index, values: get(card) }))
    .sort((a, b) => {
      for (let i = 0; i < a.values.length; i++) {
        const x = a.values[i], y = b.values[i];
        if (x === y) continue;
        if (x === null) return 1;
        if (y === null) return -1;
        const diff = compare(x, y);
        if (diff !== 0) return i === 0 ? sign * diff : diff;
      }
      if (key === 'added') return sign * (a.index - b.index);
      return collator.compare(a.card.name, b.card.name) || a.index - b.index;
    })
    .map((e) => e.card);
}
