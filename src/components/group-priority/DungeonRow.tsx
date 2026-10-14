import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { DungeonDisclosure } from '@/components/dungeon-disclosure/DungeonDisclosure';
import { classTextColor } from '@/components/shared/class-colors';
import { SPLIT_DUNGEON } from '@/components/shared/priority-copy';
import type { GroupDungeonView } from '@/server/views/types';
import { CreditChip } from './CreditChip';

/** One ranked dungeon: who benefits in the summary, their needs inside. */
export function DungeonRow({ dungeon, rank }: { dungeon: GroupDungeonView; rank: number }) {
  const chips = dungeon.members.map((m) => (
    <span key={m.key} title={`${m.name}: ${m.credits.length} ${m.credits.length === 1 ? 'need' : 'needs'}`}
      className="inline-flex h-[22px] items-center gap-1 rounded-full border border-line bg-surface pl-0.5 pr-1.5 font-mono text-xs">
      <CharacterAvatar name={m.name} className={m.className} avatarUrl={m.avatarUrl} classIconUrl={m.classIconUrl} size={18} />
      <span className="sr-only">{m.name}: </span>{m.credits.length}
    </span>
  ));
  return (
    <DungeonDisclosure rank={rank} name={dungeon.name} score={dungeon.score} imageUrl={dungeon.imageUrl} shortName={dungeon.shortName} challengeModeId={dungeon.challengeModeId} summaryExtra={chips}>
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
    </DungeonDisclosure>
  );
}
