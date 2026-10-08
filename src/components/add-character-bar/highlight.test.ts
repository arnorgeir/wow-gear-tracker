import { describe, expect, it } from 'vitest';
import { activeOrNone, moveHighlight } from './highlight';

describe('moveHighlight', () => {
  it('ArrowDown from nothing picks the first result', () => {
    expect(moveHighlight(-1, 'ArrowDown', 3)).toBe(0);
  });
  it('ArrowUp from nothing picks the last result', () => {
    expect(moveHighlight(-1, 'ArrowUp', 3)).toBe(2);
  });
  it('moves one step and wraps at both ends', () => {
    expect(moveHighlight(0, 'ArrowDown', 3)).toBe(1);
    expect(moveHighlight(2, 'ArrowDown', 3)).toBe(0);
    expect(moveHighlight(1, 'ArrowUp', 3)).toBe(0);
    expect(moveHighlight(0, 'ArrowUp', 3)).toBe(2);
  });
  it('highlights nothing when there are no results', () => {
    expect(moveHighlight(-1, 'ArrowDown', 0)).toBe(-1);
  });
});

describe('activeOrNone', () => {
  it('drops an index the list no longer reaches', () => {
    expect(activeOrNone(2, 2)).toBe(-1);
    expect(activeOrNone(1, 2)).toBe(1);
    expect(activeOrNone(-1, 2)).toBe(-1);
  });
});
