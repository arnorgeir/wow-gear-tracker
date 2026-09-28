import { describe, expect, it } from 'vitest';
import { wowheadData } from './wowhead';

describe('wowheadData', () => {
  it('includes bonus IDs and item level so the tooltip matches the item', () => {
    expect(wowheadData(271528, [13440, 12850], 321)).toBe('item=271528&bonus=13440:12850&ilvl=321');
  });

  it('leaves out empty parts', () => {
    expect(wowheadData(5, [], null)).toBe('item=5');
  });
});
