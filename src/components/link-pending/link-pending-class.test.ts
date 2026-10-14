import { describe, expect, it } from 'vitest';
import { linkPendingClass } from './link-pending-class';

describe('linkPendingClass', () => {
  const words = (s: string) => s.split(' ');

  it('hides the ring at once when idle', () => {
    expect(words(linkPendingClass(false))).toEqual(expect.arrayContaining(['opacity-0', 'delay-0']));
    expect(words(linkPendingClass(false))).not.toContain('opacity-100');
  });

  it('fades the ring in after 100 ms when pending', () => {
    expect(words(linkPendingClass(true))).toEqual(expect.arrayContaining(['opacity-100', 'delay-100']));
    expect(words(linkPendingClass(true))).not.toContain('opacity-0');
  });

  it('keeps the same box and stops spinning under reduced motion either way', () => {
    for (const pending of [false, true]) {
      expect(words(linkPendingClass(pending))).toEqual(expect.arrayContaining(['size-[0.8em]', 'shrink-0', 'animate-spin', 'motion-reduce:animate-none', 'transition-opacity']));
    }
  });
});
