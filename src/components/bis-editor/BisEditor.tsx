import Link from 'next/link';
import { LIST_NAMES } from '@/components/shared/list-names';
import { LIST_TYPES } from '@/core/types';
import type { SettingsSpecView } from '@/server/views/types';
import { CompareAgainst } from './CompareAgainst';
import { OrphanList } from './OrphanList';
import { SlotRow } from './SlotRow';
import { StatsMatter } from './StatsMatter';

export function BisEditor({ view }: { view: SettingsSpecView }) {
  const list = view.lists[view.editing];
  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-2xl font-bold">{view.specName} {view.className}</h2>
      <div className="flex flex-wrap gap-x-10 gap-y-4">
        <CompareAgainst specSlug={view.slug} listType={view.listType} />
        <StatsMatter specSlug={view.slug} statsMatter={view.statsMatter} />
      </div>
      <nav aria-label="Lists to edit" className="flex border-b border-line">
        {LIST_TYPES.map((l) => (
          <Link key={l} href={`/settings/bis/${view.slug}?list=${l}`} aria-current={l === view.editing ? 'page' : undefined}
            className={`-mb-px border-b-2 px-4 py-3 font-semibold no-underline ${l === view.editing ? 'border-gold text-ink' : 'border-transparent text-muted'}`}>
            {LIST_NAMES[l]}
            {l === view.listType && <span className="ml-2 text-xs font-normal text-muted">Compared</span>}
          </Link>
        ))}
      </nav>
      <section aria-label={`${LIST_NAMES[view.editing]} list`} className="flex flex-col rounded-2xl border border-line bg-surface py-1">
        {list.slots.length === 0 && <p className="p-6 text-muted">Method has no {LIST_NAMES[view.editing]} list for this spec.</p>}
        {list.slots.map((slot) => <SlotRow key={slot.slotKey} slot={slot} specSlug={view.slug} listType={view.editing} />)}
      </section>
      <OrphanList orphans={list.orphans} specSlug={view.slug} listType={view.editing} />
    </div>
  );
}
