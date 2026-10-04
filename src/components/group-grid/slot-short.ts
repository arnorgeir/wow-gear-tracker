import type { SlotType } from '@/core/types';

/** Slot labels that fit a 44 px phone column. The full label stays for screen readers. */
export const SLOT_SHORT: Record<SlotType, string> = {
  HEAD: 'Head', NECK: 'Neck', SHOULDER: 'Shldr', BACK: 'Cloak', CHEST: 'Chest', WRIST: 'Wrist', HANDS: 'Gloves',
  WAIST: 'Belt', LEGS: 'Legs', FEET: 'Boots', FINGER_1: 'Ring 1', FINGER_2: 'Ring 2', TRINKET_1: 'Trink 1',
  TRINKET_2: 'Trink 2', MAIN_HAND: 'Weap', OFF_HAND: 'Off-h',
};
