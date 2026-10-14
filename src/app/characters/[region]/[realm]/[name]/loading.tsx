import Link from 'next/link';
import { CharacterPageSkeleton } from '@/components/character-page/CharacterPageSkeleton';
import { CHARACTER_LOADING } from '@/components/shared/loading-copy';

// Safe beside the character page: it reads no search params, and its actions only refresh,
// which keeps the current UI. /group still can't have one (see the skeleton loaders spec).
export default function Loading() {
  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-10 sm:px-16">
      <Link href="/" className="text-sm">&larr; All characters</Link>
      <p role="status" className="sr-only">{CHARACTER_LOADING}</p>
      <CharacterPageSkeleton />
    </main>
  );
}
