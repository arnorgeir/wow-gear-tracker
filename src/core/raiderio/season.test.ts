import { describe, expect, it } from 'vitest';
import { fakeFetch, json, on } from '@/test/fake-fetch';
import { artworkUrl, fetchMainSeason, pickMainSeason, type RawSeason } from './season';

const now = Date.parse('2026-09-30T12:00:00Z');
const season = (slug: string, isMain: boolean, starts: Record<string, string | null>, dungeons: RawSeason['dungeons'] = []): RawSeason =>
  ({ slug, name: slug, is_main_season: isMain, starts, dungeons });
const ART = 'https://cdn.raiderio.net/images/dungeons/expansion11/base/alpha-hollow.jpg';
const dungeons: RawSeason['dungeons'] = [{ challenge_mode_id: 501, name: 'Alpha Hollow', short_name: 'AH', background_image_url: ART }];

describe('pickMainSeason', () => {
  it('takes the newest main season that has started in any region', () => {
    const picked = pickMainSeason([
      season('season-test-1', true, { eu: '2026-03-25T04:00:00Z' }),
      season('season-test-2', true, { us: '2026-08-18T15:00:00Z', eu: '2026-08-19T04:00:00Z' }, dungeons),
      season('season-test-2-remix', false, { eu: '2026-09-01T04:00:00Z' }),
      season('season-test-3', true, { eu: '2026-12-01T04:00:00Z' }),
      season('season-test-4', true, { eu: null }),
    ], now);
    expect(picked).toEqual({ slug: 'season-test-2', name: 'season-test-2', dungeons: [{ challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', imageUrl: ART }] });
  });

  it('returns null when no main season has started', () => {
    expect(pickMainSeason([season('season-test-3', true, { eu: '2026-12-01T04:00:00Z' })], now)).toBeNull();
  });
});

describe('fetchMainSeason', () => {
  it('checks this expansion and the next, tolerating a next expansion Raider.IO rejects', async () => {
    const { fn, calls } = fakeFetch([
      on('expansion_id=11', () => json({ seasons: [season('season-test-2', true, { eu: '2026-08-19T04:00:00Z' }, dungeons)] })),
      on('expansion_id=12', () => new Response('bad expansion', { status: 400 })),
    ]);
    expect((await fetchMainSeason(fn, now)).slug).toBe('season-test-2');
    expect(calls.map((c) => c.url)).toEqual(expect.arrayContaining([
      'https://raider.io/api/v1/mythic-plus/static-data?expansion_id=11',
      'https://raider.io/api/v1/mythic-plus/static-data?expansion_id=12',
    ]));
  });

  it('prefers a started season from the next expansion', async () => {
    const { fn } = fakeFetch([
      on('expansion_id=11', () => json({ seasons: [season('season-test-2', true, { eu: '2026-08-19T04:00:00Z' })] })),
      on('expansion_id=12', () => json({ seasons: [season('season-next-1', true, { eu: '2026-09-29T04:00:00Z' })] })),
    ]);
    expect((await fetchMainSeason(fn, now)).slug).toBe('season-next-1');
  });

  it('fails when Raider.IO lists no started main season', async () => {
    const { fn } = fakeFetch([on('static-data', () => json({ seasons: [] }))]);
    await expect(fetchMainSeason(fn, now)).rejects.toThrow('no started main Mythic+ season');
  });
});

describe('artworkUrl', () => {
  it('keeps an HTTPS URL on Raider.IO’s CDN unchanged', () => {
    expect(artworkUrl(ART)).toBe(ART);
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['a number', 42],
    ['empty', ''],
    ['malformed', 'not a url'],
    ['HTTP', 'http://cdn.raiderio.net/images/a.jpg'],
    ['credential-bearing', 'https://user:pw@cdn.raiderio.net/images/a.jpg'],
    ['another host', 'https://evil.example/images/a.jpg'],
    ['a lookalike host', 'https://cdn.raiderio.net.evil.example/a.jpg'],
  ])('turns %s into null', (_label, value) => {
    expect(artworkUrl(value)).toBeNull();
  });
});

describe('pickMainSeason artwork', () => {
  it('keeps a dungeon whose artwork is unusable, with null artwork', () => {
    const picked = pickMainSeason([season('season-test-2', true, { eu: '2026-08-19T04:00:00Z' }, [
      { challenge_mode_id: 502, name: 'Streets of Beta', short_name: 'STRT', background_image_url: 'http://cdn.raiderio.net/x.jpg' },
      { challenge_mode_id: 503, name: 'Beta Gambit', short_name: 'GMBT' },
    ])], now);
    expect(picked!.dungeons.map((d) => [d.challengeModeId, d.imageUrl])).toEqual([[502, null], [503, null]]);
  });
});
