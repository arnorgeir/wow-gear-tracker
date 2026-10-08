import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { getCharacterCards } from './character-cards';
import { getCharacterPage } from './character-page';
import type { Services } from '../services';
import { upgradeFor } from './summarize';
import { creditView, rowView } from './member';
import type { GearRow } from '@/core/gear/evaluate';
import { gearToSnapshotItems, saveSnapshotIfChanged } from '@/core/db/queries/snapshots';
import { insertCharacter, updateCharacter } from '@/core/db/queries/characters';
import { replaceSeason } from '@/core/db/queries/season';
import { setMeta } from '@/core/db/queries/meta';
import { SEASON_META_KEY } from '@/core/sync/season-sync';
import { syncReference } from '@/core/sync/reference-run';
import { DAY_MS, syncBisLists, syncTracks } from '@/core/sync/reference-sync';
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
    getItemDetails: async () => null,
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

/** Fills the reference cache the way the background sync would. */
const prime = (s: Services) =>
  syncReference({ db: s.db, bisSource: s.bisSource, fetchRaidbots: s.fetchRaidbots, blizzard: s.blizzard, now: s.now() });

describe('getCharacterPage', () => {
  it('builds rows with states, tracks and icons for the priority list', async () => {
    const s = await services();
    const id = await seed(s);
    await prime(s);
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
    await prime(s);
    const page = await getCharacterPage(s, id);
    expect(page!.snapshot).toBeNull();
    expect(page!.rows.every((r) => r.state === 'missing' && r.equipped === null)).toBe(true);
  });

  it('flags missing track data instead of marking matched items done', async () => {
    const s = await services();
    s.fetchRaidbots = async () => { throw new Error('down'); };
    const id = await seed(s);
    await prime(s);
    const page = await getCharacterPage(s, id);
    expect(page!.tracksError).toMatch(/Upgrade track data/);
    await prime(s);
    const { cards: [card] } = await getCharacterCards(s);
    expect(card!.tracksError).toMatch(/Upgrade track data/);
  });

  it('leaves a tier piece with the wrong stats out of the BiS count', async () => {
    const s = await services();
    Object.assign(s.blizzard, { getItemDetails: async () => ({ quality: 'EPIC', isTier: false, inventoryType: 'HEAD', armorType: 'leather', secondaryStats: ['HASTE_RATING', 'MASTERY_RATING'] }) });
    const { id } = await insertCharacter(s.db, { region: 'eu', realmId: 1, realmSlug: 'test-realm', realmName: 'Test Realm', name: 'Birkibjörn', className: 'Druid', specName: 'Guardian' }, 1);
    const wrong = gear.map((g) => (g.slot === 'HEAD' ? { ...g, secondaryStats: ['CRIT_RATING', 'MASTERY_RATING'] } : g));
    await saveSnapshotIfChanged(s.db, id, 'blizzard', gearToSnapshotItems(wrong), 500);
    await prime(s);
    const page = await getCharacterPage(s, id);
    expect(page!.rows[0]).toMatchObject({ state: 'wrongStats', equippedStats: ['CRIT_RATING', 'MASTERY_RATING'], bis: { targetStats: ['HASTE_RATING', 'MASTERY_RATING'] } });
    expect(page!.counts.mythicPlus).toEqual({ bis: 1, total: 2 });
  });

  it('borrows a pasted piece’s stats from the Blizzard snapshot of the same piece', async () => {
    const s = await services();
    Object.assign(s.blizzard, { getItemDetails: async () => ({ quality: 'EPIC', isTier: false, inventoryType: 'HEAD', armorType: 'leather', secondaryStats: ['HASTE_RATING', 'MASTERY_RATING'] }) });
    const { id } = await insertCharacter(s.db, { region: 'eu', realmId: 1, realmSlug: 'test-realm', realmName: 'Test Realm', name: 'Birkibjörn', className: 'Druid', specName: 'Guardian' }, 1);
    const wrong = gear.map((g) => (g.slot === 'HEAD' ? { ...g, secondaryStats: ['CRIT_RATING', 'MASTERY_RATING'] } : g));
    await saveSnapshotIfChanged(s.db, id, 'blizzard', gearToSnapshotItems(wrong), 500);
    await saveSnapshotIfChanged(s.db, id, 'simc', gearToSnapshotItems(gear.map((g) => ({ ...g, secondaryStats: null }))), 600);
    await prime(s);
    const page = await getCharacterPage(s, id);
    expect(page!.rows[0]).toMatchObject({ state: 'wrongStats', equippedStats: ['CRIT_RATING', 'MASTERY_RATING'] });
  });

  it('returns null for an unknown character', async () => {
    expect(await getCharacterPage(await services(), 404)).toBeNull();
  });
});

