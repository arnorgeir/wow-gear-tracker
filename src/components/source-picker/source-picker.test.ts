import { describe, expect, it } from 'vitest';
import { sourceOptions } from './source-picker';

describe('sourceOptions', () => {
  it('offers Method, Icy Veins and Manual, in that order', () => {
    expect(sourceOptions().map((o) => o.label)).toEqual(['Method', 'Icy Veins', 'Manual']);
    expect(sourceOptions().map((o) => o.value)).toEqual(['method', 'icyVeins', 'manual']);
  });
});
