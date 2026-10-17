import { ItemCard } from '@/components/item-card/ItemCard';
import { itemKind } from '@/components/shared/item-kind';
import { statPairLabel } from '@/components/shared/stat-pair';
import type { DungeonPageView } from '@/server/views/types';

/** One boss's items, or the whole dungeon's in boss order, each naming its boss. */
export function LootTab({ view, bossId }: { view: DungeonPageView; bossId: number | null }) {
  const chosen = view.bosses.find((b) => b.encounterId === bossId);
  const bosses = chosen ? [chosen] : view.bosses;
  return (
    <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
      {bosses.flatMap((boss) => boss.items.map((item) => {
        const kind = itemKind(item);
        const detail = chosen ? kind : [kind, boss.name].filter(Boolean).join(', ');
        return (
          <ItemCard key={`${boss.encounterId}-${item.itemId}`} itemId={item.itemId} name={item.name} quality={item.quality} iconUrl={item.iconUrl}
            bonusIds={[]} itemLevel={null} detail={detail || undefined}
            stats={item.stats && item.stats.length > 0 ? statPairLabel(item.stats) : undefined} />
        );
      }))}
    </div>
  );
}
