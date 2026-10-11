import { LIST_NAMES } from '@/components/shared/list-names';
import type { SettingsSpecView } from '@/server/views/types';
import { CompareAgainst } from './CompareAgainst';
import { EditorHeader } from './EditorHeader';
import { ListTabs } from './ListTabs';
import { OrphanList } from './OrphanList';
import { SlotRow } from './SlotRow';
import { StatsMatter } from './StatsMatter';

const COLUMN_HEAD = 'hidden grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_120px] gap-4 px-5 py-2.5 text-[13px] font-bold uppercase tracking-wider text-muted md:grid';

export function BisEditor({ view, now }: { view: SettingsSpecView; now: number }) {
  const list = view.lists[view.editing];
  return (
    <div className="flex flex-col gap-5 md:gap-7">
      <EditorHeader view={view} now={now} />
      <section aria-label="Comparison" className="grid gap-4 rounded-[14px] border border-line bg-surface p-4 xl:grid-cols-2 md:gap-8 md:px-6 md:py-[22px]">
        <CompareAgainst specSlug={view.slug} listType={view.listType} />
        <StatsMatter specSlug={view.slug} statsMatter={view.statsMatter} />
      </section>
      <div className="flex flex-col gap-3 md:gap-0">
        <ListTabs view={view} />
        <section aria-label={`${LIST_NAMES[view.editing]} list`} className="flex flex-col gap-2 md:mt-3 md:gap-0 md:rounded-[14px] md:border md:border-line md:bg-surface md:py-1.5">
          <div className={COLUMN_HEAD}><span>Slot</span><span>Method&apos;s pick</span><span>Your pick</span><span /></div>
          {list.slots.length === 0 && <p className="p-6 text-muted">Method has no {LIST_NAMES[view.editing]} list for this spec.</p>}
          {list.slots.map((slot) => <SlotRow key={slot.slotKey} slot={slot} specSlug={view.slug} listType={view.editing} />)}
        </section>
      </div>
      <OrphanList orphans={list.orphans} specSlug={view.slug} listType={view.editing} />
    </div>
  );
}
