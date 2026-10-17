import Link from 'next/link';
import { DungeonThumbnail } from '@/components/dungeon-thumbnail/DungeonThumbnail';
import type { DungeonPageView } from '@/server/views/types';
import { guideHref, type GuideState } from './guide-state';

const ROW = 'flex shrink-0 items-center gap-3 rounded-lg border px-3 py-2.5 no-underline focus-visible:outline-2 focus-visible:outline-gold lg:shrink';
const CHOSEN = 'border-gold-line bg-gold-soft text-gold';
const IDLE = 'border-transparent hover:bg-surface-2';

/** The left page: the dungeon's heading, an Overview row, then one banner per boss in journal order. */
export function BossIndex({ view, state }: { view: DungeonPageView; state: GuideState }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <DungeonThumbnail imageUrl={view.imageUrl} shortName={view.shortName} className="h-12 w-16 shrink-0 rounded-md" />
        <h1 className="font-display text-xl font-bold">{view.name}</h1>
      </div>
      <nav aria-label="Bosses" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:flex-col lg:overflow-visible lg:border-t lg:border-line lg:pb-0 lg:pt-3">
        <Link href={guideHref(view.challengeModeId, { boss: null, tab: state.tab })} aria-current={state.boss === null ? 'page' : undefined}
          className={`${ROW} ${state.boss === null ? CHOSEN : IDLE}`}>
          <span className="font-display font-bold">Dungeon overview</span>
        </Link>
        {view.bosses.map((boss, i) => {
          const chosen = state.boss === boss.encounterId;
          return (
            <Link key={boss.encounterId} href={guideHref(view.challengeModeId, { boss: boss.encounterId, tab: state.tab })}
              aria-current={chosen ? 'page' : undefined} className={`${ROW} ${chosen ? CHOSEN : IDLE}`}>
              <span className={`font-mono text-sm ${chosen ? 'text-gold' : 'text-muted'}`}>{i + 1}</span>
              <span className="font-display font-bold">{boss.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
