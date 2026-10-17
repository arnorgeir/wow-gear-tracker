import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openTestDb } from '@/test/db';
import { dungeonEncounters } from '../schema';
import { getSeasonDungeon, getSeasonLoot, replaceSeason, updateSeasonArtwork, type SeasonData } from './season';

const AH = 'https://cdn.raiderio.net/images/dungeons/alpha-hollow.jpg';
const STRT = 'https://cdn.raiderio.net/images/dungeons/streets.jpg';
const data: SeasonData = {
  slug: 'season-test-2',
  dungeons: [
    { challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', journalInstanceId: 901, mapId: 11, imageUrl: AH },
    { challengeModeId: 502, name: 'Streets of Beta', shortName: 'STRT', journalInstanceId: 902, mapId: 22, imageUrl: STRT },
    { challengeModeId: 503, name: 'Beta Gambit', shortName: 'GMBT', journalInstanceId: 902, mapId: 22, imageUrl: null },
  ],
  loot: [
    { challengeModeId: 501, encounterId: 1, encounterName: 'Hollow King', itemId: 100, itemName: 'Hollow Robe', inventoryType: 'ROBE', armorType: 'leather' },
    { challengeModeId: 501, encounterId: 1, encounterName: 'Hollow King', itemId: 101, itemName: 'Vanished Band', inventoryType: null, armorType: null },
    { challengeModeId: 502, encounterId: 2, encounterName: 'Market Warden', itemId: 200, itemName: 'Warden Helm', inventoryType: 'HEAD', armorType: 'plate' },
    { challengeModeId: 503, encounterId: 2, encounterName: 'Market Warden', itemId: 200, itemName: 'Warden Helm', inventoryType: 'HEAD', armorType: 'plate' },
  ],
};

describe('season storage', () => {
  it('reads back each dungeon with its loot, ordered by name, marking split dungeons', async () => {
    const db = await openTestDb();
    await replaceSeason(db, data);
    expect(await getSeasonLoot(db)).toEqual([
      { challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', imageUrl: AH, split: false, loot: [
        { itemId: 100, name: 'Hollow Robe', inventoryType: 'ROBE', armorType: 'leather', weaponType: null, secondaryStats: null },
        { itemId: 101, name: 'Vanished Band', inventoryType: null, armorType: null, weaponType: null, secondaryStats: null },
      ] },
      { challengeModeId: 503, name: 'Beta Gambit', shortName: 'GMBT', imageUrl: null, split: true, loot: [{ itemId: 200, name: 'Warden Helm', inventoryType: 'HEAD', armorType: 'plate', weaponType: null, secondaryStats: null }] },
      { challengeModeId: 502, name: 'Streets of Beta', shortName: 'STRT', imageUrl: STRT, split: true, loot: [{ itemId: 200, name: 'Warden Helm', inventoryType: 'HEAD', armorType: 'plate', weaponType: null, secondaryStats: null }] },
    ]);
  });

  it('reads back loot names and stat pairs, unknown when not stored', async () => {
    const db = await openTestDb();
    await replaceSeason(db, { ...data, loot: data.loot.map((l) => (l.itemId === 100 ? { ...l, secondaryStats: 'HASTE_RATING,MASTERY_RATING' } : l)) });
    const alpha = (await getSeasonLoot(db)).find((d) => d.challengeModeId === 501)!;
    expect(alpha.loot[0]).toEqual({ itemId: 100, name: 'Hollow Robe', inventoryType: 'ROBE', armorType: 'leather', weaponType: null, secondaryStats: ['HASTE_RATING', 'MASTERY_RATING'] });
    expect(alpha.loot[1]!.secondaryStats).toBeNull();
  });

  it('reads back the weapon type, null for armor', async () => {
    const db = await openTestDb();
    await replaceSeason(db, { ...data, loot: [...data.loot, { challengeModeId: 501, encounterId: 1, encounterName: 'Hollow King', itemId: 102, itemName: 'Hollow Blade', inventoryType: 'WEAPON', armorType: null, weaponType: 'sword1h' }] });
    const alpha = (await getSeasonLoot(db)).find((d) => d.challengeModeId === 501)!;
    expect(alpha.loot.map((l) => [l.itemId, l.weaponType])).toEqual([[100, null], [101, null], [102, 'sword1h']]);
  });

  it('replaces the previous season entirely', async () => {
    const db = await openTestDb();
    await replaceSeason(db, data);
    await replaceSeason(db, { slug: 'season-test-3', dungeons: [data.dungeons[0]!], loot: [data.loot[0]!] });
    const season = await getSeasonLoot(db);
    expect(season.map((d) => d.name)).toEqual(['Alpha Hollow']);
    expect(season[0]!.loot).toHaveLength(1);
  });

  it('is empty before any season is stored', async () => {
    expect(await getSeasonLoot(await openTestDb())).toEqual([]);
  });
});

