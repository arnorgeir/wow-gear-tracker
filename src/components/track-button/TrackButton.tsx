'use client';

import { useApiAction } from '@/components/hooks/use-api-action';
import { RemoveFromGroupButton } from '@/components/remove-from-group/RemoveFromGroupButton';
import { parseMemberKey } from '@/core/characters/member-key';

/** Tracks a member named in the link but not on this install. Nothing is fetched until it's pressed. */
export function TrackButton({ memberKey, name, keys }: { memberKey: string; name: string; keys: string[] }) {
  const { busy, error, run } = useApiAction();
  const key = parseMemberKey(memberKey);
  if (!key) return null;
  const track = () => run('/api/characters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ region: key.region, name: key.nameKey, realmSlug: key.realmSlug }),
  }, { fallbackError: `Couldn’t track ${name}.` });
  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={track} disabled={busy} className="h-11 rounded-xl border border-line-strong bg-raised px-4 font-semibold disabled:opacity-50">
        {busy ? 'Tracking…' : 'Track'}
      </button>
      {error && (
        <>
          <p role="alert" className="text-sm text-[#f3c9a2]">{error}</p>
          <RemoveFromGroupButton memberKey={memberKey} name={name} keys={keys} variant="text" />
        </>
      )}
    </div>
  );
}
