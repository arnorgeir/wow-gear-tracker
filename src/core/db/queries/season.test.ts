import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { getSeasonLoot, replaceSeason, type SeasonData } from './season';

const data: SeasonData = {
  slug: 'season-test-2',
  dungeons: [
    { challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', journalInstanceId: 901, mapId: 11 },
    { challengeModeId: 502, name: 'Streets of Beta', shortName: 'STRT', journalInstanceId: 902, mapId: 22 },
    { challengeModeId: 503, name: 'Beta Gambit', shortName: 'GMBT', journalInstanceId: 902, mapId: 22 },
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
      { challengeModeId: 501, name: 'Alpha Hollow', split: false, loot: [
        { itemId: 100, inventoryType: 'ROBE', armorType: 'leather' },
        { itemId: 101, inventoryType: null, armorType: null },
      ] },
      { challengeModeId: 503, name: 'Beta Gambit', split: true, loot: [{ itemId: 200, inventoryType: 'HEAD', armorType: 'plate' }] },
      { challengeModeId: 502, name: 'Streets of Beta', split: true, loot: [{ itemId: 200, inventoryType: 'HEAD', armorType: 'plate' }] },
    ]);
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
