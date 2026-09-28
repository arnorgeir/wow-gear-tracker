import { formatAge } from '@/core/format';
import type { CrestView } from '@/server/views';

export function CrestSummary({ crests, now }: { crests: CrestView | null; now: number }) {
  if (!crests) return <p className="text-sm text-muted">Crests unknown. Paste SimC to see them.</p>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {crests.balances.length === 0 && <span className="text-sm text-muted">No crests in the last paste.</span>}
      {crests.balances.map((b) => (
        <span key={b.currencyId} className="flex h-8 items-center gap-2 rounded-full border border-line bg-surface-2 px-3 text-sm">
          {b.name}
          <strong className="font-mono font-medium">{b.quantity}</strong>
          <span className="text-muted">({b.steps} {b.steps === 1 ? 'step' : 'steps'})</span>
        </span>
      ))}
      <span className="text-sm text-muted">From SimC, pasted {formatAge(crests.pastedAt, now)}</span>
    </div>
  );
}
