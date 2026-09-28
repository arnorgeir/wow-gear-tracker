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
