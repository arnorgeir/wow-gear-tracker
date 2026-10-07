import { ensureBisLists, ensureTierTargets, type BisResult } from '@/core/sync/reference-sync';
import type { Region, TierTarget } from '@/core/types';
import type { Services } from '../services';

export interface SpecBis extends BisResult { targets: ReadonlyMap<number, TierTarget> }

/** One BiS lookup per spec and region per page: Method's lists plus their tier items' stat pairs. */
export function createBisLookup({ db, blizzard, bisSource }: Pick<Services, 'db' | 'blizzard' | 'bisSource'>, time: number) {
  const cache = new Map<string, Promise<SpecBis>>();
  return (slug: string, region: Region): Promise<SpecBis> => {
    const key = `${region}:${slug}`;
    if (!cache.has(key)) {
      cache.set(key, (async () => {
        const bis = await ensureBisLists({ db, source: bisSource, now: time }, slug);
        return { ...bis, targets: await ensureTierTargets({ db, blizzard, now: time }, region, bis.lists) };
      })());
    }
    return cache.get(key)!;
  };
}
