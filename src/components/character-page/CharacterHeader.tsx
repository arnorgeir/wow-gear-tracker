import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { RefreshButton } from '@/components/refresh-button/RefreshButton';
import { RemoveCharacterButton } from '@/components/remove-character-button/RemoveCharacterButton';
import { classTextColor } from '@/components/shared/class-colors';
import { formatAge } from '@/core/format';
import type { CharacterPageView } from '@/server/views/types';

export function CharacterHeader({ view, now }: { view: CharacterPageView; now: number }) {
  const source = view.snapshot && view.sourceAt !== null
    ? `${view.snapshot.source === 'simc' ? 'From SimC, pasted' : 'From Blizzard, synced'} ${formatAge(view.sourceAt, now)}`
    : 'Not synced yet';
  return (
    <div className="flex flex-wrap items-center justify-between gap-6">
      <div className="flex items-center gap-4">
        <CharacterAvatar name={view.name} className={view.className} avatarUrl={view.avatarUrl} classIconUrl={view.classIconUrl} size={76} />
        <div className="flex flex-col">
          <h1 className="font-display text-4xl font-bold tracking-wide" style={{ color: classTextColor(view.className) }}>{view.name}</h1>
          <span className="text-muted">{view.realmName} ({view.region.toUpperCase()})</span>
          <span className="font-semibold" style={{ color: classTextColor(view.className) }}>{view.identity}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted">{source}</span>
        <RefreshButton id={view.id} />
        <RemoveCharacterButton id={view.id} name={view.name} redirectTo="/" />
      </div>
    </div>
  );
}
