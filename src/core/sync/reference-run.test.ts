import { describe, expect, it, vi } from 'vitest';
import { openTestDb } from '@/test/db';
import type { BlizzardClient } from '../blizzard/client';
import type { Db } from '../db/client';
import { insertCharacter, updateCharacter } from '../db/queries/characters';
import type { BisLists, Region } from '../types';
import { readBisLists, readTierTargets, readTracks } from './reference-sync';
import { syncReference, type ReferenceSyncDeps } from './reference-run';
import { updateSpecSettings, upsertOverride } from '../db/queries/bis-settings';
import { manualBisItems } from '../db/schema';
import { upsertCatalogItem } from '../db/queries/item-catalog';
import { listSpecs } from '../db/queries/specs';

const tierRobe: BisLists['mythicPlus'][number] = { kind: 'item', slotLabel: 'Chest', slots: ['CHEST'], itemId: 10, name: 'Tier Robe', bonusIds: [], isTier: true, isCatalyst: false, source: '' };
const lists: BisLists = { overall: [], raid: [], mythicPlus: [tierRobe] };
// A catalyst row: tier by its marker, so the sync needs no item lookup for it.
const icyLists: BisLists = { overall: [{ ...tierRobe, slotLabel: 'Head', slots: ['HEAD'], itemId: 500, isCatalyst: true }], raid: [], mythicPlus: [] };
const trackData = { tracks: [{ bonusId: 1, name: 'Myth', step: 1, max: 6, group: 618, currencyId: null, currencyName: null, costPerStep: null }], qualities: [] };

function deps(db: Db) {
  const calls = { lists: [] as string[], icy: [] as string[], tracks: 0, items: [] as string[] };
  const d: ReferenceSyncDeps = {
    db, now: 1000,
    bisSources: { icyVeins: { name: 'Icy Veins', fetchLists: async (slug) => { calls.icy.push(slug); return icyLists; } },
      method: { name: 'Fake', fetchLists: async (slug) => { calls.lists.push(slug); return lists; } } },
    fetchRaidbots: async () => { calls.tracks++; return trackData; },
    blizzard: { getItemDetails: async (region: string, id: number) => { calls.items.push(`${region}:${id}`); return null; } } as unknown as BlizzardClient,
  };
  return { d, calls };
}

async function track(db: Db, name: string, className: string, specName: string, region: Region = 'eu') {
  return (await insertCharacter(db, { region, realmId: 1, realmSlug: 'argent-dawn', realmName: 'Argent Dawn', name, className, specName }, 1)).id;
}

