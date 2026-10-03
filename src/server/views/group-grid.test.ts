import { describe, expect, it } from 'vitest';
import type { GearRowView } from './types';
import { alignGrid, exclusionReason, memberState } from './group-grid';

const cell = (slot: GearRowView['slot'], slotLabel: string, itemId: number): GearRowView => ({
  slotLabel, slot, state: 'missing', equipped: null, upgrade: null,
  bis: { kind: 'item', itemId, name: `Item ${itemId}`, itemLevel: null, quality: 'EPIC', bonusIds: [], iconUrl: null, trackLabel: null, isTier: false, isCatalyst: false, source: '' },
});

describe('alignGrid', () => {
  it('puts differently named slots in one row, in slot order, with fixed labels', () => {
    const grid = alignGrid([
      [cell('MAIN_HAND', 'Weapon', 1), cell('HANDS', 'Gloves', 2)],
      [cell('HANDS', 'Hands', 3), cell('MAIN_HAND', 'Main Hand', 4)],
    ]);
    expect(grid.map((r) => r.label)).toEqual(['Gloves', 'Main Hand']);
    expect(grid[1]!.cells.map((c) => c?.bis.kind === 'item' && c.bis.itemId)).toEqual([1, 4]);
  });

  it('places rings and trinkets by the slot they evaluated to, not by list order', () => {
    // The first-listed ring matched in FINGER_2; the second fell back to FINGER_1.
    const grid = alignGrid([[cell('FINGER_2', 'Ring', 40), cell('FINGER_1', 'Ring', 41), cell('TRINKET_2', 'Trinket', 50), cell('TRINKET_1', 'Trinket', 51)]]);
    expect(grid.map((r) => [r.label, r.cells[0]?.bis.kind === 'item' && r.cells[0].bis.itemId]))
      .toEqual([['Ring 1', 41], ['Ring 2', 40], ['Trinket 1', 51], ['Trinket 2', 50]]);
  });

  it('leaves an empty cell for a missing off hand without moving other rows, and a null column empty', () => {
    const grid = alignGrid([
      [cell('MAIN_HAND', 'Weapon', 1), cell('OFF_HAND', 'Off Hand', 2)],
      [cell('MAIN_HAND', 'Weapon', 3)],
      null,
    ]);
    expect(grid.map((r) => r.label)).toEqual(['Main Hand', 'Off Hand']);
    expect(grid[1]!.cells.map((c) => c?.slot ?? null)).toEqual(['OFF_HAND', null, null]);
    expect(grid[0]!.cells[2]).toBeNull();
  });
});

describe('memberState', () => {
  it('tells untracked, not found, syncing, no gear and ready apart', () => {
    expect(memberState(null, false)).toBe('untracked');
    expect(memberState({ status: 'notFound', lastSyncedAt: 5, lastSyncError: null }, true)).toBe('notFound');
    expect(memberState({ status: 'ok', lastSyncedAt: null, lastSyncError: null }, false)).toBe('syncing');
    expect(memberState({ status: 'ok', lastSyncedAt: 5, lastSyncError: null }, false)).toBe('noGear');
    expect(memberState({ status: 'ok', lastSyncedAt: 5, lastSyncError: null }, true)).toBe('ready');
  });

  it('does not call a first sync that failed "syncing", since nothing is running and it never clears', () => {
    expect(memberState({ status: 'ok', lastSyncedAt: null, lastSyncError: 'Blizzard returned 503. Showing the last saved gear.' }, false)).toBe('noGear');
    expect(memberState({ status: 'ok', lastSyncedAt: null, lastSyncError: 'Blizzard returned 503' }, true)).toBe('ready');
  });
});

describe('exclusionReason', () => {
  it('gives a reason for every member the ranking leaves out, and none for an eligible one', () => {
    expect(exclusionReason('ready', true)).toBeNull();
    expect(exclusionReason('ready', false)).toBe('no BiS list');
    expect(exclusionReason('untracked', false)).toBe('not tracked');
    expect(exclusionReason('notFound', false)).toBe('not found by Blizzard');
    expect(exclusionReason('syncing', false)).toBe('syncing');
    expect(exclusionReason('noGear', false)).toBe('no gear yet');
  });
});
