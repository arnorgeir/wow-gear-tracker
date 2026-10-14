import { getItemIcons } from '@/core/db/queries/media';
import { getSeasonDungeon } from '@/core/db/queries/season';
import { decodeStats } from '@/core/gear/stat-pair';
import type { Services } from '../services';
import type { DungeonBossView, DungeonPageView } from './types';

/** One season dungeon with its bosses and their loot, or null when the stored season doesn't list it. */
export async function getDungeonPage(services: Services, challengeModeId: number): Promise<DungeonPageView | null> {
  const found = await getSeasonDungeon(services.db, challengeModeId);
  if (!found) return null;
  const { dungeon, split, loot } = found;
  const icons = await getItemIcons(services.db, loot.map((l) => l.itemId));
  const bosses = new Map<number, DungeonBossView>();
  for (const l of loot) {
    const boss = bosses.get(l.encounterId) ?? { encounterId: l.encounterId, name: l.encounterName, items: [] };
    bosses.set(l.encounterId, boss);
    const stats = decodeStats(l.secondaryStats ?? null);
    boss.items.push({
      itemId: l.itemId, name: l.itemName, quality: l.quality ?? 'EPIC', iconUrl: icons.get(l.itemId) ?? null,
      inventoryType: l.inventoryType, armorType: l.armorType, stats: stats && stats.length > 0 ? stats : null,
    });
  }
  return { challengeModeId: dungeon.challengeModeId, name: dungeon.name, shortName: dungeon.shortName, imageUrl: dungeon.imageUrl, split, bosses: [...bosses.values()] };
}
