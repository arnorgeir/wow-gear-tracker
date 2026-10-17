import { getSeasonDungeons } from '@/core/db/queries/season';
import type { Services } from '../services';
import type { DungeonListView } from './types';

/** The stored season's dungeons, no loot. Empty until a season has loaded. */
export async function getDungeonList(services: Services): Promise<DungeonListView> {
  const rows = await getSeasonDungeons(services.db);
  return { dungeons: rows.map((d) => ({ challengeModeId: d.challengeModeId, name: d.name, shortName: d.shortName, imageUrl: d.imageUrl })) };
}
