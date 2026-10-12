import { SOURCE_NAMES, type BisSourceId } from '@/core/types';

const ORDER: BisSourceId[] = ['method', 'icyVeins', 'manual'];

/** The picker's choices, in the order they show. */
export const sourceOptions = () => ORDER.map((value) => ({ value, label: SOURCE_NAMES[value] }));
