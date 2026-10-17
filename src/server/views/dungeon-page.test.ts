import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { replaceSeason, type DungeonLootRow, type EncounterRow } from '@/core/db/queries/season';
import { upsertItemIcons } from '@/core/db/queries/media';
import type { JournalSection } from '@/core/types';
import type { Services } from '../services';
import { insertCharacter, updateCharacter } from '@/core/db/queries/characters';
import { replaceBisLists } from '@/core/db/queries/bis-lists';
import { updateSpecSettings } from '@/core/db/queries/bis-settings';
import { replaceSpecs } from '@/core/db/queries/specs';
import { gearToSnapshotItems, saveSnapshotIfChanged } from '@/core/db/queries/snapshots';
import type { BisLists, BisRow, GearItem } from '@/core/types';
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
  return { db, now: () => 10_000_000, currentAccountId: () => 1 } as unknown as Services;
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

  it('shows every drop as epic, the best it reaches in Mythic+, and carries cached icons, null when not cached', async () => {
    const s = await setup([loot(1, 'Boss', 1, { quality: 'RARE' }), loot(1, 'Boss', 2)]);
    await upsertItemIcons(s.db, [{ itemId: 1, iconUrl: 'https://i/1.jpg' }], 1);
    const [a, b] = (await getDungeonPage(s, 501))!.bosses[0]!.items;
    expect([a!.quality, a!.iconUrl, b!.quality, b!.iconUrl]).toEqual(['EPIC', 'https://i/1.jpg', 'EPIC', null]);
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

const ring = (itemId: number): BisRow => ({ kind: 'item', slotLabel: 'Ring', slots: ['FINGER_1', 'FINGER_2'], itemId, name: `Item ${itemId}`, bonusIds: [], isTier: false, isCatalyst: false, source: 'Alpha Hollow' });
const worn = (slot: GearItem['slot'], itemId: number): GearItem => ({ slot, itemId, name: `Worn ${itemId}`, itemLevel: 300, quality: 'EPIC', bonusIds: [], isTier: false });
const lists = (overall: BisRow[], mythicPlus: BisRow[] = []): BisLists => ({ overall, raid: [], mythicPlus });

async function track(s: Services, name: string, className: string, specName: string, gear: GearItem[] | null) {
  const { id } = await insertCharacter(s.db, { region: 'eu', realmId: 1, realmSlug: 'argent-dawn', realmName: 'Argent Dawn', name, className, specName }, 1);
  if (gear) {
    await saveSnapshotIfChanged(s.db, id, 'blizzard', gearToSnapshotItems(gear), 500);
    await updateCharacter(s.db, id, { lastSyncedAt: s.now() });
  }
}

const drops = [
  loot(1, 'Boss One', 41, { inventoryType: 'FINGER', armorType: null }),
  loot(1, 'Boss One', 70, { inventoryType: 'TWOHWEAPON', armorType: null }),
  loot(2, 'Boss Two', 61, { inventoryType: 'HOLDABLE', armorType: null }),
];
const neededNames = (view: Awaited<ReturnType<typeof getDungeonPage>>) => view!.bosses.flatMap((b) => b.items.map((i) => [i.itemId, i.neededBy.map((n) => n.name)] as const));

describe('getDungeonPage needs', () => {
  it('lists who needs each drop, counts them per boss and dungeon, and covers the roster', async () => {
    const s = await setup(drops);
    await replaceBisLists(s.db, 'method', 'guardian-druid', lists([], [ring(40), ring(41)]), 1);
    await track(s, 'Birkibjörn', 'Druid', 'Guardian', [worn('FINGER_1', 42), worn('FINGER_2', 40)]);
    const view = await getDungeonPage(s, 501);
    expect(neededNames(view)).toEqual([[41, ['Birkibjörn']], [70, []], [61, []]]);
    expect(view!.bosses[0]!.items[0]!.neededBy[0]).toMatchObject({ key: 'eu.argent-dawn.birkibjörn', className: 'Druid', slotLabel: 'Ring', via: 'drop', reason: 'missing' });
    expect(view!.bosses.map((b) => b.neededCount)).toEqual([1, 0]);
    expect(view).toMatchObject({ neededCount: 1, coverage: { evaluated: 1, excluded: [] }, lens: { who: 'all', groupRemembered: false } });
  });

  it('shows no needs for a roster that has everything', async () => {
    const s = await setup(drops);
    await replaceBisLists(s.db, 'method', 'guardian-druid', lists([], [ring(40), ring(41)]), 1);
    await track(s, 'Birkibjörn', 'Druid', 'Guardian', [worn('FINGER_1', 41), worn('FINGER_2', 40)]);
    const view = await getDungeonPage(s, 501);
    expect(neededNames(view).every(([, who]) => who.length === 0)).toBe(true);
    expect(view).toMatchObject({ neededCount: 0, coverage: { evaluated: 1, excluded: [] } });
  });

  it('checks the characters it can and names the rest with a reason', async () => {
    const s = await setup(drops);
    await replaceBisLists(s.db, 'method', 'guardian-druid', lists([], [ring(40), ring(41)]), 1);
    await track(s, 'Birkibjörn', 'Druid', 'Guardian', [worn('FINGER_1', 42), worn('FINGER_2', 40)]);
    await track(s, 'Sólrún', 'Druid', 'Guardian', null);
    const view = await getDungeonPage(s, 501);
    expect(view!.coverage).toEqual({ evaluated: 1, excluded: [{ name: 'Sólrún', reason: 'syncing' }] });
    expect(neededNames(view)[0]).toEqual([41, ['Birkibjörn']]);
  });

  it('evaluates nobody when every character is left out, or none is tracked', async () => {
    const s = await setup(drops);
    await track(s, 'Sólrún', 'Druid', 'Guardian', null);
    const view = await getDungeonPage(s, 501);
    expect(view).toMatchObject({ neededCount: 0, coverage: { evaluated: 0, excluded: [{ name: 'Sólrún', reason: 'syncing' }] } });
    expect(neededNames(view).every(([, who]) => who.length === 0)).toBe(true);
    expect((await getDungeonPage(await setup(drops), 501))!.coverage).toEqual({ evaluated: 0, excluded: [] });
  });
});

describe('getDungeonPage BiS for', () => {
  const specs = [
    { methodSlug: 'guardian-druid', classId: 11, className: 'Druid', specName: 'Guardian', iconUrl: 'https://render/guardian.jpg' },
    { methodSlug: 'feral-druid', classId: 11, className: 'Druid', specName: 'Feral', iconUrl: null },
    { methodSlug: 'protection-warrior', classId: 1, className: 'Warrior', specName: 'Protection', iconUrl: null },
    { methodSlug: 'balance-druid', classId: 11, className: 'Druid', specName: 'Balance', iconUrl: null },
  ];

  it('names the specs whose stored list holds the drop, falling back to Overall, ordered by class then spec', async () => {
    const s = await setup(drops);
    await replaceSpecs(s.db, specs, 1);
    await replaceBisLists(s.db, 'method', 'guardian-druid', lists([ring(41)]), 1);
    await replaceBisLists(s.db, 'method', 'feral-druid', lists([ring(41)]), 1);
    await replaceBisLists(s.db, 'method', 'protection-warrior', lists([{ ...ring(70), slots: ['MAIN_HAND'], slotLabel: 'Main Hand' }]), 1);
    await updateSpecSettings(s.db, 1, 'protection-warrior', { listType: 'raid' });
    const view = await getDungeonPage(s, 501);
    const [a, b] = view!.bosses[0]!.items;
    expect(a!.bisFor).toEqual([
      { slug: 'feral-druid', label: 'Feral Druid', className: 'Druid', iconUrl: null },
      { slug: 'guardian-druid', label: 'Guardian Druid', className: 'Druid', iconUrl: 'https://render/guardian.jpg' },
    ]);
    expect(b!.bisFor.map((x) => x.slug)).toEqual(['protection-warrior']);
    expect(view!.bosses[1]!.items[0]!.bisFor).toEqual([]);
  });

  it('uses the tracked specs when the spec catalog is not loaded', async () => {
    const s = await setup(drops);
    await replaceBisLists(s.db, 'method', 'guardian-druid', lists([ring(41)]), 1);
    await track(s, 'Birkibjörn', 'Druid', 'Guardian', [worn('FINGER_1', 41)]);
    expect((await getDungeonPage(s, 501))!.bosses[0]!.items[0]!.bisFor).toMatchObject([{ slug: 'guardian-druid', label: 'Guardian Druid' }]);
  });
});

describe('getDungeonPage lens', () => {
  const cookie = encodeURIComponent('eu.argent-dawn.birkibjörn');
  async function roster() {
    const s = await setup(drops);
    await replaceBisLists(s.db, 'method', 'guardian-druid', lists([], [ring(40), ring(41)]), 1);
    await track(s, 'Birkibjörn', 'Druid', 'Guardian', [worn('FINGER_1', 42), worn('FINGER_2', 40)]);
    await track(s, 'Sólrún', 'Druid', 'Guardian', [worn('FINGER_1', 42), worn('FINGER_2', 40)]);
    return s;
  }

  it('limits needs, coverage and counts to the remembered group', async () => {
    const view = await getDungeonPage(await roster(), 501, { who: 'group', groupCookie: cookie });
    expect(neededNames(view)[0]).toEqual([41, ['Birkibjörn']]);
    expect(view).toMatchObject({ coverage: { evaluated: 1, excluded: [] }, lens: { who: 'group', groupRemembered: true } });
  });

  it('names a remembered member the app does not track', async () => {
    const view = await getDungeonPage(await roster(), 501, { who: 'group', groupCookie: encodeURIComponent('eu.argent-dawn.birkibjörn,eu.argent-dawn.fenrir') });
    expect(view!.coverage).toEqual({ evaluated: 1, excluded: [{ name: 'fenrir', reason: 'not tracked' }] });
  });

  it('shows everyone when the group lens is asked for without a remembered group', async () => {
    const view = await getDungeonPage(await roster(), 501, { who: 'group' });
    expect(neededNames(view)[0]).toEqual([41, ['Birkibjörn', 'Sólrún']]);
    expect(view!.lens).toEqual({ who: 'all', groupRemembered: false });
  });

  it('keeps the remembered group known while showing everyone', async () => {
    const view = await getDungeonPage(await roster(), 501, { who: 'all', groupCookie: cookie });
    expect(neededNames(view)[0]).toEqual([41, ['Birkibjörn', 'Sólrún']]);
    expect(view!.lens).toEqual({ who: 'all', groupRemembered: true });
  });
});
