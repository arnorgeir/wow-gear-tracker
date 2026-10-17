import { describe, expect, it } from 'vitest';
import { GROUP_UPDATING } from '@/components/shared/loading-copy';
import { statusText } from './status-text';

const picked = { name: 'Birkibjörn' };
const moved = { name: 'Hrafnhildur', position: 2, count: 3 };

describe('statusText', () => {
  it('says nothing when idle', () => {
    expect(statusText({ picked: null, moved: null, pending: false })).toBe('');
  });

  it('reports a pending edit', () => {
    expect(statusText({ picked: null, moved: null, pending: true })).toBe(GROUP_UPDATING);
  });

  it('reports a move over a plain pending edit', () => {
    expect(statusText({ picked: null, moved, pending: true })).toBe('Hrafnhildur moved to position 2 of 3.');
  });

  it('reports a pick-up over everything else', () => {
    expect(statusText({ picked, moved, pending: true })).toBe('Birkibjörn picked up. Choose where to move it, or press Escape.');
  });
});
