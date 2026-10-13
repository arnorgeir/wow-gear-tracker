import { OFFERED_SOURCES, SOURCE_NAMES } from '@/core/types';

/** The picker's choices, in the order they show. */
export const sourceOptions = () => OFFERED_SOURCES.map((value) => ({ value, label: SOURCE_NAMES[value] }));