describe('getCharacterCards', () => {
  it('counts states on each character’s priority list', async () => {
    const s = await services();
    await seed(s);
    await prime(s);
    const { cards: [card] } = await getCharacterCards(s);
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
    { location: 'bag' as const, slot: 'WAIST', itemId: 30, name: 'Best Belt', itemLevel: 300, quality: 'EPIC' as const, bonusIds: [], isTier: false, secondaryStats: null },
    { location: 'vault' as const, slot: 'NECK', itemId: 20, name: 'Best Neck', itemLevel: 330, quality: 'EPIC' as const, bonusIds: [], isTier: false, secondaryStats: null },
    { location: 'vault' as const, slot: 'BACK', itemId: 77, name: 'Other Cloak', itemLevel: 330, quality: 'EPIC' as const, bonusIds: [], isTier: false, secondaryStats: null },
  ];
  const crests = [{ kind: 'upgrade' as const, currencyId: 3445, quantity: 45 }];

  it('shows bag BiS items, crests, upgrade flags and vault choices from a paste', async () => {
    const s = await services(withBelt);
    const id = await seed(s);
    await saveSnapshotIfChanged(s.db, id, 'simc', pasted, 900, crests);

    await prime(s);
    const page = await getCharacterPage(s, id);
    expect(page!.sourceAt).toBe(900);
    expect(page!.rows.map((r) => r.state)).toEqual(['done', 'belowMyth', 'inBags']);
    expect(page!.rows[0]!.upgrade).toBeNull();
    expect(page!.rows[1]!.upgrade).toEqual({ steps: 1, currencyId: 3445, currencyName: 'Hero Mistcrest', costPerStep: 20, iconUrl: HERO_ICON });
    expect(page!.crests).toEqual({ balances: [{ currencyId: 3445, name: 'Hero Mistcrest', quantity: 45, steps: 2, iconUrl: HERO_ICON }], pastedAt: 900 });
    expect(page!.vaultChoices.map((v) => [v.itemId, v.isBis])).toEqual([[20, true], [77, false]]);
    expect(page!.vaultChoicesAt).toBe(900);

    await prime(s);
    const { cards: [card] } = await getCharacterCards(s);
    expect(card).toMatchObject({ upgradesReady: 1, crests: { pastedAt: 900 }, sourceAt: 900 });
  });

  it('keeps crests from the last paste after Blizzard takes over, but forgets the bags', async () => {
    const s = await services(withBelt);
    const id = await seed(s);
    await saveSnapshotIfChanged(s.db, id, 'simc', pasted, 900, crests);
    const upgraded = gear.map((g) => (g.slot === 'NECK' ? { ...g, itemLevel: 330 } : g));
    await saveSnapshotIfChanged(s.db, id, 'blizzard', gearToSnapshotItems(upgraded), 950);

    await prime(s);
    const page = await getCharacterPage(s, id);
    expect(page!.snapshot?.source).toBe('blizzard');
    expect(page!.rows[2]!.state).toBe('missing');
    expect(page!.crests?.pastedAt).toBe(900);
    expect(page!.vaultChoices).toHaveLength(2);
  });

  it('shows no crests or vault choices without a paste', async () => {
    const s = await services();
    const id = await seed(s);
    await prime(s);
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
      { location: 'equipped', slot: 'SHOULDER', itemId: 70, name: 'Worn Mantle', itemLevel: 321, quality: 'EPIC', bonusIds: [], isTier: false, secondaryStats: null },
      { location: 'vault', slot: 'SHOULDER', itemId: 71, name: 'Vault Mantle', itemLevel: 334, quality: 'EPIC', bonusIds: [], isTier: false, secondaryStats: null },
      { location: 'vault', slot: 'SHOULDER', itemId: 72, name: 'Low Mantle', itemLevel: 320, quality: 'EPIC', bonusIds: [], isTier: false, secondaryStats: null },
    ], 500);
    await prime(s);
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
    await prime(s);
    const page = await getCharacterPage(s, id);
    expect(page!.priority).toMatchObject({ listType: 'mythicPlus', fellBack: false, season: 'ready', needsSync: false, approximate: false, nothingFrom: ['Beta Spire'] });
    expect(page!.priority.dungeons).toEqual([{
      challengeModeId: 501, name: 'Alpha Hollow', score: 3, split: false,
      credits: [{ kind: 'item', slotLabel: 'Cloak', weight: 3, item: expect.objectContaining({ itemId: 30, iconUrl: 'https://i/30.jpg' }) }],
    }]);
  });

  it('credits a tier need with each dungeon’s own drop and its icon', async () => {
    const tierNeeds: BisLists = {
      overall: [], raid: [],
      mythicPlus: [{ kind: 'item', slotLabel: 'Chest', slots: ['CHEST'], itemId: 12, name: 'Tier Catalyst Robe', bonusIds: [], isTier: true, isCatalyst: true, source: 'Alpha Hollow' }],
    };
    const s = await services(tierNeeds);
    const id = await seed(s);
    await replaceSeason(s.db, {
      slug: 'season-test-2',
      dungeons: [
        { challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', journalInstanceId: 901, mapId: 11, imageUrl: null },
        { challengeModeId: 502, name: 'Beta Spire', shortName: 'BS', journalInstanceId: 902, mapId: 22, imageUrl: null },
      ],
      loot: [
        { challengeModeId: 501, encounterId: 1, encounterName: 'Hollow King', itemId: 40, itemName: 'Hollow Jerkin', inventoryType: 'CHEST', armorType: 'leather' },
        { challengeModeId: 502, encounterId: 2, encounterName: 'Spire Warden', itemId: 41, itemName: 'Spire Vest', inventoryType: 'CHEST', armorType: 'leather' },
      ],
    });
    await setMeta(s.db, SEASON_META_KEY, 'season-test-2', 1000);
    await prime(s);
    const page = await getCharacterPage(s, id);
    const credits = (name: string) => page!.priority.dungeons.find((d) => d.name === name)!.credits;
    expect(credits('Alpha Hollow')).toEqual([{
      kind: 'tier', slotLabel: 'Chest', weight: expect.any(Number), fit: expect.any(String), dropStats: null, targetStats: null,
      item: expect.objectContaining({ itemId: 40, name: 'Hollow Jerkin', iconUrl: 'https://i/40.jpg' }), targetName: 'Tier Catalyst Robe',
    }]);
    expect(credits('Beta Spire')[0]).toMatchObject({ item: { itemId: 41, name: 'Spire Vest', iconUrl: 'https://i/41.jpg' }, targetName: 'Tier Catalyst Robe' });
  });

  it('asks for a sync and says loading before any season is stored', async () => {
    const s = await services(needs);
    const id = await seed(s);
    await prime(s);
    const page = await getCharacterPage(s, id);
    expect(page!.priority).toMatchObject({ season: 'loading', needsSync: true, dungeons: [], nothingFrom: [] });
  });

  it('falls back to Overall when the spec has no Mythic+ list', async () => {
    const s = await services({ overall: needs.mythicPlus, raid: [], mythicPlus: [] });
    const id = await seed(s);
    await withSeason(s);
    await prime(s);
    const page = await getCharacterPage(s, id);
    expect(page!.priority).toMatchObject({ listType: 'overall', fellBack: true });
    expect(page!.priority.dungeons.map((d) => d.name)).toEqual(['Alpha Hollow']);
  });
});

