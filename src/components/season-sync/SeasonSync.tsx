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
    fetch(`/api/season/sync?region=${region}`, { method: 'POST' })
      .then((res) => (res.ok ? (res.json() as Promise<{ result: string }>) : { result: 'failed' }))
      .catch(() => ({ result: 'failed' }))
      .then(({ result }) => { if (!cancelled && result !== 'skipped') router.refresh(); });
    return () => { cancelled = true; };
  }, [needed, region, router]);
  return null;
}
