import { formatAge } from '@/core/format';
import { editedText } from '@/components/shared/edited-text';

export const fetchedLine = (fetchedAt: number | null, now: number) =>
  (fetchedAt === null ? 'Method list not fetched' : `Method list fetched ${formatAge(fetchedAt, now)}`);

/** What a slot's button does next: undo an edit, open the search, or close it. */
export const rowButton = ({ edited, open }: { edited: boolean; open: boolean }) => (edited ? 'Reset' : open ? 'Cancel' : 'Override');

/** A phone tab's second line: the compared list says so beside its edit count. */
export const tabSub = (editedCount: number, compared: boolean) => (compared ? `Compared · ${editedText(editedCount)}` : editedText(editedCount));

/** `Ring#3` was a slot of Method's list that no longer exists. */
export const orphanLabel = (slotKey: string) => `Was your pick for ${slotKey.replace('#', ' ')}`;

/** Method's pick for a row: a catalyst base reads as the tier piece it turns into. */
export const methodPickName = (pick: { name: string; isTier: boolean; isCatalyst: boolean }) =>
  (pick.isTier && pick.isCatalyst ? `Tier piece (catalyst ${pick.name})` : pick.name);

export const anyPickName = (minItemLevel: number) => ({ name: `Any ${minItemLevel}`, detail: `Any item at item level ${minItemLevel} or higher` });
