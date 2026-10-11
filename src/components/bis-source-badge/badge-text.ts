import { editedText } from '@/components/shared/edited-text';

/** The badge's two parts: where the list comes from, and how many slots the account edited (null when none). */
export const badgeText = (source: string, editedCount: number) =>
  ({ source: `From ${source}`, edited: editedCount > 0 ? editedText(editedCount) : null });
