'use client';

import { useState } from 'react';
import type { ItemChoice, RowRef } from '@/core/bis/edits';
import { useApiAction } from '@/components/hooks/use-api-action';
import { QUALITY_STYLES } from '@/components/item-card/quality-styles';
import { wowheadData } from '@/components/item-card/wowhead';
import { useItemSearch } from './use-item-search';

function ItemLink({ item }: { item: ItemChoice }) {
  const q = QUALITY_STYLES[item.quality ?? 'EPIC'];
  return (
    <a href={`https://www.wowhead.com/item=${item.itemId}`} data-wowhead={wowheadData(item.itemId, [], null)} target="_blank" rel="noreferrer"
      className="font-semibold no-underline hover:underline" style={{ color: q.text }}>
      {item.name}
    </a>
  );
}

/** Search by name, ID or Wowhead link for the item that replaces one slot of Method's list. */
export function ItemSearch({ row, slotLabel, onDone }: { row: RowRef; slotLabel: string; onDone: () => void }) {
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<ItemChoice | null>(null);
  const [catalyst, setCatalyst] = useState(false);
  const { results, unusable, busy, error } = useItemSearch(row, query);
  const save = useApiAction();

  async function saveItem(item: ItemChoice, asCatalyst: boolean) {
    const result = await save.run('/api/bis/overrides', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...row, itemId: item.itemId, catalyst: asCatalyst }),
    });
    if (result.ok) onDone();
  }

  function choose(item: ItemChoice) {
    if (item.canCatalyst) {
      setChosen(item);
      setCatalyst(false);
    } else {
      void saveItem(item, false);
    }
  }

  const message = save.error ?? error;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-2 p-3">
      <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setChosen(null); }}
        onKeyDown={(e) => { if (e.key === 'Escape') onDone(); }}
        placeholder="Search by name, ID or Wowhead link" aria-label={`Search items for ${slotLabel}`} autoFocus
        className="h-11 rounded-xl border border-line-strong bg-surface px-3 text-ink" />
      <span role="status" className="sr-only">{busy ? 'Searching…' : ''}</span>
      {message && <p role="alert" className="text-sm text-missing">{message}</p>}
      {chosen ? (
        <div className="flex flex-wrap items-center gap-4">
          <ItemLink item={chosen} />
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={catalyst} onChange={(e) => setCatalyst(e.target.checked)} className="size-[18px] accent-[var(--color-gold)]" />
            Catalyst into tier
          </label>
          <button type="button" disabled={save.busy} onClick={() => void saveItem(chosen, catalyst)}
            className="h-9 rounded-lg border border-line-strong bg-raised px-3 text-sm font-semibold disabled:opacity-60">
            {save.busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {results.map((item) => (
            <li key={item.itemId} className="flex items-center justify-between gap-3">
              <ItemLink item={item} />
              <button type="button" disabled={save.busy} onClick={() => choose(item)}
                className="h-9 rounded-lg border border-line-strong bg-raised px-3 text-sm font-semibold disabled:opacity-60">
                Choose
              </button>
            </li>
          ))}
          {unusable && (
            <li className="flex flex-wrap items-center gap-x-3 text-muted">
              <span>{unusable.name}</span>
              <span className="text-sm">{unusable.canUse.ok ? '' : unusable.canUse.reason}</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
