import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { createCharacterSyncer, isStale } from './character-sync';
import { gearToSnapshotItems, getCharacter, getLatestSnapshot, insertCharacter, saveSnapshotIfChanged } from '../db/queries';
import { HttpError } from '../http';
import type { BlizzardClient, CharacterProfile } from '../blizzard/client';
import type { GearItem } from '../types';

const profile: CharacterProfile = { name: 'Testchar', realmId: 1, realmSlug: 'test-realm', realmName: 'Test Realm', className: 'Druid', specName: 'Feral' };
const gear: GearItem[] = [{ slot: 'HEAD', itemId: 1, name: 'Helm', itemLevel: 300, quality: 'EPIC', bonusIds: [], isTier: false }];

function fakeBlizzard(overrides: Partial<BlizzardClient> = {}) {
  const calls = { profile: 0, equipment: 0 };
  const client: BlizzardClient = {
    getProfile: async () => { calls.profile++; return profile; },
    getEquipment: async () => { calls.equipment++; return gear; },
    getItemIconUrl: async () => null,
    getItemDetails: async () => null,
    getRealms: async () => [],
    getClasses: async () => [],
    ...overrides,
  };
  return { client, calls };
}

async function setup(overrides: Partial<BlizzardClient> = {}, now = 1_000_000) {
  const db = await openTestDb();
  const { id } = await insertCharacter(db, { region: 'eu', realmId: 1, realmSlug: 'test-realm', realmName: 'Test Realm', name: 'Testchar', className: 'Druid', specName: 'Guardian' }, 0);
  const blizzard = fakeBlizzard(overrides);
  let clock = now;
  const syncer = createCharacterSyncer({ db, blizzard: blizzard.client, now: () => clock });
  return { db, id, syncer, calls: blizzard.calls, advance: (ms: number) => { clock += ms; } };
}

describe('isStale', () => {
  it('treats never-synced and old data as stale', () => {
    expect(isStale(null, 10)).toBe(true);
    expect(isStale(0, 5 * 60 * 1000)).toBe(true);
    expect(isStale(0, 5 * 60 * 1000 - 1)).toBe(false);
  });
});

describe('createCharacterSyncer', () => {
  it('saves gear and profile on the first sync', async () => {
    const { db, id, syncer } = await setup();
    expect(await syncer.sync(id)).toBe('updated');
    expect(await getCharacter(db, id)).toMatchObject({ specName: 'Feral', lastSyncedAt: 1_000_000, status: 'ok', lastSyncError: null });
    expect((await getLatestSnapshot(db, id))?.items).toHaveLength(1);
  });

  it('skips fresh data unless forced, and reports unchanged gear', async () => {
    const { id, syncer, calls, advance } = await setup();
    await syncer.sync(id);
    expect(await syncer.sync(id)).toBe('skipped');
    expect(await syncer.sync(id, { force: true })).toBe('unchanged');
    advance(6 * 60 * 1000);
    expect(await syncer.sync(id)).toBe('unchanged');
    expect(calls.equipment).toBe(3);
  });

  it('shares one in-progress sync between concurrent callers', async () => {
    const { id, syncer, calls } = await setup();
    const [a, b] = await Promise.all([syncer.sync(id), syncer.sync(id)]);
    expect([a, b]).toEqual(['updated', 'updated']);
    expect(calls.equipment).toBe(1);
  });

  it('marks a character notFound on a Blizzard 404', async () => {
    const { db, id, syncer } = await setup({ getProfile: async () => { throw new HttpError(404, 'u', ''); } });
    expect(await syncer.sync(id)).toBe('notFound');
    expect(await getCharacter(db, id)).toMatchObject({ status: 'notFound' });
  });

  it('keeps the last gear and records the error on other failures', async () => {
    let fail = false;
    const { db, id, syncer, advance } = await setup({
      getEquipment: async () => { if (fail) throw new HttpError(503, 'u', 'down'); return gear; },
    });
    await syncer.sync(id);
    fail = true;
    advance(6 * 60 * 1000);
    expect(await syncer.sync(id)).toBe('error');
    const character = await getCharacter(db, id);
    expect(character?.lastSyncError).toMatch(/Blizzard/);
    expect(character?.lastSyncedAt).toBe(1_000_000);
    expect((await getLatestSnapshot(db, id))?.items).toHaveLength(1);
  });

  it('reports a network failure as Blizzard being unreachable', async () => {
    const { db, id, syncer } = await setup({ getEquipment: async () => { throw new TypeError('fetch failed'); } });
    expect(await syncer.sync(id)).toBe('error');
    expect((await getCharacter(db, id))?.lastSyncError).toMatch(/couldn’t be reached/);
  });

  it('rethrows errors that are not Blizzard’s fault', async () => {
    const { syncer, id } = await setup({ getEquipment: async () => { throw new Error('bug in our code'); } });
    await expect(syncer.sync(id)).rejects.toThrow('bug in our code');
  });

  it('does not mark the character fresh when saving the snapshot fails', async () => {
    const broken = [{ ...gear[0]!, quality: undefined as unknown as GearItem['quality'] }];
    const { db, id, syncer } = await setup({ getEquipment: async () => broken });
    await expect(syncer.sync(id)).rejects.toThrow();
    expect((await getCharacter(db, id))?.lastSyncedAt).toBeNull();
  });

  it('keeps a newer SimC paste when Blizzard still has the same gear', async () => {
    const { db, id, syncer, advance } = await setup();
    await syncer.sync(id);
    advance(1000);
    await saveSnapshotIfChanged(db, id, 'simc', gearToSnapshotItems(gear), 1_001_000, [{ kind: 'upgrade', currencyId: 3446, quantity: 85 }]);
    expect(await syncer.sync(id, { force: true })).toBe('unchanged');
    expect((await getLatestSnapshot(db, id))?.source).toBe('simc');
  });

  it('throws for an unknown character ID', async () => {
    const { syncer } = await setup();
    await expect(syncer.sync(999)).rejects.toThrow('Character 999 not found');
  });
});
