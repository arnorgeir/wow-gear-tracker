import { describe, expect, it } from 'vitest';
import { itemKind } from './item-kind';

describe('itemKind', () => {
  it('joins armor type and slot', () => {
    expect(itemKind({ armorType: 'leather', inventoryType: 'WRIST' })).toBe('Leather wrist');
  });

  it('names the slot alone when there is no armor type', () => {
    expect(itemKind({ armorType: null, inventoryType: 'TRINKET' })).toBe('Trinket');
  });

  it('lowercases an unknown slot with underscores as spaces', () => {
    expect(itemKind({ armorType: null, inventoryType: 'SOMETHING_NEW' })).toBe('Something new');
  });

  it('gives null when the slot is unknown', () => {
    expect(itemKind({ armorType: 'plate', inventoryType: null })).toBeNull();
  });

  it('gives null for an item nobody wears, such as a recipe', () => {
    expect(itemKind({ armorType: null, inventoryType: 'NON_EQUIP' })).toBeNull();
  });
});
