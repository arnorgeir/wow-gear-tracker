'use client';

import { useId } from 'react';
import { InfoTip } from '@/components/info-tip/InfoTip';
import { useApiAction } from '@/components/hooks/use-api-action';

export function StatsMatter({ specSlug, statsMatter }: { specSlug: string; statsMatter: boolean }) {
  const { error, run } = useApiAction();
  const tipId = useId();
  return (
    <div className="flex flex-col gap-1 md:gap-2.5">
      <span className="inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.08em] text-muted">Tier pieces<InfoTip id={tipId} title="Tier pieces">Uncheck if the set bonus is all that matters for this spec.</InfoTip></span>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] font-semibold md:min-h-12 md:text-base">
        <input type="checkbox" aria-describedby={tipId} checked={statsMatter}
          onChange={(e) => run('/api/bis/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ specSlug, statsMatter: e.target.checked }) }, { after: 'refresh-always' })}
          className="size-5 shrink-0 accent-[var(--color-gold)]" />
        Tier pieces must have the list&apos;s stats
      </label>
      {error && <span role="alert" className="text-sm text-missing">{error}</span>}
    </div>
  );
}
