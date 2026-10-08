import { BIS_LOADING } from '@/components/shared/loading-copy';
import { statPairLabel } from '@/components/shared/stat-pair';
import { tierTargetText } from '@/components/shared/tier-target';
import type { GearRowView, GroupMemberState } from '@/server/views/types';

/** What a member's cells say when there are no rows to show. Dimmed ones are waiting on something. */
export function cellNote(state: GroupMemberState, hasRows: boolean, bisLoading = false): { text: string; dim: boolean } | null {
  switch (state) {
    case 'ready': return hasRows ? null : bisLoading ? { text: BIS_LOADING, dim: true } : { text: 'No BiS list', dim: false };
    case 'untracked': return { text: 'Not tracked', dim: true };
    case 'syncing': return { text: 'Syncing…', dim: true };
    case 'noGear': return { text: 'No gear yet', dim: true };
    case 'notFound': return { text: 'Not found', dim: true };
  }
}

/** The line under a cell: what to hunt for a missing BiS item, or which stats a tier piece lacks. */
export function needText(cell: GearRowView): string | null {
  if (cell.state === 'wrongStats' && cell.bis.kind === 'item') {
    return `Tier, ${statPairLabel(cell.equippedStats ?? [])}; Method BiS wants ${statPairLabel(cell.bis.targetStats ?? [])}`;
  }
  if (cell.state !== 'missing' && cell.state !== 'inBags') return null;
  if (cell.bis.kind === 'any') return `Need: any item, level ${cell.bis.minItemLevel}+`;
  if (cell.bis.isTier) return `Need: ${tierTargetText(cell.bis)}`;
  return cell.state === 'inBags' ? `Need: ${cell.bis.name}, in your bags` : `Need: ${cell.bis.name}`;
}
