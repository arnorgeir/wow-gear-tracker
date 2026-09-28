import { formatAge } from '@/core/format';

interface CrestLineInput {
  crests: { balances: { name: string; quantity: number }[]; pastedAt: number } | null;
  /** When the gear itself came from the same paste, its age is already shown beside the source. */
  gearFromSimc: boolean;
  upgradesReady: number;
}

/** The crest line on a character card: balances from the last paste, and how many BiS upgrades they pay for. */
export function crestLine({ crests, gearFromSimc, upgradesReady }: CrestLineInput, now: number): { text: string; tone: string } {
  if (!crests) return { text: 'Crests unknown: paste SimC', tone: 'text-muted' };
  const age = gearFromSimc ? '' : ` (pasted ${formatAge(crests.pastedAt, now)})`;
  const balances = (crests.balances.map((b) => `${b.name.split(' ')[0]} ${b.quantity}`).join(', ') || 'No crests') + age;
  if (upgradesReady === 0) return { text: `${balances}: no BiS upgrades affordable`, tone: 'text-muted' };
  const ready = `${upgradesReady} BiS ${upgradesReady === 1 ? 'upgrade' : 'upgrades'} ready`;
  return { text: `${balances}: ${ready}`, tone: 'text-upgrade' };
}
