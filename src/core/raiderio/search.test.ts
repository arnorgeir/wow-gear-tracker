import { describe, expect, it } from 'vitest';
import { searchCharacters } from './search';
import { fakeFetch, json, on } from '@/test/fake-fetch';

const response = {
  matches: [
    { type: 'character', name: 'Birkibjörn', data: { name: 'Birkibjörn', region: { slug: 'eu' }, realm: { name: 'Azjol-Nerub', slug: 'azjolnerub', wowRealmId: 503 }, class: { name: 'Druid' }, faction: 'horde', thumbnail_url: '//render.worldofwarcraft.com/eu/character/x.jpg' } },
    { type: 'character', name: 'Birkibjörn', data: { name: 'Birkibjörn', region: { slug: 'us' }, realm: { name: 'Stormrage', slug: 'stormrage', wowRealmId: 60 }, class: { name: 'Mage' } } },
    { type: 'guild', name: 'Birkibjörn Guild', data: {} },
  ],
};

describe('searchCharacters', () => {
  it('returns characters in the region, keyed by Blizzard realm ID', async () => {
    const { fn, calls } = fakeFetch([on('raider.io/api/search', () => json(response))]);
    expect(await searchCharacters(fn, 'eu', '  Birkibjörn ')).toEqual([
      { name: 'Birkibjörn', realmName: 'Azjol-Nerub', blizzardRealmId: 503, region: 'eu', className: 'Druid', faction: 'HORDE', thumbnailUrl: 'https://render.worldofwarcraft.com/eu/character/x.jpg' },
    ]);
    expect(calls[0]!.url).toBe('https://raider.io/api/search?term=Birkibj%C3%B6rn');
  });

  it('leaves the faction empty when Raider.IO has none or an unknown one', async () => {
    const odd = { matches: [{ type: 'character', data: { name: 'Birkibjörn', region: { slug: 'eu' }, realm: { name: 'X', wowRealmId: 1 }, class: { name: 'Druid' }, faction: 'neutral' } }] };
    const { fn } = fakeFetch([on('raider.io/api/search', () => json(odd))]);
    expect((await searchCharacters(fn, 'eu', 'Birkibjörn'))[0]?.faction).toBeNull();
  });

  it('does not search for fewer than 3 characters', async () => {
    const { fn, calls } = fakeFetch([]);
    expect(await searchCharacters(fn, 'eu', 'Te ')).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});
