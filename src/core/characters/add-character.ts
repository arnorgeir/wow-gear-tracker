import type { BlizzardClient } from '../blizzard/client';
import type { Db } from '../db/client';
import { insertCharacter } from '../db/queries';
import { UserError } from '../errors';
import { HttpError } from '../http';
import type { CharacterSyncer } from '../sync/character-sync';
import type { Region } from '../types';

export interface AddCharacterInput {
  region: Region;
  name: string;
  realmId?: number;
  realmSlug?: string;
}

interface Deps {
  db: Db;
  blizzard: BlizzardClient;
  syncer: CharacterSyncer;
  now: () => number;
}

export async function addCharacter({ db, blizzard, syncer, now }: Deps, input: AddCharacterInput): Promise<{ id: number; created: boolean }> {
  const name = input.name.trim();
  if (!name) throw new UserError('Enter a character name.');

  let realmSlug = input.realmSlug?.trim();
  if (!realmSlug && input.realmId !== undefined) {
    const realm = (await blizzard.getRealms(input.region)).find((r) => r.id === input.realmId);
    if (!realm) throw new UserError('That realm doesn’t exist in this region.');
    realmSlug = realm.slug;
  }
  if (!realmSlug) throw new UserError('Pick a realm.');

  let profile;
  try {
    profile = await blizzard.getProfile({ region: input.region, realmSlug, name });
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) throw new UserError(`Blizzard can’t find ${name} on that realm.`);
    throw err;
  }

  const result = await insertCharacter(db, {
    region: input.region,
    realmId: profile.realmId,
    realmSlug: profile.realmSlug,
    realmName: profile.realmName,
    name: profile.name,
    className: profile.className,
    specName: profile.specName,
  }, now());
  if (result.created) await syncer.sync(result.id, { force: true });
  return result;
}
