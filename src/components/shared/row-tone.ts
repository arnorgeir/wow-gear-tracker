import type { CSSProperties } from 'react';
import type { ItemState } from '@/core/types';

export type RowTone = 'gold' | 'green' | 'stats';

/**
 * Gold marks a fully upgraded BiS item; green marks a Myth-track BiS item that only needs crests; a dashed
 * pink outline marks a tier piece whose stats differ from Method's. No highlight while track data is
 * unavailable, since states can't be trusted then.
 */
export function rowTone(state: ItemState, tracksKnown: boolean): RowTone | null {
  if (!tracksKnown) return null;
  if (state === 'done') return 'gold';
  if (state === 'mythUpgradable') return 'green';
  if (state === 'wrongStats') return 'stats';
  return null;
}

// Bright gold and dark green differ in lightness as well as hue; the stats tone differs in shape, a dashed outline.
export const ROW_TONE_STYLES: Record<RowTone, CSSProperties> = {
  gold: { background: '#2e2513', boxShadow: '0 0 0 2px var(--color-gold)' },
  green: { background: '#1a2e20', boxShadow: '0 0 0 2px #3e8a4d' },
  stats: { background: 'var(--color-stats-bg)', outline: '2px dashed var(--color-stats)', outlineOffset: '-2px' },
};
