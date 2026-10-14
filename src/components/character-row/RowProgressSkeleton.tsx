import { Skeleton } from '@/components/skeleton/Skeleton';

/** The row's progress block while its BiS list loads: label and count, bar, summary. */
export function RowProgressSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <Skeleton className="h-4 w-24 rounded-md" />
        <Skeleton className="h-4 w-12 rounded-md" />
      </div>
      <Skeleton className="h-2.5 w-full rounded-full" />
      <Skeleton className="h-4 w-40 rounded-md" />
    </div>
  );
}
