'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Refreshes stale characters in the background, then re-renders the page with the new data. */
export function StaleSync({ ids }: { ids: number[] }) {
  const router = useRouter();
  const key = ids.join(',');
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    Promise.all(key.split(',').map((id) =>
      fetch(`/api/characters/${id}/sync`, { method: 'POST' })
        .then((res) => (res.ok ? (res.json() as Promise<{ result: string }>) : { result: 'error' }))
        .catch(() => ({ result: 'error' })),
    )).then((results) => {
      if (!cancelled && results.some((r) => r.result !== 'skipped')) router.refresh();
    });
    return () => { cancelled = true; };
  }, [key, router]);
  return null;
}
