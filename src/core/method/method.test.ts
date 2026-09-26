import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createMethodSource, methodSpecSlug, parseGearingHtml } from './method';
import { fakeFetch, on } from '@/test/fake-fetch';

const html = readFileSync(new URL('./__fixtures__/gearing.html', import.meta.url), 'utf8');

describe('parseGearingHtml', () => {
  const lists = parseGearingHtml(html);

  it('parses every list and skips rows without an item link', () => {
    expect(lists.overall).toHaveLength(6);
    expect(lists.raid).toHaveLength(1);
    expect(lists.mythicPlus).toHaveLength(2);
  });

  it('flags tier and catalyst rows and cleans their text', () => {
    expect(lists.overall[0]).toEqual({
      slotLabel: 'Head', slots: ['HEAD'], itemId: 271875, name: 'Gaze of the Coiled Watcher',
      bonusIds: [], isTier: true, isCatalyst: true, source: 'Ula’tek',
    });
  });

  it('decodes entities and reads bonus IDs', () => {
    expect(lists.overall[2]).toMatchObject({
      slots: ['FINGER_1', 'FINGER_2'], itemId: 159459, name: "Ritual Binder's Ring", bonusIds: [13440, 12854], source: 'Kings’ Rest',
    });
  });

  it('reads links without the /ptr/ prefix', () => {
    expect(lists.overall[4]).toMatchObject({ slots: ['TRINKET_1', 'TRINKET_2'], itemId: 250245 });
  });

  it('maps Cloak and Off Hand labels', () => {
    expect(lists.mythicPlus.map((r) => r.slots)).toEqual([['BACK'], ['OFF_HAND']]);
  });

  it('returns empty lists when the tables are missing', () => {
    expect(parseGearingHtml('<html></html>')).toEqual({ overall: [], raid: [], mythicPlus: [] });
  });
});

describe('methodSpecSlug', () => {
  it.each([
    ['Guardian', 'Druid', 'guardian-druid'],
    ['Beast Mastery', 'Hunter', 'beast-mastery-hunter'],
    ['Blood', 'Death Knight', 'blood-death-knight'],
  ])('%s %s gives %s', (spec, cls, slug) => {
    expect(methodSpecSlug(spec, cls)).toBe(slug);
  });
});

describe('createMethodSource', () => {
  it('fetches the gearing page for the slug', async () => {
    const { fn, calls } = fakeFetch([on('/guides/guardian-druid/gearing', () => new Response(html))]);
    const lists = await createMethodSource(fn).fetchLists('guardian-druid');
    expect(calls[0]!.url).toBe('https://www.method.gg/guides/guardian-druid/gearing');
    expect(lists.overall).toHaveLength(6);
  });

  it('throws an HttpError with status 404 for an unknown spec', async () => {
    const { fn } = fakeFetch([]);
    await expect(createMethodSource(fn).fetchLists('nope-nope')).rejects.toMatchObject({ status: 404 });
  });
});
