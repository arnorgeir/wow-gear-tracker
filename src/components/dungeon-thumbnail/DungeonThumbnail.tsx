'use client';

import { useState } from 'react';
import { thumbnailLabel } from './thumbnail-label';

const BOX = 'h-9 w-12 shrink-0 rounded-md';

/**
 * Decorative: the title beside it names the dungeon. A missing or broken image becomes the
 * short-name tile. `className` sizes the box. Remembering which URL failed lets a new URL from a later refresh load.
 */
export function DungeonThumbnail({ imageUrl, shortName, className = BOX }: { imageUrl: string | null; shortName: string; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!imageUrl || failedUrl === imageUrl) {
    return (
      <span aria-hidden="true" className={`${className} flex items-center justify-center border border-line-strong bg-surface-2 font-mono text-[10px] text-muted`}>
        {thumbnailLabel(shortName)}
      </span>
    );
  }
  return (
    <img src={imageUrl} alt="" width={48} height={36} loading="lazy" decoding="async" className={`${className} object-cover`}
      onError={() => setFailedUrl(imageUrl)}
      // A server-rendered image can fail before hydration attaches onError; catch that on mount.
      ref={(el) => { if (el?.complete && el.naturalWidth === 0) setFailedUrl(imageUrl); }} />
  );
}
