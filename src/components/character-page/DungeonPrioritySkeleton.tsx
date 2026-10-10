import { BrandIcon } from '@/components/brand-icon/BrandIcon';
import { DungeonRowsSkeleton } from './DungeonRowsSkeleton';

export function DungeonPrioritySkeleton({ status }: { status?: string }) {
  return (
    <section aria-label="Dungeon priority" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      {status && <span role="status" className="sr-only">{status}</span>}
      <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold"><BrandIcon name="dungeons" size={28} className="text-gold" />Dungeon priority</h2>
      <DungeonRowsSkeleton />
    </section>
  );
}
