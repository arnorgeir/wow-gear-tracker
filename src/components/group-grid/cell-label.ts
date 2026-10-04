import { STATE_LABELS } from '@/components/state-badge/state-labels';
import type { GearRowView } from '@/server/views/types';

/** The compact cell button's accessible name: everything the cell abbreviates, in words. */
export function cellLabel(memberName: string, slotLabel: string, cell: GearRowView): string {
  const item = cell.equipped
    ? `${cell.equipped.name}${cell.equipped.itemLevel ? `, item level ${cell.equipped.itemLevel}` : ''}`
    : 'nothing equipped';
  const upgrade = cell.upgrade ? ', can upgrade now' : '';
  return `${memberName}, ${slotLabel}: ${item}, ${STATE_LABELS[cell.state].text.toLowerCase()}${upgrade}`;
}
