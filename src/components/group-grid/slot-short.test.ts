import { describe, expect, it } from 'vitest';
import { SLOT_TYPES } from '@/core/types';
import { SLOT_SHORT } from './slot-short';

describe('SLOT_SHORT', () => {
  it('gives every slot a label of at most seven characters', () => {
    for (const slot of SLOT_TYPES) expect(SLOT_SHORT[slot].length).toBeLessThanOrEqual(7);
  });

  it('numbers rings and trinkets and shortens the long ones', () => {
    expect([SLOT_SHORT.SHOULDER, SLOT_SHORT.FINGER_2, SLOT_SHORT.TRINKET_1, SLOT_SHORT.MAIN_HAND, SLOT_SHORT.OFF_HAND])
      .toEqual(['Shldr', 'Ring 2', 'Trink 1', 'Weap', 'Off-h']);
  });
});
