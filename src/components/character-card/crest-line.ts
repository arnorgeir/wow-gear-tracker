import type { CrestBalance } from '@/core/gear/crests';
import { formatAge } from '@/core/format';

interface CrestLineInput {
  crests: { balances: CrestBalance[]; pastedAt: number } | null;
  /** When the gear itself came from the same paste, its age is already shown beside the source. */
  gearFromSimc: boolean;
  upgradesReady: number;
}

/** The crest line on a character card: balances to show as chips, then how many BiS upgrades they pay for. */
export function crestLine({ crests, gearFromSimc, upgradesReady }: CrestLineInput, now: number): { balances: CrestBalance[]; text: string; tone: string } {
  if (!crests) return { balances: [], text: 'Crests unknown: paste SimC', tone: 'text-muted' };
  const ready = upgradesReady === 0 ? 'no BiS upgrades affordable' : `${upgradesReady} BiS ${upgradesReady === 1 ? 'upgrade' : 'upgrades'} ready`;
  const tone = upgradesReady === 0 ? 'text-muted' : 'text-upgrade';
  const lead = crests.balances.length === 0 ? 'No crests' : gearFromSimc ? '' : `Pasted ${formatAge(crests.pastedAt, now)}`;
  const text = lead ? `${lead}: ${ready}` : ready.charAt(0).toUpperCase() + ready.slice(1);
  return { balances: crests.balances, text, tone };
}
