import { describe, expect, it } from 'vitest';
import { groupBodyMode } from './group-body-mode';

describe('groupBodyMode', () => {
  it('shows the empty state whenever nobody is requested, even mid-edit', () => {
    expect(groupBodyMode(false, 0, false)).toBe('empty');
    expect(groupBodyMode(true, 0, true)).toBe('empty');
    expect(groupBodyMode(true, 0, false)).toBe('empty');
  });

  it('shows skeletons while an edit to a non-empty group is pending, with or without rendered content', () => {
    expect(groupBodyMode(true, 1, false)).toBe('skeleton');
    expect(groupBodyMode(true, 3, true)).toBe('skeleton');
  });

  it('shows the rendered panels once settled', () => {
    expect(groupBodyMode(false, 2, true)).toBe('content');
  });

  it('falls back to the empty state if settled without content', () => {
    expect(groupBodyMode(false, 2, false)).toBe('empty');
  });
});
