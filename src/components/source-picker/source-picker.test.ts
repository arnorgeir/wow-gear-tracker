import { describe, expect, it } from 'vitest';
import { sourceOptions } from './source-picker';

describe('sourceOptions', () => {
  it('offers the sources on offer, in order', () => {
    expect(sourceOptions()).toEqual([{ value: 'method', label: 'Method' }, { value: 'manual', label: 'Manual' }]);
  });
});
