import { formatAge } from '@/core/format';
import type { CharacterPageView } from '@/server/views';

export function CharacterAlerts({ view, now }: { view: CharacterPageView; now: number }) {
  return (
    <>
      {view.status === 'notFound' && (
        <p role="alert" className="rounded-lg border border-[#8a5a2b] bg-[#2e1f16] p-3 text-[#f3c9a2]">
          Blizzard can&rsquo;t find this character. It may have been renamed or transferred. You can remove it and search again.
        </p>
      )}
      {view.status === 'ok' && view.lastSyncError && <p role="alert" className="text-[#f3c9a2]">{view.lastSyncError}</p>}
      {view.bisError && (
        <p role="alert" className="text-[#f3c9a2]">
          {view.bisError}{view.bisFetchedAt ? `. Showing the list from ${formatAge(view.bisFetchedAt, now)}.` : '.'}
        </p>
      )}
      {view.tracksError && <p role="alert" className="text-[#f3c9a2]">{view.tracksError}.</p>}
    </>
  );
}
