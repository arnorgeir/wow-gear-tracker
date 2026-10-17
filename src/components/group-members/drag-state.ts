import { moveMember } from '@/core/characters/member-key';
import { sameMembers } from '@/components/shared/same-members';

/** A member picked up by a tap, with the members it was picked among: any other edit puts it down. */
export interface Picked { key: string; members: string[] }

export type DragState =
  | { kind: 'idle' }
  | { kind: 'drag'; pointerId: number; key: string; preview: string[]; moved: boolean; /** Picked before this press, so a tap on another handle can drop it there. */ from: Picked | null }
  | ({ kind: 'picked' } & Picked);

export type DragAction =
  | { type: 'start'; pointerId: number; key: string; order: string[]; isPrimary: boolean; button: number }
  | { type: 'over'; pointerId: number; index: number }
  | { type: 'end'; pointerId: number; order: string[] }
  | { type: 'tap'; key: string; order: string[] }
  | { type: 'cancel' }
  | { type: 'membersChanged'; keys: string[] };

export interface DragResult { state: DragState; commit?: { key: string; index: number } }

export const IDLE: DragState = { kind: 'idle' };

/** A tap on a handle: pick it up, put it down, or drop the picked member there. */
function tap(picked: Picked | null, key: string, order: string[]): DragResult {
  // A displayed member that left the shared order (removal loading) is not a drop target.
  if (!order.includes(key)) return { state: picked ? { kind: 'picked', ...picked } : IDLE };
  if (!picked) return { state: { kind: 'picked', key, members: order } };
  if (picked.key === key) return { state: IDLE };
  return { state: IDLE, commit: { key: picked.key, index: order.indexOf(key) } };
}

/** The drag rules, pure: `use-member-drag` feeds it events and carries out the commit it returns. */
export function reduce(state: DragState, action: DragAction): DragResult {
  switch (action.type) {
    case 'start': {
      if (state.kind === 'drag' || !action.isPrimary || action.button !== 0) return { state };
      const from = state.kind === 'picked' ? { key: state.key, members: state.members } : null;
      return { state: { kind: 'drag', pointerId: action.pointerId, key: action.key, preview: [...action.order], moved: false, from } };
    }
    case 'over': {
      if (state.kind !== 'drag' || state.pointerId !== action.pointerId) return { state };
      const preview = moveMember(state.preview, state.key, action.index);
      const changed = preview.some((k, i) => k !== state.preview[i]);
      return { state: changed ? { ...state, preview, moved: true } : state };
    }
    case 'end': {
      if (state.kind !== 'drag' || state.pointerId !== action.pointerId) return { state };
      if (!state.moved) return tap(state.from, state.key, action.order);
      const index = state.preview.indexOf(state.key);
      return { state: IDLE, commit: index !== action.order.indexOf(state.key) ? { key: state.key, index } : undefined };
    }
    case 'tap':
      return tap(state.kind === 'picked' ? state : null, action.key, action.order);
    case 'cancel':
      return { state: IDLE };
    case 'membersChanged': {
      if (state.kind === 'picked') return { state: sameMembers(state.members, action.keys) ? state : IDLE };
      if (state.kind !== 'drag') return { state };
      if (!action.keys.includes(state.key)) return { state: IDLE };
      const preview = [...state.preview.filter((k) => action.keys.includes(k)), ...action.keys.filter((k) => !state.preview.includes(k))];
      return { state: { ...state, preview, from: state.from && sameMembers(state.from.members, action.keys) ? state.from : null } };
    }
  }
}
