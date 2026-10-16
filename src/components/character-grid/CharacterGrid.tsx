'use client';

import type { ReactNode } from 'react';
import { CharacterCardSkeleton } from '@/components/character-card/CharacterCardSkeleton';
import { CharacterRowSkeleton } from '@/components/character-row/CharacterRowSkeleton';
import type { CharactersView } from '@/components/view-toggle/characters-view';
import { usePendingCharacter } from '@/components/pending-character/PendingCharacterProvider';

/** The cards as a grid or the rows as a list, with a named skeleton at the end while one is being added. */
export function CharacterGrid({ count, view, empty, children }: { count: number; view: CharactersView; empty: ReactNode; children?: ReactNode }) {
  const adding = usePendingCharacter()?.name ?? null;
  if (count === 0 && !adding) return <>{empty}</>;
  return (
    <div className={view === 'list' ? 'flex flex-col gap-3' : 'grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4'}>
      {children}
      {adding && (view === 'list' ? <CharacterRowSkeleton name={adding} /> : <CharacterCardSkeleton name={adding} />)}
    </div>
  );
}
