import { statPairLabel } from '@/components/shared/stat-pair';
import type { PriorityCreditView } from '@/server/views/types';

/** The detail line under a credit's item card on the character page. The weight sits in the card's corner, so a long line can't hide it. */
export function creditDetail(credit: Exclude<PriorityCreditView, { kind: 'any' }>): string {
  if (credit.kind === 'item') return credit.slotLabel;
  const fit = credit.fit === 'alternative'
    ? `catalyst alternative (${statPairLabel(credit.dropStats ?? [])}, BiS ${statPairLabel(credit.targetStats ?? [])})`
    : credit.fit === 'any' ? 'catalyst into tier'
    : credit.fit === 'unverified' ? 'stats unverified' : credit.targetStats ? 'BiS stats' : 'BiS item';
  return `${credit.slotLabel} · ${fit}`;
}
