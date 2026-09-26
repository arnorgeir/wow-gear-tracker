import { describe, expect, it } from 'vitest';
import { createRaidbotsTracksFetcher, decodeTrack, parseRaidbotsBonuses, trackLabel } from './tracks';
import { fakeFetch, json, on } from '@/test/fake-fetch';

const sample = {
  '12850': { upgrade: { group: 618, level: 2, max: 6, name: 'Myth', fullName: 'Myth 2/6', bonusId: 12850, costs: [{ amounts: [{ currencyId: 3446, amount: 20 }] }] } },
  '12833': { upgrade: { group: 616, level: 1, max: 6, name: 'Champion', fullName: 'Champion 1/6', bonusId: 12833 } },
  '13440': { id: 13440, tag: 'Mythic+' },
};

describe('parseRaidbotsBonuses', () => {
  it('keeps only upgrade bonuses, with their cost per step', () => {
    const tracks = parseRaidbotsBonuses(sample);
    expect(tracks).toHaveLength(2);
    expect(tracks).toEqual(expect.arrayContaining([
      { bonusId: 12850, name: 'Myth', step: 2, max: 6, currencyId: 3446, costPerStep: 20 },
      { bonusId: 12833, name: 'Champion', step: 1, max: 6, currencyId: null, costPerStep: null },
    ]));
  });
});

describe('decodeTrack', () => {
  const tracks = new Map(parseRaidbotsBonuses(sample).map((t) => [t.bonusId, t]));

  it('finds the track among other bonus IDs', () => {
    expect(decodeTrack([13440, 6652, 12850], tracks)?.name).toBe('Myth');
  });

  it('returns null when no bonus ID is a track', () => {
    expect(decodeTrack([13440, 40], tracks)).toBeNull();
  });

  it('formats a label', () => {
    expect(trackLabel(tracks.get(12850)!)).toBe('Myth 2/6');
  });
});

describe('createRaidbotsTracksFetcher', () => {
  it('fetches the live bonus data', async () => {
    const { fn, calls } = fakeFetch([on('raidbots.com/static/data/live/bonuses.json', () => json(sample))]);
    expect(await createRaidbotsTracksFetcher(fn)()).toHaveLength(2);
    expect(calls).toHaveLength(1);
  });
});
