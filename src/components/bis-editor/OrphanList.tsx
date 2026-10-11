'use client';

import type { RowRef } from '@/core/bis/edits';
import { useApiAction } from '@/components/hooks/use-api-action';
import { QUALITY_STYLES } from '@/components/item-card/quality-styles';
import { wowheadData } from '@/components/item-card/wowhead';
import type { SettingsSpecView } from '@/server/views/types';

type Orphan = SettingsSpecView['lists']['overall']['orphans'][number];

function OrphanRow({ orphan, row }: { orphan: Orphan; row: RowRef }) {
  const { busy, error, run } = useApiAction();
  const q = QUALITY_STYLES[orphan.quality];
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <a href={`https://www.wowhead.com/item=${orphan.itemId}`} data-wowhead={wowheadData(orphan.itemId, [], null)} target="_blank" rel="noreferrer"
        className="font-semibold no-underline hover:underline" style={{ color: q.text }}>{orphan.name}</a>
      <span className="text-sm text-muted">{orphan.slotKey}</span>
      <button type="button" disabled={busy}
        onClick={() => run('/api/bis/overrides', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row) })}
        className="h-9 rounded-lg border border-line-strong bg-surface-2 px-3 text-sm font-semibold disabled:opacity-60">
        {busy ? 'Removing…' : 'Remove'}
      </button>
      {error && <span role="alert" className="text-sm text-missing">{error}</span>}
    </li>
  );
}

/** Overrides whose slot is no longer in Method's list. They apply to nothing until removed. */
export function OrphanList({ orphans, specSlug, listType }: { orphans: Orphan[]; specSlug: string; listType: RowRef['listType'] }) {
  if (orphans.length === 0) return null;
  return (
    <section aria-label="No longer in Method's list" className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
      <h3 className="font-semibold">No longer in Method&apos;s list</h3>
      <ul className="flex flex-col gap-2">
        {orphans.map((o) => <OrphanRow key={o.slotKey} orphan={o} row={{ specSlug, listType, slotKey: o.slotKey }} />)}
      </ul>
    </section>
  );
}
