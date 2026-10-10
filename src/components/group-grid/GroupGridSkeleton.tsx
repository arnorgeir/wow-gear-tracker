import type { CSSProperties } from 'react';
import { SLOT_TYPES } from '@/core/types';
import { SLOT_LABELS } from '@/server/views/group-grid';
import { CellSkeleton } from './CellSkeleton';
import { COLUMNS } from './columns';
import { MemberHeaderSkeleton } from './MemberHeaderSkeleton';
import { SLOT_SHORT } from './slot-short';

/** The grid's shape for a membership the server hasn't rendered yet. */
export function GroupGridSkeleton({ members, status }: { members: number; status?: string }) {
  const count = Math.max(1, members);
  const columns = Array.from({ length: count }, (_, i) => i);
  return (
    <section aria-label="Gear by slot" className="rounded-2xl border border-line bg-surface p-1 sm:p-2">
      {status && <span role="status" className="sr-only">{status}</span>}
      <div className={`grid gap-[3px] sm:gap-1.5 ${COLUMNS}`} style={{ '--members': count } as CSSProperties}>
        <span className="self-end p-1 text-xs font-semibold uppercase tracking-wider text-muted"><span className="sr-only sm:not-sr-only">Slot</span></span>
        {columns.map((i) => <MemberHeaderSkeleton key={i} />)}
        {SLOT_TYPES.map((slot) => (
          <div key={slot} className="contents">
            <span className="flex items-center text-xs font-semibold text-muted sm:text-sm">
              <span aria-hidden="true" className="sm:hidden">{SLOT_SHORT[slot]}</span>
              <span className="sr-only sm:not-sr-only">{SLOT_LABELS[slot]}</span>
            </span>
            {columns.map((i) => <CellSkeleton key={i} />)}
          </div>
        ))}
      </div>
    </section>
  );
}
