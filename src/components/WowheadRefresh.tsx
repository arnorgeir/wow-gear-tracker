'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

declare global {
  interface Window { $WowheadPower?: { refreshLinks: () => void } }
}

/** Wowhead scans links once on load; client-side navigation needs a rescan. */
export function WowheadRefresh() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    window.$WowheadPower?.refreshLinks();
  }, [pathname, search]);
  return null;
}
