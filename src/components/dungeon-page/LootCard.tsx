import { ItemCard } from '@/components/item-card/ItemCard';
import { itemKind } from '@/components/shared/item-kind';
import { statPairLabel } from '@/components/shared/stat-pair';
import { BisFor } from './BisFor';
import type { LootEntry } from './loot-view';
import { NeededBy } from './NeededBy';

const LABEL = 'text-xs font-semibold uppercase tracking-wide text-muted';

/** The item detail line: its kind, plus the boss when the list spans the dungeon. */
export const lootDetail = ({ item, boss }: LootEntry, withBoss: boolean) => [itemKind(item), withBoss ? boss.name : null].filter(Boolean).join(', ') || undefined;

/** An item card with who needs it and which specs list it, in one bordered box. Rows with nothing to show are left out. */
export function LootCard({ entry, withBoss }: { entry: LootEntry; withBoss: boolean }) {
  const { item } = entry;
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-line bg-surface-2 p-2">
      <ItemCard itemId={item.itemId} name={item.name} quality={item.quality} iconUrl={item.iconUrl} bonusIds={[]} itemLevel={null}
        detail={lootDetail(entry, withBoss)} stats={item.stats && item.stats.length > 0 ? statPairLabel(item.stats) : undefined} />
      {item.neededBy.length > 0 && <div className="flex flex-col gap-1 px-1"><p className={LABEL}>Needed by</p><NeededBy needs={item.neededBy} /></div>}
      {item.bisFor.length > 0 && <div className="flex flex-col gap-1 px-1"><p className={LABEL}>BiS for</p><BisFor specs={item.bisFor} /></div>}
    </div>
  );
}
