import { EmptySlotCard } from '@/components/empty-slot-card/EmptySlotCard';
import { ItemCard } from '@/components/item-card/ItemCard';
import { ROW_TONE_STYLES, rowTone } from '@/components/shared/row-tone';
import { trackText } from '@/components/shared/track-label';
import { StateBadge } from '@/components/state-badge/StateBadge';
import { UpgradeBadge } from '@/components/upgrade-badge/UpgradeBadge';
import type { GearRowView } from '@/server/views/types';
import { BisTarget } from '@/components/bis-target/BisTarget';

export function GearTable({ rows, tracksKnown }: { rows: GearRowView[]; tracksKnown: boolean }) {
  return (
    <section aria-label="Gear by slot" className="flex flex-col rounded-2xl border border-line bg-surface py-1">
      <div className="hidden grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_190px] gap-3 border-b border-line px-4 py-3 text-[13px] font-semibold uppercase tracking-wider text-muted md:grid">
        <span>Slot</span><span>Equipped</span><span>BiS</span><span>State</span>
      </div>
      {rows.length === 0 && <p className="p-6 text-muted">No BiS list to compare against yet.</p>}
      {rows.map((row, index) => {
        const tone = rowTone(row.state, tracksKnown);
        return (
        <div key={`${row.slot}-${index}`} style={tone ? ROW_TONE_STYLES[tone] : undefined}
          className="mx-2 my-1 grid grid-cols-1 gap-3 rounded-[10px] px-3 py-2 md:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_190px] md:items-center">
          <span className="font-semibold text-muted">{row.slotLabel}</span>
          {row.equipped ? (
            <ItemCard itemId={row.equipped.itemId} name={row.equipped.name} quality={row.equipped.quality} iconUrl={row.equipped.iconUrl}
              bonusIds={row.equipped.bonusIds} itemLevel={row.equipped.itemLevel}
              detail={[trackText(row.equipped.trackLabel, tracksKnown), row.equipped.itemLevel].filter(Boolean).join(' · ')} />
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
