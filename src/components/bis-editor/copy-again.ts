import { FETCHED_SOURCES, SOURCE_NAMES, type FetchedSourceId } from '@/core/types';

/** The sources "Copy again" offers: both fetched ones, the one the copy came from first. */
export const copyChoices = (copiedFrom: FetchedSourceId | null): FetchedSourceId[] =>
  copiedFrom ? [copiedFrom, ...FETCHED_SOURCES.filter((s) => s !== copiedFrom)] : [...FETCHED_SOURCES];

export const copyConfirm = (from: FetchedSourceId) => `Replace your manual list with ${SOURCE_NAMES[from]}'s? Your edits on it are lost.`;
