import { BisSourceBadge } from '@/components/bis-source-badge/BisSourceBadge';
import { LIST_NAMES } from '@/components/shared/list-names';
import type { ListType } from '@/core/types';

export const GEAR_COLUMNS = 'md:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_190px]';

interface Source { listType: ListType; specSlug: string; editedCount: number }

/** `source` names the compared list and links to its settings; skeletons draw the header without one. */
export function GearTableHeader({ source }: { source?: Source }) {
  return (
    <div className="hidden grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_190px] gap-3 border-b border-line px-4 py-3 text-[13px] font-semibold uppercase tracking-wider text-muted md:grid">
      <span>Slot</span><span>Equipped</span>
      <span className="flex flex-wrap items-center gap-2">
        {source ? <>BiS · {LIST_NAMES[source.listType]} <BisSourceBadge specSlug={source.specSlug} editedCount={source.editedCount} /></> : 'BiS'}
      </span>
      <span>State</span>
    </div>
  );
}
