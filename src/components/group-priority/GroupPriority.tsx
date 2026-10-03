import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { wowheadData } from '@/components/item-card/wowhead';
import { APPROXIMATE, SEASON_FAILED, SEASON_LOADING, SEASON_STALE, SPLIT_DUNGEON } from '@/components/shared/priority-copy';
import type { GroupPriorityView, PriorityCreditView } from '@/server/views/types';

const names = (list: string[]) => (list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`);
const excludedText = (excluded: GroupPriorityView['excluded']) => excluded.map((e) => `${e.name} (${e.reason})`).join(', ');

function Credit({ credit }: { credit: PriorityCreditView }) {
  if (credit.kind === 'item') {
    return (
      <a href={`https://www.wowhead.com/item=${credit.item.itemId}`} data-wowhead={wowheadData(credit.item.itemId, credit.item.bonusIds, null)}
        target="_blank" rel="noreferrer" title={`${credit.slotLabel} · weight ${credit.weight}`}>{credit.item.name}</a>
    );
  }
  const what = credit.kind === 'tier' ? 'Tier via catalyst' : `Any item, level ${credit.minItemLevel}+`;
  return <span title={`weight ${credit.weight}`}>{credit.slotLabel}: {what}</span>;
}

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
      <ol className="flex flex-col gap-4">
        {dungeons.map((d, i) => (
          <li key={d.challengeModeId} className="flex gap-3">
            <span className="w-6 shrink-0 font-mono text-muted">{i + 1}</span>
            <div className="flex grow flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{d.name}</span>
                <span className="font-mono text-gold">{d.score}</span>
              </div>
              {d.split && <span className="text-xs text-muted">{SPLIT_DUNGEON}</span>}
              {d.members.map((m) => (
                <div key={m.key} className="flex items-start gap-2 text-[15px]">
                  <CharacterAvatar name={m.name} className={m.className} avatarUrl={m.avatarUrl} classIconUrl={m.classIconUrl} size={24} />
                  <span className="font-semibold">{m.name}</span>
                  <span className="flex flex-wrap gap-x-2 text-muted">
                    {m.credits.map((c, j) => <Credit key={j} credit={c} />)}
                  </span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ol>
      {nothingFrom.length > 0 && <p className="text-sm text-muted">Nothing anyone needs from: {nothingFrom.join(', ')}.</p>}
    </>
  );
}

export function GroupPriority({ priority }: { priority: GroupPriorityView }) {
  const partial = priority.ranking && priority.excluded.length > 0;
  return (
    <section aria-label="Dungeon priority" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
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
