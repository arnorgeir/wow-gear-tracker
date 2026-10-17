import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { replaceSeason } from '@/core/db/queries/season';
import type { Services } from '../services';
import { getDungeonList } from './dungeon-list';

describe('getDungeonList', () => {
  it('is empty before a season is stored', async () => {
    const db = await openTestDb();
    expect(await getDungeonList({ db } as unknown as Services)).toEqual({ dungeons: [] });
  });

  it('lists the stored dungeons by name, without loot', async () => {
    const db = await openTestDb();
    await replaceSeason(db, {
      slug: 'season-test',
      dungeons: [
        { challengeModeId: 502, name: 'Streets of Beta', shortName: 'SB', journalInstanceId: 902, mapId: 22, imageUrl: null },
        { challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', journalInstanceId: 901, mapId: 11, imageUrl: 'https://cdn.raiderio.net/a.jpg' },
      ],
      loot: [],
    });
    expect(await getDungeonList({ db } as unknown as Services)).toEqual({ dungeons: [
      { challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', imageUrl: 'https://cdn.raiderio.net/a.jpg' },
      { challengeModeId: 502, name: 'Streets of Beta', shortName: 'SB', imageUrl: null },
    ] });
  });
});
