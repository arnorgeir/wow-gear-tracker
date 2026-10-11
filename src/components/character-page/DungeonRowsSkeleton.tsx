import { Skeleton } from '@/components/skeleton/Skeleton';

/** Four ranked dungeons like the loaded rows: the first open with two items, three closed. */
export function DungeonRowsSkeleton() {
  return (
    <ol aria-hidden="true" className="flex flex-col gap-1.5">
      <li className="flex flex-col gap-2.5 rounded-xl border border-line-strong pb-3">
        <Skeleton className="h-[58px] rounded-xl" />
        <div className="flex flex-col gap-2.5 px-2.5">
          <Skeleton className="h-[62px] rounded-lg" />
          <Skeleton className="h-[62px] rounded-lg" />
        </div>
      </li>
      {[1, 2, 3].map((i) => <li key={i}><Skeleton className="h-[58px] rounded-xl" /></li>)}
    </ol>
  );
}