describe('updateSeasonArtwork', () => {
  it('replaces or clears artwork on matching rows only, and never adds rows', async () => {
    const db = await openTestDb();
    await replaceSeason(db, data);
    const NEW = 'https://cdn.raiderio.net/images/dungeons/alpha-hollow-v2.jpg';
    await updateSeasonArtwork(db, 'season-test-2', [
      { challengeModeId: 501, imageUrl: NEW },
      { challengeModeId: 502, imageUrl: null },
      { challengeModeId: 999, imageUrl: NEW },
    ]);
    const season = await getSeasonLoot(db);
    expect(season.map((d) => [d.challengeModeId, d.imageUrl])).toEqual([[501, NEW], [503, null], [502, null]]);
    expect(season[0]!.loot).toHaveLength(2);
  });

  it('leaves another season’s rows alone', async () => {
    const db = await openTestDb();
    await replaceSeason(db, data);
    await updateSeasonArtwork(db, 'season-test-3', [{ challengeModeId: 501, imageUrl: null }]);
    expect((await getSeasonLoot(db))[0]!.imageUrl).toBe(AH);
  });

  it('reads one dungeon with its loot in insertion order, whatever the encounter IDs', async () => {
    const db = await openTestDb();
    await replaceSeason(db, { ...data, loot: [
      { challengeModeId: 501, encounterId: 9, encounterName: 'First Boss', itemId: 100, itemName: 'Hollow Robe', inventoryType: 'ROBE', armorType: 'leather' },
      { challengeModeId: 501, encounterId: 3, encounterName: 'Second Boss', itemId: 101, itemName: 'Vanished Band', inventoryType: null, armorType: null },
    ] });
    const found = await getSeasonDungeon(db, 501);
    expect(found!.dungeon.name).toBe('Alpha Hollow');
    expect(found!.split).toBe(false);
    expect(found!.loot.map((l) => l.encounterName)).toEqual(['First Boss', 'Second Boss']);
  });

  it('marks a dungeon sharing its journal instance as split, and gives null for an unknown ID', async () => {
    const db = await openTestDb();
    await replaceSeason(db, data);
    expect((await getSeasonDungeon(db, 502))!.split).toBe(true);
    expect(await getSeasonDungeon(db, 999)).toBeNull();
  });

  it('returns the dungeon’s encounters by ID, and treats malformed section JSON as missing', async () => {
    const db = await openTestDb();
    const sections = [{ title: 'Overview', spellId: null, bodyText: 'Dodge it.', sections: [] }];
    await replaceSeason(db, { ...data, encounters: [
      { encounterId: 1, name: 'Hollow King', description: 'Lore.', sections },
      { encounterId: 2, name: 'Market Warden', description: null, sections: [] },
    ] });
    const found = await getSeasonDungeon(db, 501);
    expect([...found!.encounters.entries()]).toEqual([[1, { description: 'Lore.', sections }]]);
    await db.update(dungeonEncounters).set({ sections: '{oops' }).where(eq(dungeonEncounters.encounterId, 1));
    expect((await getSeasonDungeon(db, 501))!.encounters.size).toBe(0);
  });
});
