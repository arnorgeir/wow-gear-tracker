import { describe, expect, it } from 'vitest';
import { dropIndex, dropIndexByKey, type Rect } from './drop-index';

// Three chips, 100 wide, 10 apart, on one row.
const row: Rect[] = [0, 110, 220].map((left) => ({ left, right: left + 100, top: 0, bottom: 40 }));
// Two rows: chips 0 and 1 on top, chip 2 below.
const wrapped: Rect[] = [
  { left: 0, right: 100, top: 0, bottom: 40 },
  { left: 110, right: 210, top: 0, bottom: 40 },
  { left: 0, right: 100, top: 50, bottom: 90 },
];

describe('dropIndex', () => {
  it('is 0 left of every chip, and the last index past the end', () => {
    expect(dropIndex(row, 2, { x: 5, y: 20 })).toBe(0);
    expect(dropIndex(row, 0, { x: 400, y: 20 })).toBe(2);
  });

  it('treats empty space right of the last chip as past the end', () => {
    expect(dropIndex(row, 1, { x: 900, y: 20 })).toBe(2);
  });

  it('switches at a chip center', () => {
    expect(dropIndex(row, 0, { x: 150, y: 20 })).toBe(0);
    expect(dropIndex(row, 0, { x: 170, y: 20 })).toBe(1);
  });

  it('does not count the dragged chip', () => {
    expect(dropIndex(row, 0, { x: 5, y: 20 })).toBe(0);
    expect(dropIndex(row, 1, { x: 165, y: 20 })).toBe(1);
  });

  it('reads wrapped rows in order', () => {
    expect(dropIndex(wrapped, 2, { x: 5, y: 70 })).toBe(2);
    expect(dropIndex(wrapped, 0, { x: 5, y: 70 })).toBe(1);
    expect(dropIndex(wrapped, 2, { x: 5, y: 20 })).toBe(0);
    expect(dropIndex(wrapped, 2, { x: 300, y: 20 })).toBe(2);
  });

  it('counts the gap between rows as past the row above', () => {
    expect(dropIndex(wrapped, 2, { x: 5, y: 45 })).toBe(2);
  });

  it('is stable: laying out again at the new place gives the same index', () => {
    const layout = (widths: number[]): Rect[] => {
      const rects: Rect[] = [];
      let x = 0;
      let y = 0;
      for (const w of widths) {
        if (x > 0 && x + w > 300) { x = 0; y += 50; }
        rects.push({ left: x, right: x + w, top: y, bottom: y + 40 });
        x += w + 10;
      }
      return rects;
    };
    const widths = [120, 90, 140, 100, 80];
    for (let dragged = 0; dragged < widths.length; dragged++) {
      for (const pt of [{ x: 5, y: 20 }, { x: 250, y: 20 }, { x: 5, y: 70 }, { x: 150, y: 70 }, { x: 290, y: 120 }]) {
        const to = dropIndex(layout(widths), dragged, pt);
        const next = widths.slice();
        const [w] = next.splice(dragged, 1);
        next.splice(to, 0, w!);
        expect(dropIndex(layout(next), to, pt)).toBe(to);
      }
    }
  });
});

describe('dropIndexByKey', () => {
  it('ignores a key with no chip, such as a member whose add is still loading', () => {
    const rects = new Map([['A', { left: 0, right: 100, top: 0, bottom: 40 }], ['B', { left: 110, right: 210, top: 0, bottom: 40 }]]);
    // C is in the shared keys but has no chip: it must not count as passed.
    expect(dropIndexByKey(['A', 'B', 'C'], 'A', (k) => rects.get(k), { x: 5, y: 20 })).toBe(0);
  });
});