describe('identity', () => {
  it('shows race, spec and class, the avatar and the class icon', async () => {
    const s = await services();
    const id = await seed(s);
    await prime(s);
    let page = await getCharacterPage(s, id);
    expect(page).toMatchObject({ identity: 'Guardian Druid', race: null, faction: null, avatarUrl: null, classIconUrl: 'https://i/class-11.jpg' });

    await updateCharacter(s.db, id, { race: 'Troll', faction: 'HORDE', avatarUrl: 'https://render/a.jpg', specOverride: 'Feral' });
    await prime(s);
    page = await getCharacterPage(s, id);
    expect(page).toMatchObject({ identity: 'Troll Feral Druid', faction: 'HORDE', avatarUrl: 'https://render/a.jpg' });

    await prime(s);
    const { cards: [card] } = await getCharacterCards(s);
    expect(card).toMatchObject({ identity: 'Troll Feral Druid', avatarUrl: 'https://render/a.jpg', classIconUrl: 'https://i/class-11.jpg' });
  });
});

describe('upgradeFor', () => {
  const myth: Track = { bonusId: 1, name: 'Myth', step: 2, max: 6, group: 700, currencyId: 3500, currencyName: 'Myth Crest', costPerStep: 20 };
  const costs = new Map([[700, { group: 700, currencyId: 3500, currencyName: 'Myth Crest', costPerStep: 20, iconUrl: null }]]);
  const balances = new Map([[3500, 50]]);
  const base: GearRow = {
    row: lists.mythicPlus[0]!, slot: 'HEAD', equipped: { ...gear[0]!, bonusIds: [1] }, track: myth, matched: true, stats: 'same', state: 'belowMyth',
  };

  it('offers a crest upgrade on a tier piece with the wrong stats, as on any matched tracked row', () => {
    const below = upgradeFor(base, costs, balances);
    expect(below).toMatchObject({ steps: 2, currencyId: 3500 });
    expect(upgradeFor({ ...base, stats: 'different', state: 'wrongStats' }, costs, balances)).toEqual(below);
  });
});

