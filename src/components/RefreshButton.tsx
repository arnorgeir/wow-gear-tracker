'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RefreshButton({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    await fetch(`/api/characters/${id}/sync?force=1`, { method: 'POST' }).catch(() => null);
    setBusy(false);
    router.refresh();
  }
  return (
    <button type="button" onClick={refresh} disabled={busy}
      className="h-11 rounded-xl border border-line-strong bg-raised px-4 font-semibold disabled:opacity-50">
      {busy ? 'Refreshing…' : 'Refresh'}
    </button>
  );
}
