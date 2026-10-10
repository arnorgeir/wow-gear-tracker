'use client';

import type { ReactNode } from 'react';
import { CharacterCardSkeleton } from '@/components/character-card/CharacterCardSkeleton';
import { usePendingCharacter } from '@/components/pending-character/PendingCharacterProvider';

/** The card grid, with a named skeleton card at the end while one is being added. */
export function CharacterGrid({ count, empty, children }: { count: number; empty: ReactNode; children?: ReactNode }) {
  const adding = usePendingCharacter()?.name ?? null;
  if (count === 0 && !adding) return <>{empty}</>;
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {children}
      {adding && <CharacterCardSkeleton name={adding} />}
    </div>
  );
}
