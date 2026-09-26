import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { addCharacter } from './add-character';
import { getCharacter } from '../db/queries';
import { HttpError } from '../http';
import { UserError } from '../errors';
import type { BlizzardClient, CharacterRef } from '../blizzard/client';
import type { CharacterSyncer } from '../sync/character-sync';

function deps(profileImpl?: (ref: CharacterRef) => Promise<never>) {
  const asked: CharacterRef[] = [];
  const synced: number[] = [];
  const blizzard = {
    getRealms: async () => [{ id: 503, name: 'Azjol-Nerub', slug: 'azjol-nerub' }],
    getProfile: profileImpl ?? (async (ref: CharacterRef) => {
      asked.push(ref);
      return { name: 'Testbear', realmId: 503, realmSlug: 'azjol-nerub', realmName: 'Azjol-Nerub', className: 'Druid', specName: 'Guardian' };
    }),
  } as unknown as BlizzardClient;
  const syncer: CharacterSyncer = { sync: async (id) => { synced.push(id); return 'updated'; } };
  return { blizzard, syncer, asked, synced };
}

describe('addCharacter', () => {
  it('resolves the realm ID to Blizzard’s slug, saves the character and syncs it', async () => {
    const db = await openTestDb();
    const d = deps();
    const result = await addCharacter({ db, blizzard: d.blizzard, syncer: d.syncer, now: () => 5 }, { region: 'eu', name: 'testbear', realmId: 503 });
    expect(result.created).toBe(true);
    expect(d.asked[0]).toEqual({ region: 'eu', realmSlug: 'azjol-nerub', name: 'testbear' });
    expect(await getCharacter(db, result.id)).toMatchObject({ name: 'Testbear', realmSlug: 'azjol-nerub', specName: 'Guardian' });
    expect(d.synced).toEqual([result.id]);
  });

  it('returns the existing character without syncing again', async () => {
    const db = await openTestDb();
    const d = deps();
    const context = { db, blizzard: d.blizzard, syncer: d.syncer, now: () => 5 };
    const first = await addCharacter(context, { region: 'eu', name: 'Testbear', realmSlug: 'azjol-nerub' });
    const second = await addCharacter(context, { region: 'eu', name: 'TESTBEAR', realmSlug: 'azjol-nerub' });
    expect(second).toEqual({ id: first.id, created: false });
    expect(d.synced).toHaveLength(1);
  });

  it('rejects an unknown realm ID', async () => {
    const db = await openTestDb();
    const d = deps();
    await expect(addCharacter({ db, blizzard: d.blizzard, syncer: d.syncer, now: () => 5 }, { region: 'eu', name: 'x', realmId: 1 }))
      .rejects.toThrow(UserError);
  });

  it('explains when Blizzard can’t find the character', async () => {
    const db = await openTestDb();
    const d = deps(async () => { throw new HttpError(404, 'u', ''); });
    await expect(addCharacter({ db, blizzard: d.blizzard, syncer: d.syncer, now: () => 5 }, { region: 'eu', name: 'Nobody', realmSlug: 'azjol-nerub' }))
      .rejects.toThrow('Blizzard can’t find Nobody on that realm.');
  });
});
