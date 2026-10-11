'use client';

import { useState } from 'react';
import type { RowRef } from '@/core/bis/edits';
import { AnyItemCard } from '@/components/bis-target/AnyItemCard';
import { useApiAction } from '@/components/hooks/use-api-action';
import { ItemCard } from '@/components/item-card/ItemCard';
import { ItemSearch } from '@/components/item-search/ItemSearch';
import type { SettingsSlotView } from '@/server/views/types';
import { overrideLabel } from './slot-row';

type Method = SettingsSlotView['method'];

function MethodPick({ pick }: { pick: Method }) {
  if (pick.kind === 'any') return <AnyItemCard minItemLevel={pick.minItemLevel} />;
  return <ItemCard itemId={pick.itemId} name={pick.name} quality={pick.quality} iconUrl={pick.iconUrl} bonusIds={pick.bonusIds} itemLevel={null} detail={pick.source} />;
}

export function SlotRow({ slot, specSlug, listType }: { slot: SettingsSlotView; specSlug: string; listType: RowRef['listType'] }) {
  const [searching, setSearching] = useState(false);
  const reset = useApiAction();
  const row: RowRef = { specSlug, listType, slotKey: slot.slotKey };
  const { override } = slot;
  return (
    <div className="mx-2 my-1 flex flex-col gap-3 rounded-[10px] px-3 py-2">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_120px] md:items-center">
        <span className="font-semibold text-muted">{slot.slotLabel}</span>
        {override ? (
          <>
            <div className="line-through decoration-muted opacity-70">
              <span className="sr-only">Method&apos;s pick: </span>
              <MethodPick pick={slot.method} />
            </div>
            <div className="flex flex-col gap-1.5">
              <ItemCard itemId={override.itemId} name={override.name} quality={override.quality} iconUrl={override.iconUrl} bonusIds={[]} itemLevel={null}
                detail={overrideLabel(override)} />
              <span className="w-fit rounded-full border border-gold px-2 py-0.5 text-xs font-semibold text-gold">Edited</span>
            </div>
            <div className="flex flex-col gap-1">
              <button type="button" disabled={reset.busy}
                onClick={() => reset.run('/api/bis/overrides', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row) })}
                className="h-9 rounded-lg border border-line-strong bg-surface-2 px-3 text-sm font-semibold disabled:opacity-60">
                {reset.busy ? 'Resetting…' : 'Reset'}
              </button>
              {reset.error && <span role="alert" className="text-sm text-missing">{reset.error}</span>}
            </div>
          </>
        ) : (
          <>
            <MethodPick pick={slot.method} />
            <span className="text-sm text-muted">Method&apos;s pick</span>
            <button type="button" aria-expanded={searching} onClick={() => setSearching((open) => !open)}
              className="h-9 rounded-lg border border-line-strong bg-surface-2 px-3 text-sm font-semibold">
              Override
            </button>
          </>
        )}
      </div>
      {searching && !override && <ItemSearch row={row} slotLabel={slot.slotLabel} onDone={() => setSearching(false)} />}
    </div>
  );
}
