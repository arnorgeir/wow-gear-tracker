import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { classTextColor } from '@/components/shared/class-colors';
import { SPLIT_DUNGEON } from '@/components/shared/priority-copy';
import type { GroupDungeonView } from '@/server/views/types';
import { CreditChip } from './CreditChip';
import { DungeonThumbnail } from './DungeonThumbnail';

/** One ranked dungeon as a native disclosure: who benefits in the summary, their needs inside. */
export function DungeonRow({ dungeon, rank }: { dungeon: GroupDungeonView; rank: number }) {
  return (
    <details open={rank === 1} className="group rounded-xl border border-line-strong bg-raised">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-xl p-2.5 focus-visible:outline-2 focus-visible:outline-gold [&::-webkit-details-marker]:hidden">
        <span className="w-7 shrink-0 text-center font-mono text-lg font-bold">{rank}</span>
        <DungeonThumbnail imageUrl={dungeon.imageUrl} shortName={dungeon.shortName} />
        <span className="flex min-w-0 grow flex-col gap-1">
          <span className="flex items-baseline justify-between gap-2">
            <h3 className="min-w-0 truncate font-display text-base font-bold">{dungeon.name}</h3>
            <span className="shrink-0 font-mono text-gold" title="Score = weighted upgrades"><span className="sr-only">Score </span>{dungeon.score}</span>
          </span>
          <span className="flex flex-wrap gap-1">
            {dungeon.members.map((m) => (
              <span key={m.key} title={`${m.name}: ${m.credits.length} ${m.credits.length === 1 ? 'need' : 'needs'}`}
                className="inline-flex h-[22px] items-center gap-1 rounded-full border border-line bg-surface pl-0.5 pr-1.5 font-mono text-xs">
                <CharacterAvatar name={m.name} className={m.className} avatarUrl={m.avatarUrl} classIconUrl={m.classIconUrl} size={18} />
                <span className="sr-only">{m.name}: </span>{m.credits.length}
              </span>
            ))}
          </span>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true" className="shrink-0 text-muted transition group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
      </summary>
      <div className="flex flex-col gap-2.5 px-2.5 pb-3">
        {dungeon.split && <p className="text-xs text-muted">{SPLIT_DUNGEON}</p>}
        {dungeon.members.map((m) => (
          <div key={m.key} className="flex items-start gap-2">
            <span className="flex w-24 min-w-0 shrink-0 items-center gap-1.5 pt-1.5">
              <CharacterAvatar name={m.name} className={m.className} avatarUrl={m.avatarUrl} classIconUrl={m.classIconUrl} size={20} />
              <span className="truncate text-sm font-semibold" style={{ color: classTextColor(m.className) }}>{m.name}</span>
            </span>
            <ul className="flex flex-wrap gap-1">
              {m.credits.map((c, j) => <li key={j}><CreditChip credit={c} /></li>)}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
