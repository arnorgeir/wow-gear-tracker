import type { GearRowView, GroupMemberState } from '@/server/views/types';

/** What a member's cells say when there are no rows to show. Dimmed ones are waiting on something. */
export function cellNote(state: GroupMemberState, hasRows: boolean): { text: string; dim: boolean } | null {
  switch (state) {
    case 'ready': return hasRows ? null : { text: 'No BiS list', dim: false };
    case 'untracked': return { text: 'Not tracked', dim: true };
    case 'syncing': return { text: 'Syncing…', dim: true };
    case 'noGear': return { text: 'No gear yet', dim: true };
    case 'notFound': return { text: 'Not found', dim: true };
  }
}

/** The "Need:" line under a cell whose BiS item isn't worn yet. */
export function needText(cell: GearRowView): string | null {
  if (cell.state !== 'missing' && cell.state !== 'inBags') return null;
  if (cell.bis.kind === 'any') return `Need: any item, level ${cell.bis.minItemLevel}+`;
  if (cell.bis.isTier) return 'Need: tier via catalyst';
  return cell.state === 'inBags' ? `Need: ${cell.bis.name}, in your bags` : `Need: ${cell.bis.name}`;
}
