/** The index a key press moves the member at `index` to, or null for a key that moves nothing. */
export function moveTarget(key: string, index: number, count: number): number | null {
  const target = key === 'ArrowLeft' || key === 'ArrowUp' ? index - 1
    : key === 'ArrowRight' || key === 'ArrowDown' ? index + 1
    : key === 'Home' ? 0
    : key === 'End' ? count - 1
    : null;
  return target === null || target < 0 || target >= count || target === index ? null : target;
}