describe('rowView stat pairs', () => {
  const HM = ['HASTE_RATING', 'MASTERY_RATING'];
  const tierRow: GearRow = {
    row: { kind: 'item', slotLabel: 'Chest', slots: ['CHEST'], itemId: 273785, name: 'Primordial Robe of Rites', bonusIds: [], isTier: true, isCatalyst: false, source: 'Altar of Fangs' },
    slot: 'CHEST', equipped: { slot: 'CHEST', itemId: 271531, name: 'Lunar Raiment', itemLevel: 321, quality: 'EPIC', bonusIds: [], isTier: true, secondaryStats: ['CRIT_RATING', 'MASTERY_RATING'] },
    track: null, matched: true, stats: 'different', state: 'wrongStats',
  };

  it('carries the equipped and target pairs and the tier-token flag', () => {
    const view = rowView(tierRow, new Map(), new Map(), new Map(), new Map([[273785, { secondaryStats: HM, isTier: false }]]));
    expect(view.equippedStats).toEqual(['CRIT_RATING', 'MASTERY_RATING']);
    expect(view.bis).toMatchObject({ kind: 'item', targetStats: HM, targetIsTierPiece: false });
  });

  it('renders without pairs when the target lookup failed', () => {
    const view = rowView({ ...tierRow, stats: 'unknown', state: 'done', equipped: { ...tierRow.equipped!, secondaryStats: null } }, new Map(), new Map(), new Map(), new Map());
    expect(view.equippedStats).toBeNull();
    expect(view.bis).toMatchObject({ targetStats: null, targetIsTierPiece: false });
  });
});

describe('creditView', () => {
  it('shows a tier credit as the dungeon’s drop with its own icon', () => {
    const view = creditView({
      kind: 'tier', slotLabel: 'Chest', weight: 4, fit: 'alternative', itemId: 251147, name: 'Hoarded Harvest Wrap', bonusIds: [],
      dropStats: ['MASTERY_RATING', 'VERSATILITY'], targetName: 'Primordial Robe of Rites', targetStats: ['HASTE_RATING', 'MASTERY_RATING'],
    }, new Map([[251147, 'https://i/251147.jpg']]));
    expect(view).toMatchObject({ kind: 'tier', fit: 'alternative', targetName: 'Primordial Robe of Rites', item: { itemId: 251147, iconUrl: 'https://i/251147.jpg' } });
  });
});

