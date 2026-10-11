import { Skeleton } from '@/components/skeleton/Skeleton';

/** A cell's placeholder, the height of a real cell. */
export function CellSkeleton() {
  return <div data-skeleton-cell className="contents"><Skeleton className="min-h-[80px] rounded-lg sm:min-h-[68px]" /></div>;
}
