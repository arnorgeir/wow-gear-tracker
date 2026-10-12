import { editedText } from '@/components/shared/edited-text';
import { SOURCE_NAMES, type BisSourceId } from '@/core/types';

/** The badge's two parts: where the list comes from, and how many slots the account edited (null when none). */
export const badgeText = (source: BisSourceId, editedCount: number) =>
  ({ source: source === 'manual' ? 'Manual' : `From ${SOURCE_NAMES[source]}`, edited: editedCount > 0 ? editedText(editedCount) : null });
