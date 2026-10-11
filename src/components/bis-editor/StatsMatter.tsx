'use client';

import { useApiAction } from '@/components/hooks/use-api-action';

export function StatsMatter({ specSlug, statsMatter }: { specSlug: string; statsMatter: boolean }) {
  const { error, run } = useApiAction();
  return (
    <div className="flex flex-col gap-1">
      <label className="flex h-11 items-center gap-2 font-semibold">
        <input type="checkbox" checked={statsMatter}
          onChange={(e) => run('/api/bis/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ specSlug, statsMatter: e.target.checked }) }, { after: 'refresh-always' })}
          className="size-[18px] accent-[var(--color-gold)]" />
        Tier pieces must have the list&apos;s stats
      </label>
      <p className="text-sm text-muted">Uncheck if the set bonus is all that matters for this spec.</p>
      {error && <span role="alert" className="text-sm text-missing">{error}</span>}
    </div>
  );
}
