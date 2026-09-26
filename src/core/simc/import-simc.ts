import type { BlizzardClient } from '../blizzard/client';
import type { Db } from '../db/client';
import { getCharacter, saveSnapshotIfChanged, type SnapshotItemInput } from '../db/queries';
import { UserError } from '../errors';
import { qualityFromBonuses } from '../raidbots/tracks';
import { ensureItemDetails } from '../sync/reference-sync';
import type { ItemLocation, Quality } from '../types';
import { parseSimc, SimcParseError, type SimcProfile } from './parse';

export interface ImportResult {
  changed: boolean;
  equipped: number;
  bags: number;
  vault: number;
}

interface Deps {
  db: Db;
  blizzard: BlizzardClient;
  qualities: ReadonlyMap<number, Quality>;
  now: () => number;
}

// SimC tokens drop spaces, dashes and apostrophes ("tarren_mill", "azjolnerub"), so compare letters and digits only.
const normalize = (text: string) => text.normalize('NFC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]/gu, '');

export async function importSimc({ db, blizzard, qualities, now }: Deps, characterId: number, text: string): Promise<ImportResult> {
  const character = await getCharacter(db, characterId);
  if (!character) throw new UserError('That character isn’t tracked anymore.');

  let profile: SimcProfile;
  try {
    profile = parseSimc(text);
  } catch (err) {
    if (err instanceof SimcParseError) throw new UserError(`Couldn’t read that SimC text. ${err.message}`);
    throw err;
  }

  if (normalize(profile.name) !== normalize(character.name)) {
    throw new UserError(`This SimC export is for ${profile.name}, not ${character.name}.`);
  }
  if (profile.region.toLowerCase() !== character.region) {
    throw new UserError(`This SimC export is from region ${profile.region.toUpperCase() || 'unknown'}, but ${character.name} is in ${character.region.toUpperCase()}.`);
  }
  const realm = normalize(profile.realmToken);
  if (realm !== normalize(character.realmName) && realm !== normalize(character.realmSlug)) {
    throw new UserError(`This SimC export is from the realm "${profile.realmToken}", but ${character.name} is on ${character.realmName}.`);
  }

  const time = now();
  const details = await ensureItemDetails({ db, blizzard, now: time }, character.region, profile.items.map((i) => i.itemId));
  const items: SnapshotItemInput[] = profile.items.map((item) => ({
    location: item.location,
    slot: item.slot,
    itemId: item.itemId,
    name: item.name ?? `Item ${item.itemId}`,
    itemLevel: item.itemLevel,
    quality: qualityFromBonuses(item.bonusIds, qualities) ?? details.get(item.itemId)?.quality ?? 'COMMON',
    bonusIds: item.bonusIds,
    isTier: details.get(item.itemId)?.isTier ?? false,
  }));

  const { changed } = await saveSnapshotIfChanged(db, characterId, 'simc', items, time, profile.currencies);
  const count = (location: ItemLocation) => items.filter((i) => i.location === location).length;
  return { changed, equipped: count('equipped'), bags: count('bag'), vault: count('vault') };
}