describe('syncReference', () => {
  it('fetches stats for override items and fills the spec catalog', async () => {
    const db = await openTestDb();
    await track(db, 'Birkibjörn', 'Mage', 'Frost');
    await upsertCatalogItem(db, { itemId: 301, name: 'Woven Hood', inventoryType: 'HEAD', armorType: 'cloth', weaponType: null, quality: 'EPIC', isTier: false }, 1);
    await upsertOverride(db, 1, 'frost-mage', 'method', 'mythicPlus', { slotKey: 'Head#1', itemId: 301, catalyst: true });
    const { d, calls } = deps(db);
    d.blizzard = { ...d.blizzard, getClasses: async () => [{ id: 8, name: 'Mage', specs: ['Frost'] }] } as unknown as BlizzardClient;
    await syncReference(d);
    expect(calls.items).toContain('eu:301');
    expect((await listSpecs(db)).map((s) => s.methodSlug)).toEqual(['frost-mage']);
    const scope = { region: 'eu' as const, specSlug: 'frost-mage', lists, extraItemIds: [301] };
    expect((await readTierTargets(db, scope, 1000)).due).toBe(false);
  });

  it('fetches tracks and each distinct spec once, without repeating tier requests across regions', async () => {
    const db = await openTestDb();
    await track(db, 'Birkibjörn', 'Druid', 'Guardian');
    await track(db, 'Sólrún', 'Druid', 'Guardian', 'us');
    await track(db, 'Hrafnhildur', 'Warrior', 'Protection');
    const { d, calls } = deps(db);
    expect(await syncReference(d)).toBe('synced');
    expect(calls.tracks).toBe(1);
    expect(calls.lists.sort()).toEqual(['guardian-druid', 'protection-warrior']);
    // Item rows are shared across regions, so the us scope finds item 10 already looked up.
    expect(calls.items).toEqual(['eu:10']);
    expect((await readTierTargets(db, { region: 'us', specSlug: 'guardian-druid', lists }, 1000)).due).toBe(false);
  });

  it('follows the spec override', async () => {
    const db = await openTestDb();
    const id = await track(db, 'Birkibjörn', 'Druid', 'Guardian');
    await updateCharacter(db, id, { specOverride: 'Feral' });
    const { d, calls } = deps(db);
    await syncReference(d);
    expect(calls.lists).toEqual(['feral-druid']);
  });

  it('skips when nothing is due', async () => {
    const db = await openTestDb();
    await track(db, 'Birkibjörn', 'Druid', 'Guardian');
    const { d, calls } = deps(db);
    await syncReference(d);
    expect(await syncReference(d)).toBe('skipped');
    expect(calls).toMatchObject({ tracks: 1, lists: ['guardian-druid'], items: ['eu:10'] });
  });

  it('records every failure without throwing, then backs off', async () => {
    const db = await openTestDb();
    await track(db, 'Birkibjörn', 'Druid', 'Guardian');
    const { d } = deps(db);
    d.bisSources.method = { name: 'Fake', fetchLists: async () => { throw new Error('down'); } };
    d.fetchRaidbots = async () => { throw new Error('down'); };
    expect(await syncReference(d)).toBe('synced');
    expect((await readTracks(db, 1000)).status).toBe('failed');
    expect((await readBisLists(db, 'method', 'guardian-druid', 1000)).status).toBe('failed');
    expect(await syncReference(d)).toBe('skipped');
  });

  it('gives calls during a pass one shared follow-up pass that sees a spec added meanwhile', async () => {
    const db = await openTestDb();
    await track(db, 'Birkibjörn', 'Druid', 'Guardian');
    const { d, calls } = deps(db);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    d.bisSources.method = { name: 'Fake', fetchLists: async (slug) => { calls.lists.push(slug); if (slug === 'guardian-druid') await gate; return lists; } };

    const first = syncReference(d);
    await vi.waitFor(() => expect(calls.lists).toEqual(['guardian-druid']));
    await track(db, 'Gnúpur', 'Mage', 'Frost');
    const second = syncReference(d);
    const third = syncReference(d);
    expect(third).toBe(second);
    release();

    expect(await first).toBe('synced');
    expect(await second).toBe('synced');
    expect(calls.lists).toEqual(['guardian-druid', 'frost-mage']);
    expect((await readBisLists(db, 'method', 'frost-mage', 1000)).status).toBe('ready');
  });

  it('fetches only the sources in use', async () => {
    const db = await openTestDb();
    await track(db, 'Birkibjörn', 'Mage', 'Frost');
    await updateSpecSettings(db, 1, 'frost-mage', { source: 'icyVeins' });
    const { d, calls } = deps(db);
    await syncReference(d);
    expect(calls.icy).toEqual(['frost-mage']);
    expect(calls.lists).toEqual([]);
  });

  it('syncs tier stats for an Icy Veins spec and a Manual spec', async () => {
    const db = await openTestDb();
    await track(db, 'Birkibjörn', 'Mage', 'Frost');
    await track(db, 'Hrafnhildur', 'Warrior', 'Protection');
    await updateSpecSettings(db, 1, 'frost-mage', { source: 'icyVeins' });
    await updateSpecSettings(db, 1, 'protection-warrior', { source: 'manual' });
    await db.insert(manualBisItems).values({
      accountId: 1, specSlug: 'protection-warrior', listType: 'raid', position: 0, slotLabel: 'Chest', slots: ['CHEST'],
      itemId: 600, minItemLevel: null, name: 'Manual Plate', bonusIds: [], isTier: true, isCatalyst: false, source: 'Boss',
    });
    const { d, calls } = deps(db);
    await syncReference(d);
    expect(calls.lists).toEqual([]);
    expect(calls.items.sort()).toEqual(['eu:500', 'eu:600']);
    expect((await readTierTargets(db, { region: 'eu', specSlug: 'frost-mage', lists: icyLists }, 1000)).due).toBe(false);
  });
});
