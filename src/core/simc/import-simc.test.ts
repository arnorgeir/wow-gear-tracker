import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { importSimc } from './import-simc';
import { getLatestSnapshot } from '../db/queries/snapshots';
import { insertCharacter } from '../db/queries/characters';
import { UserError } from '../errors';
import type { BlizzardClient } from '../blizzard/client';

const text = readFileSync(new URL('./__fixtures__/export.txt', import.meta.url), 'utf8');

const blizzard = {
  getItemDetails: async (_region: string, id: number) => (id === 271528 ? { quality: 'EPIC', isTier: true } : { quality: 'RARE', isTier: false }),
} as unknown as BlizzardClient;
const qualities = new Map([[12850, 'EPIC' as const]]);

async function setup(realmName = 'Tarren Mill', realmSlug = 'tarren-mill') {
  const db = await openTestDb();
  const { id } = await insertCharacter(db, { region: 'eu', realmId: 1, realmSlug, realmName, name: 'Birkibjörn', className: 'Druid', specName: 'Guardian' }, 1);
  return { db, id, deps: { db, blizzard, qualities, now: () => 500 } };
}

describe('importSimc', () => {
  it('saves a SimC snapshot with equipped, bag and vault items and crests', async () => {
    const { db, id, deps } = await setup();
    expect(await importSimc(deps, id, text)).toEqual({ changed: true, equipped: 5, bags: 2, vault: 1 });
    const snapshot = await getLatestSnapshot(db, id);
    expect(snapshot).toMatchObject({ source: 'simc', createdAt: 500 });
    expect(snapshot!.currencies).toHaveLength(3);
    const head = snapshot!.items.find((i) => i.slot === 'HEAD')!;
    expect(head).toMatchObject({ itemId: 271528, quality: 'EPIC', isTier: true, itemLevel: 321 });
    const neck = snapshot!.items.find((i) => i.slot === 'NECK')!;
    expect(neck).toMatchObject({ quality: 'RARE', isTier: false });
  });

  it('reports an identical paste as unchanged', async () => {
    const { id, deps } = await setup();
    await importSimc(deps, id, text);
    expect((await importSimc(deps, id, text)).changed).toBe(false);
  });

  it('matches realm tokens without dashes or spaces', async () => {
    const { id, deps } = await setup('Azjol-Nerub', 'azjol-nerub');
    const other = text.replace('server=tarren_mill', 'server=azjolnerub');
    expect((await importSimc(deps, id, other)).changed).toBe(true);
  });

  it('rejects a paste from another character, naming who it belongs to', async () => {
    const { id, deps } = await setup();
    await expect(importSimc(deps, id, text.replace('druid="Birkibjörn"', 'druid="Grenibjörn"')))
      .rejects.toThrow('This SimC export is for Grenibjörn, not Birkibjörn.');
  });

  it('rejects a paste from another realm or region', async () => {
    const { id, deps } = await setup();
    await expect(importSimc(deps, id, text.replace('server=tarren_mill', 'server=draenor'))).rejects.toThrow(/realm "draenor"/);
    await expect(importSimc(deps, id, text.replace('region=eu', 'region=us'))).rejects.toThrow(/region US/);
  });

  it('refuses to save when Blizzard can’t confirm which items are tier pieces', async () => {
    const { db, id, deps } = await setup();
    const down = { getItemDetails: async () => { throw new Error('down'); } } as unknown as BlizzardClient;
    await expect(importSimc({ ...deps, blizzard: down }, id, text)).rejects.toThrow(/Couldn’t reach Blizzard/);
    expect(await getLatestSnapshot(db, id)).toBeNull();
  });

  it('turns parse errors into a readable message', async () => {
    const { id, deps } = await setup();
    await expect(importSimc(deps, id, 'hello there')).rejects.toBeInstanceOf(UserError);
    await expect(importSimc(deps, id, 'hello there')).rejects.toThrow(/Couldn’t read that SimC text/);
  });
});

describe('importSimc tier stats', () => {
  const HM = ['HASTE_RATING', 'MASTERY_RATING'];
  const CV = ['CRIT_RATING', 'VERSATILITY'];
  const own: Record<number, string[]> = { 271528: HM, 251223: CV, 251173: HM, 159301: HM, 250245: HM };
  const tiers = new Set([271528, 251173, 159301, 250245]);

  /** Answers every item at once; ids in `failing` throw on any request after their first (the details one). */
  function fake(failing: Set<number> = new Set()) {
    const seen = new Set<number>([251223]); // the redirect source is never in the profile, so it has no details request
    const client = {
      getItemDetails: async (_region: string, id: number) => {
        if (failing.has(id) && seen.has(id)) throw new Error('down');
        seen.add(id);
        return { quality: 'EPIC', isTier: tiers.has(id), inventoryType: null, armorType: null, name: null, secondaryStats: own[id] ?? null };
      },
    } as unknown as BlizzardClient;
    return client;
  }
  const statsOf = async (db: Awaited<ReturnType<typeof setup>>['db'], id: number) =>
    Object.fromEntries((await getLatestSnapshot(db, id))!.items.map((i) => [`${i.location}:${i.slot}`, i.secondaryStats]));

  it('gives a catalysed tier piece the redirected item’s stats, a dropped one its own, others none', async () => {
    const { db, id, deps } = await setup();
    await importSimc({ ...deps, blizzard: fake() }, id, text);
    expect(await statsOf(db, id)).toMatchObject({ 'equipped:HEAD': CV, 'equipped:NECK': HM, 'equipped:FINGER_1': null, 'bag:WAIST': null, 'vault:TRINKET_1': null });
  });

  it('still imports, with null stats, when the stats request fails', async () => {
    const { db, id, deps } = await setup();
    await importSimc({ ...deps, blizzard: fake(new Set([251223, 251173])) }, id, text);
    expect(await statsOf(db, id)).toMatchObject({ 'equipped:HEAD': null, 'equipped:NECK': null });
  });

  it('fills a pasted-before snapshot in place when the same paste comes again', async () => {
    const { db, id, deps } = await setup();
    await importSimc({ ...deps, blizzard: fake(new Set([251223, 251173])) }, id, text);
    const first = (await getLatestSnapshot(db, id))!.id;
    expect((await importSimc({ ...deps, blizzard: fake() }, id, text)).changed).toBe(false);
    const again = (await getLatestSnapshot(db, id))!;
    expect(again.id).toBe(first);
    expect(await statsOf(db, id)).toMatchObject({ 'equipped:HEAD': CV, 'equipped:NECK': HM });
  });

  it('saves a new snapshot when one piece had stats and another gets them on a re-paste', async () => {
    const { db, id, deps } = await setup();
    // 251173 (the neck) is a tier piece here and fails its stats request; the head succeeds.
    await importSimc({ ...deps, blizzard: fake(new Set([251173])) }, id, text);
    const first = (await getLatestSnapshot(db, id))!.id;
    expect((await importSimc({ ...deps, blizzard: fake() }, id, text)).changed).toBe(true);
    expect((await getLatestSnapshot(db, id))!.id).not.toBe(first);
    expect(await statsOf(db, id)).toMatchObject({ 'equipped:HEAD': CV, 'equipped:NECK': HM });
  });
});
