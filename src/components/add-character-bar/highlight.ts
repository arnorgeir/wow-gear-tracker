/** The highlighted result after an arrow key; -1 means none. Wraps at both ends. */
export function moveHighlight(current: number, key: 'ArrowDown' | 'ArrowUp', count: number): number {
  if (count === 0) return -1;
  if (current < 0) return key === 'ArrowDown' ? 0 : count - 1;
  return (current + (key === 'ArrowDown' ? 1 : count - 1)) % count;
}

/** The stored highlight, or -1 when a new answer is shorter than it. */
export function activeOrNone(index: number, count: number): number {
  return index < count ? index : -1;
}
