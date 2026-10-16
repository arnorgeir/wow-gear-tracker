import Link from 'next/link';
import type { CharacterCardView } from '@/server/views/types';
import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { classTextColor } from '@/components/shared/class-colors';
import { LIST_NAMES } from '@/components/shared/list-names';
import { RemoveCharacterButton } from '@/components/remove-character-button/RemoveCharacterButton';
import { CrestChip } from '@/components/crest-chip/CrestChip';
import { LinkPending } from '@/components/link-pending/LinkPending';
import { BIS_LOADING, TRACKS_LOADING } from '@/components/shared/loading-copy';
import { Skeleton } from '@/components/skeleton/Skeleton';
import { barSegments, bisSummary } from '@/components/shared/bis-summary';
import { sourceText } from '@/components/shared/source-text';
import { BisBar } from '@/components/bis-bar/BisBar';
import { CardProgressSkeleton } from './CardProgressSkeleton';
import { crestLine } from './crest-line';

export function CharacterCard({ card, now }: { card: CharacterCardView; now: number }) {
  const color = classTextColor(card.className);
  const counts = card.counts;
  const { bis, text: summary } = bisSummary(counts, card.tracksKnown);
  const bar = counts && barSegments(counts, card.tracksKnown);
  const listName = `${LIST_NAMES[card.listType]} BiS`;
  const crests = crestLine({ crests: card.crests, gearFromSimc: card.snapshot?.source === 'simc', upgradesReady: card.upgradesReady, tracksKnown: card.tracksKnown }, now);

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-3.5">
        <CharacterAvatar name={card.name} className={card.className} avatarUrl={card.avatarUrl} classIconUrl={card.classIconUrl} size={52} classBadge="surface" />
        <div className="flex min-w-0 flex-col">
          <Link href={card.href} className="inline-flex min-w-0 items-center gap-1.5 text-xl font-bold no-underline hover:underline" style={{ color }}>
            <span className="min-w-0 truncate">{card.name}</span><LinkPending />
          </Link>
          <span className="truncate text-[15px] font-semibold" style={{ color }}>{card.identity}</span>
          <span className="truncate text-[15px] text-muted">
            {card.realmName}{card.itemLevel !== null && <> · <span className="font-mono">{card.itemLevel.toFixed(1)}</span> ilvl</>}
          </span>
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
          <BisBar bar={bar} />
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
        <span className="text-sm text-muted">{sourceText(card, now)}</span>
        <RemoveCharacterButton id={card.id} name={card.name} />
      </div>
    </article>
  );
}
