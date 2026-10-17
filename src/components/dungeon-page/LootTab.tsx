import Link from 'next/link';
import { DUNGEON_LOOT_VIEW_COOKIE } from '@/components/view-toggle/dungeon-loot-view';
import { ViewToggle } from '@/components/view-toggle/ViewToggle';
import type { DungeonPageView } from '@/server/views/types';
import { guideHref, type GuideState } from './guide-state';
import { LootCard } from './LootCard';
import { LootList } from './LootList';
import { LootSwitch } from './LootSwitch';
import { excludedText, lootEntries } from './loot-view';

const LINK = 'text-gold underline focus-visible:outline-2 focus-visible:outline-gold';

/** One boss's drops, or the whole dungeon's, with who needs each and which specs list it. Wanted drops by default. */
export function LootTab({ view, state, layout }: { view: DungeonPageView; state: GuideState; layout: 'grid' | 'list' }) {
  const chosen = view.bosses.find((b) => b.encounterId === state.boss);
  const { entries, wantedCount } = lootEntries(view, state.boss, state.show);
  const href = (change: Partial<GuideState>) => guideHref(view.challengeModeId, { ...state, tab: 'loot', ...change });
  const { coverage, lens } = view;
  const nobody = coverage.evaluated === 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <LootSwitch label="Which drops" options={[
          { label: `Wanted (${wantedCount})`, href: href({ show: 'wanted' }), current: state.show === 'wanted' },
          { label: 'All drops', href: href({ show: 'all' }), current: state.show === 'all' },
        ]} />
        <div className="flex items-center gap-2">
          <LootSwitch label="Whose needs" options={[
            { label: 'Everyone', href: href({ who: 'all' }), current: lens.who === 'all' },
            lens.groupRemembered
              ? { label: 'My group', href: href({ who: 'group' }), current: lens.who === 'group' }
              : { label: 'My group', href: '/group', current: false },
          ]} />
          {!lens.groupRemembered && <span className="text-sm text-muted">Pick a group first</span>}
        </div>
        <div className="sm:ml-auto"><ViewToggle view={layout} cookie={DUNGEON_LOOT_VIEW_COOKIE} name={DUNGEON_LOOT_VIEW_COOKIE} /></div>
      </div>
      {nobody
        ? <p className="text-sm text-muted">{`No character could be checked yet.${coverage.excluded.length > 0 ? ` ${excludedText(coverage.excluded)}.` : ""}`}</p>
        : coverage.excluded.length > 0 && <p className="text-sm text-muted">{`Not checked: ${excludedText(coverage.excluded)}.`}</p>}
      {entries.length === 0 && state.show === 'wanted' ? (
        <p>{`${chosen ? 'Nothing from this boss is wanted' : 'Nothing here is wanted'} by the characters checked or your BiS lists.`} <Link href={href({ show: 'all' })} className={LINK}>All drops</Link></p>
      ) : layout === 'list' ? <LootList entries={entries} withBoss={!chosen} /> : (
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
          {entries.map((entry) => <LootCard key={`${entry.boss.encounterId}-${entry.item.itemId}`} entry={entry} withBoss={!chosen} />)}
        </div>
      )}
    </div>
  );
}
