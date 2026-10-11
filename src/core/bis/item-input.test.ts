import { describe, expect, it } from 'vitest';
import { parseItemInput } from './item-input';

describe('parseItemInput', () => {
  it('reads bare IDs and Wowhead links', () => {
    expect(parseItemInput(' 212401 ')).toBe(212401);
    expect(parseItemInput('https://www.wowhead.com/item=212401/some-name')).toBe(212401);
    expect(parseItemInput('https://www.wowhead.com/de/item=212401/some-name?bonus=1')).toBe(212401);
  });

  it('rejects anything else', () => {
    expect(parseItemInput('Frost crown')).toBeNull();
    expect(parseItemInput('0')).toBeNull();
    expect(parseItemInput('https://www.wowhead.com/spell=1')).toBeNull();
  });
});
