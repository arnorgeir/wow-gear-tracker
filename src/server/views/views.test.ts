import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { getCharacterCards } from './character-cards';
import { getCharacterPage } from './character-page';
import type { Services } from '../services';
import { gearToSnapshotItems, saveSnapshotIfChanged } from '@/core/db/queries/snapshots';
import { insertCharacter, updateCharacter } from '@/core/db/queries/characters';
import { replaceSeason } from '@/core/db/queries/season';
import { setMeta } from '@/core/db/queries/meta';
import { SEASON_META_KEY } from '@/core/sync/season-sync';
import type { BisLists, GearItem, Track } from '@/core/types';
import type { BlizzardClient } from '@/core/blizzard/client';

const lists: BisLists = {
  overall: [],
  raid: [],
  mythicPlus: [
    { kind: 'item', slotLabel: 'Head', slots: ['HEAD'], itemId: 10, name: 'Tier Catalyst Helm', bonusIds: [], isTier: true, isCatalyst: true, source: 'Dungeon A' },
    { kind: 'item', slotLabel: 'Neck', slots: ['NECK'], itemId: 20, name: 'Best Neck', bonusIds: [1], isTier: false, isCatalyst: false, source: 'Dungeon B' },
  ],
};
const HERO_ICON = 'https://wow.zamimg.com/images/wow/icons/medium/inv_121_crest_hero.jpg';
const tracks: Track[] = [
  { bonusId: 99, name: 'Hero', step: 5, max: 6, group: 617, currencyId: null, currencyName: null, costPerStep: null },
  { bonusId: 98, name: 'Hero', step: 6, max: 6, group: 617, currencyId: 3445, currencyName: 'Hero Mistcrest', currencyIcon: 'inv_121_crest_hero', costPerStep: 20 },
];
const gear: GearItem[] = [
  { slot: 'HEAD', itemId: 11, name: 'Worn Tier Helm', itemLevel: 321, quality: 'EPIC', bonusIds: [], isTier: true },
  { slot: 'NECK', itemId: 20, name: 'Best Neck', itemLevel: 318, quality: 'EPIC', bonusIds: [99], isTier: false },
];

async function services(bisLists: BisLists = lists): Promise<Services> {
  const db = await openTestDb();
  const blizzard = {
    getItemIconUrl: async (_r: string, id: number) => `https://i/${id}.jpg`,
    getClasses: async () => [{ id: 11, name: 'Druid', specs: ['Balance', 'Feral', 'Guardian', 'Restoration'] }],
    getClassIconUrl: async (_r: string, id: number) => `https://i/class-${id}.jpg`,
  } as unknown as BlizzardClient;
  return {
    db, blizzard,
    bisSource: { name: 'Fake', fetchLists: async () => bisLists },
    fetchRaidbots: async () => ({ tracks, qualities: [] }),
    syncer: { sync: async () => 'skipped' },
    now: () => 1000,
    fetchFn: fetch,
  };
}

async function seed(s: Services, withGear = true) {
  const { id } = await insertCharacter(s.db, { region: 'eu', realmId: 1, realmSlug: 'test-realm', realmName: 'Test Realm', name: 'Birkibjörn', className: 'Druid', specName: 'Guardian' }, 1);
  if (withGear) await saveSnapshotIfChanged(s.db, id, 'blizzard', gearToSnapshotItems(gear), 500);
  return id;
}

describe('getCharacterPage', () => {
  it('builds rows with states, tracks and icons for the priority list', async () => {
    const s = await services();
    const id = await seed(s);
    const page = await getCharacterPage(s, id);
    expect(page).toMatchObject({ listType: 'mythicPlus', spec: 'Guardian', specSlug: 'guardian-druid', specs: ['Balance', 'Feral', 'Guardian', 'Restoration'] });
    expect(page!.rows.map((r) => r.state)).toEqual(['done', 'belowMyth']);
    expect(page!.rows[1]!.equipped).toMatchObject({ name: 'Best Neck', trackLabel: 'Hero 5/6', iconUrl: 'https://i/20.jpg' });
    expect(page!.rows[0]!.bis).toMatchObject({ itemId: 10, iconUrl: 'https://i/10.jpg', isTier: true });
    expect(page!.vault.map((r) => r.slot)).toEqual(['NECK']);
    expect(page!.counts.mythicPlus).toEqual({ bis: 2, total: 2 });
  });

  it('shows every row as missing before the first sync', async () => {
    const s = await services();
    const id = await seed(s, false);
    const page = await getCharacterPage(s, id);
    expect(page!.snapshot).toBeNull();
    expect(page!.rows.every((r) => r.state === 'missing' && r.equipped === null)).toBe(true);
  });

  it('flags missing track data instead of marking matched items done', async () => {
    const s = await services();
    s.fetchRaidbots = async () => { throw new Error('down'); };
    const id = await seed(s);
    const page = await getCharacterPage(s, id);
    expect(page!.tracksError).toMatch(/Upgrade track data/);
    const [card] = await getCharacterCards(s);
    expect(card!.tracksError).toMatch(/Upgrade track data/);
  });

  it('returns null for an unknown character', async () => {
    expect(await getCharacterPage(await services(), 404)).toBeNull();
  });
});

