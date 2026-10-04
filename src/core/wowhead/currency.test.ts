import { describe, expect, it } from 'vitest';
import { fakeFetch, json, on } from '@/test/fake-fetch';
import type { Track } from '../types';
import fixture from './__fixtures__/currency-3446.json';
import { createCurrencyIconFetcher, currencyTooltipUrl, parseCurrencyIcon, withCurrencyIcons } from './currency';

const track = (bonusId: number, currencyId: number | null): Track => ({
  bonusId, name: 'Myth', step: 2, max: 6, group: 618, currencyId, currencyName: currencyId ? 'Myth Mistcrest' : null, costPerStep: currencyId ? 20 : null,
});

describe('parseCurrencyIcon', () => {
  it('reads the icon name from a tooltip answer', () => {
    expect(parseCurrencyIcon(fixture)).toBe('inv_121_crest_myth');
  });

  it('rejects names with other characters, and answers without one', () => {
    expect(parseCurrencyIcon({ icon: '../evil' })).toBeNull();
    expect(parseCurrencyIcon({ icon: 'INV Crest' })).toBeNull();
    expect(parseCurrencyIcon({ name: 'Myth Mistcrest' })).toBeNull();
    expect(parseCurrencyIcon(null)).toBeNull();
  });
});

describe('createCurrencyIconFetcher', () => {
  it('asks Wowhead for the currency and returns its icon name', async () => {
    const { fn, calls } = fakeFetch([on('/tooltip/currency/3446', () => json(fixture))]);
    expect(await createCurrencyIconFetcher(fn)(3446)).toBe('inv_121_crest_myth');
    expect(calls[0]!.url).toBe(currencyTooltipUrl(3446));
  });

  it('returns null instead of throwing when Wowhead fails', async () => {
    const { fn } = fakeFetch([on('/tooltip/currency/', () => json({ error: 'down' }, 500))]);
    expect(await createCurrencyIconFetcher(fn)(3446)).toBeNull();
  });
});

describe('withCurrencyIcons', () => {
  it('looks up each currency once and adds its icon to every track that costs it', async () => {
    const asked: number[] = [];
    const fetchIcon = async (id: number) => { asked.push(id); return id === 3446 ? 'inv_121_crest_myth' : null; };
    const fetchRaidbots = async () => ({ tracks: [track(1, 3446), track(2, 3446), track(3, 3445), track(4, null)], qualities: [] });
    const { tracks } = await withCurrencyIcons(fetchRaidbots, fetchIcon)();
    expect(asked.sort()).toEqual([3445, 3446]);
    expect(tracks.map((t) => t.currencyIcon)).toEqual(['inv_121_crest_myth', 'inv_121_crest_myth', null, null]);
  });

  it('keeps the tracks when one lookup fails', async () => {
    const fetchIcon = async (id: number) => { if (id === 3445) throw new Error('timeout'); return 'inv_121_crest_myth'; };
    const fetchRaidbots = async () => ({ tracks: [track(1, 3446), track(3, 3445)], qualities: [] });
    const { tracks } = await withCurrencyIcons(fetchRaidbots, fetchIcon)();
    expect(tracks.map((t) => t.currencyIcon)).toEqual(['inv_121_crest_myth', null]);
  });
});
