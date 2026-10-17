'use client';

import { useEffect, useState } from 'react';
import { VaultChoiceList } from '@/components/vault-choice-list/VaultChoiceList';
import { formatAge } from '@/core/format';
import type { VaultWeekView } from '@/server/views/types';

/** Earlier weeks of Great Vault choices, loaded one at a time on request. */
export function VaultHistory({ id, before, now }: { id: number; before: number; now: number }) {
  const [weeks, setWeeks] = useState<VaultWeekView[]>([]);
  const [next, setNext] = useState<number | null>(before);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { window.$WowheadPower?.refreshLinks(); }, [weeks]);

  async function load() {
    if (next === null) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/characters/${id}/vault-history?before=${next}`);
      const body = await res.json().catch(() => null) as { week?: VaultWeekView | null; nextBefore?: number | null; error?: string } | null;
      if (!res.ok || !body) {
        setError(body?.error ?? 'Couldn’t load that week.');
        return;
      }
      if (body.week) setWeeks((w) => [...w, body.week!]);
      setNext(body.week ? body.nextBefore ?? null : null);
    } catch {
      setError('Couldn’t load that week.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {weeks.length > 0 && <p className="text-sm text-muted">Marked against today&rsquo;s BiS list.</p>}
      {weeks.map((week) => (
        <div key={week.start} className="flex flex-col gap-2">
          <h4 className="text-[13px] font-semibold uppercase tracking-wider text-muted">{week.label} · from SimC pasted {formatAge(week.pastedAt, now)}</h4>
          <VaultChoiceList choices={week.choices} />
        </div>
      ))}
      <div className="flex items-center gap-3">
        {next !== null && (
          <button type="button" onClick={load} disabled={loading}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-surface-2 disabled:opacity-60">
            {loading ? 'Loading…' : weeks.length === 0 ? 'Great Vault history' : 'Show an earlier week'}
          </button>
        )}
        {error && <p role="alert" className="text-sm text-muted">{error}</p>}
      </div>
    </div>
  );
}
