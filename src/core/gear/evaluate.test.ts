import { describe, expect, it } from 'vitest';
import { countStates, evaluateGear } from './evaluate';
import type { BisRow, GearItem, SlotType, Track } from '../types';

const track = (bonusId: number, name: string, step: number, max = 6): Track =>
  ({ bonusId, name, step, max, group: null, currencyId: null, currencyName: null, costPerStep: null });
const tracks = new Map<number, Track>([
  [1, track(1, 'Myth', 6)],
  [2, track(2, 'Myth', 2)],
  [3, track(3, 'Hero', 5)],
]);

const item = (slot: SlotType, itemId: number, bonusIds: number[] = [], isTier = false): GearItem =>
  ({ slot, itemId, name: `Item ${itemId}`, itemLevel: 300, quality: 'EPIC', bonusIds, isTier });

const row = (slots: SlotType[], itemId: number, isTier = false): BisRow =>
  ({ kind: 'item', slotLabel: slots[0]!, slots, itemId, name: `BiS ${itemId}`, bonusIds: [], isTier, isCatalyst: isTier, source: 'Somewhere' });

describe('evaluateGear', () => {
  it('matches normal rows by item ID', () => {
    const [hit, miss] = evaluateGear({
      equipped: [item('NECK', 10, [1]), item('BACK', 99)],
      bisRows: [row(['NECK'], 10), row(['BACK'], 20)],
      tracks,
    });
    expect(hit).toMatchObject({ slot: 'NECK', matched: true, state: 'done' });
    expect(miss).toMatchObject({ slot: 'BACK', matched: false, state: 'missing', equipped: { itemId: 99 } });
  });

  it('matches tier rows with any tier piece in the slot', () => {
    const [head] = evaluateGear({ equipped: [item('HEAD', 555, [2], true)], bisRows: [row(['HEAD'], 777, true)], tracks });
    expect(head).toMatchObject({ matched: true, state: 'mythUpgradable' });
  });

  it('does not match a tier row with a non-tier item', () => {
    const [head] = evaluateGear({ equipped: [item('HEAD', 777)], bisRows: [row(['HEAD'], 777, true)], tracks });
    expect(head).toMatchObject({ matched: false, state: 'missing' });
  });

  it('matches rings in either slot and assigns exact matches first', () => {
    const rows = evaluateGear({
      equipped: [item('FINGER_1', 200), item('FINGER_2', 100, [1])],
      bisRows: [row(['FINGER_1', 'FINGER_2'], 100), row(['FINGER_1', 'FINGER_2'], 200)],
      tracks,
    });
    expect(rows.map((r) => [r.slot, r.matched])).toEqual([['FINGER_2', true], ['FINGER_1', true]]);
  });

  it('shows the unmatched paired slot when one ring is missing', () => {
    const rows = evaluateGear({
      equipped: [item('FINGER_1', 300), item('FINGER_2', 100)],
      bisRows: [row(['FINGER_1', 'FINGER_2'], 100), row(['FINGER_1', 'FINGER_2'], 200)],
      tracks,
    });
    expect(rows[1]).toMatchObject({ slot: 'FINGER_1', matched: false, equipped: { itemId: 300 } });
  });

  it('derives states from the track', () => {
    const states = evaluateGear({
      equipped: [item('HEAD', 1, [1]), item('NECK', 2, [2]), item('BACK', 3, [3]), item('WRIST', 4, [])],
      bisRows: [row(['HEAD'], 1), row(['NECK'], 2), row(['BACK'], 3), row(['WRIST'], 4)],
      tracks,
    }).map((r) => r.state);
    expect(states).toEqual(['done', 'mythUpgradable', 'belowMyth', 'done']);
  });

  it('marks a missing BiS item as inBags when the bags hold it', () => {
    const [belt] = evaluateGear({ equipped: [item('WAIST', 9)], bisRows: [row(['WAIST'], 42)], tracks, bagItemIds: new Set([42]) });
    expect(belt!.state).toBe('inBags');
  });

  it('treats an empty slot as missing', () => {
    const [offHand] = evaluateGear({ equipped: [], bisRows: [row(['OFF_HAND'], 5)], tracks });
    expect(offHand).toMatchObject({ slot: 'OFF_HAND', equipped: null, state: 'missing' });
  });

  it('skips rows whose slot label is unknown', () => {
    expect(evaluateGear({ equipped: [], bisRows: [{ ...row(['HEAD'], 1), slots: [] }], tracks })).toEqual([]);
  });
});

describe('countStates', () => {
  it('counts every state, including zeros', () => {
    const rows = evaluateGear({ equipped: [item('HEAD', 1, [1])], bisRows: [row(['HEAD'], 1), row(['NECK'], 2)], tracks });
    expect(countStates(rows)).toEqual({ done: 1, mythUpgradable: 0, belowMyth: 0, inBags: 0, missing: 1 });
  });
});

const anyRow = (slots: SlotType[], minItemLevel: number): BisRow => ({ kind: 'any', slotLabel: slots[0]!, slots, minItemLevel, source: '' });

describe('any rows', () => {
  it('is done when the slot holds an item at or above the item level', () => {
    const [at, below] = evaluateGear({ equipped: [item('SHOULDER', 5), item('FEET', 6)], bisRows: [anyRow(['SHOULDER'], 300), anyRow(['FEET'], 301)], tracks });
    expect(at).toMatchObject({ matched: true, state: 'done' });
    expect(below).toMatchObject({ matched: false, state: 'missing' });
  });

  it('never reports a track state, even on a Myth item below max', () => {
    const [row] = evaluateGear({ equipped: [item('SHOULDER', 5, [2])], bisRows: [anyRow(['SHOULDER'], 300)], tracks });
    expect(row!.state).toBe('done');
  });

  it('is missing when the item has no item level, and when the slot is empty', () => {
    const [noLevel, empty] = evaluateGear({
      equipped: [{ ...item('SHOULDER', 5), itemLevel: null }],
      bisRows: [anyRow(['SHOULDER'], 1), anyRow(['FEET'], 1)],
      tracks,
    });
    expect(noLevel!.state).toBe('missing');
    expect(empty).toMatchObject({ state: 'missing', equipped: null });
  });
});
