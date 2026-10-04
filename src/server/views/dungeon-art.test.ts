import { describe, expect, it } from 'vitest';
import type { SeasonLoot } from '@/core/types';
import { dungeonArt } from './dungeon-art';

const AH = 'https://cdn.raiderio.net/images/dungeons/alpha-hollow.jpg';
const season: SeasonLoot[] = [
  { challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', imageUrl: AH, split: false, loot: [] },
  { challengeModeId: 502, name: 'Streets of Beta', shortName: 'STRT', imageUrl: null, split: true, loot: [] },
];

describe('dungeonArt', () => {
  it('finds artwork by challenge mode ID', () => {
    expect(dungeonArt(season, 501)).toEqual({ shortName: 'AH', imageUrl: AH });
    expect(dungeonArt(season, 502)).toEqual({ shortName: 'STRT', imageUrl: null });
  });

  it('gives an unmatched dungeon the fallback instead of dropping it', () => {
    expect(dungeonArt(season, 999)).toEqual({ shortName: '', imageUrl: null });
  });
});
