'use client';

import { useApiAction } from '@/components/hooks/use-api-action';
import type { GearRowView } from '@/server/views/types';

const BUTTON = 'min-h-11 rounded-lg border border-line px-3 text-sm font-semibold';

/** Lets a player say whether an unverified tier piece has the right stats, or take that back. */
export function StatMark({ characterId, row }: { characterId: number; row: GearRowView }) {
  const { busy, error, run } = useApiAction();
  const url = `/api/characters/${characterId}/stat-mark`;
  const send = (method: 'PUT' | 'DELETE', body: unknown) =>
    run(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, { after: 'refresh' });

  const piece = row.equipped;
  const unverified = row.statsUnverified && piece !== null && row.bis.kind === 'item';
  if (!unverified && row.statsMark === null) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {unverified && [true, false].map((right) => (
        <button key={String(right)} type="button" disabled={busy} className={BUTTON}
          onClick={() => send('PUT', { slot: row.slot, itemId: piece.itemId, bonusIds: piece.bonusIds, targetItemId: (row.bis as { itemId: number }).itemId, right })}>
          {right ? 'Right stats' : 'Wrong stats'}
        </button>
      ))}
      {row.statsMark !== null && (
        <button type="button" disabled={busy} className={BUTTON} onClick={() => send('DELETE', { slot: row.slot })}>Clear mark</button>
      )}
      {error && <span role="alert" className="text-sm text-missing">{error}</span>}
    </div>
  );
}
