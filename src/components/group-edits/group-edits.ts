import { addMember, removeMember } from '@/core/characters/member-key';

/**
 * The membership the user has asked for, which runs ahead of the last render while a navigation is
 * loading. Every edit composes against this and never against rendered props, so two quick edits, or a
 * search add that finishes after a removal, can't undo each other.
 */
export function createGroupEdits(initial: readonly string[], onChange: (keys: string[]) => void) {
  let current = [...initial];
  const apply = (next: string[]) => {
    if (next.length === current.length && next.every((k, i) => k === current[i])) return;
    current = next;
    onChange(next);
  };
  return {
    keys: () => current,
    add: (key: string) => apply(addMember(current, key)),
    remove: (key: string) => apply(removeMember(current, key)),
    /** Takes the committed keys back once nothing is loading. Doesn't navigate. */
    reset: (keys: readonly string[]) => { current = [...keys]; },
  };
}