describe('reference data off the render path', () => {
  /** Counts the three requests a render must never make; the retained icon and spec calls stay stubbed. */
  function counting(s: Services) {
    const calls = { lists: 0, tracks: 0, items: 0 };
    const { bisSource, fetchRaidbots, blizzard } = s;
    s.bisSource = { name: bisSource.name, fetchLists: async (slug) => { calls.lists++; return bisSource.fetchLists(slug); } };
    s.fetchRaidbots = async () => { calls.tracks++; return fetchRaidbots(); };
    const getItemDetails = blizzard.getItemDetails.bind(blizzard);
    Object.assign(s.blizzard, { getItemDetails: async (region: string, id: number) => { calls.items++; return getItemDetails(region as 'eu', id); } });
    return calls;
  }

  it('renders loading states from an empty cache without asking Method, Raidbots or Blizzard item details', async () => {
    const s = await services();
    const calls = counting(s);
    const id = await seed(s);
    const page = await getCharacterPage(s, id);
    const { cards: [card], referenceDue } = await getCharacterCards(s);
    expect(calls).toEqual({ lists: 0, tracks: 0, items: 0 });
    expect(page).toMatchObject({
      bisLoading: true, bisError: null, tracksLoading: true, tracksKnown: false, tracksError: null, rows: [],
      referenceDue: 'bis:guardian-druid,tracks',
    });
    expect(page!.priority).toMatchObject({ bisLoading: true, approximate: true });
    expect(card).toMatchObject({ counts: null, bisError: null, tracksKnown: false, tracksLoading: true, tracksError: null });
    expect(referenceDue).toBe('bis:guardian-druid,tracks');
  });

  it('asks only for tracks with no characters', async () => {
    expect(await getCharacterCards(await services())).toEqual({ cards: [], referenceDue: 'tracks' });
  });

  it('needs no sync once the reference data is stored', async () => {
    const s = await services();
    const id = await seed(s);
    await prime(s);
    expect((await getCharacterPage(s, id))!.referenceDue).toBeNull();
    expect((await getCharacterCards(s)).referenceDue).toBeNull();
  });

  it('drops failed work from the key, so a failure does not ask again', async () => {
    const s = await services();
    s.bisSource = { name: 'Fake', fetchLists: async () => { throw new Error('down'); } };
    s.fetchRaidbots = async () => { throw new Error('down'); };
    const id = await seed(s);
    await prime(s);
    const page = await getCharacterPage(s, id);
    expect(page).toMatchObject({ referenceDue: null, bisLoading: false, bisError: 'BiS list couldn’t be updated', tracksLoading: false, tracksKnown: false });
    expect(page!.tracksError).toMatch(/Upgrade track data/);
  });

  it('treats tracks as unknown until stored, and cached tracks with a newer failure as known', async () => {
    const s = await services();
    const id = await seed(s);
    await syncBisLists({ db: s.db, source: s.bisSource, now: 1000 }, 'guardian-druid');
    let page = await getCharacterPage(s, id);
    let { cards: [card] } = await getCharacterCards(s);
    expect(page).toMatchObject({ tracksKnown: false, tracksLoading: true, tracksError: null, priority: { approximate: true } });
    expect(card).toMatchObject({ tracksKnown: false, tracksLoading: true });
    expect(card!.counts).not.toBeNull();

    await syncTracks({ db: s.db, fetchRaidbots: s.fetchRaidbots, now: 1000 });
    await syncTracks({ db: s.db, fetchRaidbots: async () => { throw new Error('down'); }, now: 1000 + DAY_MS });
    s.now = () => 1001 + DAY_MS;
    page = await getCharacterPage(s, id);
    ({ cards: [card] } = await getCharacterCards(s));
    expect(page).toMatchObject({ tracksKnown: true, tracksLoading: false, tracksError: null, priority: { approximate: false } });
    expect(card).toMatchObject({ tracksKnown: true, tracksLoading: false, tracksError: null });
  });
});
