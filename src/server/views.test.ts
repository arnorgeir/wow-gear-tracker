import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { getCharacterCards, getCharacterPage } from './views';
import type { Services } from './services';
import { gearToSnapshotItems, insertCharacter, saveSnapshotIfChanged } from '@/core/db/queries';
import type { BisLists, GearItem, Track } from '@/core/types';
import type { BlizzardClient } from '@/core/blizzard/client';

const lists: BisLists = {
  overall: [],
  raid: [],
  mythicPlus: [
    { slotLabel: 'Head', slots: ['HEAD'], itemId: 10, name: 'Tier Catalyst Helm', bonusIds: [], isTier: true, isCatalyst: true, source: 'Dungeon A' },
    { slotLabel: 'Neck', slots: ['NECK'], itemId: 20, name: 'Best Neck', bonusIds: [1], isTier: false, isCatalyst: false, source: 'Dungeon B' },
  ],
};
const tracks: Track[] = [{ bonusId: 99, name: 'Hero', step: 5, max: 6, currencyId: null, costPerStep: null }];
const gear: GearItem[] = [
  { slot: 'HEAD', itemId: 11, name: 'Worn Tier Helm', itemLevel: 321, quality: 'EPIC', bonusIds: [], isTier: true },
  { slot: 'NECK', itemId: 20, name: 'Best Neck', itemLevel: 318, quality: 'EPIC', bonusIds: [99], isTier: false },
];

async function services(): Promise<Services> {
  const db = await openTestDb();
  const blizzard = {
    getItemIconUrl: async (_r: string, id: number) => `https://i/${id}.jpg`,
    getClasses: async () => [{ id: 11, name: 'Druid', specs: ['Balance', 'Feral', 'Guardian', 'Restoration'] }],
  } as unknown as BlizzardClient;
  return {
    db, blizzard,
    bisSource: { name: 'Fake', fetchLists: async () => lists },
    fetchTracks: async () => tracks,
    syncer: { sync: async () => 'skipped' },
    now: () => 1000,
    fetchFn: fetch,
  };
}

async function seed(s: Services, withGear = true) {
  const { id } = await insertCharacter(s.db, { region: 'eu', realmId: 1, realmSlug: 'test-realm', realmName: 'Test Realm', name: 'Testbear', className: 'Druid', specName: 'Guardian' }, 1);
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
    s.fetchTracks = async () => { throw new Error('down'); };
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
    expect(card).toMatchObject({ name: 'Testbear', total: 2, bisError: null, snapshot: { source: 'blizzard', createdAt: 500 } });
    expect(card!.counts).toMatchObject({ done: 1, belowMyth: 1, missing: 0 });
  });
});
