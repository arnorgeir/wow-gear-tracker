import type { DungeonBossView, DungeonLootItemView, DungeonPageView, LootNeedView } from '@/server/views/types';
import type { GuideState } from './guide-state';

export interface LootEntry { item: DungeonLootItemView; boss: DungeonBossView }

/** How a character's need reads beside their name: nothing for a plainly missing item, otherwise the route and the stat caveat. */
export function needWords(need: Pick<LootNeedView, 'via' | 'reason' | 'fit'>): string {
  return [
    need.reason === 'wrongStats' ? 'has wrong stats' : null,
    need.via === 'catalyst' ? 'via Catalyst' : null,
    need.fit === 'unverified' ? 'stats unverified' : need.fit === 'alternative' ? 'alternative stats' : null,
  ].filter(Boolean).join(', ');
}

const isWanted = (item: DungeonLootItemView) => item.neededBy.length > 0 || item.bisFor.length > 0;

/**
 * The drops to list for a boss or the whole dungeon, and how many of them someone wants. Wanted drops sort by
 * how many characters need them, then how many specs list them, then journal order; All drops keep journal order.
 */
export function lootEntries(view: DungeonPageView, bossId: number | null, show: GuideState['show']): { entries: LootEntry[]; wantedCount: number } {
  const chosen = view.bosses.find((b) => b.encounterId === bossId);
  const all = (chosen ? [chosen] : view.bosses).flatMap((boss) => boss.items.map((item) => ({ item, boss })));
  const wanted = all.filter((e) => isWanted(e.item));
  if (show === 'all') return { entries: all, wantedCount: wanted.length };
  const entries = wanted
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.item.neededBy.length - a.e.item.neededBy.length || b.e.item.bisFor.length - a.e.item.bisFor.length || a.i - b.i)
    .map(({ e }) => e);
  return { entries, wantedCount: wanted.length };
}

/** "Birkibjörn (still syncing), Sólrún (no gear yet)", as the group page words who was left out. */
export const excludedText = (excluded: DungeonPageView['coverage']['excluded']) => excluded.map((e) => `${e.name} (${e.reason})`).join(', ');
