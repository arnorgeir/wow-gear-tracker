'use client';

import { useState } from 'react';
import { thumbnailLabel } from './thumbnail-label';

const BOX = 'h-12 w-16 shrink-0 rounded-md';

/**
 * Decorative: the title beside it names the dungeon. A missing or broken image becomes the
 * short-name tile. Remembering which URL failed lets a new URL from a later refresh load.
 */
export function DungeonThumbnail({ imageUrl, shortName }: { imageUrl: string | null; shortName: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!imageUrl || failedUrl === imageUrl) {
    return (
      <span aria-hidden="true" className={`${BOX} flex items-center justify-center border border-line-strong bg-surface-2 font-mono text-xs text-muted`}>
        {thumbnailLabel(shortName)}
      </span>
    );
  }
  return (
    <img src={imageUrl} alt="" width={64} height={48} loading="lazy" decoding="async" className={`${BOX} object-cover`}
      onError={() => setFailedUrl(imageUrl)}
      // A server-rendered image can fail before hydration attaches onError; catch that on mount.
      ref={(el) => { if (el?.complete && el.naturalWidth === 0) setFailedUrl(imageUrl); }} />
  );
}
