import { describe, expect, it } from 'vitest';
import { editedText } from './edited-text';

describe('editedText', () => {
  it('counts edits, or says there are none', () => {
    expect(editedText(0)).toBe('no edits');
    expect(editedText(3)).toBe('3 edited');
  });
});
