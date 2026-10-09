import { describe, expect, it } from 'vitest';
import { activeIndex, keyAction, moveHighlight } from './highlight';

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

describe('activeIndex', () => {
  const answer = [{ name: 'Birkibjörn' }, { name: 'Birkir' }];
  it('keeps the index while the highlight was made on the same answer', () => {
    expect(activeIndex({ list: answer, index: 1 }, answer)).toBe(1);
  });
  it('drops the highlight when a new answer replaces the list, even a same-length one', () => {
    expect(activeIndex({ list: answer, index: 1 }, [...answer])).toBe(-1);
  });
  it('drops an index the list does not reach', () => {
    expect(activeIndex({ list: answer, index: 2 }, answer)).toBe(-1);
  });
});

describe('keyAction', () => {
  const base = { key: 'ArrowDown', isOpen: true, count: 3, active: -1, pending: false, isComposing: false };
  it('moves the highlight on arrow keys', () => {
    expect(keyAction(base)).toEqual({ move: 0 });
    expect(keyAction({ ...base, key: 'ArrowUp', active: 0 })).toEqual({ move: 2 });
  });
  it('picks the highlighted result on Enter', () => {
    expect(keyAction({ ...base, key: 'Enter', active: 1 })).toEqual({ pick: 1 });
  });
  it('ignores Enter with nothing highlighted, or while an add is pending', () => {
    expect(keyAction({ ...base, key: 'Enter' })).toBeNull();
    expect(keyAction({ ...base, key: 'Enter', active: 1, pending: true })).toBeNull();
  });
  it('ignores every key while an input method is composing', () => {
    expect(keyAction({ ...base, isComposing: true })).toBeNull();
    expect(keyAction({ ...base, key: 'Enter', active: 1, isComposing: true })).toBeNull();
  });
  it('ignores keys when the list is hidden or empty, and other keys', () => {
    expect(keyAction({ ...base, isOpen: false })).toBeNull();
    expect(keyAction({ ...base, count: 0 })).toBeNull();
    expect(keyAction({ ...base, key: 'a' })).toBeNull();
  });
});
