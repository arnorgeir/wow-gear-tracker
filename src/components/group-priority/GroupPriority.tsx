import { APPROXIMATE, SEASON_FAILED, SEASON_LOADING, SEASON_STALE } from '@/components/shared/priority-copy';
import type { GroupPriorityView } from '@/server/views/types';
import { DungeonRow } from './DungeonRow';

const names = (list: string[]) => (list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`);
const excludedText = (excluded: GroupPriorityView['excluded']) => excluded.map((e) => `${e.name} (${e.reason})`).join(', ');

function Ranking({ priority }: { priority: GroupPriorityView }) {
  if (priority.season === 'loading') return <p role="status" className="text-muted">{SEASON_LOADING}</p>;
  if (priority.season === 'failed') return <p role="alert" className="text-[#f3c9a2]">{SEASON_FAILED}</p>;
  if (!priority.ranking) {
    return (
      <p className="text-muted">
        Dungeon priority needs at least one member with gear and a BiS list.
        {priority.excluded.length > 0 && <> Left out: {excludedText(priority.excluded)}.</>}
      </p>
    );
  }
  const { dungeons, nothingFrom } = priority.ranking;
  if (dungeons.length === 0) return <p className="text-muted">No season dungeon drops anything the group still needs.</p>;
  return (
    <>
      <ol className="flex flex-col gap-1.5">
        {dungeons.map((d, i) => <li key={d.challengeModeId} className="min-w-0"><DungeonRow dungeon={d} rank={i + 1} /></li>)}
      </ol>
      {nothingFrom.length > 0 && <p className="text-sm text-muted">Nothing anyone needs from: {nothingFrom.join(', ')}.</p>}
    </>
  );
}

export function GroupPriority({ priority }: { priority: GroupPriorityView }) {
  const partial = priority.ranking && priority.excluded.length > 0;
  return (
    <section aria-label="Dungeon priority" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">Dungeon priority</h2>
        <span className="text-sm text-muted">Score = weighted upgrades</span>
      </div>
      {partial && <p className="text-sm text-muted">Covers {names(priority.covered)}. Left out: {excludedText(priority.excluded)}.</p>}
      {priority.fellBack.map((n) => <p key={n} className="text-sm text-muted">{n} uses the Overall list: Method has no Mythic+ list for that spec.</p>)}
      {priority.approximate && <p className="text-sm text-muted">{APPROXIMATE}</p>}
      {priority.season === 'stale' && <p className="text-sm text-muted">{SEASON_STALE}</p>}
      <Ranking priority={priority} />
    </section>
  );
}
