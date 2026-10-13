import { SOURCE_NAMES, type BisSourceId, type ListType } from '@/core/types';
import { LIST_NAMES } from './list-names';

/** Who a fallback notice blames: the source by name, or the account's own copy. */
export const sourceSubject = (source: BisSourceId) => (source === 'manual' ? 'Your copy' : SOURCE_NAMES[source]);

/** The start of a fallback notice: who lacks which list. Each notice finishes the sentence its own way. */
export const fallbackText = (source: BisSourceId, from: ListType) => `${sourceSubject(source)} has no ${LIST_NAMES[from]} list`;
