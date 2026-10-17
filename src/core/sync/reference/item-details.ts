import type { BlizzardClient } from '../../blizzard/client';
import type { ItemDetails } from '../../blizzard/types';
import type { Db } from '../../db/client';
import { getItemDetailsMap, upsertItemDetails } from '../../db/queries/media';
import type { Region } from '../../types';

export async function ensureItemDetails(
  deps: { db: Db; blizzard: BlizzardClient; now: number }, region: Region, itemIds: number[],
): Promise<Map<number, ItemDetails>> {
  const { db, blizzard, now } = deps;
  const unique = [...new Set(itemIds)];
  const known = await getItemDetailsMap(db, unique);
  const unknown = unique.filter((id) => !known.has(id));
  const fetched = await Promise.all(unknown.map(async (itemId) => {
    try {
      const details = await blizzard.getItemDetails(region, itemId);
      return { itemId, quality: details?.quality ?? null, isTier: details?.isTier ?? false };
    } catch {
      return null;
    }
  }));
  const found = fetched.filter((entry): entry is { itemId: number } & ItemDetails => entry !== null);
  if (found.length > 0) await upsertItemDetails(db, found, now);
  return getItemDetailsMap(db, unique);
}
