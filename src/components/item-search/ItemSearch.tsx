'use client';

import { useState } from 'react';
import type { ItemChoice, RowRef } from '@/core/bis/edits';
import { pickQuality } from '@/core/bis/pick-quality';
import { useApiAction } from '@/components/hooks/use-api-action';
import { QUALITY_STYLES } from '@/components/item-card/quality-styles';
import { wowheadData } from '@/components/item-card/wowhead';
import { RarityBox } from './RarityBox';
import { resultDetail } from './result-detail';
import { useItemSearch } from './use-item-search';

const BUTTON = 'h-9 shrink-0 rounded-lg border border-line-strong bg-raised px-3.5 text-sm font-semibold text-ink disabled:opacity-60 md:h-9';

function ItemName({ item }: { item: ItemChoice }) {
  const q = QUALITY_STYLES[pickQuality(item.quality)];
  return (
    <a href={`https://www.wowhead.com/item=${item.itemId}`} data-wowhead={wowheadData(item.itemId, [], null)} target="_blank" rel="noreferrer"
      className="text-[15px] font-semibold no-underline hover:underline" style={{ color: q.text }}>
      {item.name}
    </a>
  );
}

const WarnIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0"><path d="M12 3l10 18H2zM12 10v5M12 18v.5" /></svg>
);

/** The panel that opens under a slot: search by name, ID or Wowhead link, then choose, then (on a tier slot) say whether to catalyze. */
export function ItemSearch({ row, label, slotLabel, onDone }: { row: RowRef; label: string; slotLabel: string; onDone: () => void }) {
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<ItemChoice | null>(null);
  const [catalyst, setCatalyst] = useState(false);
  const { results, unusable, busy, looking, error } = useItemSearch(row, query);
  const save = useApiAction();
  const inputId = `search-${row.slotKey.replace(/\W/g, '-')}`;

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
    <div className="flex flex-col gap-2.5 rounded-xl border border-line-strong bg-surface-2 p-3.5">
      <label htmlFor={inputId} className="text-[13px] font-bold uppercase tracking-wider text-muted">{label}</label>
      <input id={inputId} type="search" value={query} onChange={(e) => { setQuery(e.target.value); setChosen(null); }}
        onKeyDown={(e) => { if (e.key === 'Escape') onDone(); }}
        placeholder="Search by name, ID or Wowhead link" autoFocus
        className={`h-[46px] rounded-[10px] bg-bg px-3.5 text-base text-ink ${query ? 'border-2 border-gold' : 'border border-line-strong'}`} />
      {looking !== null && (
        <span role="status" className="flex items-center gap-2.5 text-sm text-muted">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true" className="shrink-0 animate-spin text-gold"><path d="M12 3a9 9 0 1 0 9 9" /></svg>
          Looking up item {looking} on Blizzard…
        </span>
      )}
      {looking === null && <span role="status" className="sr-only">{busy ? 'Searching…' : ''}</span>}
      {message && <p role="alert" className="flex items-center gap-2.5 text-sm text-missing"><WarnIcon />{message}</p>}

      {chosen ? (
        <div className="flex flex-col gap-3 rounded-xl border border-line-strong bg-surface-2 p-3.5">
          <div className="flex items-center gap-3"><RarityBox item={chosen} /><ItemName item={chosen} /></div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] font-semibold">
            <input type="checkbox" role="switch" checked={catalyst} onChange={(e) => setCatalyst(e.target.checked)} className="size-5 accent-[var(--color-gold)]" />
            Catalyst into tier
          </label>
          <span className="text-[13px] text-muted">Any tier {slotLabel.toLowerCase()} will count. Its stats are checked against this item&apos;s.</span>
          <div className="flex gap-2">
            <button type="button" disabled={save.busy} onClick={() => void saveItem(chosen, catalyst)}
              className="h-10 rounded-lg border border-gold bg-gold-soft px-4 text-sm font-bold text-gold disabled:opacity-60">
              {save.busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" disabled={save.busy} onClick={() => setChosen(null)} className={`${BUTTON} h-10 px-4`}>Cancel</button>
          </div>
        </div>
      ) : (results.length > 0 || unusable) && (
        <ul aria-label="Matching items" className="flex flex-col gap-0.5">
          {results.map((item) => (
            <li key={item.itemId} className="flex min-h-[52px] items-center gap-3 rounded-lg px-2 hover:bg-surface">
              <RarityBox item={item} />
              <span className="flex min-w-0 grow flex-col gap-px"><ItemName item={item} /><span className="text-[13px] text-muted">{resultDetail(item)}</span></span>
              <button type="button" disabled={save.busy} onClick={() => choose(item)} className={BUTTON}>Choose</button>
            </li>
          ))}
          {unusable && (
            <li className="flex min-h-[52px] items-center gap-3 rounded-lg bg-surface px-2">
              <span aria-hidden="true" className="size-[34px] shrink-0 rounded-md border-2 border-line-strong bg-surface" />
              <span className="flex min-w-0 grow flex-col gap-px">
                <span className="text-[15px] font-semibold text-dim">{unusable.name}</span>
                <span className="text-[13px] text-legacy">{unusable.canUse.ok ? '' : unusable.canUse.reason}</span>
              </span>
              <span className="text-[13px] text-dim">Can&apos;t choose</span>
            </li>
          )}
        </ul>
      )}
      <span className="text-[13px] text-muted">Searches this season&apos;s dungeon loot. Paste an item ID or Wowhead link for anything else.</span>
    </div>
  );
}
