'use client';

import { useApiAction } from '@/components/hooks/use-api-action';

export function FetchButton({ specSlug, label }: { specSlug: string; label: 'Fetch Method list' | 'Refresh' }) {
  const { busy, error, run } = useApiAction();
  return (
    <span className="flex items-center gap-2">
      <button type="button" disabled={busy}
        onClick={() => run('/api/bis/fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ specSlug }) })}
        className="h-9 rounded-lg border border-line-strong bg-surface-2 px-3 text-sm font-semibold disabled:opacity-60">
        {busy ? 'Fetching…' : label}
      </button>
      {error && <span role="alert" className="text-sm text-danger">{error}</span>}
    </span>
  );
}
