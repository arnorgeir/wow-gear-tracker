export type GroupBodyMode = 'empty' | 'skeleton' | 'content';

/** What the group page shows below the picker, from the membership asked for and whether the server has rendered it.
 * A reorder (pending, same members as rendered) keeps the group-wide panels, as they depend on who is in the group, not their order. */
export function groupBodyMode(pending: boolean, requestedCount: number, hasContent: boolean, sameMembers: boolean): GroupBodyMode {
  if (requestedCount === 0) return 'empty';
  if (pending) return sameMembers && hasContent ? 'content' : 'skeleton';
  return hasContent ? 'content' : 'empty';
}
