'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Asks a sync route to refresh in the background, then re-renders. `due` is the server's name for the work
 * the page is missing, or null. Each new name posts once: a refresh keeps this component, so the same name
 * never posts twice, and a page whose missing work changes mid-sync posts again.
 */
export function BackgroundSync({ url, due }: { url: string; due: string | null }) {
  const router = useRouter();
  useEffect(() => {
    if (!due) return;
    let cancelled = false;
    // Refresh after every answer, skips included: another page may have loaded the data meanwhile.
    fetch(url, { method: 'POST' })
      .catch(() => null)
      .then(() => { if (!cancelled) router.refresh(); });
    return () => { cancelled = true; };
  }, [due, url, router]);
  return null;
}
