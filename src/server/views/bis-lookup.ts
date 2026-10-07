import { ensureBisLists, ensureTierTargets, type BisResult } from '@/core/sync/reference-sync';
import type { Region, TierTarget } from '@/core/types';
import type { Services } from '../services';

export interface SpecBis extends BisResult { targets: ReadonlyMap<number, TierTarget> }

/** One BiS lookup per page: Method's lists once per spec, their tier items' stat pairs once per spec and region. */
export function createBisLookup({ db, blizzard, bisSource }: Pick<Services, 'db' | 'blizzard' | 'bisSource'>, time: number) {
  const lists = new Map<string, Promise<BisResult>>();
  const lookups = new Map<string, Promise<SpecBis>>();
  return (slug: string, region: Region): Promise<SpecBis> => {
    if (!lists.has(slug)) lists.set(slug, ensureBisLists({ db, source: bisSource, now: time }, slug));
    const key = `${region}:${slug}`;
    if (!lookups.has(key)) {
      lookups.set(key, (async () => {
        const bis = await lists.get(slug)!;
        return { ...bis, targets: await ensureTierTargets({ db, blizzard, now: time }, region, bis.lists) };
      })());
    }
    return lookups.get(key)!;
  };
}
