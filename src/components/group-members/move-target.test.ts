import { describe, expect, it } from 'vitest';
import { moveTarget } from './move-target';

describe('moveTarget', () => {
  it('steps one place with the arrow keys', () => {
    expect(moveTarget('ArrowLeft', 2, 4)).toBe(1);
    expect(moveTarget('ArrowUp', 2, 4)).toBe(1);
    expect(moveTarget('ArrowRight', 2, 4)).toBe(3);
    expect(moveTarget('ArrowDown', 2, 4)).toBe(3);
  });

  it('jumps to the ends with Home and End', () => {
    expect(moveTarget('Home', 2, 4)).toBe(0);
    expect(moveTarget('End', 1, 4)).toBe(3);
  });

  it('does nothing at an edge', () => {
    expect(moveTarget('ArrowLeft', 0, 4)).toBeNull();
    expect(moveTarget('Home', 0, 4)).toBeNull();
    expect(moveTarget('ArrowRight', 3, 4)).toBeNull();
    expect(moveTarget('End', 3, 4)).toBeNull();
  });

  it('ignores other keys', () => {
    expect(moveTarget('Enter', 1, 4)).toBeNull();
    expect(moveTarget('a', 1, 4)).toBeNull();
  });
});
