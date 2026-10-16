import { BrandIcon } from '@/components/brand-icon/BrandIcon';
import { DungeonDisclosure } from '@/components/dungeon-disclosure/DungeonDisclosure';
import { DungeonLinks } from '@/components/dungeon-links/DungeonLinks';
import { ItemCard } from '@/components/item-card/ItemCard';
import { fallbackText } from '@/components/shared/fallback-text';
import { LIST_NAMES } from '@/components/shared/list-names';
import { BIS_LOADING } from '@/components/shared/loading-copy';
import { APPROXIMATE, SEASON_FAILED, SEASON_LOADING, SEASON_STALE, SPLIT_DUNGEON } from '@/components/shared/priority-copy';
import type { PriorityCreditView, PriorityView } from '@/server/views/types';
import { creditDetail } from './credit-detail';
import { DungeonRowsSkeleton } from './DungeonRowsSkeleton';


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
  if (priority.bisLoading) return <><span role="status" className="sr-only">{BIS_LOADING}</span><DungeonRowsSkeleton /></>;
  if (priority.season === 'loading') return <><span role="status" className="sr-only">{SEASON_LOADING}</span><DungeonRowsSkeleton /></>;
  if (priority.season === 'failed') {
    return <p role="alert" className="text-[#f3c9a2]">{SEASON_FAILED}</p>;
  }
  if (priority.dungeons.length === 0) return <p className="text-muted">No season dungeon drops anything you still need.</p>;
  return (
    <>
      <ol className="flex flex-col gap-1.5">
        {priority.dungeons.map((d, i) => (
          <li key={d.challengeModeId} className="min-w-0">
            <DungeonDisclosure rank={i + 1} name={d.name} score={d.score} imageUrl={d.imageUrl} shortName={d.shortName} challengeModeId={d.challengeModeId}>
              {d.split && <p className="text-xs text-muted">{SPLIT_DUNGEON}</p>}
              {d.credits.map((credit, j) => <Credit key={j} credit={credit} />)}
            </DungeonDisclosure>
          </li>
        ))}
      </ol>
      {priority.nothingFrom.length > 0 && <p className="text-sm text-muted">Nothing you need from: <DungeonLinks dungeons={priority.nothingFrom} />.</p>}
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
        <span className="text-sm text-muted">{LIST_NAMES[priority.listType]} list</span>
      </div>
      {priority.fellBackFrom && <p className="text-sm text-muted">Using the Overall list: {fallbackText(priority.source, priority.fellBackFrom)} for {specLabel}.</p>}
      {priority.approximate && <p className="text-sm text-muted">{APPROXIMATE}</p>}
      {priority.season === 'stale' && <p className="text-sm text-muted">{SEASON_STALE}</p>}
      <Ranking priority={priority} />
    </section>
  );
}
