import { Skeleton } from '@/components/skeleton/Skeleton';

/** Four ranked dungeons: name, score and the items each would credit. */
export function DungeonRowsSkeleton() {
  return (
    <ol aria-hidden="true" className="flex flex-col gap-4">
      {[2, 1, 2, 1].map((items, i) => (
        <li key={i} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <Skeleton className="h-5 w-40 rounded-md" />
            <Skeleton className="h-5 w-8 rounded-md" />
          </div>
          {Array.from({ length: items }, (_, j) => <Skeleton key={j} className="h-[62px] rounded-lg" />)}
        </li>
      ))}
    </ol>
  );
}
