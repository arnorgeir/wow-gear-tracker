import { describe, expect, it, vi } from 'vitest';
import { openTestDb } from '@/test/db';
import type { BlizzardClient } from '../blizzard/client';
import type { Db } from '../db/client';
import { insertCharacter, updateCharacter } from '../db/queries/characters';
import type { BisLists, Region } from '../types';
import { readBisLists, readTierTargets, readTracks } from './reference-sync';
import { syncReference, type ReferenceSyncDeps } from './reference-run';

const tierRobe = { kind: 'item', slotLabel: 'Chest', slots: ['CHEST'], itemId: 10, name: 'Tier Robe', bonusIds: [], isTier: true, isCatalyst: false, source: '' } as const;
const lists: BisLists = { overall: [], raid: [], mythicPlus: [tierRobe] };
const trackData = { tracks: [{ bonusId: 1, name: 'Myth', step: 1, max: 6, group: 618, currencyId: null, currencyName: null, costPerStep: null }], qualities: [] };

function deps(db: Db) {
  const calls = { lists: [] as string[], tracks: 0, items: [] as string[] };
  const d: ReferenceSyncDeps = {
    db, now: 1000,
    bisSource: { name: 'Fake', fetchLists: async (slug) => { calls.lists.push(slug); return lists; } },
    fetchRaidbots: async () => { calls.tracks++; return trackData; },
    blizzard: { getItemDetails: async (region: string, id: number) => { calls.items.push(`${region}:${id}`); return null; } } as unknown as BlizzardClient,
  };
  return { d, calls };
}

async function track(db: Db, name: string, className: string, specName: string, region: Region = 'eu') {
  return (await insertCharacter(db, { region, realmId: 1, realmSlug: 'argent-dawn', realmName: 'Argent Dawn', name, className, specName }, 1)).id;
}

describe('syncReference', () => {
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
    d.bisSource = { name: 'Fake', fetchLists: async () => { throw new Error('down'); } };
    d.fetchRaidbots = async () => { throw new Error('down'); };
    expect(await syncReference(d)).toBe('synced');
    expect((await readTracks(db, 1000)).status).toBe('failed');
    expect((await readBisLists(db, 'guardian-druid', 1000)).status).toBe('failed');
    expect(await syncReference(d)).toBe('skipped');
  });

  it('gives calls during a pass one shared follow-up pass that sees a spec added meanwhile', async () => {
    const db = await openTestDb();
    await track(db, 'Birkibjörn', 'Druid', 'Guardian');
    const { d, calls } = deps(db);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    d.bisSource = { name: 'Fake', fetchLists: async (slug) => { calls.lists.push(slug); if (slug === 'guardian-druid') await gate; return lists; } };

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
    expect((await readBisLists(db, 'frost-mage', 1000)).status).toBe('ready');
  });
});
