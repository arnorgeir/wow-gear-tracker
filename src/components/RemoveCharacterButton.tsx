'use client';

import { useApiAction } from '@/components/hooks/use-api-action';

export function RemoveCharacterButton({ id, name, redirectTo }: { id: number; name: string; redirectTo?: string }) {
  const { busy, run } = useApiAction();
  async function remove() {
    if (!window.confirm(`Remove ${name} from the tracker?`)) return;
    // No message is rendered here — the button is an icon with nowhere to put one — so a failed
    // delete refreshes instead, and the character staying in the list is the feedback.
    await run(`/api/characters/${id}`, { method: 'DELETE' }, {
      after: redirectTo ? { push: redirectTo } : 'refresh-always',
    });
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
