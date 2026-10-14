import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openTestDb } from '@/test/db';
import type { BlizzardClient } from '@/core/blizzard/client';
import { insertCharacter } from '@/core/db/queries/characters';
import { listStatMarks } from '@/core/db/queries/stat-marks';
import type { Services } from '@/server/services';

let services: Services;
vi.mock('@/server/services', () => ({ getServices: async () => services }));

const { PUT, DELETE } = await import('./route');

const valid = { slot: 'HEAD', itemId: 100, bonusIds: [30, 10], targetItemId: 200, right: true };

const call = async (handler: typeof PUT, id: string, body?: BodyInit) => {
  const res = await handler(new NextRequest('http://localhost/api', { method: 'PUT', body }), { params: Promise.resolve({ id }) });
  return { status: res.status, body: await res.json() as Record<string, unknown> };
};
const json = (value: unknown) => JSON.stringify(value);

let id: number;
beforeEach(async () => {
  const db = await openTestDb();
  services = {
    db, blizzard: {} as unknown as BlizzardClient,
    bisSources: { method: { name: 'Method', fetchLists: async () => { throw new Error('unused'); } }, icyVeins: { name: 'Icy Veins', fetchLists: async () => { throw new Error('unused'); } } },
    fetchRaidbots: async () => ({ tracks: [], qualities: [] }), syncer: { sync: async () => 'skipped' },
    now: () => 1000, fetchFn: fetch, currentAccountId: () => 1,
  };
  ({ id } = await insertCharacter(db, { region: 'eu', realmId: 1, realmSlug: 'test-realm', realmName: 'Test Realm', name: 'Birkibjörn', className: 'Druid', specName: 'Guardian' }, 1));
});

describe('stat-mark route', () => {
  it('saves and clears a mark', async () => {
    expect(await call(PUT, String(id), json(valid))).toEqual({ status: 200, body: { ok: true } });
    expect(await listStatMarks(services.db, 1, id)).toEqual([{ ...valid, bonusIds: [10, 30] }]);
    expect(await call(DELETE, String(id), json({ slot: 'HEAD' }))).toEqual({ status: 200, body: { ok: true } });
    expect(await listStatMarks(services.db, 1, id)).toEqual([]);
  });

  it('answers 404 for an unknown character', async () => {
    for (const handler of [PUT, DELETE]) {
      for (const bad of [String(id + 1), 'abc']) {
        expect(await call(handler, bad, json(valid))).toEqual({ status: 404, body: { error: 'Unknown character' } });
      }
    }
  });

  it('answers 400 for a bad body', async () => {
    const bad = [
      { ...valid, slot: 'NOSE' }, { ...valid, itemId: 1.5 }, { ...valid, targetItemId: 0 },
      { ...valid, bonusIds: 'x' }, { ...valid, bonusIds: [-1] }, { ...valid, right: undefined },
    ];
    for (const body of bad) expect(await call(PUT, String(id), json(body))).toEqual({ status: 400, body: { error: 'Invalid stat mark.' } });
    expect(await call(PUT, String(id), 'not json')).toEqual({ status: 400, body: { error: 'Invalid stat mark.' } });
    expect(await call(DELETE, String(id), json({ slot: 'NOSE' }))).toEqual({ status: 400, body: { error: 'Invalid stat mark.' } });
    expect(await call(DELETE, String(id), 'not json')).toEqual({ status: 400, body: { error: 'Invalid stat mark.' } });
    expect(await call(DELETE, String(id))).toEqual({ status: 400, body: { error: 'Invalid stat mark.' } });
    expect(await listStatMarks(services.db, 1, id)).toEqual([]);
  });
});
