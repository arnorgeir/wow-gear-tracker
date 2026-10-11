import type { ReactNode } from 'react';
import { DungeonThumbnail } from '@/components/dungeon-thumbnail/DungeonThumbnail';

type Props = { rank: number; name: string; score: number; imageUrl: string | null; shortName: string; summaryExtra?: ReactNode; children: ReactNode };

/** One ranked dungeon as a native disclosure: rank, art, name and score in the summary. Rank 1 starts open. */
export function DungeonDisclosure({ rank, name, score, imageUrl, shortName, summaryExtra, children }: Props) {
  return (
    <details open={rank === 1} className="group rounded-xl border border-line-strong bg-raised">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-xl p-2.5 focus-visible:outline-2 focus-visible:outline-gold [&::-webkit-details-marker]:hidden">
        <span className="w-7 shrink-0 text-center font-mono text-lg font-bold">{rank}</span>
        <DungeonThumbnail imageUrl={imageUrl} shortName={shortName} />
        <span className="flex min-w-0 grow flex-col gap-1">
          <span className="flex items-baseline justify-between gap-2">
            <h3 className="min-w-0 truncate font-display text-base font-bold">{name}</h3>
            <span className="shrink-0 font-mono text-gold" title="Score = weighted upgrades"><span className="sr-only">Score </span>{score}</span>
          </span>
          {summaryExtra && <span className="flex flex-wrap gap-1">{summaryExtra}</span>}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true" className="shrink-0 text-muted transition group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
      </summary>
      <div className="flex flex-col gap-2.5 px-2.5 pb-3">{children}</div>
    </details>
  );
}
