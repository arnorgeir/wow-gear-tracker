import type { Db } from '../db/client';
import { getBisLists } from '../db/queries/bis-lists';
import { getSpecSettings, listOverrides } from '../db/queries/bis-settings';
import { getCatalogItems } from '../db/queries/item-catalog';
import { getManualLists, setManualSource, writeManualCopy } from '../db/queries/manual-lists';
import { withWriteLock } from '../db/queries/write-lock';
import { UserError } from '../errors';
import { readBisLists, type BisRead } from '../sync/reference-sync';
import { LIST_TYPES, type BisLists, type BisRow, type BisSourceId, type FetchedSourceId } from '../types';
import { applyOverrides } from './overlay';

const NOTHING_TO_COPY = 'Fetch a list first, then copy it.';

const plain = (r: BisRow): BisRow => {
  if (r.kind !== 'item' || !r.edited) return r;
  const copy = { ...r };
  delete copy.edited;
  return copy;
};

export interface SpecBase extends BisRead { source: BisSourceId; copiedFrom: FetchedSourceId | null }

/**
 * The spec's base lists for an account: its chosen source's cache, or its manual copy, with what the page
 * should say about them. A manual copy is always ready: it never loads, never syncs and never fails. Database reads only.
 */
export async function readSpecBase(db: Db, accountId: number, specSlug: string, now: number): Promise<SpecBase> {
  const { source } = await getSpecSettings(db, accountId, specSlug);
  if (source !== 'manual') return { ...(await readBisLists(db, source, specSlug, now)), source, copiedFrom: null };
  const manual = await getManualLists(db, accountId, specSlug);
  return {
    source, copiedFrom: manual?.copiedFrom ?? null, lists: manual?.lists ?? null, fetchedAt: manual?.copiedAt ?? null,
    error: null, status: 'ready', due: false,
  };
}

/** A fetched source's lists with the account's overrides for it applied. Null when the source has no cached rows. */
export async function effectiveLists(db: Db, accountId: number, specSlug: string, source: FetchedSourceId): Promise<BisLists | null> {
  const cached = await getBisLists(db, source, specSlug);
  if (!cached) return null;
  const overrides = await listOverrides(db, accountId, specSlug, source);
  const catalog = await getCatalogItems(db, LIST_TYPES.flatMap((l) => overrides[l].map((o) => o.itemId)));
  const out: BisLists = { overall: [], raid: [], mythicPlus: [] };
  for (const l of LIST_TYPES) out[l] = applyOverrides(cached.lists[l], overrides[l], catalog).rows.map(plain);
  return out;
}

// withWriteLock isn't reentrant: these read inside the lock, then write through unlocked queries.

/** Switches the spec to Manual. The first time, copies the current source's lists with the account's edits. */
export async function chooseManual(db: Db, accountId: number, specSlug: string, now: number) {
  await withWriteLock(db, async () => {
    const { source } = await getSpecSettings(db, accountId, specSlug);
    if (source === 'manual') return;
    if (await getManualLists(db, accountId, specSlug)) return setManualSource(db, accountId, specSlug);
    const lists = await effectiveLists(db, accountId, specSlug, source);
    if (!lists) throw new UserError(NOTHING_TO_COPY);
    await writeManualCopy(db, accountId, specSlug, source, lists, now);
  });
}

/** Replaces the manual lists with a fresh copy of a source's lists. Manual edits are dropped. */
export async function copyManual(db: Db, accountId: number, specSlug: string, from: FetchedSourceId, now: number) {
  await withWriteLock(db, async () => {
    const lists = await effectiveLists(db, accountId, specSlug, from);
    if (!lists) throw new UserError(NOTHING_TO_COPY);
    await writeManualCopy(db, accountId, specSlug, from, lists, now);
  });
}