describe('getCharacterCards', () => {
  it('counts states on each character’s priority list', async () => {
    const s = await services();
    await seed(s);
    const [card] = await getCharacterCards(s);
    expect(card).toMatchObject({ name: 'Birkibjörn', realmId: 1, total: 2, bisError: null, snapshot: { source: 'blizzard', createdAt: 500 } });
    expect(card!.counts).toMatchObject({ done: 1, belowMyth: 1, missing: 0 });
  });
});

describe('SimC data', () => {
  const withBelt: BisLists = {
    ...lists,
    mythicPlus: [...lists.mythicPlus, { kind: 'item', slotLabel: 'Belt', slots: ['WAIST'], itemId: 30, name: 'Best Belt', bonusIds: [], isTier: false, isCatalyst: false, source: 'Dungeon C' }],
  };
  const pasted = [
    ...gearToSnapshotItems(gear),
    { location: 'bag' as const, slot: 'WAIST', itemId: 30, name: 'Best Belt', itemLevel: 300, quality: 'EPIC' as const, bonusIds: [], isTier: false },
    { location: 'vault' as const, slot: 'NECK', itemId: 20, name: 'Best Neck', itemLevel: 330, quality: 'EPIC' as const, bonusIds: [], isTier: false },
    { location: 'vault' as const, slot: 'BACK', itemId: 77, name: 'Other Cloak', itemLevel: 330, quality: 'EPIC' as const, bonusIds: [], isTier: false },
  ];
  const crests = [{ kind: 'upgrade' as const, currencyId: 3445, quantity: 45 }];

  it('shows bag BiS items, crests, upgrade flags and vault choices from a paste', async () => {
    const s = await services(withBelt);
    const id = await seed(s);
    await saveSnapshotIfChanged(s.db, id, 'simc', pasted, 900, crests);

    const page = await getCharacterPage(s, id);
    expect(page!.sourceAt).toBe(900);
    expect(page!.rows.map((r) => r.state)).toEqual(['done', 'belowMyth', 'inBags']);
    expect(page!.rows[0]!.upgrade).toBeNull();
    expect(page!.rows[1]!.upgrade).toEqual({ steps: 1, currencyId: 3445, currencyName: 'Hero Mistcrest', costPerStep: 20, iconUrl: HERO_ICON });
    expect(page!.crests).toEqual({ balances: [{ currencyId: 3445, name: 'Hero Mistcrest', quantity: 45, steps: 2, iconUrl: HERO_ICON }], pastedAt: 900 });
    expect(page!.vaultChoices.map((v) => [v.itemId, v.isBis])).toEqual([[20, true], [77, false]]);
    expect(page!.vaultChoicesAt).toBe(900);

    const [card] = await getCharacterCards(s);
    expect(card).toMatchObject({ upgradesReady: 1, crests: { pastedAt: 900 }, sourceAt: 900 });
  });

  it('keeps crests from the last paste after Blizzard takes over, but forgets the bags', async () => {
    const s = await services(withBelt);
    const id = await seed(s);
    await saveSnapshotIfChanged(s.db, id, 'simc', pasted, 900, crests);
    const upgraded = gear.map((g) => (g.slot === 'NECK' ? { ...g, itemLevel: 330 } : g));
    await saveSnapshotIfChanged(s.db, id, 'blizzard', gearToSnapshotItems(upgraded), 950);

    const page = await getCharacterPage(s, id);
    expect(page!.snapshot?.source).toBe('blizzard');
    expect(page!.rows[2]!.state).toBe('missing');
    expect(page!.crests?.pastedAt).toBe(900);
    expect(page!.vaultChoices).toHaveLength(2);
  });

  it('shows no crests or vault choices without a paste', async () => {
    const s = await services();
    const id = await seed(s);
    const page = await getCharacterPage(s, id);
    expect(page).toMatchObject({ crests: null, vaultChoices: [], vaultChoicesAt: null });
    expect(page!.rows.every((r) => r.upgrade === null)).toBe(true);
  });
});

describe('any rows on the character page', () => {
  it('shows an any card, and counts a vault choice at its item level as BiS', async () => {
    const anyLists: BisLists = { overall: [], raid: [], mythicPlus: [{ kind: 'any', slotLabel: 'Shoulders', slots: ['SHOULDER'], minItemLevel: 334, source: '' }] };
    const s = await services(anyLists);
    const id = await seed(s, false);
    await saveSnapshotIfChanged(s.db, id, 'simc', [
      { location: 'equipped', slot: 'SHOULDER', itemId: 70, name: 'Worn Mantle', itemLevel: 321, quality: 'EPIC', bonusIds: [], isTier: false },
      { location: 'vault', slot: 'SHOULDER', itemId: 71, name: 'Vault Mantle', itemLevel: 334, quality: 'EPIC', bonusIds: [], isTier: false },
      { location: 'vault', slot: 'SHOULDER', itemId: 72, name: 'Low Mantle', itemLevel: 320, quality: 'EPIC', bonusIds: [], isTier: false },
    ], 500);
    const page = await getCharacterPage(s, id);
    expect(page!.rows[0]).toMatchObject({ state: 'missing', bis: { kind: 'any', minItemLevel: 334, source: '' } });
    expect(page!.vaultChoices.map((c) => [c.itemId, c.isBis])).toEqual([[71, true], [72, false]]);
  });
});

