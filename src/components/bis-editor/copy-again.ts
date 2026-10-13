import { FETCHED_SOURCES, SOURCE_NAMES, isOfferedSource, type FetchedSourceId } from '@/core/types';

/** The sources "Copy again" offers: the fetched ones on offer, the one the copy came from first. */
export const copyChoices = (copiedFrom: FetchedSourceId | null): FetchedSourceId[] => {
  const offered = FETCHED_SOURCES.filter(isOfferedSource);
  return copiedFrom && offered.includes(copiedFrom) ? [copiedFrom, ...offered.filter((s) => s !== copiedFrom)] : offered;
};

export const copyConfirm = (from: FetchedSourceId) => `Replace your manual list with ${SOURCE_NAMES[from]}'s? Your edits on it are lost.`;
