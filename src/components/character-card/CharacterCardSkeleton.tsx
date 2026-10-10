import { Skeleton } from '@/components/skeleton/Skeleton';
import { addingText } from '@/components/shared/loading-copy';
import { CardProgressSkeleton } from './CardProgressSkeleton';

/** A whole card's shape. With a name it is a card being added, and says so. */
export function CharacterCardSkeleton({ name }: { name?: string }) {
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-3.5">
        <Skeleton className="size-[52px] shrink-0 rounded-full" />
        <div className="flex min-w-0 grow flex-col gap-1.5">
          {name ? <span className="truncate text-xl font-bold">{name}</span> : <Skeleton className="h-6 w-32 rounded-md" />}
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-4 w-28 rounded-md" />
        </div>
      </div>
      <CardProgressSkeleton />
      <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
        {/* No role="status": the card mounts with its text, so the add bar's always-mounted status announces it. */}
        {name ? <span className="text-sm text-muted">{addingText(name)}</span> : <Skeleton className="h-4 w-36 rounded-md" />}
      </div>
    </article>
  );
}
