import { SLOT_TYPES, type SlotType } from '@/core/types';
import type { GearRowView, GroupGridRow, GroupMemberState } from './types';

/** Method names one slot several ways ("Weapon", "Main Hand"), so the grid labels slots itself. */
export const SLOT_LABELS: Record<SlotType, string> = {
  HEAD: 'Head', NECK: 'Neck', SHOULDER: 'Shoulders', BACK: 'Cloak', CHEST: 'Chest', WRIST: 'Wrist', HANDS: 'Gloves',
  WAIST: 'Belt', LEGS: 'Legs', FEET: 'Boots', FINGER_1: 'Ring 1', FINGER_2: 'Ring 2', TRINKET_1: 'Trinket 1',
  TRINKET_2: 'Trinket 2', MAIN_HAND: 'Main Hand', OFF_HAND: 'Off Hand',
};

/**
 * One row per slot, keyed by the slot each row evaluated to. Rings and trinkets land where the
 * equipped item actually is, since evaluateGear lets an exact match claim either slot. A `null`
 * column is a member without rows; a slot no member has is left out.
 */
export function alignGrid(columns: (GearRowView[] | null)[]): GroupGridRow[] {
  return SLOT_TYPES
    .map((slot) => ({ slot, label: SLOT_LABELS[slot], cells: columns.map((rows) => rows?.find((r) => r.slot === slot) ?? null) }))
    .filter((row) => row.cells.some((c) => c !== null));
}

export function memberState(character: { status: 'ok' | 'notFound'; lastSyncedAt: number | null } | null, hasGear: boolean): GroupMemberState {
  if (!character) return 'untracked';
  if (character.status === 'notFound') return 'notFound';
  if (hasGear) return 'ready';
  return character.lastSyncedAt === null ? 'syncing' : 'noGear';
}

export const EXCLUSION_REASONS = {
  untracked: 'not tracked',
  notFound: 'not found by Blizzard',
  syncing: 'syncing',
  noGear: 'no gear yet',
  noList: 'no BiS list',
} as const;

/** Why the ranking leaves a member out, or null when the member counts. */
export function exclusionReason(state: GroupMemberState, hasRows: boolean): string | null {
  if (state === 'ready') return hasRows ? null : EXCLUSION_REASONS.noList;
  return EXCLUSION_REASONS[state];
}
