import { describe, expect, it } from 'vitest';
import { rowTone } from './row-tone';

describe('rowTone', () => {
  it('highlights a fully upgraded BiS item in gold', () => {
    expect(rowTone('done', true)).toBe('gold');
  });

  it('highlights a Myth-track BiS item that only needs crests in green', () => {
    expect(rowTone('mythUpgradable', true)).toBe('green');
  });

  it('leaves other states plain', () => {
    expect(rowTone('belowMyth', true)).toBeNull();
    expect(rowTone('inBags', true)).toBeNull();
    expect(rowTone('missing', true)).toBeNull();
  });

  it('shows no highlight while upgrade track data is unavailable', () => {
    expect(rowTone('done', false)).toBeNull();
    expect(rowTone('mythUpgradable', false)).toBeNull();
  });

  it('marks a tier piece with the wrong stats with the stats tone', () => {
    expect(rowTone('wrongStats', true)).toBe('stats');
    expect(rowTone('wrongStats', false)).toBeNull();
  });
});
