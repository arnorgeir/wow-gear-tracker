import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createMethodSource, methodSpecSlug, parseGearingHtml } from './method';
import { fakeFetch, on } from '@/test/fake-fetch';

const html = readFileSync(new URL('./__fixtures__/gearing.html', import.meta.url), 'utf8');
const feral = readFileSync(new URL('./__fixtures__/feral-gearing.html', import.meta.url), 'utf8');

describe('parseGearingHtml', () => {
  const lists = parseGearingHtml(html);

  it('parses every list and skips rows without an item link', () => {
    expect(lists.overall).toHaveLength(6);
    expect(lists.raid).toHaveLength(1);
    expect(lists.mythicPlus).toHaveLength(2);
  });

  it('flags tier and catalyst rows and cleans their text', () => {
    expect(lists.overall[0]).toEqual({
      kind: 'item', slotLabel: 'Head', slots: ['HEAD'], itemId: 271875, name: 'Gaze of the Coiled Watcher',
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

describe('"Any" rows', () => {
  const lists = parseGearingHtml(feral);

  it('keeps an "Any <item level>" row and still skips the header', () => {
    expect(lists.overall).toHaveLength(5);
    expect(lists.overall[1]).toEqual({ kind: 'any', slotLabel: 'Shoulders', slots: ['SHOULDER'], minItemLevel: 334, source: '' });
    expect(lists.overall.filter((r) => r.kind === 'any').map((r) => r.slotLabel)).toEqual(['Shoulders', 'Chest', 'Gloves', 'Boots']);
    expect(lists.mythicPlus).toEqual([]);
  });

  it('still reads the named rows on the same page', () => {
    expect(lists.overall[0]).toMatchObject({ kind: 'item', itemId: 271875, isTier: true });
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

describe('catalyst sources', () => {
  const table = (item: string, source: string) =>
    `<table id="dungeon_table"><tr><td>Head</td><td><a href="https://www.wowhead.com/item=271875">${item}</a></td><td>${source}</td></tr></table>`;

  it('reads "X / Catalyst" as a catalyst source and strips the suffix', () => {
    const [row] = parseGearingHtml(table('Gaze of the Coiled Watcher (Tier Set)', 'Ula&#39;tek / Catalyst')).mythicPlus;
    expect(row).toMatchObject({ kind: 'item', isTier: true, isCatalyst: true, source: "Ula'tek" });
  });

  it('keeps a Tier Set row with a plain source as tier but not catalyst', () => {
    const [row] = parseGearingHtml(table('Primordial Robe of Rites (Tier Set)', 'Altar of Fangs')).mythicPlus;
    expect(row).toMatchObject({ isTier: true, isCatalyst: false, source: 'Altar of Fangs' });
  });
});
