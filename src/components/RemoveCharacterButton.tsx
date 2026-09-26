'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RemoveCharacterButton({ id, name, redirectTo }: { id: number; name: string; redirectTo?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (!window.confirm(`Remove ${name} from the tracker?`)) return;
    setBusy(true);
    await fetch(`/api/characters/${id}`, { method: 'DELETE' });
    if (redirectTo) router.push(redirectTo);
    else router.refresh();
  }
  return (
    <button type="button" onClick={remove} disabled={busy} aria-label={`Remove ${name}`}
      className="flex size-11 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" />
      </svg>
    </button>
  );
}
