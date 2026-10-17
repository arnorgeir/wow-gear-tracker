import { SPLIT_DUNGEON } from '@/components/shared/priority-copy';
import type { DungeonPageView } from '@/server/views/types';
import { BossAbilities } from './BossTactics';
import { BossIndex } from './BossIndex';
import { Breadcrumb } from './Breadcrumb';
import { GuideTabs } from './GuideTabs';
import type { GuideState } from './guide-state';
import { LootTab } from './LootTab';
import { OverviewTab } from './OverviewTab';

/** One season dungeon as an open book: boss index on the left page, the chosen boss or dungeon on the right, tab ribbons on its edge. */
export function DungeonPage({ view, state }: { view: DungeonPageView; state: GuideState }) {
  const boss = view.bosses.find((b) => b.encounterId === state.boss);
  return (
    <>
      <Breadcrumb dungeonId={view.challengeModeId} dungeonName={view.name} bossName={boss?.name ?? null} />
      {view.split && <p className="text-sm text-muted">{SPLIT_DUNGEON}</p>}
      <div className="flex flex-col overflow-hidden rounded-xl border border-line-strong bg-surface lg:flex-row">
        {/* The spine: a hairline with a soft shadow falling away on each page. The page's one flourish. */}
        <div className="min-w-0 border-b border-line lg:w-80 lg:shrink-0 lg:border-b-0 lg:border-r lg:shadow-[inset_-14px_0_14px_-14px_var(--color-bg)]">
          <BossIndex view={view} state={state} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col lg:flex-row lg:shadow-[inset_14px_0_14px_-14px_var(--color-bg)]">
          <div className="lg:order-last"><GuideTabs dungeonId={view.challengeModeId} state={state} /></div>
          <section aria-labelledby="guide-title" className="flex min-w-0 flex-1 flex-col gap-4 p-4 lg:p-6">
            <h2 id="guide-title" className="font-display text-2xl font-bold">{boss?.name ?? view.name}</h2>
            {state.tab === 'loot' ? <LootTab view={view} bossId={state.boss} />
              : state.tab === 'abilities' && boss ? <BossAbilities tactics={boss.tactics} />
              : <OverviewTab view={view} bossId={state.boss} />}
          </section>
        </div>
      </div>
    </>
  );
}
