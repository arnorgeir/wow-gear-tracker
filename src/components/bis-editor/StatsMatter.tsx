'use client';

import { useApiAction } from '@/components/hooks/use-api-action';

export function StatsMatter({ specSlug, statsMatter }: { specSlug: string; statsMatter: boolean }) {
  const { error, run } = useApiAction();
  return (
    <div className="flex flex-col gap-1 md:gap-2.5">
      <span className="hidden text-[13px] font-bold uppercase tracking-[0.08em] text-muted md:block">Tier pieces</span>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] font-semibold md:min-h-12 md:text-base">
        <input type="checkbox" checked={statsMatter}
          onChange={(e) => run('/api/bis/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ specSlug, statsMatter: e.target.checked }) }, { after: 'refresh-always' })}
          className="size-5 shrink-0 accent-[var(--color-gold)]" />
        Tier pieces must have the list&apos;s stats
      </label>
      <p className="pl-8 text-[13px] text-muted md:pl-0 md:text-sm">Uncheck if the set bonus is all that matters for this spec.</p>
      {error && <span role="alert" className="text-sm text-missing">{error}</span>}
    </div>
  );
}
