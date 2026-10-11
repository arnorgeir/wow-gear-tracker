export type GroupBodyMode = 'empty' | 'skeleton' | 'content';

/** What the group page shows below the picker, from the membership asked for and whether the server has rendered it. */
export function groupBodyMode(pending: boolean, requestedCount: number, hasContent: boolean): GroupBodyMode {
  if (requestedCount === 0) return 'empty';
  if (pending) return 'skeleton';
  return hasContent ? 'content' : 'empty';
}
