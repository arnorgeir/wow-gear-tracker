'use client';

import { useApiAction } from '@/components/hooks/use-api-action';
import type { GearRowView } from '@/server/views/types';

// Compact beside the state badge for a mouse; 44 px tall where the pointer is a finger.
const BUTTON = 'min-h-8 shrink-0 whitespace-nowrap rounded-lg border px-2.5 text-[13px] font-semibold pointer-coarse:min-h-11 disabled:opacity-60';
// Each verdict takes the tone of the state it leads to: Done's gold, Wrong stats' pink. The words carry the meaning too.
const TONE = { right: 'border-gold-line text-gold', wrong: 'border-stats/50 text-stats', clear: 'border-line text-ink' } as const;

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
    <div className="flex flex-col gap-1">
      <div className="flex flex-nowrap items-center gap-1.5">
        {unverified && [true, false].map((right) => (
          <button key={String(right)} type="button" disabled={busy} className={`${BUTTON} ${right ? TONE.right : TONE.wrong}`}
            onClick={() => send('PUT', { slot: row.slot, itemId: piece.itemId, bonusIds: piece.bonusIds, targetItemId: (row.bis as { itemId: number }).itemId, right })}>
            {right ? 'Right stats' : 'Wrong stats'}
          </button>
        ))}
        {row.statsMark !== null && (
          <button type="button" disabled={busy} className={`${BUTTON} ${TONE.clear}`} onClick={() => send('DELETE', { slot: row.slot })}>Clear mark</button>
        )}
      </div>
      {error && <span role="alert" className="text-sm text-missing">{error}</span>}
    </div>
  );
}
