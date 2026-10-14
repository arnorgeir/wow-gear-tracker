'use client';

import { useState } from 'react';
import type { RowRef } from '@/core/bis/edits';
import type { FetchedSourceId } from '@/core/types';
import { useApiAction } from '@/components/hooks/use-api-action';
import { ItemSearch } from '@/components/item-search/ItemSearch';
import type { SettingsSlotView } from '@/server/views/types';
import { EditedPill } from './EditedPill';
import { anyPickName, followsText, methodPickName, replaceText, rowButton } from './editor-text';
import { PickLine } from './PickLine';
import { overrideLabel } from './slot-row';

type Method = SettingsSlotView['method'];

function MethodPick({ pick, replaced }: { pick: Method; replaced?: boolean }) {
  if (pick.kind === 'any') {
    const any = anyPickName(pick.minItemLevel);
    return <PickLine itemId={null} name={any.name} quality={null} iconUrl={null} detail={any.detail} replaced={replaced} />;
  }
  return <PickLine itemId={pick.itemId} name={methodPickName(pick)} quality={pick.quality} iconUrl={pick.iconUrl} detail={pick.source} replaced={replaced} />;
}

const BUTTON = 'h-10 justify-self-end rounded-lg border bg-raised px-3.5 text-sm font-semibold text-ink disabled:opacity-60';

export function SlotRow({ slot, specSlug, source, copiedFrom, listType }: { slot: SettingsSlotView; specSlug: string; source: RowRef['source']; copiedFrom: FetchedSourceId | null; listType: RowRef['listType'] }) {
  const [searching, setSearching] = useState(false);
  const reset = useApiAction();
  const row: RowRef = { specSlug, source, listType, slotKey: slot.slotKey };
  const { override } = slot;
  const edited = override !== null;
  const label = rowButton({ edited, open: searching });
  const button = (
    <button type="button" disabled={reset.busy} aria-expanded={edited ? undefined : searching}
      onClick={() => (edited
        ? reset.run('/api/bis/overrides', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row) })
        : setSearching((open) => !open))}
      className={`${BUTTON} ${label === 'Cancel' ? 'border-gold' : 'border-line-strong'}`}>
      {reset.busy ? 'Resetting…' : label}
    </button>
  );
  const mine = override && (
    <PickLine itemId={override.itemId} name={overrideLabel(override)} quality={override.quality} iconUrl={override.iconUrl}
      detail={override.catalyst ? `Any tier ${slot.slotLabel.toLowerCase()} counts` : ''} badge={<EditedPill />} />
  );
  const tone = edited ? 'border border-gold-wash-line bg-gold-wash' : 'border border-transparent';
  return (
    <div className={`mx-2 my-1 flex flex-col gap-3 rounded-[10px] px-3 py-2 ${tone}`}>
      <div className="hidden grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_120px] items-center gap-4 md:grid">
        <span className="text-[15px] font-semibold text-muted">{slot.slotLabel}</span>
        <MethodPick pick={slot.method} replaced={edited} />
        {mine ?? <span className="text-sm text-dim">{followsText(source)}</span>}
        {button}
      </div>

      <div className="flex flex-col gap-2.5 md:hidden">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-muted">{slot.slotLabel}{edited && <EditedPill />}</span>
          {button}
        </div>
        {mine}
        <MethodPick pick={slot.method} replaced={edited} />
      </div>

      {reset.error && <span role="alert" className="text-sm text-missing">{reset.error}</span>}
      {searching && !edited && (
        <div className="md:ml-[126px]">
          <ItemSearch row={row} label={replaceText(source, slot.slotLabel, copiedFrom)} slotLabel={slot.slotLabel} onDone={() => setSearching(false)} />
        </div>
      )}
    </div>
  );
}
