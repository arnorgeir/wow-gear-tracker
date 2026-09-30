import { describe, expect, it } from 'vitest';
import { buildTrackedLookup, isTracked, type TrackedCharacter } from './tracked';

const birkibjorn: TrackedCharacter = { region: 'eu', realmId: 1306, name: 'Birkibjörn' };

describe('tracked', () => {
  it('matches the same character regardless of case, including a non-ASCII capital', () => {
    const lookup = buildTrackedLookup([birkibjorn]);
    expect(isTracked(lookup, 'eu', { blizzardRealmId: 1306, name: 'BIRKIBJÖRN' })).toBe(true);
  });

  it('is not tracked when the result is on a different realm', () => {
    const lookup = buildTrackedLookup([birkibjorn]);
    expect(isTracked(lookup, 'eu', { blizzardRealmId: 1307, name: 'Birkibjörn' })).toBe(false);
  });

  it('is not tracked when the result is in a different region', () => {
    const lookup = buildTrackedLookup([birkibjorn]);
    expect(isTracked(lookup, 'us', { blizzardRealmId: 1306, name: 'Birkibjörn' })).toBe(false);
  });
});
