import { EmptySlotCard } from '@/components/empty-slot-card/EmptySlotCard';
import { ItemCard } from '@/components/item-card/ItemCard';
import { BisSourceBadge } from '@/components/bis-source-badge/BisSourceBadge';
import { equippedStatText } from '@/components/shared/equipped-stats';
import { fallbackText } from '@/components/shared/fallback-text';
import { LIST_NAMES } from '@/components/shared/list-names';
import { BIS_LOADING } from '@/components/shared/loading-copy';
import { ROW_TONE_STYLES, rowTone } from '@/components/shared/row-tone';
import { trackText } from '@/components/shared/track-label';
import { StateBadge } from '@/components/state-badge/StateBadge';
import { UpgradeBadge } from '@/components/upgrade-badge/UpgradeBadge';
import type { BisSourceId, ListType } from '@/core/types';
import type { GearRowView } from '@/server/views/types';
import { BisTarget } from '@/components/bis-target/BisTarget';
import { GEAR_COLUMNS, GearTableHeader } from './GearTableHeader';
import { GearRowsSkeleton } from './GearTableSkeleton';

interface Props {
  rows: GearRowView[];
  tracksKnown: boolean;
  bisLoading: boolean;
  listType: ListType;
  specSlug: string;
  editedCount: number;
  doneCount: number;
  /** The list the spec asked for when its source has none and Overall is shown instead. */
  fellBackFrom: ListType | null;
  source: BisSourceId;
}

export function GearTable({ rows, tracksKnown, bisLoading, listType, specSlug, editedCount, doneCount, fellBackFrom, source }: Props) {
  return (
    <section aria-label="Gear by slot" className="flex flex-col rounded-2xl border border-line bg-surface pb-1">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-raised px-5 py-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-3">
            <h2 className="font-display text-[22px] font-bold">{LIST_NAMES[listType]} BiS</h2>
            <span className="font-mono text-[15px] text-muted">{doneCount}/{rows.length} done</span>
          </div>
          {fellBackFrom && (
            <span className="flex items-center gap-2 text-sm text-legacy">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0"><path d="M12 3l10 18H2zM12 10v5M12 18v.5" /></svg>
              {fallbackText(source, fellBackFrom)} for this spec. Showing Overall.
            </span>
          )}
        </div>
        <BisSourceBadge specSlug={specSlug} source={source} editedCount={editedCount} />
      </div>
      <GearTableHeader />
      {rows.length === 0 && (bisLoading
        ? <><span role="status" className="sr-only">{BIS_LOADING}</span><GearRowsSkeleton /></>
        : <p className="p-6 text-muted">No BiS list to compare against yet.</p>)}
      {rows.map((row, index) => {
        const tone = rowTone(row.state, tracksKnown);
        return (
        <div key={`${row.slot}-${index}`} style={tone ? ROW_TONE_STYLES[tone] : undefined}
          className={`mx-2 my-1 grid grid-cols-1 gap-3 rounded-[10px] px-3 py-2 ${GEAR_COLUMNS} md:items-center`}>
          <span className="font-semibold text-muted">{row.slotLabel}</span>
          {row.equipped ? (
            <ItemCard itemId={row.equipped.itemId} name={row.equipped.name} quality={row.equipped.quality} iconUrl={row.equipped.iconUrl}
              bonusIds={row.equipped.bonusIds} itemLevel={row.equipped.itemLevel}
              detail={[trackText(row.equipped.trackLabel), row.equipped.itemLevel].filter(Boolean).join(' · ')}
              stats={equippedStatText(row) ?? undefined} />
          ) : <EmptySlotCard />}
          <BisTarget row={row} />
          <div className="flex flex-col gap-1.5">
            <StateBadge state={row.state} />
            {row.upgrade && <UpgradeBadge upgrade={row.upgrade} />}
          </div>
        </div>
        );
      })}
    </section>
  );
}
