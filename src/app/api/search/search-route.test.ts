import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { openTestDb } from '@/test/db';
import { fakeFetch, json, on } from '@/test/fake-fetch';
import type { BlizzardClient } from '@/core/blizzard/client';
import type { Services } from '@/server/services';

let services: Services;
vi.mock('@/server/services', () => ({ getServices: async () => services }));

const { GET } = await import('./route');

const match = (name: string, className: string) => ({
  type: 'character',
  data: { name, region: { slug: 'eu' }, realm: { name: 'Draenor', wowRealmId: 1403 }, class: { name: className }, faction: 'horde' },
});

describe('GET /api/search', () => {
  it('gives a result whose class has no cached icon a null icon', async () => {
    const { fn } = fakeFetch([on('raider.io/api/search', () => json({ matches: [match('Birkibjörn', 'Druid'), match('Hrafnhildur', 'Tinker')] }))]);
    services = {
      db: await openTestDb(), fetchFn: fn, now: () => 1000,
      blizzard: {
        getClasses: async () => [{ id: 11, name: 'Druid', specs: [] }],
        getClassIconUrl: async () => 'https://i/druid.jpg',
      } as unknown as BlizzardClient,
    } as unknown as Services;
    const res = await GET(new NextRequest('http://localhost/api/search?region=eu&term=bir'));
    const body = await res.json() as { name: string; classIconUrl: string | null }[];
    expect(body.map((r) => [r.name, r.classIconUrl])).toEqual([['Birkibjörn', 'https://i/druid.jpg'], ['Hrafnhildur', null]]);
  });
});
