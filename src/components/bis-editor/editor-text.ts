import { formatAge } from '@/core/format';
import { SOURCE_NAMES, type BisSourceId, type FetchedSourceId } from '@/core/types';
import { editedText } from '@/components/shared/edited-text';

interface ListAge { source: BisSourceId; fetchedAt: number | null; copiedFrom: FetchedSourceId | null; copiedAt: number | null }

/** The header's age line: when the source's list was fetched, or where and when the manual copy came from. */
export function fetchedLine({ source, fetchedAt, copiedFrom, copiedAt }: ListAge, now: number) {
  if (source === 'manual') return copiedFrom && copiedAt !== null ? `Manual · copied from ${SOURCE_NAMES[copiedFrom]} ${formatAge(copiedAt, now)}` : 'Manual';
  const name = SOURCE_NAMES[source];
  return fetchedAt === null ? `${name} list not fetched` : `${name} list fetched ${formatAge(fetchedAt, now)}`;
}

/** The slot table's column for the list's own pick. */
export const pickColumn = (source: BisSourceId, copiedFrom: FetchedSourceId | null) =>
  (source === 'manual' ? (copiedFrom ? `Copied from ${SOURCE_NAMES[copiedFrom]}` : 'Copied pick') : `${SOURCE_NAMES[source]}'s pick`);

/** The item search's label: which pick an override replaces. */
export const replaceText = (source: BisSourceId, slotLabel: string, copiedFrom: FetchedSourceId | null) =>
  (source === 'manual' ? (copiedFrom ? `Replace the ${slotLabel} pick copied from ${SOURCE_NAMES[copiedFrom]}` : `Replace the copied ${slotLabel} pick`) : `Replace ${SOURCE_NAMES[source]}'s ${slotLabel} pick`);

/** What an unedited slot says it follows. */
export const followsText = (source: BisSourceId) => (source === 'manual' ? 'Follows your copy' : `Follows ${SOURCE_NAMES[source]}`);

/** The orphan card's heading and line: overrides whose slot left the list. */
export const orphanText = (source: BisSourceId) => source === 'manual'
  ? { heading: 'No longer in your copy', body: "These slots are gone from your copy. Your picks for them aren't applied." }
  : { heading: `No longer in ${SOURCE_NAMES[source]}'s list`, body: `${SOURCE_NAMES[source]} dropped these slots. Your picks for them aren't applied.` };

/** What a slot's button does next: undo an edit, open the search, or close it. */
export const rowButton = ({ edited, open }: { edited: boolean; open: boolean }) => (edited ? 'Reset' : open ? 'Cancel' : 'Override');

/** A phone tab's second line: the compared list says so beside its edit count. */
export const tabSub = (editedCount: number, compared: boolean) => [compared ? 'Compared' : null, editedText(editedCount)].filter(Boolean).join(' · ') || null;

/** `Ring#3` was a slot of the list that no longer exists. */
export const orphanLabel = (slotKey: string) => `Was your pick for ${slotKey.replace('#', ' ')}`;

/** The list's own pick for a row: a catalyst base reads as the tier piece it turns into. */
export const methodPickName = (pick: { name: string; isTier: boolean; isCatalyst: boolean }) =>
  (pick.isTier && pick.isCatalyst ? `Tier piece (catalyst ${pick.name})` : pick.name);

export const anyPickName = (minItemLevel: number) => ({ name: `Any ${minItemLevel}`, detail: `Any item at item level ${minItemLevel} or higher` });
