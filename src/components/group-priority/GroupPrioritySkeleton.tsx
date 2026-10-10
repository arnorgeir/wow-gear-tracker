import { PriorityRowsSkeleton } from './PriorityRowsSkeleton';

export function GroupPrioritySkeleton({ status }: { status?: string }) {
  return (
    <section aria-label="Dungeon priority" className="flex flex-col gap-3">
      {status && <span role="status" className="sr-only">{status}</span>}
      <h2 className="font-display text-xl font-bold whitespace-nowrap">Dungeon priority</h2>
      <PriorityRowsSkeleton />
    </section>
  );
}
