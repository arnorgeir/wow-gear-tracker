import type { CSSProperties } from 'react';
import type { ItemState } from '@/core/types';

export type RowTone = 'gold' | 'green';

/**
 * Gold marks a fully upgraded BiS item; green marks a Myth-track BiS item that only needs crests.
 * No highlight while upgrade track data is unavailable, since states can't be trusted then.
 */
export function rowTone(state: ItemState, tracksKnown: boolean): RowTone | null {
  if (!tracksKnown) return null;
  if (state === 'done') return 'gold';
  if (state === 'mythUpgradable') return 'green';
  return null;
}

// Bright gold and dark green differ in lightness as well as hue, so they read for color-blind players too.
export const ROW_TONE_STYLES: Record<RowTone, CSSProperties> = {
  gold: { background: '#2e2513', boxShadow: '0 0 0 2px var(--color-gold)' },
  green: { background: '#1a2e20', boxShadow: '0 0 0 2px #3e8a4d' },
};
