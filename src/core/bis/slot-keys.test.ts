import { describe, expect, it } from 'vitest';
import type { BisRow } from '../types';
import { slotKeys } from './slot-keys';

const row = (slotLabel: string): BisRow => ({ kind: 'any', slotLabel, slots: [], minItemLevel: 1, source: '' });

describe('slotKeys', () => {
  it('numbers repeated labels in list order', () => {
    expect(slotKeys([row('Head'), row('Ring'), row('Trinket'), row('Ring')])).toEqual(['Head#1', 'Ring#1', 'Trinket#1', 'Ring#2']);
  });
});
