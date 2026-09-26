import type { BlizzardClient } from '../blizzard/client';
import type { Db } from '../db/client';
import { gearToSnapshotItems, getCharacter, saveSnapshotIfChanged, updateCharacter } from '../db/queries';
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
    try {
      const [profile, gear] = await Promise.all([blizzard.getProfile(ref), blizzard.getEquipment(ref)]);
      await updateCharacter(db, characterId, {
        className: profile.className,
        specName: profile.specName || character.specName,
        status: 'ok',
        lastSyncedAt: time,
        lastSyncError: null,
      });
      const { changed } = await saveSnapshotIfChanged(db, characterId, 'blizzard', gearToSnapshotItems(gear), time);
      return changed ? 'updated' : 'unchanged';
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) {
        await updateCharacter(db, characterId, { status: 'notFound', lastSyncedAt: time, lastSyncError: 'Blizzard can’t find this character' });
        return 'notFound';
      }
      const reason = err instanceof HttpError ? `Blizzard returned ${err.status}` : 'Blizzard couldn’t be reached';
      await updateCharacter(db, characterId, { lastSyncError: `${reason}. Showing the last saved gear.` });
      return 'error';
    }
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
