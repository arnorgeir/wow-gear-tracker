import { LIST_NAMES } from '@/components/shared/list-names';
import type { ListType } from '@/core/types';

/** A class's summary in the phone accordion: how many specs are tracked, else how many it has. */
export const classSummary = (trackedCount: number, specCount: number) => (trackedCount > 0 ? `${trackedCount} tracked` : `${specCount} specs`);

/** A tracked spec's state line on a phone, where there is no room for the pill. */
export const trackedLine = (characterName: string, list: ListType) => `Tracked: ${characterName} · compares ${LIST_NAMES[list]}`;
