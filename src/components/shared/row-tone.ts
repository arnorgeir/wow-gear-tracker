import type { CSSProperties } from 'react';
import type { ItemState } from '@/core/types';

export type RowTone = 'gold' | 'crest' | 'stats' | 'vault';

/** Every state where the BiS item is equipped gets its badge's color; bags and missing stay plain. */
const TONES: Record<ItemState, RowTone | null> = {
  done: 'gold',
  mythUpgradable: 'crest',
  wrongStats: 'stats',
  belowMyth: 'vault',
  inBags: null,
  missing: null,
};

/** No highlight while track data is unavailable, since states can't be trusted then. */
export function rowTone(state: ItemState, tracksKnown: boolean): RowTone | null {
  return tracksKnown ? TONES[state] : null;
}

// Border lightness steps down gold > crest > vault so the tones read apart in grayscale. Stats takes done's gold,
// since only the stats are off, and differs in shape, a dashed border. The outline sits inside the element, so
// toned neighbours on the 3 px mobile grid gap never overlap. Token names stay literal so Tailwind emits them.
export const ROW_TONE_STYLES: Record<RowTone, CSSProperties> = {
  gold: { background: 'var(--color-gold-soft)', outline: '2px solid var(--color-gold)', outlineOffset: '-2px' },
  crest: { background: 'var(--color-crest-soft)', outline: '2px solid var(--color-crest-line)', outlineOffset: '-2px' },
  stats: { background: 'var(--color-gold-soft)', outline: '2px dashed var(--color-gold)', outlineOffset: '-2px' },
  vault: { background: 'var(--color-vault-soft)', outline: '2px solid var(--color-vault-line)', outlineOffset: '-2px' },
};
