import { describe, expect, it } from 'vitest';
import { resultDetail } from './result-detail';

describe('resultDetail', () => {
  it('joins armor type and slot, then the source', () => {
    expect(resultDetail({ armorType: 'leather', inventoryType: 'WRIST', source: 'Den of Nalorakk' })).toBe('Leather wrist · Den of Nalorakk');
  });

  it('names a looked-up item as looked up earlier, and leaves armor type off non-armor', () => {
    expect(resultDetail({ armorType: null, inventoryType: 'FINGER', source: null })).toBe('Ring · looked up earlier');
  });

  it('falls back to the raw slot name for a slot it does not know', () => {
    expect(resultDetail({ armorType: null, inventoryType: 'SOMETHING_NEW', source: 'AH' })).toBe('Something new · AH');
    expect(resultDetail({ armorType: null, inventoryType: null, source: 'AH' })).toBe('AH');
  });
});
