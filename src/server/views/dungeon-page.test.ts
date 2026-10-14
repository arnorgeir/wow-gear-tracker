import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { replaceSeason, type DungeonLootRow } from '@/core/db/queries/season';
import { upsertItemIcons } from '@/core/db/queries/media';
import type { Services } from '../services';
import { getDungeonPage } from './dungeon-page';

const loot = (encounterId: number, encounterName: string, itemId: number, extra: Partial<DungeonLootRow> = {}): DungeonLootRow =>
  ({ challengeModeId: 501, encounterId, encounterName, itemId, itemName: `Item ${itemId}`, inventoryType: 'WRIST', armorType: 'leather', ...extra });

async function setup(rows: DungeonLootRow[]) {
  const db = await openTestDb();
  await replaceSeason(db, {
    slug: 'season-test',
    dungeons: [
      { challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', journalInstanceId: 901, mapId: 11, imageUrl: 'https://cdn.raiderio.net/images/dungeons/alpha-hollow.jpg' },
      { challengeModeId: 502, name: 'Streets of Beta', shortName: 'SB', journalInstanceId: 902, mapId: 22, imageUrl: null },
      { challengeModeId: 503, name: 'Gambit of Beta', shortName: 'GB', journalInstanceId: 902, mapId: 23, imageUrl: null },
    ],
    loot: rows,
  });
  return { db } as unknown as Services;
}

describe('getDungeonPage', () => {
  it('groups items under their boss in stored order', async () => {
    const s = await setup([loot(9, 'First Boss', 1), loot(3, 'Second Boss', 2), loot(9, 'First Boss', 3)]);
    const view = await getDungeonPage(s, 501);
    expect(view).toMatchObject({ challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', split: false, imageUrl: 'https://cdn.raiderio.net/images/dungeons/alpha-hollow.jpg' });
    expect(view!.bosses.map((b) => [b.encounterId, b.name, b.items.map((i) => i.itemId)])).toEqual([[9, 'First Boss', [1, 3]], [3, 'Second Boss', [2]]]);
  });

  it('falls back to epic quality and carries cached icons, null when not cached', async () => {
    const s = await setup([loot(1, 'Boss', 1, { quality: 'RARE' }), loot(1, 'Boss', 2)]);
    await upsertItemIcons(s.db, [{ itemId: 1, iconUrl: 'https://i/1.jpg' }], 1);
    const [a, b] = (await getDungeonPage(s, 501))!.bosses[0]!.items;
    expect([a!.quality, a!.iconUrl, b!.quality, b!.iconUrl]).toEqual(['RARE', 'https://i/1.jpg', 'EPIC', null]);
    expect(b).toMatchObject({ inventoryType: 'WRIST', armorType: 'leather', name: 'Item 2' });
  });

  it('decodes stats: unknown and empty become null, a pair stays a pair', async () => {
    const s = await setup([loot(1, 'Boss', 1), loot(1, 'Boss', 2, { secondaryStats: '' }), loot(1, 'Boss', 3, { secondaryStats: 'HASTE_RATING,MASTERY_RATING' })]);
    expect((await getDungeonPage(s, 501))!.bosses[0]!.items.map((i) => i.stats)).toEqual([null, null, ['HASTE_RATING', 'MASTERY_RATING']]);
  });

  it('marks a split dungeon, and gives null for an unknown ID', async () => {
    const s = await setup([loot(1, 'Boss', 1, { challengeModeId: 502 })]);
    expect((await getDungeonPage(s, 502))!.split).toBe(true);
    expect(await getDungeonPage(s, 999)).toBeNull();
  });
});
