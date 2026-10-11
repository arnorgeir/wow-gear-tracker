import { describe, expect, it } from 'vitest';
import { tabClass } from './nav-tab';

describe('tabClass', () => {
  it('marks the current tab gold with an underline, and others muted', () => {
    expect(tabClass(true)).toContain('text-gold');
    expect(tabClass(true)).toContain('shadow-[inset_0_-2px_0_var(--color-gold)]');
    expect(tabClass(false)).toContain('text-muted');
    expect(tabClass(false)).not.toContain('text-gold');
  });
});
