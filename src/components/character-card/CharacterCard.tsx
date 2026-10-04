import Link from 'next/link';
import { formatAge } from '@/core/format';
import type { CharacterCardView } from '@/server/views/types';
import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { classTextColor } from '@/components/shared/class-colors';
import { RemoveCharacterButton } from '@/components/remove-character-button/RemoveCharacterButton';
import { crestLine } from './crest-line';

export function CharacterCard({ card, now }: { card: CharacterCardView; now: number }) {
  const color = classTextColor(card.className);
  const counts = card.counts;
  const bis = counts ? counts.done + counts.mythUpgradable + counts.belowMyth : 0;
  const source = card.snapshot && card.sourceAt !== null
    ? `${card.snapshot.source === 'simc' ? 'SimC, pasted' : 'Blizzard, synced'} ${formatAge(card.sourceAt, now)}`
    : 'Not synced yet';
  const listName = card.priorityList === 'mythicPlus' ? 'Mythic+ BiS' : 'Overall BiS';
  const crests = crestLine({ crests: card.crests, gearFromSimc: card.snapshot?.source === 'simc', upgradesReady: card.upgradesReady }, now);

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-3.5">
        <CharacterAvatar name={card.name} className={card.className} avatarUrl={card.avatarUrl} classIconUrl={card.classIconUrl} size={52} />
        <div className="flex min-w-0 flex-col">
          <Link href={`/characters/${card.id}`} className="truncate text-xl font-bold no-underline hover:underline" style={{ color }}>{card.name}</Link>
          <span className="text-[15px] text-muted">{card.realmName}</span>
          <span className="text-[15px] font-semibold" style={{ color }}>{card.identity}</span>
        </div>
      </div>

      {card.status === 'notFound' ? (
        <p className="rounded-lg border border-[#8a5a2b] bg-[#2e1f16] p-3 text-[15px] text-[#f3c9a2]">
          Blizzard can&rsquo;t find this character. It may have been renamed or transferred.
        </p>
      ) : counts ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold uppercase tracking-wider text-muted">{listName}</span>
            <span className="font-mono"><strong className="text-gold">{bis}</strong><span className="text-muted"> / {card.total}</span></span>
          </div>
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div className="bg-gold" style={{ flexGrow: counts.done }} />
            <div className="bg-crest" style={{ flexGrow: counts.mythUpgradable }} />
            <div className="bg-vault" style={{ flexGrow: counts.belowMyth }} />
            <div style={{ flexGrow: counts.missing + counts.inBags }} />
          </div>
          <span className="text-sm text-muted">
            {counts.done} done, {counts.mythUpgradable} need crests, {counts.belowMyth} vault targets
            {counts.inBags > 0 ? `, ${counts.inBags} in bags` : ''}
          </span>
          <span className={`text-sm ${crests.tone}`}>{crests.text}</span>
        </div>
      ) : (
        <p className="text-sm text-muted">{card.bisError ?? 'Loading BiS list…'}</p>
      )}

      {card.tracksError && card.status === 'ok' && <p className="text-sm text-[#f3c9a2]">{card.tracksError}.</p>}
      {card.lastSyncError && card.status === 'ok' && <p className="text-sm text-[#f3c9a2]">{card.lastSyncError}</p>}

      <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
        <span className="text-sm text-muted">{source}</span>
        <RemoveCharacterButton id={card.id} name={card.name} />
      </div>
    </article>
  );
}
