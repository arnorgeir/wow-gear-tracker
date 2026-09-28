'use client';

import { useApiAction } from '@/components/hooks/use-api-action';

export function RefreshButton({ id }: { id: number }) {
  // A failed sync still refreshes: the server records the failure on the character, and the
  // refreshed page is what shows it.
  const { busy, run } = useApiAction();
  return (
    <button type="button" onClick={() => run(`/api/characters/${id}/sync?force=1`, { method: 'POST' }, { after: 'refresh-always' })} disabled={busy}
      className="h-11 rounded-xl border border-line-strong bg-raised px-4 font-semibold disabled:opacity-50">
      {busy ? 'Refreshing…' : 'Refresh'}
    </button>
  );
}
