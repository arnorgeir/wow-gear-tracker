import type { Db } from '@/core/db/client';
import { applyOverrides } from '@/core/bis/overlay';
import { readSpecBase, type SpecBase } from '@/core/bis/spec-base';
import { getSpecSettings, listOverrides } from '@/core/db/queries/bis-settings';
import { getCatalogItems } from '@/core/db/queries/item-catalog';
import { readTierTargets } from '@/core/sync/reference/tier-stats';
import { LIST_TYPES, type BisOverride, type ListType, type Region, type TierTarget } from '@/core/types';

interface Overlay {
  listType: ListType;
  statsMatter: boolean;
  editedCount: number;
  /** Overrides that no longer fit a row of the source's list, by list. */
  orphans: Record<ListType, BisOverride[]>;
}

export interface SpecBis extends SpecBase, Overlay {
  targets: ReadonlyMap<number, TierTarget>;
  targetsDue: boolean;
  /** This spec's due work, by name, for the page's background sync key. */
  dueKeys: string[];
}

/** The chosen source's lists with the account's overrides and settings. Database reads only, in sequence. */
async function readEffective(db: Db, slug: string, time: number, accountId: number): Promise<SpecBase & Overlay> {
  const read = await readSpecBase(db, accountId, slug, time);
  const { listType, statsMatter } = await getSpecSettings(db, accountId, slug);
  const settings = { listType, statsMatter };
  const overrides = await listOverrides(db, accountId, slug, read.source);
  const catalog = await getCatalogItems(db, LIST_TYPES.flatMap((l) => overrides[l].map((o) => o.itemId)));
  const orphans: Record<ListType, BisOverride[]> = { overall: [], raid: [], mythicPlus: [] };
  if (!read.lists) return { ...read, ...settings, editedCount: 0, orphans };
  const effective = { ...read.lists };
  let editedCount = 0;
  for (const l of LIST_TYPES) {
    const out = applyOverrides(read.lists[l], overrides[l], catalog);
    effective[l] = out.rows;
    editedCount += out.editedCount;
    orphans[l] = out.orphans;
  }
  return { ...read, lists: effective, ...settings, editedCount, orphans };
}

/** One BiS lookup per page, from the database only: lists once per spec, tier stat pairs once per spec and region. */
export function createBisLookup(db: Db, time: number, accountId: number) {
  const lists = new Map<string, Promise<SpecBase & Overlay>>();
  const lookups = new Map<string, Promise<SpecBis>>();
  return (slug: string, region: Region): Promise<SpecBis> => {
    if (!lists.has(slug)) lists.set(slug, readEffective(db, slug, time, accountId));
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
