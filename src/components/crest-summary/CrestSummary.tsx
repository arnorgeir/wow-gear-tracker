import { CrestChip } from '@/components/crest-chip/CrestChip';
import { formatAge } from '@/core/format';
import type { CrestView } from '@/server/views/types';

export function CrestSummary({ crests, now }: { crests: CrestView | null; now: number }) {
  if (!crests) return <p className="text-sm text-muted">Crests unknown. Paste SimC to see them.</p>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {crests.balances.length === 0 && <span className="text-sm text-muted">No crests in the last paste.</span>}
      {crests.balances.map((b) => <CrestChip key={b.currencyId} balance={b} showSteps />)}
      <span className="text-sm text-muted">From SimC, pasted {formatAge(crests.pastedAt, now)}</span>
    </div>
  );
}
