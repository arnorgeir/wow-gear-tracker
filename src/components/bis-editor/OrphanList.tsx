'use client';

import type { RowRef } from '@/core/bis/edits';
import { useApiAction } from '@/components/hooks/use-api-action';
import type { SettingsSpecView } from '@/server/views/types';
import { orphanLabel, orphanText } from './editor-text';
import { PickLine } from './PickLine';

type Orphan = SettingsSpecView['lists']['overall']['orphans'][number];

function OrphanRow({ orphan, row }: { orphan: Orphan; row: RowRef }) {
  const { busy, error, run } = useApiAction();
  return (
    <li className="flex min-h-[52px] flex-wrap items-center gap-x-3.5 gap-y-1">
      <div className="min-w-0 grow">
        <PickLine itemId={orphan.itemId} name={orphan.name} quality={orphan.quality} iconUrl={orphan.iconUrl} detail={orphanLabel(orphan.slotKey)} />
      </div>
      <button type="button" disabled={busy}
        onClick={() => run('/api/bis/overrides', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row) })}
        className="h-10 rounded-lg border border-line-strong bg-raised px-3.5 text-sm font-semibold disabled:opacity-60">
        {busy ? 'Removing…' : 'Remove'}
      </button>
      {error && <span role="alert" className="w-full text-sm text-missing">{error}</span>}
    </li>
  );
}

/** Overrides whose slot is no longer in the list. They apply to nothing until removed. */
export function OrphanList({ orphans, specSlug, source, listType }: { orphans: Orphan[]; specSlug: string; source: RowRef['source']; listType: RowRef['listType'] }) {
  if (orphans.length === 0) return null;
  const text = orphanText(source);
  return (
    <section aria-labelledby="orphans" className="flex flex-col gap-3 rounded-xl border border-missing-line bg-header p-3.5 md:rounded-[14px] md:px-6 md:py-5">
      <div className="flex flex-col gap-1">
        <h3 id="orphans" className="text-base font-bold md:text-[17px]">{text.heading}</h3>
        <span className="text-[13px] text-muted md:text-sm">{text.body}</span>
      </div>
      <ul className="flex flex-col gap-2">
        {orphans.map((o) => <OrphanRow key={o.slotKey} orphan={o} row={{ specSlug, source, listType, slotKey: o.slotKey }} />)}
      </ul>
    </section>
  );
}
