import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { getSeasonLoot, replaceSeason, updateSeasonArtwork, type SeasonData } from './season';

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
        { itemId: 100, inventoryType: 'ROBE', armorType: 'leather' },
        { itemId: 101, inventoryType: null, armorType: null },
      ] },
      { challengeModeId: 503, name: 'Beta Gambit', shortName: 'GMBT', imageUrl: null, split: true, loot: [{ itemId: 200, inventoryType: 'HEAD', armorType: 'plate' }] },
      { challengeModeId: 502, name: 'Streets of Beta', shortName: 'STRT', imageUrl: STRT, split: true, loot: [{ itemId: 200, inventoryType: 'HEAD', armorType: 'plate' }] },
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
});
