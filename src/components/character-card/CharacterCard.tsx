import Link from 'next/link';
import { formatAge } from '@/core/format';
import type { CharacterCardView } from '@/server/views/types';
import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { classTextColor } from '@/components/shared/class-colors';
import { RemoveCharacterButton } from '@/components/remove-character-button/RemoveCharacterButton';
import { CrestChip } from '@/components/crest-chip/CrestChip';
import { BIS_LOADING, TRACKS_LOADING } from '@/components/shared/loading-copy';
import { Skeleton } from '@/components/skeleton/Skeleton';
import { barSegments, bisSummary } from './bis-summary';
import { CardProgressSkeleton } from './CardProgressSkeleton';
import { crestLine } from './crest-line';

export function CharacterCard({ card, now }: { card: CharacterCardView; now: number }) {
  const color = classTextColor(card.className);
  const counts = card.counts;
  const { bis, text: summary } = bisSummary(counts, card.tracksKnown);
  const bar = counts && barSegments(counts, card.tracksKnown);
  const source = card.snapshot && card.sourceAt !== null
    ? `${card.snapshot.source === 'simc' ? 'SimC, pasted' : 'Blizzard, synced'} ${formatAge(card.sourceAt, now)}`
    : 'Not synced yet';
  const listName = card.priorityList === 'mythicPlus' ? 'Mythic+ BiS' : 'Overall BiS';
  const crests = crestLine({ crests: card.crests, gearFromSimc: card.snapshot?.source === 'simc', upgradesReady: card.upgradesReady, tracksKnown: card.tracksKnown }, now);

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-3.5">
        <CharacterAvatar name={card.name} className={card.className} avatarUrl={card.avatarUrl} classIconUrl={card.classIconUrl} size={52} />
        <div className="flex min-w-0 flex-col">
          <Link href={card.href} className="truncate text-xl font-bold no-underline hover:underline" style={{ color }}>{card.name}</Link>
          <span className="text-[15px] text-muted">{card.realmName}</span>
          <span className="text-[15px] font-semibold" style={{ color }}>{card.identity}</span>
        </div>
      </div>

      {card.status === 'notFound' ? (
        <p className="rounded-lg border border-[#8a5a2b] bg-[#2e1f16] p-3 text-[15px] text-[#f3c9a2]">
          Blizzard can&rsquo;t find this character. It may have been renamed or transferred.
        </p>
      ) : bar ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold uppercase tracking-wider text-muted">{listName}</span>
            <span className="font-mono"><strong className="text-gold">{bis}</strong><span className="text-muted"> / {card.total}</span></span>
          </div>
          {/* A tier piece with the wrong stats isn't BiS: it gets its own segment. */}
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div className="bg-gold" style={{ flexGrow: bar.done }} />
            <div className="bg-crest" style={{ flexGrow: bar.mythUpgradable }} />
            <div className="bg-vault" style={{ flexGrow: bar.belowMyth }} />
            <div className="bg-stats" style={{ flexGrow: bar.wrongStats }} />
            <div style={{ flexGrow: bar.rest }} />
          </div>
          {card.tracksLoading
            ? <><span role="status" className="sr-only">{TRACKS_LOADING}</span><Skeleton className="h-4 w-40 rounded-md" /></>
            : summary && <span className="text-sm text-muted">{summary}</span>}
          <span className="flex flex-wrap items-center gap-1.5">
            {crests.balances.map((b) => <CrestChip key={b.currencyId} balance={b} />)}
            {crests.text && <span className={`text-sm ${crests.tone}`}>{crests.text}</span>}
          </span>
        </div>
      ) : card.bisError ? (
        <p className="text-sm text-muted">{card.bisError}</p>
      ) : (
        <><span role="status" className="sr-only">{BIS_LOADING}</span><CardProgressSkeleton /></>
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
