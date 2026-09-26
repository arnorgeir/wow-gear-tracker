import { describe, expect, it } from 'vitest';
import { searchCharacters } from './search';
import { fakeFetch, json, on } from '@/test/fake-fetch';

const response = {
  matches: [
    { type: 'character', name: 'Testbear', data: { name: 'Testbear', region: { slug: 'eu' }, realm: { name: 'Azjol-Nerub', slug: 'azjolnerub', wowRealmId: 503 }, class: { name: 'Druid' }, thumbnail_url: '//render.worldofwarcraft.com/eu/character/x.jpg' } },
    { type: 'character', name: 'Testbear', data: { name: 'Testbear', region: { slug: 'us' }, realm: { name: 'Stormrage', slug: 'stormrage', wowRealmId: 60 }, class: { name: 'Mage' } } },
    { type: 'guild', name: 'Testbear Guild', data: {} },
  ],
};

describe('searchCharacters', () => {
  it('returns characters in the region, keyed by Blizzard realm ID', async () => {
    const { fn, calls } = fakeFetch([on('raider.io/api/search', () => json(response))]);
    expect(await searchCharacters(fn, 'eu', '  Testbear ')).toEqual([
      { name: 'Testbear', realmName: 'Azjol-Nerub', blizzardRealmId: 503, region: 'eu', className: 'Druid', thumbnailUrl: 'https://render.worldofwarcraft.com/eu/character/x.jpg' },
    ]);
    expect(calls[0]!.url).toBe('https://raider.io/api/search?term=Testbear');
  });

  it('does not search for fewer than 3 characters', async () => {
    const { fn, calls } = fakeFetch([]);
    expect(await searchCharacters(fn, 'eu', 'Te ')).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});
