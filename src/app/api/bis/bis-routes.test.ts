import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openTestDb } from '@/test/db';
import type { BlizzardClient } from '@/core/blizzard/client';
import { replaceBisLists } from '@/core/db/queries/bis-lists';
import { getSpecSettings, listOverrides, updateSpecSettings } from '@/core/db/queries/bis-settings';
import { getManualLists } from '@/core/db/queries/manual-lists';
import { replaceSpecs } from '@/core/db/queries/specs';
import type { BisLists } from '@/core/types';
import type { Services } from '@/server/services';

let services: Services;
vi.mock('@/server/services', () => ({ getServices: async () => services }));

const { PATCH } = await import('./settings/route');
const { POST: COPY } = await import('./manual/copy/route');
const { PUT } = await import('./overrides/route');

const SLUG = 'frost-mage';
const lists: BisLists = {
  overall: [], raid: [],
  mythicPlus: [{ kind: 'item', slotLabel: 'Head', slots: ['HEAD'], itemId: 10, name: 'Hood', bonusIds: [], isTier: false, isCatalyst: false, source: 'Vexmaw' }],
};
const none = { overall: [], raid: [], mythicPlus: [] };

const send = (handler: (r: NextRequest) => Promise<Response>, method: string, body: unknown) =>
  handler(new NextRequest('http://localhost/api', { method, body: JSON.stringify(body) }));
const answer = async (res: Promise<Response>) => {
  const r = await res;
  return { status: r.status, body: await r.json() as Record<string, unknown> };
};

beforeEach(async () => {
  const db = await openTestDb();
  await replaceSpecs(db, [{ methodSlug: SLUG, classId: 8, className: 'Mage', specName: 'Frost', iconUrl: null }], 1);
  services = {
    db, blizzard: { getItemDetails: async () => null } as unknown as BlizzardClient,
    bisSources: { method: { name: 'Method', fetchLists: async () => lists }, icyVeins: { name: 'Icy Veins', fetchLists: async () => lists } },
    fetchRaidbots: async () => ({ tracks: [], qualities: [] }), syncer: { sync: async () => 'skipped' },
    now: () => 1000, fetchFn: fetch, currentAccountId: () => 1,
  };
});

describe('PATCH /api/bis/settings', () => {
  it('saves a fetched source', async () => {
    expect(await answer(send(PATCH, 'PATCH', { specSlug: SLUG, source: 'icyVeins' }))).toEqual({ status: 200, body: { ok: true } });
    expect(await getSpecSettings(services.db, 1, SLUG)).toMatchObject({ source: 'icyVeins' });
  });

  it('copies the current list when Manual is chosen', async () => {
    await replaceBisLists(services.db, 'method', SLUG, lists, 1);
    expect((await answer(send(PATCH, 'PATCH', { specSlug: SLUG, source: 'manual', statsMatter: false }))).status).toBe(200);
    expect(await getSpecSettings(services.db, 1, SLUG)).toEqual({ source: 'manual', listType: 'mythicPlus', statsMatter: false });
    expect(await getManualLists(services.db, 1, SLUG)).toMatchObject({ copiedFrom: 'method', lists });
  });

  it('refuses an unknown source, and Manual with nothing to copy', async () => {
    expect(await answer(send(PATCH, 'PATCH', { specSlug: SLUG, source: 'wowhead' }))).toEqual({ status: 400, body: { error: 'Unknown source.' } });
    expect(await answer(send(PATCH, 'PATCH', { specSlug: SLUG, source: 'manual' }))).toEqual({ status: 400, body: { error: 'Fetch a list first, then copy it.' } });
    expect(await getSpecSettings(services.db, 1, SLUG)).toMatchObject({ source: 'method' });
  });
});

describe('POST /api/bis/manual/copy', () => {
  it('copies again from a fetched source', async () => {
    await replaceBisLists(services.db, 'icyVeins', SLUG, lists, 1);
    expect((await answer(send(COPY, 'POST', { specSlug: SLUG, from: 'icyVeins' }))).status).toBe(200);
    expect(await getManualLists(services.db, 1, SLUG)).toMatchObject({ copiedFrom: 'icyVeins', copiedAt: 1000 });
  });

  it('refuses Manual as a source and a source with nothing cached', async () => {
    expect(await answer(send(COPY, 'POST', { specSlug: SLUG, from: 'manual' }))).toEqual({ status: 400, body: { error: 'Unknown source.' } });
    expect(await answer(send(COPY, 'POST', { specSlug: SLUG, from: 'method' }))).toEqual({ status: 400, body: { error: 'Fetch a list first, then copy it.' } });
    expect(await answer(send(COPY, 'POST', { specSlug: 'nope-nope', from: 'method' }))).toEqual({ status: 400, body: { error: 'Unknown spec.' } });
  });
});

describe('PUT /api/bis/overrides', () => {
  it('source mismatch answers 400 and writes nothing', async () => {
    await replaceBisLists(services.db, 'method', SLUG, lists, 1);
    await updateSpecSettings(services.db, 1, SLUG, { source: 'icyVeins' });
    const body = { specSlug: SLUG, source: 'method', listType: 'mythicPlus', slotKey: 'Head#1', itemId: 20 };
    expect(await answer(send(PUT, 'PUT', body))).toEqual({ status: 400, body: { error: 'The BiS source changed. Reload the page.' } });
    expect(await listOverrides(services.db, 1, SLUG, 'method')).toEqual(none);
    expect(await listOverrides(services.db, 1, SLUG, 'icyVeins')).toEqual(none);
  });
});
