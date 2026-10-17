import { getCharacter } from '@/core/db/queries/characters';
import { getItemIcons } from '@/core/db/queries/media';
import { getLatestVaultPaste } from '@/core/db/queries/snapshots';
import { readTracks } from '@/core/sync/reference-sync';
import { formatWeek, weekStart } from '@/core/vault/week';
import type { Services } from '../services';
import { createBisLookup } from './bis-lookup';
import { loadMember, vaultChoicesFor } from './member';
import type { VaultWeekView } from './types';

/**
 * The latest earlier week with a vault paste, judged against today's BiS list. Reads only (it backs a GET).
 * Null for an unknown character.
 */
export async function getVaultHistoryWeek(services: Services, id: number, before: number): Promise<{ week: VaultWeekView | null; nextBefore: number | null } | null> {
  const { db, now } = services;
  const character = await getCharacter(db, id);
  if (!character) return null;
  const time = now();
  const { tracks } = await readTracks(db, time);
  const member = await loadMember({ db, tracks, now: time, bisFor: createBisLookup(db, time, services.currentAccountId()) }, character);
  const paste = await getLatestVaultPaste(db, id, { before });
  if (!paste) return { week: null, nextBefore: null };
  const start = weekStart(character.region, paste.createdAt);
  const icons = await getItemIcons(db, paste.items.map((i) => i.itemId));
  const choices = vaultChoicesFor(paste.items, member.bis.lists?.[member.choice.listType] ?? [], icons, tracks);
  const nextBefore = (await getLatestVaultPaste(db, id, { before: start })) ? start : null;
  return { week: { start, label: formatWeek(character.region, start), pastedAt: paste.createdAt, choices }, nextBefore };
}
