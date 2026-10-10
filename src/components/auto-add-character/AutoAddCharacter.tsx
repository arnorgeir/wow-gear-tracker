'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { runApiAction } from '@/components/shared/api-action';
import type { UntrackedCharacterView } from '@/server/views/types';

/**
 * Tracks a character opened by path, then re-renders the same URL as its page. The add runs here,
 * through the guarded POST route, because a page render must never write on GET.
 */
export function AutoAddCharacter({ character }: { character: UntrackedCharacterView }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Strict Mode mounts twice in development; one POST is enough. A refresh keeps this mounted, so a failure never retries.
  const started = useRef(false);
  const { region, realmSlug, name } = character;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    runApiAction(fetch, '/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region, realmSlug, name }),
    }, 'Couldn’t add that character.').then((result) => {
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }, [region, realmSlug, name, router]);

  return error
    ? <p role="alert" className="text-[#f3c9a2]">{error}</p>
    : <p className="text-muted">Adding {name} – {realmSlug}…</p>;
}
