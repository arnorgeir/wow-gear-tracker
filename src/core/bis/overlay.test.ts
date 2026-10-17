import { describe, expect, it } from 'vitest';
import type { BisRow, CatalogItem } from '../types';
import { applyOverrides } from './overlay';

const head: BisRow = { kind: 'item', slotLabel: 'Head', slots: ['HEAD'], itemId: 10, name: 'Method Crown', bonusIds: [1], isTier: true, isCatalyst: false, source: 'Raid' };
const ring1: BisRow = { kind: 'item', slotLabel: 'Ring', slots: ['FINGER_1', 'FINGER_2'], itemId: 20, name: 'Band A', bonusIds: [], isTier: false, isCatalyst: false, source: 'Alpha Hollow' };
const ring2: BisRow = { ...ring1, itemId: 21, name: 'Band B' };
const catalog = new Map<number, CatalogItem>([
  [30, { itemId: 30, name: 'Birkibjörn Band', inventoryType: 'FINGER', armorType: null, weaponType: null, quality: 'EPIC', isTier: false }],
  [31, { itemId: 31, name: 'Woven Hood', inventoryType: 'HEAD', armorType: 'cloth', weaponType: null, quality: 'EPIC', isTier: false }],
  [32, { itemId: 32, name: 'Frostbound Crown', inventoryType: 'HEAD', armorType: 'cloth', weaponType: null, quality: 'EPIC', isTier: true }],
]);

describe('applyOverrides', () => {
  it('replaces the keyed row and keeps the rest', () => {
    const out = applyOverrides([head, ring1, ring2], [{ slotKey: 'Ring#2', itemId: 30, catalyst: false }], catalog);
    expect(out.editedCount).toBe(1);
    expect(out.orphans).toEqual([]);
    expect(out.rows[0]).toBe(head);
    expect(out.rows[1]).toBe(ring1);
    expect(out.rows[2]).toEqual({ kind: 'item', slotLabel: 'Ring', slots: ['FINGER_1', 'FINGER_2'], itemId: 30, name: 'Birkibjörn Band',
      bonusIds: [], isTier: false, isCatalyst: false, source: 'Alpha Hollow', edited: { methodPick: ring2 } });
  });

  it('takes tier identity from the catalog', () => {
    const out = applyOverrides([head], [{ slotKey: 'Head#1', itemId: 32, catalyst: false }], catalog);
    expect(out.rows[0]).toMatchObject({ itemId: 32, isTier: true, isCatalyst: false });
  });

  it('makes a catalyst override a tier row on its base item', () => {
    const out = applyOverrides([head], [{ slotKey: 'Head#1', itemId: 31, catalyst: true }], catalog);
    expect(out.rows[0]).toMatchObject({ itemId: 31, name: 'Woven Hood', isTier: true, isCatalyst: true });
  });

  it('returns overrides for missing slots or uncataloged items as orphans', () => {
    const gone = { slotKey: 'Rings#1', itemId: 30, catalyst: false };
    const uncataloged = { slotKey: 'Head#1', itemId: 999, catalyst: false };
    const out = applyOverrides([head], [gone, uncataloged], catalog);
    expect(out.rows).toEqual([head]);
    expect(out.editedCount).toBe(0);
    expect(out.orphans).toEqual([gone, uncataloged]);
  });
});
