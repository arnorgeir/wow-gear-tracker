import { Skeleton } from '@/components/skeleton/Skeleton';

/** Five ranked dungeon rows. */
export function PriorityRowsSkeleton() {
  return (
    <ol aria-hidden="true" className="flex flex-col gap-1.5">
      {[0, 1, 2, 3, 4].map((i) => <li key={i}><Skeleton className="h-[52px] rounded-lg" /></li>)}
    </ol>
  );
}
