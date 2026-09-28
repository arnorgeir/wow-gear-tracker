import type { BlizzardClient } from '../blizzard/client';
import type { Db } from '../db/client';
import { gearToSnapshotItems, saveSnapshotIfChanged } from '../db/queries/snapshots';
import { getCharacter, updateCharacter } from '../db/queries/characters';
import { HttpError } from '../http';

export const GEAR_TTL_MS = 5 * 60 * 1000;

export const isStale = (lastSyncedAt: number | null, now: number, ttlMs = GEAR_TTL_MS) =>
  lastSyncedAt === null || now - lastSyncedAt >= ttlMs;

export type SyncResult = 'skipped' | 'unchanged' | 'updated' | 'notFound' | 'error';

export interface CharacterSyncer {
  sync(characterId: number, options?: { force?: boolean }): Promise<SyncResult>;
}

interface Deps {
  db: Db;
  blizzard: BlizzardClient;
  now?: () => number;
  ttlMs?: number;
}

export function createCharacterSyncer({ db, blizzard, now = Date.now, ttlMs = GEAR_TTL_MS }: Deps): CharacterSyncer {
  const inFlight = new Map<number, Promise<SyncResult>>();

  async function run(characterId: number, force: boolean): Promise<SyncResult> {
    const character = await getCharacter(db, characterId);
    if (!character) throw new Error(`Character ${characterId} not found`);
    const time = now();
    if (!force && !isStale(character.lastSyncedAt, time, ttlMs)) return 'skipped';

    const ref = { region: character.region, realmSlug: character.realmSlug, name: character.name };
    // The avatar is nice to have: a failed or empty media call never fails the sync.
    const media = blizzard.getCharacterMedia(ref).catch(() => null);
    let profile, gear;
    try {
      [profile, gear] = await Promise.all([blizzard.getProfile(ref), blizzard.getEquipment(ref)]);
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) {
        await updateCharacter(db, characterId, { status: 'notFound', lastSyncedAt: time, lastSyncError: 'Blizzard can’t find this character' });
        return 'notFound';
      }
      // HttpError is a Blizzard response; fetch throws TypeError (or a TimeoutError) when Blizzard can't be reached.
      const isNetwork = err instanceof TypeError || (err instanceof Error && err.name === 'TimeoutError');
      if (!(err instanceof HttpError) && !isNetwork) throw err;
      const reason = err instanceof HttpError ? `Blizzard returned ${err.status}` : 'Blizzard couldn’t be reached';
      await updateCharacter(db, characterId, { lastSyncError: `${reason}. Showing the last saved gear.` });
      return 'error';
    }

    // Save the gear before marking the character fresh, so a failed save is retried on the next load.
    const { changed } = await saveSnapshotIfChanged(db, characterId, 'blizzard', gearToSnapshotItems(gear), time);
    const avatarUrl = await media;
    await updateCharacter(db, characterId, {
      className: profile.className,
      specName: profile.specName || character.specName,
      race: profile.raceName || character.race,
      faction: profile.faction ?? character.faction,
      avatarUrl: avatarUrl ?? character.avatarUrl,
      status: 'ok',
      lastSyncedAt: time,
      lastSyncError: null,
    });
    return changed ? 'updated' : 'unchanged';
  }

  return {
    sync(characterId, options = {}) {
      const existing = inFlight.get(characterId);
      if (existing) return existing;
      const promise = run(characterId, options.force ?? false).finally(() => inFlight.delete(characterId));
      inFlight.set(characterId, promise);
      return promise;
    },
  };
}
