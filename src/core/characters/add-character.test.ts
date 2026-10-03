import { describe, expect, it, vi } from 'vitest';
import { openTestDb } from '@/test/db';
import { addCharacter } from './add-character';
import { getCharacter } from '../db/queries/characters';
import { HttpError } from '../http';
import { UserError } from '../errors';
import type { BlizzardClient } from '../blizzard/client';
import type { CharacterRef } from '../blizzard/types';
import type { CharacterSyncer } from '../sync/character-sync';

function deps(profileImpl?: (ref: CharacterRef) => Promise<never>) {
  const asked: CharacterRef[] = [];
  const synced: number[] = [];
  const blizzard = {
    getRealms: async () => [{ id: 503, name: 'Argent Dawn', slug: 'argent-dawn' }],
    getProfile: profileImpl ?? (async (ref: CharacterRef) => {
      asked.push(ref);
      return { name: 'Birkibjörn', realmId: 503, realmSlug: 'argent-dawn', realmName: 'Argent Dawn', className: 'Druid', specName: 'Guardian' };
    }),
  } as unknown as BlizzardClient;
  const syncer: CharacterSyncer = { sync: async (id) => { synced.push(id); return 'updated'; } };
  return { blizzard, syncer, asked, synced };
}

describe('addCharacter', () => {
  it('resolves the realm ID to Blizzard’s slug, saves the character and syncs it', async () => {
    const db = await openTestDb();
    const d = deps();
    const result = await addCharacter({ db, blizzard: d.blizzard, syncer: d.syncer, now: () => 5 }, { region: 'eu', name: 'birkibjörn', realmId: 503 });
    expect(result.created).toBe(true);
    expect(result.key).toBe('eu.argent-dawn.birkibjörn');
    expect(d.asked[0]).toEqual({ region: 'eu', realmSlug: 'argent-dawn', name: 'birkibjörn' });
    expect(await getCharacter(db, result.id)).toMatchObject({ name: 'Birkibjörn', realmSlug: 'argent-dawn', specName: 'Guardian' });
    expect(d.synced).toEqual([result.id]);
  });

  it('returns the existing character without syncing again', async () => {
    const db = await openTestDb();
    const d = deps();
    const context = { db, blizzard: d.blizzard, syncer: d.syncer, now: () => 5 };
    const first = await addCharacter(context, { region: 'eu', name: 'Birkibjörn', realmSlug: 'argent-dawn' });
    const second = await addCharacter(context, { region: 'eu', name: 'BIRKIBJÖRN', realmSlug: 'argent-dawn' });
    expect(second).toEqual({ id: first.id, created: false, key: 'eu.argent-dawn.birkibjörn' });
    expect(d.synced).toHaveLength(1);
  });

  it('rejects an unknown realm ID', async () => {
    const db = await openTestDb();
    const d = deps();
    await expect(addCharacter({ db, blizzard: d.blizzard, syncer: d.syncer, now: () => 5 }, { region: 'eu', name: 'x', realmId: 1 }))
      .rejects.toThrow(UserError);
  });

  // The Blizzard client can come from another server bundle's copy of the http module, whose
  // HttpError is a different class. This is the production failure behind issue #33.
  it('explains a 404 even when the HttpError comes from another copy of the http module', async () => {
    vi.resetModules();
    const { HttpError: OtherHttpError } = await import('../http');
    const db = await openTestDb();
    const d = deps(async () => { throw new OtherHttpError(404, 'u', ''); });
    await expect(addCharacter({ db, blizzard: d.blizzard, syncer: d.syncer, now: () => 5 }, { region: 'eu', name: 'Nobody', realmSlug: 'argent-dawn' }))
      .rejects.toThrow('Blizzard can’t find Nobody on that realm.');
  });

  it('explains when Blizzard can’t find the character', async () => {
    const db = await openTestDb();
    const d = deps(async () => { throw new HttpError(404, 'u', ''); });
    await expect(addCharacter({ db, blizzard: d.blizzard, syncer: d.syncer, now: () => 5 }, { region: 'eu', name: 'Nobody', realmSlug: 'argent-dawn' }))
      .rejects.toThrow('Blizzard can’t find Nobody on that realm.');
  });
});
