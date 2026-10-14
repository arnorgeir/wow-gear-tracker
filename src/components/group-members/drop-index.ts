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

/** `dropIndex` over keys: a key with no chip (not rendered yet) is left out of the count. */
export function dropIndexByKey(keys: readonly string[], dragged: string, rectOf: (key: string) => Rect | undefined, point: { x: number; y: number }): number {
  const chips = keys.flatMap((k) => { const r = rectOf(k); return r ? [{ k, r }] : []; });
  return dropIndex(chips.map((c) => c.r), chips.findIndex((c) => c.k === dragged), point);
}
