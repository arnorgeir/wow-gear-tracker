import type { Db } from '@/core/db/client';
import { readBisLists, readTierTargets, type BisRead } from '@/core/sync/reference-sync';
import type { Region, TierTarget } from '@/core/types';

export interface SpecBis extends BisRead {
  targets: ReadonlyMap<number, TierTarget>;
  targetsDue: boolean;
  /** This spec's due work, by name, for the page's background sync key. */
  dueKeys: string[];
}

/** One BiS lookup per page, from the database only: lists once per spec, tier stat pairs once per spec and region. */
export function createBisLookup(db: Db, time: number) {
  const lists = new Map<string, Promise<BisRead>>();
  const lookups = new Map<string, Promise<SpecBis>>();
  return (slug: string, region: Region): Promise<SpecBis> => {
    if (!lists.has(slug)) lists.set(slug, readBisLists(db, slug, time));
    const key = `${region}:${slug}`;
    if (!lookups.has(key)) {
      lookups.set(key, (async () => {
        const bis = await lists.get(slug)!;
        const { targets, due: targetsDue } = await readTierTargets(db, { region, specSlug: slug, lists: bis.lists }, time);
        const dueKeys = [...(bis.due ? [`bis:${slug}`] : []), ...(targetsDue ? [`tiers:${key}`] : [])];
        return { ...bis, targets, targetsDue, dueKeys };
      })());
    }
    return lookups.get(key)!;
  };
}

/**
 * The page's background sync key: the reference work due for what it shows, or null. A new key re-arms the
 * sync when the page's needs change mid-sync; the route ignores it and picks its own work.
 */
export function referenceDue(tracksDue: boolean, specs: SpecBis[]): string | null {
  const keys = [...new Set([...(tracksDue ? ['tracks'] : []), ...specs.flatMap((s) => s.dueKeys)])].sort();
  return keys.length > 0 ? keys.join(',') : null;
}
