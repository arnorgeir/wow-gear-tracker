import { trackLabel } from '@/core/raidbots/tracks';
import { type Quality, type Track } from '@/core/types';
import type { ItemView } from './types';

export function itemView(
  item: { itemId: number; name: string; itemLevel: number | null; quality: Quality; bonusIds: number[] },
  icons: ReadonlyMap<number, string | null>, track: Track | null,
): ItemView {
  return {
    itemId: item.itemId,
    name: item.name,
    itemLevel: item.itemLevel,
    quality: item.quality,
    bonusIds: item.bonusIds,
    iconUrl: icons.get(item.itemId) ?? null,
    trackLabel: track ? trackLabel(track) : null,
  };
}
