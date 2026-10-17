import { describe, expect, it } from 'vitest';
import { DUNGEON_LOOT_VIEW_COOKIE, parseDungeonLootView } from './dungeon-loot-view';

describe('parseDungeonLootView', () => {
  it('has its own cookie name', () => expect(DUNGEON_LOOT_VIEW_COOKIE).toBe('dungeon-loot-view'));
  it('reads list as list', () => expect(parseDungeonLootView('list')).toBe('list'));
  it.each(['grid', undefined, '', 'LIST', 'junk'])('reads %j as grid', (v) => expect(parseDungeonLootView(v)).toBe('grid'));
});