describe('dungeon priority', () => {
  const needs: BisLists = {
    overall: [],
    raid: [],
    mythicPlus: [{ kind: 'item', slotLabel: 'Cloak', slots: ['BACK'], itemId: 30, name: 'Cloak of the Hollow', bonusIds: [], isTier: false, isCatalyst: false, source: 'Alpha Hollow' }],
  };

  async function withSeason(s: Services) {
    await replaceSeason(s.db, {
      slug: 'season-test-2',
      dungeons: [
        { challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', journalInstanceId: 901, mapId: 11, imageUrl: null },
        { challengeModeId: 502, name: 'Beta Spire', shortName: 'BS', journalInstanceId: 902, mapId: 22, imageUrl: null },
      ],
      loot: [{ challengeModeId: 501, encounterId: 1, encounterName: 'Hollow King', itemId: 30, itemName: 'Cloak of the Hollow', inventoryType: 'CLOAK', armorType: 'cloth' }],
    });
    await setMeta(s.db, SEASON_META_KEY, 'season-test-2', 1000);
  }

  it('ranks the season for the priority list, with credited items and the rest listed apart', async () => {
    const s = await services(needs);
    const id = await seed(s);
    await withSeason(s);
    const page = await getCharacterPage(s, id);
    expect(page!.priority).toMatchObject({ listType: 'mythicPlus', fellBack: false, season: 'ready', needsSync: false, approximate: false, nothingFrom: ['Beta Spire'] });
    expect(page!.priority.dungeons).toEqual([{
      challengeModeId: 501, name: 'Alpha Hollow', score: 3, split: false,
      credits: [{ kind: 'item', slotLabel: 'Cloak', weight: 3, item: expect.objectContaining({ itemId: 30, iconUrl: 'https://i/30.jpg' }) }],
    }]);
  });

  it('credits a tier need with the tier piece and its icon', async () => {
    const tierNeeds: BisLists = {
      overall: [], raid: [],
      mythicPlus: [{ kind: 'item', slotLabel: 'Chest', slots: ['CHEST'], itemId: 12, name: 'Tier Catalyst Robe', bonusIds: [], isTier: true, isCatalyst: true, source: 'Alpha Hollow' }],
    };
    const s = await services(tierNeeds);
    const id = await seed(s);
    await replaceSeason(s.db, {
      slug: 'season-test-2',
      dungeons: [{ challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', journalInstanceId: 901, mapId: 11, imageUrl: null }],
      loot: [{ challengeModeId: 501, encounterId: 1, encounterName: 'Hollow King', itemId: 40, itemName: 'Hollow Jerkin', inventoryType: 'CHEST', armorType: 'leather' }],
    });
    await setMeta(s.db, SEASON_META_KEY, 'season-test-2', 1000);
    const page = await getCharacterPage(s, id);
    expect(page!.priority.dungeons[0]!.credits).toEqual([
      { kind: 'tier', slotLabel: 'Chest', weight: expect.any(Number), item: expect.objectContaining({ itemId: 12, name: 'Tier Catalyst Robe', iconUrl: 'https://i/12.jpg' }) },
    ]);
  });

  it('asks for a sync and says loading before any season is stored', async () => {
    const s = await services(needs);
    const id = await seed(s);
    const page = await getCharacterPage(s, id);
    expect(page!.priority).toMatchObject({ season: 'loading', needsSync: true, dungeons: [], nothingFrom: [] });
  });

  it('falls back to Overall when the spec has no Mythic+ list', async () => {
    const s = await services({ overall: needs.mythicPlus, raid: [], mythicPlus: [] });
    const id = await seed(s);
    await withSeason(s);
    const page = await getCharacterPage(s, id);
    expect(page!.priority).toMatchObject({ listType: 'overall', fellBack: true });
    expect(page!.priority.dungeons.map((d) => d.name)).toEqual(['Alpha Hollow']);
  });
});

describe('identity', () => {
  it('shows race, spec and class, the avatar and the class icon', async () => {
    const s = await services();
    const id = await seed(s);
    let page = await getCharacterPage(s, id);
    expect(page).toMatchObject({ identity: 'Guardian Druid', race: null, faction: null, avatarUrl: null, classIconUrl: 'https://i/class-11.jpg' });

    await updateCharacter(s.db, id, { race: 'Troll', faction: 'HORDE', avatarUrl: 'https://render/a.jpg', specOverride: 'Feral' });
    page = await getCharacterPage(s, id);
    expect(page).toMatchObject({ identity: 'Troll Feral Druid', faction: 'HORDE', avatarUrl: 'https://render/a.jpg' });

    const [card] = await getCharacterCards(s);
    expect(card).toMatchObject({ identity: 'Troll Feral Druid', avatarUrl: 'https://render/a.jpg', classIconUrl: 'https://i/class-11.jpg' });
  });
});
