import { getItemIcons } from '@/core/db/queries/media';
import { getSeasonDungeon } from '@/core/db/queries/season';
import { decodeStats } from '@/core/gear/stat-pair';
import { parseJournalText, spellIndex } from '@/core/journal/markup';
import type { JournalSection } from '@/core/types';
import type { Services } from '../services';
import { loadLootNeeds, type LootLens } from './dungeon-loot-needs';
import type { AbilityView, BossTacticsView, DungeonBossView, DungeonPageView } from './types';

function tacticsOf(found: { description: string | null; sections: JournalSection[] } | undefined): BossTacticsView | null {
  if (!found || (!found.description && found.sections.length === 0)) return null;
  const spells = spellIndex(found.sections);
  const blocks = (text: string | null) => (text ? parseJournalText(text, spells) : []);
  const ability = (s: JournalSection): AbilityView => ({ name: s.title, spellId: s.spellId, blocks: blocks(s.bodyText), abilities: s.sections.map(ability) });
  const [first, ...rest] = found.sections;
  const hasOverview = first !== undefined && first.spellId === null && !!first.bodyText;
  return {
    description: found.description,
    overview: hasOverview ? blocks(first.bodyText) : [],
    roles: hasOverview ? first.sections.map((r) => ({ title: r.title, blocks: blocks(r.bodyText) })) : [],
    abilities: (hasOverview ? rest : found.sections).map(ability),
  };
}

/** One season dungeon with its bosses and their loot, or null when the stored season doesn't list it. */
export async function getDungeonPage(services: Services, challengeModeId: number, lens: LootLens = {}): Promise<DungeonPageView | null> {
  const found = await getSeasonDungeon(services.db, challengeModeId);
  if (!found) return null;
  const { dungeon, split, loot, encounters } = found;
  const icons = await getItemIcons(services.db, loot.map((l) => l.itemId));
  const lootItems = loot.map((l) => ({ itemId: l.itemId, name: l.itemName, inventoryType: l.inventoryType, armorType: l.armorType, secondaryStats: decodeStats(l.secondaryStats ?? null) }));
  const { needs, bis, coverage, lens: shownLens } = await loadLootNeeds(services, lootItems, lens);
  const bosses = new Map<number, DungeonBossView>();
  for (const l of loot) {
    const boss = bosses.get(l.encounterId) ?? { encounterId: l.encounterId, name: l.encounterName, items: [], tactics: tacticsOf(encounters.get(l.encounterId)), neededCount: 0 };
    bosses.set(l.encounterId, boss);
    const stats = decodeStats(l.secondaryStats ?? null);
    boss.items.push({
      itemId: l.itemId, name: l.itemName,
      // Stored quality is the catalog's base one; every season drop reaches epic in Mythic+, as the Wowhead tooltip shows.
      quality: 'EPIC', iconUrl: icons.get(l.itemId) ?? null,
      inventoryType: l.inventoryType, armorType: l.armorType, stats: stats && stats.length > 0 ? stats : null,
      neededBy: needs.get(l.itemId) ?? [], bisFor: bis.get(l.itemId) ?? [],
    });
    if (needs.has(l.itemId)) boss.neededCount++;
  }
  return { challengeModeId: dungeon.challengeModeId, name: dungeon.name, shortName: dungeon.shortName, imageUrl: dungeon.imageUrl, split, bosses: [...bosses.values()], neededCount: [...bosses.values()].reduce((n, b) => n + b.neededCount, 0), coverage, lens: shownLens };
}
