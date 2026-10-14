export interface Rect { left: number; right: number; top: number; bottom: number }

/**
 * Where the dragged chip belongs, from the chips' rects in display order. Chips wrap, so it reads in
 * reading order: the count of other chips the pointer is past. A chip is passed when its row is above the
 * pointer, or the pointer is in its row and right of its center.
 *
 * ponytail: comparing to centers on a greedy-wrapped row isn't proven stable when a move shifts line
 * breaks. The test covers made-up widths; add hysteresis if it flickers by hand.
 */
export function dropIndex(rects: readonly Rect[], dragged: number, { x, y }: { x: number; y: number }): number {
  return rects.filter((r, i) => i !== dragged && (r.bottom < y || (y >= r.top && y <= r.bottom && x > (r.left + r.right) / 2))).length;
}
