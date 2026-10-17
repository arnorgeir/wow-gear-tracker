import { ItemCard } from '@/components/item-card/ItemCard';
import { statPairLabel } from '@/components/shared/stat-pair';
import { lootDetail } from './LootCard';
import type { LootEntry } from './loot-view';
import { NeededBy } from './NeededBy';

const COLUMNS = 'md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,2fr)] md:gap-4';
const MOBILE_LABEL = 'text-xs font-semibold uppercase tracking-wide text-muted md:hidden';

/** One row per item. Wide screens show columns under headers; below md each row stacks its three parts under small labels. */
export function LootList({ entries, withBoss }: { entries: LootEntry[]; withBoss: boolean }) {
  return (
    <div role="table" aria-label="Dungeon loot" className="flex flex-col gap-2">
      <div role="rowgroup">
        <div role="row" className={`hidden px-2 text-xs font-semibold uppercase tracking-wide text-muted ${COLUMNS}`}>
          <div role="columnheader">Item</div>
          <div role="columnheader">Needed by</div>
          <div role="columnheader">BiS for</div>
        </div>
      </div>
      <div role="rowgroup" className="flex flex-col gap-2">
        {entries.map((entry) => {
          const { item } = entry;
          return (
            <div key={`${entry.boss.encounterId}-${item.itemId}`} role="row" className={`flex min-w-0 flex-col gap-2 rounded-xl border border-line bg-surface-2 p-2 md:items-start ${COLUMNS}`}>
              <div role="cell" className="min-w-0">
                <ItemCard itemId={item.itemId} name={item.name} quality={item.quality} iconUrl={item.iconUrl} bonusIds={[]} itemLevel={null}
                  detail={lootDetail(entry, withBoss)} stats={item.stats && item.stats.length > 0 ? statPairLabel(item.stats) : undefined} />
              </div>
              <div role="cell" className={`min-w-0 flex-col gap-1 px-1 py-1 ${item.neededBy.length > 0 ? 'flex' : 'hidden md:flex'}`}>
                <p className={MOBILE_LABEL}>Needed by</p>
                {item.neededBy.length > 0 ? <NeededBy needs={item.neededBy} /> : <p className="text-sm text-muted">No one</p>}
              </div>
              <div role="cell" className={`min-w-0 flex-col gap-1 px-1 py-1 ${item.bisFor.length > 0 ? 'flex' : 'hidden md:flex'}`}>
                <p className={MOBILE_LABEL}>BiS for</p>
                <p className="text-sm wrap-anywhere">{item.bisFor.length > 0 ? item.bisFor.map((s) => s.label).join(', ') : <span className="text-muted">No spec</span>}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
