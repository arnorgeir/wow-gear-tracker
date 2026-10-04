'use client';

import { useState, type ReactNode } from 'react';

/**
 * A crest icon that falls back when the URL is null or the image fails to load. Remembering which
 * URL failed lets a new URL from a later refresh load, and never retries the same one in a loop.
 */
export function CrestIcon({ url, size, fallback }: { url: string | null; size: number; fallback: ReactNode }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!url || failedUrl === url) return <>{fallback}</>;
  return (
    <img src={url} alt="" width={size} height={size} loading="lazy" className="shrink-0 rounded-sm" style={{ width: size, height: size }}
      onError={() => setFailedUrl(url)}
      // A server-rendered image can fail before hydration attaches onError; catch that on mount.
      ref={(el) => { if (el?.complete && el.naturalWidth === 0) setFailedUrl(url); }} />
  );
}
