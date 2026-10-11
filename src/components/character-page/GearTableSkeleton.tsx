import { Skeleton } from '@/components/skeleton/Skeleton';
import { SLOT_TYPES } from '@/core/types';
import { SLOT_LABELS } from '@/server/views/group-grid';
import { GEAR_COLUMNS, GearTableHeader } from './GearTableHeader';

/** One placeholder row per slot, on the gear table's grid. */
export function GearRowsSkeleton() {
  return SLOT_TYPES.map((slot) => (
    <div key={slot} className={`mx-2 my-1 grid grid-cols-1 gap-3 rounded-[10px] px-3 py-2 ${GEAR_COLUMNS} md:items-center`}>
      <span className="font-semibold text-muted">{SLOT_LABELS[slot]}</span>
      <Skeleton className="h-[62px] rounded-lg" />
      <Skeleton className="h-[62px] rounded-lg" />
      <Skeleton className="h-6 w-28 rounded-full" />
    </div>
  ));
}

export function GearTableSkeleton({ status }: { status?: string }) {
  return (
    <section aria-label="Gear by slot" className="flex flex-col rounded-2xl border border-line bg-surface py-1">
      {status && <span role="status" className="sr-only">{status}</span>}
      <GearTableHeader />
      <GearRowsSkeleton />
    </section>
  );
}
