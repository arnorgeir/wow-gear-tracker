import { addMember, moveMember, removeMember } from '@/core/characters/member-key';

/** The last move, for the status line. `keys` are the ones the move asked for. */
export interface MovedMember { name: string; position: number; count: number; keys: string[] }

/**
 * The membership the user has asked for, which runs ahead of the last render while a navigation is
 * loading. Every edit composes against this and never against rendered props, so two quick edits, or a
 * search add that finishes after a removal, can't undo each other.
 */
export function createGroupEdits(initial: readonly string[], onChange: (keys: string[]) => void) {
  let current = [...initial];
  let moved: MovedMember | null = null;
  /** Returns whether the keys changed. */
  const apply = (next: string[]) => {
    if (next.length === current.length && next.every((k, i) => k === current[i])) return false;
    current = next;
    onChange(next);
    return true;
  };
  return {
    keys: () => current,
    add: (key: string) => { if (apply(addMember(current, key))) moved = null; },
    remove: (key: string) => { if (apply(removeMember(current, key))) moved = null; },
    move: (key: string, name: string, toIndex: number) => {
      const next = moveMember(current, key, toIndex);
      if (apply(next)) moved = { name, position: next.indexOf(key) + 1, count: next.length, keys: next };
    },
    /** The last move, while its keys are still the ones asked for. */
    moved: () => (moved && moved.keys.length === current.length && moved.keys.every((k, i) => k === current[i]) ? moved : null),
    /** Takes the committed keys back once nothing is loading. Doesn't navigate. */
    reset: (keys: readonly string[]) => { current = [...keys]; },
  };
}
