import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import type { BlizzardClient } from '@/core/blizzard/client';
import { insertCharacter } from '@/core/db/queries/characters';
import { upsertOverride } from '@/core/db/queries/bis-settings';
import { upsertCatalogItem } from '@/core/db/queries/item-catalog';
import { saveSnapshotIfChanged } from '@/core/db/queries/snapshots';
import { syncReference } from '@/core/sync/reference-run';
import { weekStart } from '@/core/vault/week';
import type { BisLists, Track } from '@/core/types';
import type { Services } from '../services';
import { getVaultHistoryWeek } from './vault-history';

const lists: BisLists = {
  overall: [], raid: [],
  mythicPlus: [{ kind: 'item', slotLabel: 'Neck', slots: ['NECK'], itemId: 20, name: 'Best Neck', bonusIds: [], isTier: false, isCatalyst: false, source: 'Dungeon B' }],
};
const tracks: Track[] = [{ bonusId: 99, name: 'Hero', step: 5, max: 6, group: 617, currencyId: null, currencyName: null, costPerStep: null }];
const NOW = Date.UTC(2026, 9, 16, 12);
const WEEK = 7 * 24 * 3600 * 1000;
const START = weekStart('eu', NOW);
const vault = (itemId: number) => [{ location: 'vault' as const, slot: 'NECK', itemId, name: `Vault ${itemId}`, itemLevel: 330, quality: 'EPIC' as const, bonusIds: [], isTier: false, secondaryStats: null }];

async function setup() {
  const db = await openTestDb();
  const s: Services = {
    db,
    blizzard: { getItemIconUrl: async () => null, getClasses: async () => [], getClassIconUrl: async () => null, getItemDetails: async () => null } as unknown as BlizzardClient,
    bisSources: { icyVeins: { name: 'Icy Veins', fetchLists: async () => { throw new Error('unused'); } }, method: { name: 'Fake', fetchLists: async () => lists } },
    fetchRaidbots: async () => ({ tracks, qualities: [] }),
    syncer: { sync: async () => 'skipped' },
    now: () => NOW, fetchFn: fetch, currentAccountId: () => 1,
  };
  const { id } = await insertCharacter(db, { region: 'eu', realmId: 1, realmSlug: 'test-realm', realmName: 'Test Realm', name: 'Birkibjörn', className: 'Druid', specName: 'Guardian' }, 1);
  await syncReference({ db, bisSources: s.bisSources, fetchRaidbots: s.fetchRaidbots, blizzard: s.blizzard, now: NOW });
  return { s, id };
}

describe('getVaultHistoryWeek', () => {
  it('pages back through past weeks, skipping none with a paste', async () => {
    const { s, id } = await setup();
    await saveSnapshotIfChanged(s.db, id, 'simc', vault(20), START - 2 * WEEK + 5000);
    await saveSnapshotIfChanged(s.db, id, 'simc', vault(21), START - WEEK + 5000);
    await saveSnapshotIfChanged(s.db, id, 'simc', vault(22), START + 5000);

    const first = await getVaultHistoryWeek(s, id, START);
    expect(first).toMatchObject({ week: { start: START - WEEK, pastedAt: START - WEEK + 5000, label: 'Week of Wed 7 Oct' }, nextBefore: START - WEEK });
    expect(first!.week!.choices.map((c) => c.itemId)).toEqual([21]);

    const second = await getVaultHistoryWeek(s, id, START - WEEK);
    expect(second).toMatchObject({ week: { start: START - 2 * WEEK, pastedAt: START - 2 * WEEK + 5000 }, nextBefore: null });
    expect(second!.week!.choices.map((c) => [c.itemId, c.isBis])).toEqual([[20, true]]);
  });

  it('answers empty when nothing is earlier, and null for an unknown character', async () => {
    const { s, id } = await setup();
    await saveSnapshotIfChanged(s.db, id, 'simc', vault(20), START + 5000);
    expect(await getVaultHistoryWeek(s, id, START)).toEqual({ week: null, nextBefore: null });
    expect(await getVaultHistoryWeek(s, 999, START)).toBeNull();
  });

  it('judges against the account override', async () => {
    const { s, id } = await setup();
    await saveSnapshotIfChanged(s.db, id, 'simc', vault(21), START - WEEK + 5000);
    expect((await getVaultHistoryWeek(s, id, START))!.week!.choices[0]!.isBis).toBe(false);
    await upsertCatalogItem(s.db, { itemId: 21, name: 'Other Neck', inventoryType: 'NECK', armorType: null, quality: 'EPIC', isTier: false }, 1);
    await upsertOverride(s.db, 1, 'guardian-druid', 'method', 'mythicPlus', { slotKey: 'Neck#1', itemId: 21, catalyst: false });
    expect((await getVaultHistoryWeek(s, id, START))!.week!.choices[0]!.isBis).toBe(true);
  });
});
