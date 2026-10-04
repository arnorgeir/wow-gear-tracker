import { describe, expect, it } from 'vitest';
import { affordableUpgrade, crestCostsByGroup, summarizeCrests } from './crests';
import type { Track } from '../types';

const t = (bonusId: number, name: string, step: number, group: number | null, cost: [number, string, number] | null): Track => ({
  bonusId, name, step, max: 6, group,
  currencyId: cost?.[0] ?? null, currencyName: cost?.[1] ?? null, costPerStep: cost?.[2] ?? null,
  currencyIcon: cost?.[0] === 3446 ? 'inv_121_crest_myth' : null,
});
const MYTH_ICON = 'https://wow.zamimg.com/images/wow/icons/medium/inv_121_crest_myth.jpg';

const tracks = [
  t(1, 'Myth', 1, 618, null),
  t(2, 'Myth', 2, 618, [3446, 'Myth Mistcrest', 20]),
  t(3, 'Myth', 6, 618, [3446, 'Myth Mistcrest', 20]),
  t(4, 'Hero', 5, 617, [3445, 'Hero Mistcrest', 20]),
  t(5, 'Myth', 3, 500, [2999, 'Old Myth Crest', 15]),
  t(6, 'Mystery', 2, null, [1, 'No group', 10]),
];
const costs = crestCostsByGroup(tracks);

describe('crestCostsByGroup', () => {
  it('keys costs by group, so seasons with the same track name stay apart', () => {
    expect(costs.get(618)).toEqual({ group: 618, currencyId: 3446, currencyName: 'Myth Mistcrest', costPerStep: 20, iconUrl: MYTH_ICON });
    expect(costs.get(500)?.currencyId).toBe(2999);
    expect(costs.size).toBe(3);
  });
});

describe('affordableUpgrade', () => {
  const balances = new Map([[3446, 85], [3445, 10]]);

  it('counts the steps the balance covers, capped at the track max', () => {
    expect(affordableUpgrade(tracks[0]!, costs, balances)).toEqual({ steps: 4, currencyId: 3446, currencyName: 'Myth Mistcrest', costPerStep: 20, iconUrl: MYTH_ICON });
    expect(affordableUpgrade(t(9, 'Myth', 5, 618, null), costs, balances)?.steps).toBe(1);
  });

  it('returns null at max step, below one step’s cost, or without cost data', () => {
    expect(affordableUpgrade(tracks[2]!, costs, balances)).toBeNull();
    expect(affordableUpgrade(tracks[3]!, costs, balances)).toBeNull();
    expect(affordableUpgrade(tracks[5]!, costs, balances)).toBeNull();
    expect(affordableUpgrade(t(9, 'Myth', 2, 777, null), costs, balances)).toBeNull();
    expect(affordableUpgrade(null, costs, balances)).toBeNull();
  });
});

describe('summarizeCrests', () => {
  it('lists crests the character holds, highest track first, with the steps they cover', () => {
    expect(summarizeCrests(new Map([[3445, 140], [3446, 85], [1234, 5]]), costs)).toEqual([
      { currencyId: 3446, name: 'Myth Mistcrest', quantity: 85, steps: 4, iconUrl: MYTH_ICON },
      { currencyId: 3445, name: 'Hero Mistcrest', quantity: 140, steps: 7, iconUrl: null },
    ]);
  });
});
