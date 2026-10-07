import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import type { Services } from '../services';
import type { BlizzardClient } from '@/core/blizzard/client';
import { insertCharacter, updateCharacter } from '@/core/db/queries/characters';
import { gearToSnapshotItems, saveSnapshotIfChanged } from '@/core/db/queries/snapshots';
import { replaceSeason } from '@/core/db/queries/season';
import { setMeta } from '@/core/db/queries/meta';
import { SEASON_META_KEY } from '@/core/sync/season-sync';
import { parseMemberKeys } from '@/core/characters/member-key';
import type { BisLists, BisRow, GearItem } from '@/core/types';
import { getGroupPage } from './group-page';

const item = (slotLabel: string, slots: BisRow['slots'], itemId: number, source = 'Alpha Hollow'): BisRow =>
  ({ kind: 'item', slotLabel, slots, itemId, name: `Item ${itemId}`, bonusIds: [], isTier: false, isCatalyst: false, source });
const worn = (slot: GearItem['slot'], itemId: number): GearItem =>
  ({ slot, itemId, name: `Worn ${itemId}`, itemLevel: 300, quality: 'EPIC', bonusIds: [], isTier: false });

// Guardian lists a "Weapon" and an off hand; Protection lists a "Main Hand" two-hander and no off hand.
const LISTS: Record<string, BisLists> = {
  'guardian-druid': { overall: [], raid: [], mythicPlus: [
    item('Ring', ['FINGER_1', 'FINGER_2'], 40), item('Ring', ['FINGER_1', 'FINGER_2'], 41),
    item('Weapon', ['MAIN_HAND'], 60), item('Off Hand', ['OFF_HAND'], 61),
  ] },
  'protection-warrior': { overall: [item('Main Hand', ['MAIN_HAND'], 70)], raid: [], mythicPlus: [] },
};

async function services() {
  const db = await openTestDb();
  const fetched: string[] = [];
  const blizzard = {
    getItemIconUrl: async (_r: string, id: number) => `https://i/${id}.jpg`,
    getClassIconUrl: async () => null,
    getClasses: async () => [],
  } as unknown as BlizzardClient;
  const s: Services = {
    db, blizzard,
    bisSource: { name: 'Fake', fetchLists: async (slug) => { fetched.push(slug); if (!LISTS[slug]) throw new Error('down'); return LISTS[slug]!; } },
    fetchRaidbots: async () => ({ tracks: [], qualities: [] }),
    syncer: { sync: async () => 'skipped' },
    now: () => 10_000_000,
    fetchFn: fetch,
  };
  return { s, fetched };
}

async function track(s: Services, name: string, className: string, specName: string, gear: GearItem[] | null, region: 'eu' | 'us' = 'eu') {
  const { id } = await insertCharacter(s.db, { region, realmId: 1, realmSlug: 'argent-dawn', realmName: 'Argent Dawn', name, className, specName }, 1);
  if (gear) {
    await saveSnapshotIfChanged(s.db, id, 'blizzard', gearToSnapshotItems(gear), 500);
    await updateCharacter(s.db, id, { lastSyncedAt: s.now() });
  }
  return id;
}

