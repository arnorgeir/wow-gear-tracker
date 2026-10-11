import { Skeleton } from '@/components/skeleton/Skeleton';

/** A member header's shape: avatar and name, then crests. */
export function MemberHeaderSkeleton() {
  return (
    <div className="flex flex-col items-center gap-1.5 p-1 sm:items-start sm:p-2">
      <Skeleton className="h-[26px] w-full max-w-28 rounded-full" />
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  );
}
