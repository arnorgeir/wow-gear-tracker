import type { GearRowView } from '@/server/views/types';
import { statPairLabel } from './stat-pair';

/**
 * The equipped tier piece's real stat pair, which the Wowhead tooltip can't show for a catalysed piece: the
 * catalyst keeps the input item's stats, and Wowhead shows the base item's. Null unless a tier piece fills a
 * tier row and its stats are known ("Stats unverified" when they could not be checked); Missing and BiS in bags rows show some other item, or none.
 */
export function equippedStatText(row: Pick<GearRowView, 'bis' | 'state' | 'equippedStats' | 'statsUnverified'>): string | null {
  if (row.bis.kind !== 'item' || !row.bis.isTier) return null;
  if (row.state === 'missing' || row.state === 'inBags') return null;
  if (row.statsUnverified) return 'Stats unverified';
  if (row.equippedStats === null) return null;
  return statPairLabel(row.equippedStats);
}
