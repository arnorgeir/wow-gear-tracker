import { GROUP_UPDATING } from '@/components/shared/loading-copy';

interface Input {
  /** The member picked up to move, if any. */
  picked: { name: string } | null;
  moved: { name: string; position: number; count: number } | null;
  pending: boolean;
}

export function statusText({ picked, moved, pending }: Input): string {
  if (picked) return `${picked.name} picked up. Choose where to move it, or press Escape.`;
  if (moved) return `${moved.name} moved to position ${moved.position} of ${moved.count}.`;
  return pending ? GROUP_UPDATING : '';
}
