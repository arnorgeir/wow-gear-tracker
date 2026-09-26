import { describe, expect, it } from 'vitest';
import {
  createRaidbotsFetcher, decodeTrack, parseBonusQualities, parseRaidbotsBonuses, qualityFromBonuses, trackLabel,
} from './tracks';
import { fakeFetch, json, on } from '@/test/fake-fetch';

const sample = {
  '12850': { upgrade: { group: 618, level: 2, max: 6, name: 'Myth', fullName: 'Myth 2/6', bonusId: 12850, costs: [{ amounts: [{ currencyId: 3446, amount: 20, name: 'Myth Mistcrest' }] }] } },
  '12833': { upgrade: { group: 616, level: 1, max: 6, name: 'Champion', fullName: 'Champion 1/6', bonusId: 12833 } },
  '13440': { id: 13440, tag: 'Mythic+' },
  '12805': { id: 12805, itemLevel: { amount: 285 }, quality: 4 },
  '4775': { id: 4775, quality: 3 },
  '999': { upgrade: { level: 3 } },
};

describe('parseRaidbotsBonuses', () => {
  it('keeps upgrade bonuses with their group, crest and cost', () => {
    const tracks = parseRaidbotsBonuses(sample);
    expect(tracks).toHaveLength(2);
    expect(tracks).toEqual(expect.arrayContaining([
      { bonusId: 12850, name: 'Myth', step: 2, max: 6, group: 618, currencyId: 3446, currencyName: 'Myth Mistcrest', costPerStep: 20 },
      { bonusId: 12833, name: 'Champion', step: 1, max: 6, group: 616, currencyId: null, currencyName: null, costPerStep: null },
    ]));
  });
});

describe('parseBonusQualities', () => {
  it('maps numeric quality bonuses to quality names', () => {
    expect(parseBonusQualities(sample)).toEqual(expect.arrayContaining([
      { bonusId: 12805, quality: 'EPIC' },
      { bonusId: 4775, quality: 'RARE' },
    ]));
    expect(parseBonusQualities(sample)).toHaveLength(2);
  });
});

describe('qualityFromBonuses', () => {
  const qualities = new Map([[12805, 'EPIC' as const], [4775, 'RARE' as const]]);

  it('picks the highest quality among the bonus IDs', () => {
    expect(qualityFromBonuses([4775, 1, 12805], qualities)).toBe('EPIC');
  });

  it('returns null when no bonus ID sets a quality', () => {
    expect(qualityFromBonuses([1, 2], qualities)).toBeNull();
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

describe('createRaidbotsFetcher', () => {
  it('fetches the live bonus data once and returns tracks and qualities', async () => {
    const { fn, calls } = fakeFetch([on('raidbots.com/static/data/live/bonuses.json', () => json(sample))]);
    const data = await createRaidbotsFetcher(fn)();
    expect(data.tracks).toHaveLength(2);
    expect(data.qualities).toHaveLength(2);
    expect(calls).toHaveLength(1);
  });
});
