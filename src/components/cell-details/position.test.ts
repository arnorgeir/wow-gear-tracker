import { describe, expect, it } from 'vitest';
import { placeBeside } from './position';

const viewport = { width: 1280, height: 800 };
const card = { width: 320, height: 240 };
const cell = (left: number, top: number) => ({ left, top, right: left + 140, bottom: top + 56 });

describe('placeBeside', () => {
  it('puts the card below the cell, aligned to its left edge', () => {
    expect(placeBeside(cell(100, 100), card, viewport)).toEqual({ top: 164, left: 100 });
  });

  it('puts it above when there is no room below', () => {
    expect(placeBeside(cell(100, 700), card, viewport)).toEqual({ top: 452, left: 100 });
  });

  it('keeps it inside the viewport on the right and at the top', () => {
    expect(placeBeside(cell(1200, 100), card, viewport).left).toBe(952);
    expect(placeBeside(cell(100, 100), { width: 320, height: 790 }, viewport).top).toBe(8);
  });
});
