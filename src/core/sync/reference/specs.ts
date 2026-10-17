import type { BlizzardClient } from '../../blizzard/client';
import type { Db } from '../../db/client';
import { getMeta, setMeta } from '../../db/queries/meta';
import { replaceSpecs } from '../../db/queries/specs';
import { createLimiter } from '../../http';
import { methodSpecSlug } from '../../method/method';
import type { Region } from '../../types';
import { cacheTiming } from '../freshness';

const SPEC_ICON_PARALLEL = 6;
const SPECS_META_KEY = 'specs.v2.fetchedAt';
const SPECS_FAILED_META_KEY = 'specs.failedAt';

/** Refreshes the spec catalog when a day old. Keeps old rows on failure; never throws for an upstream failure. */
export async function syncSpecs(deps: { db: Db; blizzard: BlizzardClient; now: number }, region: Region): Promise<boolean> {
  const { db, blizzard, now } = deps;
  const fetchedAt = await getMeta(db, SPECS_META_KEY);
  const failed = await getMeta(db, SPECS_FAILED_META_KEY);
  if (!cacheTiming(fetchedAt?.updatedAt ?? null, failed?.updatedAt ?? null, now).due) return false;
  try {
    const classes = await blizzard.getClasses(region);
    const limit = createLimiter(SPEC_ICON_PARALLEL);
    // A spec whose icon can't be fetched keeps a null icon: views fall back to the class icon.
    const iconOf = (specId: number | undefined) => limit(async () => {
      try {
        return specId === undefined ? null : await blizzard.getSpecIconUrl(region, specId);
      } catch {
        return null;
      }
    });
    const rows = await Promise.all(classes.flatMap((c) => c.specs.map(async (specName, i) => ({
      methodSlug: methodSpecSlug(specName, c.name), classId: c.id, className: c.name, specName, iconUrl: await iconOf(c.specIds?.[i]),
    }))));
    if (rows.length === 0) throw new Error('No specs in the class index');
    await replaceSpecs(db, rows, now);
    await setMeta(db, SPECS_META_KEY, String(now), now);
  } catch {
    await setMeta(db, SPECS_FAILED_META_KEY, String(now), now);
  }
  return true;
}
