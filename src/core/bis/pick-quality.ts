import type { Quality } from '../types';

/** The quality a BiS pick shows: Epic, unless its base quality is already above Epic. Base quality is what Blizzard's item API gives, and dungeon loot is Rare there. */
export const pickQuality = (base: Quality | null): Quality => (base === 'LEGENDARY' || base === 'ARTIFACT' ? base : 'EPIC');
