import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openTestDb } from '@/test/db';
import type { BlizzardClient } from '@/core/blizzard/client';
import { insertCharacter } from '@/core/db/queries/characters';
import { saveSnapshotIfChanged } from '@/core/db/queries/snapshots';
import type { Services } from '@/server/services';

let services: Services;
vi.mock('@/server/services', () => ({ getServices: async () => services }));

const { GET } = await import('./[id]/vault-history/route');

const NOW = Date.UTC(2026, 9, 16, 12);
const call = async (id: string, query: string) => {
  const res = await GET(new NextRequest(`http://localhost/api/characters/${id}/vault-history${query}`), { params: Promise.resolve({ id }) });
  return { status: res.status, body: await res.json() as Record<string, unknown> };
};

let id: number;
beforeEach(async () => {
  const db = await openTestDb();
  services = {
    db, blizzard: { getItemDetails: async () => null } as unknown as BlizzardClient,
    bisSources: { method: { name: 'Method', fetchLists: async () => { throw new Error('unused'); } }, icyVeins: { name: 'Icy Veins', fetchLists: async () => { throw new Error('unused'); } } },
    fetchRaidbots: async () => ({ tracks: [], qualities: [] }), syncer: { sync: async () => 'skipped' },
    now: () => NOW, fetchFn: fetch, currentAccountId: () => 1,
  };
  id = (await insertCharacter(db, { region: 'eu', realmId: 1, realmSlug: 'test-realm', realmName: 'Test Realm', name: 'Birkibjörn', className: 'Druid', specName: 'Guardian' }, 1)).id;
});

describe('GET /api/characters/[id]/vault-history', () => {
  it('refuses a bad before', async () => {
    for (const q of ['', '?before=abc', '?before=-5', '?before=1.5', '?before=0']) {
      expect(await call(String(id), q)).toEqual({ status: 400, body: { error: 'Unknown week.' } });
    }
  });

  it('answers 404 for an unknown character', async () => {
    expect(await call('999', '?before=1000')).toEqual({ status: 404, body: { error: 'Unknown character' } });
    expect((await call('abc', '?before=1000')).status).toBe(404);
  });

  it('answers the earlier week', async () => {
    await saveSnapshotIfChanged(services.db, id, 'simc', [{ location: 'vault', slot: 'NECK', itemId: 20, name: 'Vault 20', itemLevel: 330, quality: 'EPIC', bonusIds: [], isTier: false, secondaryStats: null }], NOW - 1000);
    const { status, body } = await call(String(id), `?before=${NOW}`);
    expect(status).toBe(200);
    expect(body).toMatchObject({ week: { pastedAt: NOW - 1000, choices: [{ itemId: 20 }] }, nextBefore: null });
  });
});
