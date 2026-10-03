'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Region } from '@/core/types';

/** Loads the season's loot in the background when the page says it's missing or a day old, then re-renders. */
export function SeasonSync({ region, needed }: { region: Region; needed: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!needed) return;
    let cancelled = false;
    // Refresh after every answer, skips included: another page may have loaded the season meanwhile.
    // Once per mount: a refresh keeps this component, so the effect only re-runs if `needed` changes.
    fetch(`/api/season/sync?region=${region}`, { method: 'POST' })
      .catch(() => null)
      .then(() => { if (!cancelled) router.refresh(); });
    return () => { cancelled = true; };
  }, [needed, region, router]);
  return null;
}
