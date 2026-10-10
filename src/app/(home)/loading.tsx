import { CharacterCardSkeleton } from '@/components/character-card/CharacterCardSkeleton';
import { CHARACTERS_LOADING } from '@/components/shared/loading-copy';
import { Skeleton } from '@/components/skeleton/Skeleton';
import { StateLegend } from '@/components/state-legend/StateLegend';

// Scoped to `/` by the (home) route group: a loading boundary above /group or a character page makes their
// search-param navigations reload the whole document (see the skeleton loaders spec).
export default function Loading() {
  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-12 sm:px-16">
      <p role="status" className="sr-only">{CHARACTERS_LOADING}</p>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-4xl font-bold tracking-wide">Characters</h1>
        <p className="text-[17px] text-muted">BiS progress against Method&rsquo;s lists</p>
      </div>
      <Skeleton className="h-[114px] rounded-2xl" />
      <StateLegend />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <CharacterCardSkeleton key={i} />)}
      </div>
    </main>
  );
}
