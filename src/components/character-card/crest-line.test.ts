import { describe, expect, it } from 'vitest';
import { crestLine } from './crest-line';

const DAY = 24 * 60 * 60 * 1000;
const now = 10 * DAY;
const myth = { currencyId: 3446, name: 'Myth Mistcrest', quantity: 12, steps: 0, iconUrl: null };
const crests = (balances: (typeof myth)[]) => ({ balances, pastedAt: now - 2 * DAY });

describe('crestLine', () => {
  it('asks for a paste when crests are unknown', () => {
    expect(crestLine({ crests: null, gearFromSimc: false, upgradesReady: 0 }, now))
      .toEqual({ balances: [], text: 'Crests unknown: paste SimC', tone: 'text-muted' });
  });

  it('returns the balances as data and says when nothing is affordable', () => {
    expect(crestLine({ crests: crests([myth]), gearFromSimc: true, upgradesReady: 0 }, now))
      .toEqual({ balances: [myth], text: 'No BiS upgrades affordable', tone: 'text-muted' });
  });

  it('says so when the paste had no crests at all', () => {
    expect(crestLine({ crests: crests([]), gearFromSimc: true, upgradesReady: 0 }, now).text).toBe('No crests: no BiS upgrades affordable');
  });

  it('keeps the balances but claims no upgrades while track data is unknown', () => {
    expect(crestLine({ crests: crests([myth]), gearFromSimc: true, upgradesReady: 0, tracksKnown: false }, now))
      .toEqual({ balances: [myth], text: '', tone: 'text-muted' });
    expect(crestLine({ crests: null, gearFromSimc: false, upgradesReady: 0, tracksKnown: false }, now).text).toBe('Crests unknown: paste SimC');
  });

  it('counts ready upgrades in the singular and plural', () => {
    expect(crestLine({ crests: crests([myth]), gearFromSimc: true, upgradesReady: 1 }, now))
      .toEqual({ balances: [myth], text: '1 BiS upgrade ready', tone: 'text-upgrade' });
    expect(crestLine({ crests: crests([myth]), gearFromSimc: true, upgradesReady: 3 }, now).text).toBe('3 BiS upgrades ready');
  });

  it('says how old the paste is when the gear itself came from Blizzard', () => {
    expect(crestLine({ crests: crests([myth]), gearFromSimc: false, upgradesReady: 0 }, now).text)
      .toBe('Pasted 2 days ago: no BiS upgrades affordable');
  });
});
