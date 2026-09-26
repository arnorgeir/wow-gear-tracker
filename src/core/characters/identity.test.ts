import { describe, expect, it } from 'vitest';
import { identityLine } from './identity';

describe('identityLine', () => {
  it('joins race, spec and class', () => {
    expect(identityLine('Troll', 'Guardian', 'Druid')).toBe('Troll Guardian Druid');
  });

  it('skips missing parts', () => {
    expect(identityLine(null, 'Guardian', 'Druid')).toBe('Guardian Druid');
    expect(identityLine('', '', 'Druid')).toBe('Druid');
  });
});
