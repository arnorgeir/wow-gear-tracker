import type { CharactersView } from './characters-view';

export const DUNGEON_LOOT_VIEW_COOKIE = 'dungeon-loot-view';

/** The remembered layout of the dungeon loot tab. Anything but `list` is the default grid. */
export function parseDungeonLootView(value?: string): CharactersView {
  return value === 'list' ? 'list' : 'grid';
}