async function season(s: Services) {
  await replaceSeason(s.db, {
    slug: 'season-test',
    dungeons: [
      { challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', journalInstanceId: 901, mapId: 11, imageUrl: 'https://cdn.raiderio.net/images/dungeons/alpha-hollow.jpg' },
      { challengeModeId: 502, name: 'Streets of Beta', shortName: 'SB', journalInstanceId: 902, mapId: 22, imageUrl: null },
      { challengeModeId: 503, name: 'Gambit of Beta', shortName: 'GB', journalInstanceId: 902, mapId: 23, imageUrl: 'https://cdn.raiderio.net/images/dungeons/gambit.jpg' },
      { challengeModeId: 504, name: 'Delta Deep', shortName: 'DD', journalInstanceId: 904, mapId: 44, imageUrl: null },
    ],
    loot: [
      { challengeModeId: 501, encounterId: 1, encounterName: 'Boss', itemId: 41, itemName: 'Item 41', inventoryType: 'FINGER', armorType: null },
      { challengeModeId: 501, encounterId: 1, encounterName: 'Boss', itemId: 70, itemName: 'Item 70', inventoryType: 'TWOHWEAPON', armorType: null },
      { challengeModeId: 502, encounterId: 2, encounterName: 'Boss', itemId: 61, itemName: 'Item 61', inventoryType: 'HOLDABLE', armorType: null },
      { challengeModeId: 503, encounterId: 2, encounterName: 'Boss', itemId: 61, itemName: 'Item 61', inventoryType: 'HOLDABLE', armorType: null },
    ],
  });
  await setMeta(s.db, SEASON_META_KEY, 'season-test', 10_000_000);
}

const keys = (...names: string[]) => parseMemberKeys(names.map((n) => `eu.argent-dawn.${n}`).join(','));

describe('getGroupPage', () => {
  it('aligns members by evaluated slot, with rings where they sit and an empty off hand', async () => {
    const { s } = await services();
    await track(s, 'Birkibjörn', 'Druid', 'Guardian', [worn('FINGER_1', 42), worn('FINGER_2', 40), worn('MAIN_HAND', 60)]);
    await track(s, 'Hrafnhildur', 'Warrior', 'Protection', [worn('MAIN_HAND', 71)]);
    const page = await getGroupPage(s, keys('birkibjörn', 'hrafnhildur'));
    const row = (label: string) => page.grid.find((r) => r.label === label)!;
    expect(page.grid.map((r) => r.label)).toEqual(['Ring 1', 'Ring 2', 'Main Hand', 'Off Hand']);
    expect(row('Ring 2').cells[0]).toMatchObject({ state: 'done', equipped: { itemId: 40 }, bis: { itemId: 40 } });
    expect(row('Ring 1').cells[0]).toMatchObject({ state: 'missing', equipped: { itemId: 42 }, bis: { itemId: 41 } });
    expect(row('Main Hand').cells.map((c) => c?.bis.kind === 'item' && c.bis.itemId)).toEqual([60, 70]);
    expect(row('Off Hand').cells[1]).toBeNull();
    expect(page.members.map((m) => [m.name, m.state, m.listType, m.fellBack])).toEqual([
      ['Birkibjörn', 'ready', 'mythicPlus', false],
      ['Hrafnhildur', 'ready', 'overall', true],
    ]);
  });

  it('ranks for the group with credits per member and keeps split dungeons marked', async () => {
    const { s } = await services();
    await track(s, 'Birkibjörn', 'Druid', 'Guardian', [worn('FINGER_1', 42), worn('FINGER_2', 40), worn('MAIN_HAND', 60)]);
    await track(s, 'Hrafnhildur', 'Warrior', 'Protection', [worn('MAIN_HAND', 71)]);
    await season(s);
    const { priority } = await getGroupPage(s, keys('birkibjörn', 'hrafnhildur'));
    expect(priority).toMatchObject({ season: 'ready', covered: ['Birkibjörn', 'Hrafnhildur'], excluded: [], fellBack: ['Hrafnhildur'] });
    const [first, ...rest] = priority.ranking!.dungeons;
    expect(first).toMatchObject({ name: 'Alpha Hollow', split: false });
    expect(first!.members.map((m) => [m.name, m.credits.map((c) => c.kind === 'item' && c.item.itemId)])).toEqual([
      ['Birkibjörn', [41]],
      ['Hrafnhildur', [70]],
    ]);
    expect(rest.map((d) => [d.name, d.split])).toEqual([['Gambit of Beta', true], ['Streets of Beta', true]]);
    expect(priority.ranking!.nothingFrom).toEqual(['Delta Deep']);
    // Artwork follows the challenge mode, not the season's name order or the ranking order.
    const art: Record<number, [string, string | null]> = {
      501: ['AH', 'https://cdn.raiderio.net/images/dungeons/alpha-hollow.jpg'],
      502: ['SB', null],
      503: ['GB', 'https://cdn.raiderio.net/images/dungeons/gambit.jpg'],
    };
    for (const d of priority.ranking!.dungeons) expect([d.shortName, d.imageUrl]).toEqual(art[d.challengeModeId]);
  });

  it('says the ranking is unavailable when no member is eligible, and names why', async () => {
    const { s } = await services();
    const id = await track(s, 'Sólrún', 'Druid', 'Guardian', null);
    await updateCharacter(s.db, id, { lastSyncedAt: 5, lastSyncError: 'Blizzard returned 503' });
    await season(s);
    const page = await getGroupPage(s, keys('sólrún', 'gnúpur'));
    expect(page.members.map((m) => [m.name, m.state, m.syncError])).toEqual([['Sólrún', 'noGear', 'Blizzard returned 503'], ['gnúpur', 'untracked', null]]);
    expect(page.priority.ranking).toBeNull();
    expect(page.priority.excluded).toEqual([{ name: 'Sólrún', reason: 'no gear yet' }, { name: 'gnúpur', reason: 'not tracked' }]);
  });

  it('ranks a partly eligible group and leaves out a member without a BiS list', async () => {
    const { s } = await services();
    await track(s, 'Birkibjörn', 'Druid', 'Guardian', [worn('MAIN_HAND', 60)]);
    await track(s, 'Hrafnhildur', 'Mage', 'Frost', [worn('MAIN_HAND', 80)]);
    await season(s);
    const page = await getGroupPage(s, keys('birkibjörn', 'hrafnhildur'));
    expect(page.members[1]).toMatchObject({ state: 'ready', hasRows: false, bisError: 'BiS list couldn’t be updated' });
    expect(page.priority.covered).toEqual(['Birkibjörn']);
    expect(page.priority.excluded).toEqual([{ name: 'Hrafnhildur', reason: 'no BiS list' }]);
    expect(page.priority.ranking).not.toBeNull();
  });

  it('gives an empty ranking, not a null one, when eligible members need nothing', async () => {
    const { s } = await services();
    await track(s, 'Hrafnhildur', 'Warrior', 'Protection', [worn('MAIN_HAND', 70)]);
    await season(s);
    const { priority } = await getGroupPage(s, keys('hrafnhildur'));
    expect(priority.ranking).toEqual({ dungeons: [], nothingFrom: ['Alpha Hollow', 'Delta Deep', 'Gambit of Beta', 'Streets of Beta'] });
  });

  it('drops other regions, lists available characters, and skips not-found members when syncing', async () => {
    const { s } = await services();
    await track(s, 'Birkibjörn', 'Druid', 'Guardian', [worn('MAIN_HAND', 60)]);
    const lost = await track(s, 'Sólrún', 'Druid', 'Guardian', [worn('MAIN_HAND', 60)]);
    await updateCharacter(s.db, lost, { status: 'notFound', lastSyncedAt: 1 });
    const stale = await track(s, 'Hrafnhildur', 'Warrior', 'Protection', [worn('MAIN_HAND', 71)]);
    await updateCharacter(s.db, stale, { lastSyncedAt: 1 });
    await track(s, 'Gnúpur', 'Warrior', 'Protection', null);
    await track(s, 'Ylfa', 'Warrior', 'Protection', null, 'us');
    const page = await getGroupPage(s, parseMemberKeys('eu.argent-dawn.birkibjörn,us.argent-dawn.ylfa,eu.argent-dawn.sólrún,eu.argent-dawn.hrafnhildur'));
    expect(page.region).toBe('eu');
    expect(page.dropped).toEqual([{ name: 'Ylfa', region: 'us' }]);
    expect(page.keys).toEqual(['eu.argent-dawn.birkibjörn', 'eu.argent-dawn.sólrún', 'eu.argent-dawn.hrafnhildur']);
    expect(page.members[1]!.state).toBe('notFound');
    expect(page.staleIds).toEqual([stale]);
    expect(page.available).toEqual([{ key: 'eu.argent-dawn.gnúpur', label: 'Gnúpur – Argent Dawn (Protection)' }]);
  });

  it('asks Method once for two members of the same spec', async () => {
    const { s, fetched } = await services();
    await track(s, 'Birkibjörn', 'Druid', 'Guardian', [worn('MAIN_HAND', 60)]);
    await track(s, 'Sólrún', 'Druid', 'Guardian', [worn('MAIN_HAND', 60)]);
    await getGroupPage(s, keys('birkibjörn', 'sólrún'));
    expect(fetched).toEqual(['guardian-druid']);
  });

  it('keeps the three vault states apart', async () => {
    const { s } = await services();
    await track(s, 'Birkibjörn', 'Druid', 'Guardian', [worn('MAIN_HAND', 60)]);
    const pasted = await track(s, 'Sólrún', 'Druid', 'Guardian', null);
    await saveSnapshotIfChanged(s.db, pasted, 'simc', [{ location: 'equipped', slot: 'MAIN_HAND', itemId: 60, name: 'Worn 60', itemLevel: 300, quality: 'EPIC', bonusIds: [], isTier: false, secondaryStats: null }], 700);
    const chooser = await track(s, 'Gnúpur', 'Druid', 'Guardian', null);
    await saveSnapshotIfChanged(s.db, chooser, 'simc', [
      { location: 'equipped', slot: 'MAIN_HAND', itemId: 60, name: 'Worn 60', itemLevel: 300, quality: 'EPIC', bonusIds: [], isTier: false, secondaryStats: null },
      { location: 'vault', slot: 'OFF_HAND', itemId: 61, name: 'Item 61', itemLevel: 330, quality: 'EPIC', bonusIds: [], isTier: false, secondaryStats: null },
    ], 800);
    const { vault } = await getGroupPage(s, keys('birkibjörn', 'sólrún', 'gnúpur'));
    expect(vault.map((v) => v.className)).toEqual(['Druid', 'Druid', 'Druid']);
    expect(vault.every((v) => 'avatarUrl' in v && 'classIconUrl' in v)).toBe(true);
    expect(vault.map((v) => [v.name, v.pastedAt, v.choices.map((c) => [c.itemId, c.isBis])])).toEqual([
      ['Birkibjörn', null, []],
      ['Sólrún', 700, []],
      ['Gnúpur', 800, [[61, true]]],
    ]);
  });

  it('is empty without keys', async () => {
    const { s } = await services();
    const page = await getGroupPage(s, []);
    expect(page).toMatchObject({ region: null, keys: [], members: [], grid: [], needsSeasonSync: false });
  });
});
