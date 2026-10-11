import type { ReactNode } from 'react';
import { Skeleton } from '@/components/skeleton/Skeleton';
import { DungeonPrioritySkeleton } from './DungeonPrioritySkeleton';
import { GearTableSkeleton } from './GearTableSkeleton';
import { VaultSectionSkeleton } from './VaultSectionSkeleton';

/** The character page below the back link. The caller owns the status line. */
export function CharacterPageSkeleton({ heading }: { heading?: ReactNode }) {
  return (
    <>
      {heading}
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-[76px] shrink-0 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-56 rounded-md" />
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="h-4 w-44 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-10 w-64 rounded-xl" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
      <section aria-hidden="true" className="flex flex-col gap-2">
        <Skeleton className="h-4 w-16 rounded-md" />
        <div className="flex gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-7 w-20 rounded-full" />)}</div>
      </section>
      <Skeleton className="h-12 w-full max-w-xl rounded-xl" />
      <div className="flex gap-2 border-b border-line pb-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-6 w-24 rounded-md" />)}</div>
      <div className="grid grid-cols-1 gap-8 min-[1380px]:grid-cols-[860px_minmax(0,1fr)] min-[1380px]:items-start">
        <GearTableSkeleton />
        <div className="flex flex-col gap-8">
          <DungeonPrioritySkeleton />
          <VaultSectionSkeleton />
        </div>
      </div>
    </>
  );
}
