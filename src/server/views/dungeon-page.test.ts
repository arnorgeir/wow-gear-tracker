import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { replaceSeason, type DungeonLootRow, type EncounterRow } from '@/core/db/queries/season';
import { upsertItemIcons } from '@/core/db/queries/media';
import type { JournalSection } from '@/core/types';
import type { Services } from '../services';
import { getDungeonPage } from './dungeon-page';

const loot = (encounterId: number, encounterName: string, itemId: number, extra: Partial<DungeonLootRow> = {}): DungeonLootRow =>
  ({ challengeModeId: 501, encounterId, encounterName, itemId, itemName: `Item ${itemId}`, inventoryType: 'WRIST', armorType: 'leather', ...extra });

async function setup(rows: DungeonLootRow[], encounters?: EncounterRow[]) {
  const db = await openTestDb();
  await replaceSeason(db, {
    slug: 'season-test',
    dungeons: [
      { challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', journalInstanceId: 901, mapId: 11, imageUrl: 'https://cdn.raiderio.net/images/dungeons/alpha-hollow.jpg' },
      { challengeModeId: 502, name: 'Streets of Beta', shortName: 'SB', journalInstanceId: 902, mapId: 22, imageUrl: null },
      { challengeModeId: 503, name: 'Gambit of Beta', shortName: 'GB', journalInstanceId: 902, mapId: 23, imageUrl: null },
    ],
    loot: rows,
    encounters,
  });
  return { db } as unknown as Services;
}

const node = (title: string, spellId: number | null, bodyText: string | null, sections: JournalSection[] = []): JournalSection => ({ title, spellId, bodyText, sections });

describe('getDungeonPage tactics', () => {
  const tactics = async (sections: JournalSection[], description: string | null = 'Lore.') => {
    const s = await setup([loot(1, 'Boss', 1)], [{ encounterId: 1, name: 'Boss', description, sections }]);
    return (await getDungeonPage(s, 501))!.bosses[0]!.tactics;
  };

  it('splits the overview and roles from the abilities, nesting child abilities', async () => {
    const t = await tactics([
      node('Overview', null, 'Watch the [Void Fissures].', [node('Tanks', null, '$bullet;Face away.'), node('Healers', null, 'Top people up.')]),
      node('Umbral Rupture', 11, 'Cracks open.', [node('Void Fissure', 12, null)]),
    ]);
    expect(t).toEqual({
      description: 'Lore.',
      overview: [{ kind: 'paragraph', parts: [{ text: 'Watch the ' }, { spell: 'Void Fissures', spellId: 12 }, { text: '.' }] }],
      roles: [
        { title: 'Tanks', blocks: [{ kind: 'list', items: [[{ text: 'Face away.' }]] }] },
        { title: 'Healers', blocks: [{ kind: 'paragraph', parts: [{ text: 'Top people up.' }] }] },
      ],
      abilities: [{ name: 'Umbral Rupture', spellId: 11, blocks: [{ kind: 'paragraph', parts: [{ text: 'Cracks open.' }] }],
        abilities: [{ name: 'Void Fissure', spellId: 12, blocks: [], abilities: [] }] }],
    });
  });

  it('treats a first section without text, or with a spell, as an ability group', async () => {
    const t = await tactics([node('Ethereal Shade', null, null, [node('Shade Bolt', 5, 'Hurts.')]), node('Slam', 6, 'Hits.')]);
    expect(t!.overview).toEqual([]);
    expect(t!.roles).toEqual([]);
    expect(t!.abilities.map((a) => [a.name, a.abilities.map((c) => c.name)])).toEqual([['Ethereal Shade', ['Shade Bolt']], ['Slam', []]]);
    const spell = await tactics([node('Slam', 6, 'Hits.')]);
    expect(spell!.overview).toEqual([]);
    expect(spell!.abilities).toHaveLength(1);
  });

  it('is null without a stored row or with an empty one', async () => {
    expect((await getDungeonPage(await setup([loot(1, 'Boss', 1)]), 501))!.bosses[0]!.tactics).toBeNull();
    expect(await tactics([], null)).toBeNull();
    expect(await tactics([], 'Lore only.')).toMatchObject({ description: 'Lore only.', abilities: [] });
  });
});

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
