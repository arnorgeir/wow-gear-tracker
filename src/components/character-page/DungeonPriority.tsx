import { ItemCard } from '@/components/item-card/ItemCard';
import type { PriorityCreditView, PriorityView } from '@/server/views/types';

const LIST_NAMES = { mythicPlus: 'Mythic+ list', overall: 'Overall list' } as const;

function Credit({ credit }: { credit: PriorityCreditView }) {
  if (credit.kind === 'item') {
    return (
      <ItemCard itemId={credit.item.itemId} name={credit.item.name} quality={credit.item.quality} iconUrl={credit.item.iconUrl}
        bonusIds={credit.item.bonusIds} itemLevel={null} detail={`${credit.slotLabel} · weight ${credit.weight}`} />
    );
  }
  const what = credit.kind === 'tier' ? 'Tier via catalyst' : `Any item, level ${credit.minItemLevel}+`;
  return (
    <p className="text-[15px]">
      <span className="font-semibold">{credit.slotLabel}</span>
      <span className="text-muted"> · {what} · weight {credit.weight}</span>
    </p>
  );
}

function Ranking({ priority }: { priority: PriorityView }) {
  if (priority.season === 'loading') return <p role="status" className="text-muted">Loading this season&rsquo;s loot&hellip;</p>;
  if (priority.season === 'failed') {
    return <p role="alert" className="text-[#f3c9a2]">This season&rsquo;s loot couldn&rsquo;t be loaded. It will retry within the hour.</p>;
  }
  if (priority.dungeons.length === 0) return <p className="text-muted">No season dungeon drops anything you still need.</p>;
  return (
    <>
      <ol className="flex flex-col gap-4">
        {priority.dungeons.map((d) => (
          <li key={d.challengeModeId} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{d.name}</span>
              <span className="font-mono text-gold">{d.score}</span>
            </div>
            {d.split && <span className="text-xs text-muted">Split dungeon: loot shown for the whole instance.</span>}
            {d.credits.map((credit, i) => <Credit key={i} credit={credit} />)}
          </li>
        ))}
      </ol>
      {priority.nothingFrom.length > 0 && <p className="text-sm text-muted">Nothing you need from: {priority.nothingFrom.join(', ')}.</p>}
    </>
  );
}

/** The season's Mythic+ dungeons, ranked by what this character still needs from each. */
export function DungeonPriority({ priority, specLabel }: { priority: PriorityView; specLabel: string }) {
  return (
    <section aria-label="Dungeon priority" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">Dungeon priority</h2>
        <span className="text-sm text-muted">{LIST_NAMES[priority.listType]}</span>
      </div>
      {priority.fellBack && <p className="text-sm text-muted">Using the Overall list: Method has no Mythic+ list for {specLabel}.</p>}
      {priority.approximate && <p className="text-sm text-muted">Weights are approximate while upgrade track data is unavailable.</p>}
      {priority.season === 'stale' && <p className="text-sm text-muted">Showing older loot data: the latest update couldn&rsquo;t be loaded.</p>}
      <Ranking priority={priority} />
    </section>
  );
}
