import { statPairLabel } from '@/components/shared/stat-pair';
import type { PriorityCreditView } from '@/server/views/types';

/** The detail line under a credit's item card on the character page. */
export function creditDetail(credit: Exclude<PriorityCreditView, { kind: 'any' }>): string {
  if (credit.kind === 'item') return `${credit.slotLabel} · weight ${credit.weight}`;
  const fit = credit.fit === 'alternative'
    ? `catalyst alternative (${statPairLabel(credit.dropStats ?? [])}, BiS ${statPairLabel(credit.targetStats ?? [])})`
    : credit.fit === 'unverified' ? 'stats unverified' : credit.targetStats ? 'Method BiS stats' : 'Method BiS item';
  return `${credit.slotLabel} · ${fit} · weight ${credit.weight}`;
}
