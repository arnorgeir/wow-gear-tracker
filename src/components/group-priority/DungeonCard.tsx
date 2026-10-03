import { SPLIT_DUNGEON } from '@/components/shared/priority-copy';
import type { GroupDungeonView } from '@/server/views/types';
import { DungeonThumbnail } from './DungeonThumbnail';
import { MemberNeeds } from './MemberNeeds';

/** One ranked dungeon: rank, thumbnail, title and score, then each benefiting member's needs. */
export function DungeonCard({ dungeon, rank }: { dungeon: GroupDungeonView; rank: number }) {
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-xl border border-line-strong bg-raised p-3">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="w-6 shrink-0 font-mono text-muted">{rank}</span>
        <DungeonThumbnail imageUrl={dungeon.imageUrl} shortName={dungeon.shortName} />
        <h3 className="min-w-0 flex-1 basis-40 font-display text-lg font-bold wrap-anywhere">{dungeon.name}</h3>
        <p className="ml-auto font-mono text-gold"><span className="font-sans text-xs text-muted">Score</span> {dungeon.score}</p>
      </header>
      {dungeon.split && <p className="text-xs text-muted">{SPLIT_DUNGEON}</p>}
      <div className="flex flex-col gap-3">
        {dungeon.members.map((m) => <MemberNeeds key={m.key} member={m} />)}
      </div>
    </article>
  );
}
