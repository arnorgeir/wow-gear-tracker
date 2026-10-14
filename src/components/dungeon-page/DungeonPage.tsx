import { DungeonThumbnail } from '@/components/dungeon-thumbnail/DungeonThumbnail';
import { ItemCard } from '@/components/item-card/ItemCard';
import { itemKind } from '@/components/shared/item-kind';
import { SPLIT_DUNGEON } from '@/components/shared/priority-copy';
import { statPairLabel } from '@/components/shared/stat-pair';
import type { DungeonPageView } from '@/server/views/types';

/** One season dungeon: its art and name, then each boss with everything it drops. */
export function DungeonPage({ view }: { view: DungeonPageView }) {
  return (
    <>
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <DungeonThumbnail imageUrl={view.imageUrl} shortName={view.shortName} />
          <h1 className="font-display text-3xl font-bold">{view.name}</h1>
        </div>
        {view.split && <p className="text-sm text-muted">{SPLIT_DUNGEON}</p>}
      </header>
      {view.bosses.map((boss) => (
        <section key={boss.encounterId} aria-labelledby={`boss-${boss.encounterId}`} className="flex flex-col gap-3">
          <h2 id={`boss-${boss.encounterId}`} className="font-display text-xl font-bold">{boss.name}</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {boss.items.map((item) => (
              <ItemCard key={item.itemId} itemId={item.itemId} name={item.name} quality={item.quality} iconUrl={item.iconUrl}
                bonusIds={[]} itemLevel={null} detail={itemKind(item) ?? undefined}
                stats={item.stats && item.stats.length > 0 ? statPairLabel(item.stats) : undefined} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
