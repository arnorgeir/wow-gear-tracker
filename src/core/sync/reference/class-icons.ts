import type { BlizzardClient } from '../../blizzard/client';
import type { Db } from '../../db/client';
import { getClassIconMap, upsertClassIcons } from '../../db/queries/media';
import { getMeta, setMeta } from '../../db/queries/meta';
import type { Region } from '../../types';
import { DAY_MS, cacheTiming } from '../freshness';

const CLASS_ICONS_META_KEY = 'classIcons.v1.fetchedAt';
const CLASS_ICONS_FAILED_META_KEY = 'classIcons.failedAt';
const CLASS_ICONS_TTL_MS = 30 * DAY_MS;

/**
 * Class icons change rarely: refresh every 30 days. A failed call never overwrites a cached icon,
 * and after any failure the next attempt waits an hour, so a Blizzard outage can't slow every page.
 * Calls that arrive while one runs share it, so a cold cache fetches the icons once.
 */
export function ensureClassIcons(
  deps: { db: Db; blizzard: BlizzardClient; now: number }, region: Region,
): Promise<Map<string, string | null>> {
  const running = classIconRuns.get(deps.db);
  if (running) return running;
  const run = loadClassIcons(deps, region).finally(() => classIconRuns.delete(deps.db));
  classIconRuns.set(deps.db, run);
  return run;
}

// Next bundles this module once per server chunk while getServices() shares one Db across them,
// so the registry lives on globalThis under a Symbol.for key, as the write locks do.
const holder = globalThis as unknown as Record<symbol, WeakMap<Db, Promise<Map<string, string | null>>> | undefined>;
const classIconRuns = (holder[Symbol.for('wow-gear-tracker.classIconRuns')] ??= new WeakMap());

async function loadClassIcons(
  deps: { db: Db; blizzard: BlizzardClient; now: number }, region: Region,
): Promise<Map<string, string | null>> {
  const { db, blizzard, now } = deps;
  const fetchedAt = await getMeta(db, CLASS_ICONS_META_KEY);
  const failedAt = await getMeta(db, CLASS_ICONS_FAILED_META_KEY);
  if (cacheTiming(fetchedAt?.updatedAt ?? null, failedAt?.updatedAt ?? null, now, CLASS_ICONS_TTL_MS).due) {
    try {
      const classes = await blizzard.getClasses(region);
      const results = await Promise.all(classes.map(async (cls) => {
        try {
          // null here means Blizzard has no icon for the class (404), which is safe to store.
          return { className: cls.name, classId: cls.id, iconUrl: await blizzard.getClassIconUrl(region, cls.id) };
        } catch {
          return null;
        }
      }));
      const found = results.filter((entry): entry is { className: string; classId: number; iconUrl: string | null } => entry !== null);
      if (found.length > 0) await upsertClassIcons(db, found, now);
      await setMeta(db, found.length === classes.length ? CLASS_ICONS_META_KEY : CLASS_ICONS_FAILED_META_KEY, String(now), now);
    } catch {
      await setMeta(db, CLASS_ICONS_FAILED_META_KEY, String(now), now);
    }
  }
  return getClassIconMap(db);
}
