/** The highlighted result after an arrow key; -1 means none. Wraps at both ends. */
export function moveHighlight(current: number, key: 'ArrowDown' | 'ArrowUp', count: number): number {
  if (count === 0) return -1;
  if (current < 0) return key === 'ArrowDown' ? 0 : count - 1;
  return (current + (key === 'ArrowDown' ? 1 : count - 1)) % count;
}

/** A highlight and the answer it was made on: a new answer is a new list, so the old index means nothing. */
export interface Highlight { list: readonly unknown[]; index: number }

/** The highlighted index, or -1 once the list is not the one the highlight was made on. */
export function activeIndex(highlight: Highlight, list: readonly unknown[]): number {
  return highlight.list === list && highlight.index < list.length ? highlight.index : -1;
}

export interface KeyState { key: string; isOpen: boolean; count: number; active: number; pending: boolean; isComposing: boolean }

/** What a key press does to the result list: move the highlight, pick a result, or nothing. */
export function keyAction({ key, isOpen, count, active, pending, isComposing }: KeyState): { move: number } | { pick: number } | null {
  if (isComposing || !isOpen || count === 0) return null;
  if (key === 'ArrowDown' || key === 'ArrowUp') return { move: moveHighlight(active, key, count) };
  if (key === 'Enter' && active >= 0 && !pending) return { pick: active };
  return null;
}
