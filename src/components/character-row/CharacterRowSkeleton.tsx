import { Skeleton } from '@/components/skeleton/Skeleton';
import { addingText } from '@/components/shared/loading-copy';
import { RowProgressSkeleton } from './RowProgressSkeleton';

/** A whole row's shape. With a name it is a character being added, and says so. */
export function CharacterRowSkeleton({ name }: { name?: string }) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line bg-surface px-4 py-3 lg:flex-row lg:items-center lg:gap-6">
      <div className="flex min-w-0 shrink-0 items-center gap-3 lg:w-64">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="flex min-w-0 grow flex-col gap-1.5">
          {name ? <span className="truncate text-lg font-bold">{name}</span> : <Skeleton className="h-5 w-32 rounded-md" />}
          <Skeleton className="h-4 w-28 rounded-md" />
        </div>
      </div>
      <div className="min-w-0 grow"><RowProgressSkeleton /></div>
      <div className="flex shrink-0 items-center justify-between gap-3">
        {/* No role="status": the row mounts with its text, so the add bar's always-mounted status announces it. */}
        {name ? <span className="text-sm text-muted lg:w-40 lg:text-right">{addingText(name)}</span> : <Skeleton className="h-4 w-36 rounded-md" />}
      </div>
    </article>
  );
}
