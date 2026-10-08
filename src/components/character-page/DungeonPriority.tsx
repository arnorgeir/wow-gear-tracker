import { BrandIcon } from '@/components/brand-icon/BrandIcon';
import { ItemCard } from '@/components/item-card/ItemCard';
import { BIS_LOADING } from '@/components/shared/loading-copy';
import { APPROXIMATE, SEASON_FAILED, SEASON_LOADING, SEASON_STALE, SPLIT_DUNGEON } from '@/components/shared/priority-copy';
import type { PriorityCreditView, PriorityView } from '@/server/views/types';
import { creditDetail } from './credit-detail';

const LIST_NAMES = { mythicPlus: 'Mythic+ list', overall: 'Overall list' } as const;

function Credit({ credit }: { credit: PriorityCreditView }) {
  if (credit.kind !== 'any') {
    const detail = creditDetail(credit);
    return (
      <ItemCard itemId={credit.item.itemId} name={credit.item.name} quality={credit.item.quality} iconUrl={credit.item.iconUrl}
        bonusIds={credit.item.bonusIds} itemLevel={null} detail={detail} />
    );
  }
  return (
    <p className="text-[15px]">
      <span className="font-semibold">{credit.slotLabel}</span>
      <span className="text-muted"> · Any item, level {credit.minItemLevel}+ · weight {credit.weight}</span>
    </p>
  );
}

function Ranking({ priority }: { priority: PriorityView }) {
  if (priority.bisLoading) return <p role="status" className="text-muted">{BIS_LOADING}</p>;
  if (priority.season === 'loading') return <p role="status" className="text-muted">{SEASON_LOADING}</p>;
  if (priority.season === 'failed') {
    return <p role="alert" className="text-[#f3c9a2]">{SEASON_FAILED}</p>;
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
            {d.split && <span className="text-xs text-muted">{SPLIT_DUNGEON}</span>}
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
      {/* items-center, not items-baseline: the heading is a flex row with an icon, so it has no text baseline to share. */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold"><BrandIcon name="dungeons" size={28} className="text-gold" />Dungeon priority</h2>
        <span className="text-sm text-muted">{LIST_NAMES[priority.listType]}</span>
      </div>
      {priority.fellBack && <p className="text-sm text-muted">Using the Overall list: Method has no Mythic+ list for {specLabel}.</p>}
      {priority.approximate && <p className="text-sm text-muted">{APPROXIMATE}</p>}
      {priority.season === 'stale' && <p className="text-sm text-muted">{SEASON_STALE}</p>}
      <Ranking priority={priority} />
    </section>
  );
}
