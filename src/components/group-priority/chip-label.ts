import type { PriorityCreditView } from '@/server/views/types';

/** What a need chip says on hover and to screen readers. */
export function chipLabel(credit: PriorityCreditView): string {
  switch (credit.kind) {
    case 'item': return `${credit.item.name} (${credit.slotLabel})`;
    case 'tier': return `${credit.item.name} (${credit.slotLabel}), tier: catalyst a ${credit.slotLabel.toLowerCase()} drop from this dungeon`;
    case 'any': return `Any ${credit.slotLabel.toLowerCase()}, level ${credit.minItemLevel}+`;
  }
}
