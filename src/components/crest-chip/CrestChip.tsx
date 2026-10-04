import type { CrestBalance } from '@/core/gear/crests';
import { crestLabel, crestShortName } from './crest-label';
import { CrestIcon } from './CrestIcon';

/** A crest as its icon and count. Without an icon it shows the crest's first word instead. */
export function CrestChip({ balance }: { balance: CrestBalance }) {
  const label = crestLabel(balance);
  return (
    <a href={`https://www.wowhead.com/currency=${balance.currencyId}`} data-wowhead={`currency=${balance.currencyId}`} target="_blank" rel="noreferrer"
      className="inline-flex h-6 min-w-0 max-w-full items-center gap-1 rounded-full border border-line bg-surface-2 px-1.5 text-xs text-ink no-underline focus-visible:outline-2 focus-visible:outline-gold">
      <CrestIcon url={balance.iconUrl} size={16} fallback={<span aria-hidden="true" className="truncate">{crestShortName(balance)}</span>} />
      <span aria-hidden="true" className="font-mono">{balance.quantity}</span>
      <span className="sr-only">{label}</span>
    </a>
  );
}
