import { describe, expect, it } from 'vitest';
import { editedText } from './edited-text';

describe('editedText', () => {
  it('counts edits, or is null when there are none', () => {
    expect(editedText(0)).toBeNull();
    expect(editedText(3)).toBe('3 edited');
  });
});
