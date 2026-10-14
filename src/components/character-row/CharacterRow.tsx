import Link from 'next/link';
import type { CharacterCardView } from '@/server/views/types';
import { BisBar } from '@/components/bis-bar/BisBar';
import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { LinkPending } from '@/components/link-pending/LinkPending';
import { RemoveCharacterButton } from '@/components/remove-character-button/RemoveCharacterButton';
import { Skeleton } from '@/components/skeleton/Skeleton';
import { barSegments, bisSummary } from '@/components/shared/bis-summary';
import { classTextColor } from '@/components/shared/class-colors';
import { LIST_NAMES } from '@/components/shared/list-names';
import { BIS_LOADING, TRACKS_LOADING } from '@/components/shared/loading-copy';
import { sourceText } from '@/components/shared/source-text';
import { RowProgressSkeleton } from './RowProgressSkeleton';

/** One character as a compact row: who, BiS progress, and where the data came from. */
export function CharacterRow({ card, now }: { card: CharacterCardView; now: number }) {
  const color = classTextColor(card.className);
  const { bis, text: summary } = bisSummary(card.counts, card.tracksKnown);
  const bar = card.counts && barSegments(card.counts, card.tracksKnown);
  const listName = `${LIST_NAMES[card.listType]} BiS`;

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line bg-surface px-4 py-3 lg:flex-row lg:items-center lg:gap-6">
      <div className="flex min-w-0 shrink-0 items-center gap-3 lg:w-64">
        <CharacterAvatar name={card.name} className={card.className} avatarUrl={card.avatarUrl} classIconUrl={card.classIconUrl} size={40} />
        <div className="flex min-w-0 flex-col">
          <Link href={card.href} className="inline-flex min-w-0 items-center gap-1.5 text-lg font-bold no-underline hover:underline" style={{ color }}>
            <span className="min-w-0 truncate">{card.name}</span><LinkPending />
          </Link>
          <span className="truncate text-sm text-muted">
            <span className="font-semibold" style={{ color }}>{card.identity}</span> · {card.realmName}{card.itemLevel !== null && <> · <span className="font-mono">{card.itemLevel.toFixed(1)}</span> ilvl</>}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 grow flex-col gap-2">
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
            <BisBar bar={bar} />
            {card.tracksLoading
              ? <><span role="status" className="sr-only">{TRACKS_LOADING}</span><Skeleton className="h-4 w-40 rounded-md" /></>
              : summary && <span className="text-sm text-muted">{summary}</span>}
          </div>
        ) : card.bisError ? (
          <p className="text-sm text-muted">{card.bisError}</p>
        ) : (
          <><span role="status" className="sr-only">{BIS_LOADING}</span><RowProgressSkeleton /></>
        )}
        {card.tracksError && card.status === 'ok' && <p className="text-sm text-[#f3c9a2]">{card.tracksError}.</p>}
        {card.lastSyncError && card.status === 'ok' && <p className="text-sm text-[#f3c9a2]">{card.lastSyncError}</p>}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3">
        <span className="text-sm text-muted lg:w-40 lg:text-right">{sourceText(card, now)}</span>
        <RemoveCharacterButton id={card.id} name={card.name} />
      </div>
    </article>
  );
}
