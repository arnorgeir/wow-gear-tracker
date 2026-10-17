import { describe, expect, it } from 'vitest';
import type { DungeonLootItemView, DungeonPageView, LootBisView, LootNeedView } from '@/server/views/types';
import { excludedText, lootEntries, needWords } from './loot-view';

const need = (name: string, extra: Partial<LootNeedView> = {}): LootNeedView =>
  ({ key: `eu.x.${name}`, name, className: 'Druid', avatarUrl: null, classIconUrl: null, slotLabel: 'Ring', via: 'drop', reason: 'missing', ...extra });
const spec = (slug: string): LootBisView => ({ slug, label: slug, className: 'Druid', iconUrl: null });
const item = (itemId: number, neededBy: LootNeedView[] = [], bisFor: LootBisView[] = []): DungeonLootItemView =>
  ({ itemId, name: `Item ${itemId}`, quality: 'EPIC', iconUrl: null, inventoryType: 'FINGER', armorType: null, stats: null, neededBy, bisFor });
const view = (...bosses: DungeonLootItemView[][]): DungeonPageView => ({
  challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', imageUrl: null, split: false, neededCount: 0,
  coverage: { evaluated: 1, excluded: [] }, lens: { who: 'all', groupRemembered: false },
  bosses: bosses.map((items, i) => ({ encounterId: i + 1, name: `Boss ${i + 1}`, items, tactics: null, neededCount: 0 })),
});

describe('needWords', () => {
  it.each([
    [{ via: 'drop', reason: 'missing' }, ''],
    [{ via: 'drop', reason: 'wrongStats' }, 'has wrong stats'],
    [{ via: 'catalyst', reason: 'missing', fit: 'bis' }, 'via Catalyst'],
    [{ via: 'catalyst', reason: 'missing', fit: 'any' }, 'via Catalyst'],
    [{ via: 'catalyst', reason: 'missing', fit: 'unverified' }, 'via Catalyst, stats unverified'],
    [{ via: 'catalyst', reason: 'missing', fit: 'alternative' }, 'via Catalyst, alternative stats'],
    [{ via: 'catalyst', reason: 'wrongStats', fit: 'bis' }, 'has wrong stats, via Catalyst'],
  ] as const)('words %j as %j', (n, words) => expect(needWords(n)).toBe(words));
});

describe('lootEntries', () => {
  const v = view([item(1), item(2, [], [spec('a')]), item(3, [need('Birkibjörn')])], [item(4, [need('Birkibjörn'), need('Sólrún')]), item(5, [need('Sólrún')], [spec('a'), spec('b')]), item(6, [need('Sólrún')], [spec('a')])]);
  const ids = (r: ReturnType<typeof lootEntries>) => r.entries.map((e) => e.item.itemId);

  it('sorts wanted drops by need count, then spec count, then journal order', () => {
    const r = lootEntries(v, null, 'wanted');
    expect(ids(r)).toEqual([4, 5, 6, 3, 2]);
    expect(r.wantedCount).toBe(5);
  });

  it('keeps journal order in All drops, and counts wanted ones', () => {
    const r = lootEntries(v, null, 'all');
    expect(ids(r)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(r.wantedCount).toBe(5);
  });

  it('limits to one boss and names the boss of each entry', () => {
    const r = lootEntries(v, 2, 'wanted');
    expect(ids(r)).toEqual([4, 5, 6]);
    expect(r.entries.every((e) => e.boss.name === 'Boss 2')).toBe(true);
    expect(ids(lootEntries(v, 99, 'all'))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('is empty when nothing is wanted', () => {
    expect(lootEntries(view([item(1)]), null, 'wanted')).toEqual({ entries: [], wantedCount: 0 });
  });
});

describe('excludedText', () => {
  it('lists names with reasons', () => {
    expect(excludedText([{ name: 'Birkibjörn', reason: 'syncing' }, { name: 'Sólrún', reason: 'no gear yet' }])).toBe('Birkibjörn (syncing), Sólrún (no gear yet)');
  });
});
