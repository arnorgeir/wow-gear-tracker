import { EmptySlotCard } from '@/components/empty-slot-card/EmptySlotCard';
import { ItemCard } from '@/components/item-card/ItemCard';
import { ROW_TONE_STYLES, rowTone } from '@/components/shared/row-tone';
import { StateBadge } from '@/components/state-badge/StateBadge';
import { UpgradeBadge } from '@/components/upgrade-badge/UpgradeBadge';
import type { GearRowView } from '@/server/views/types';
import { needText } from './cell-note';

export function GroupCell({ cell, tracksKnown }: { cell: GearRowView | null; tracksKnown: boolean }) {
  if (!cell) return <div className="p-2 text-muted">&mdash;</div>;
  const tone = rowTone(cell.state, tracksKnown);
  const need = needText(cell);
  return (
    <div className="m-1 flex flex-col gap-1.5 rounded-[10px] p-2" style={tone ? ROW_TONE_STYLES[tone] : undefined}>
      {cell.equipped ? (
        <ItemCard itemId={cell.equipped.itemId} name={cell.equipped.name} quality={cell.equipped.quality} iconUrl={cell.equipped.iconUrl}
          bonusIds={cell.equipped.bonusIds} itemLevel={cell.equipped.itemLevel}
          detail={[cell.equipped.trackLabel ?? 'no track', cell.equipped.itemLevel].filter(Boolean).join(' · ')} />
      ) : <EmptySlotCard />}
      <span className="flex flex-wrap items-center gap-2">
        <StateBadge state={cell.state} />
        {cell.upgrade && <UpgradeBadge upgrade={cell.upgrade} />}
      </span>
      {need && <span className="text-sm text-muted">{need}</span>}
    </div>
  );
}
