import { describe, expect, it } from 'vitest';
import { fakeFetch, json, on } from '@/test/fake-fetch';
import { fetchMainSeason, pickMainSeason, type RawSeason } from './season';

const now = Date.parse('2026-09-30T12:00:00Z');
const season = (slug: string, isMain: boolean, starts: Record<string, string | null>, dungeons: RawSeason['dungeons'] = []): RawSeason =>
  ({ slug, name: slug, is_main_season: isMain, starts, dungeons });
const dungeons: RawSeason['dungeons'] = [{ challenge_mode_id: 501, name: 'Alpha Hollow', short_name: 'AH' }];

describe('pickMainSeason', () => {
  it('takes the newest main season that has started in any region', () => {
    const picked = pickMainSeason([
      season('season-test-1', true, { eu: '2026-03-25T04:00:00Z' }),
      season('season-test-2', true, { us: '2026-08-18T15:00:00Z', eu: '2026-08-19T04:00:00Z' }, dungeons),
      season('season-test-2-remix', false, { eu: '2026-09-01T04:00:00Z' }),
      season('season-test-3', true, { eu: '2026-12-01T04:00:00Z' }),
      season('season-test-4', true, { eu: null }),
    ], now);
    expect(picked).toEqual({ slug: 'season-test-2', name: 'season-test-2', dungeons: [{ challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH' }] });
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
