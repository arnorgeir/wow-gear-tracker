import { describe, expect, it } from 'vitest';
import { crestLine } from './crest-line';

const DAY = 24 * 60 * 60 * 1000;
const now = 10 * DAY;
const crests = (balances: { name: string; quantity: number }[]) => ({ balances, pastedAt: now - 2 * DAY });

describe('crestLine', () => {
  it('asks for a paste when crests are unknown', () => {
    expect(crestLine({ crests: null, gearFromSimc: false, upgradesReady: 0 }, now))
      .toEqual({ text: 'Crests unknown: paste SimC', tone: 'text-muted' });
  });

  it('names each crest by its first word and says when nothing is affordable', () => {
    const input = { crests: crests([{ name: 'Myth Crest', quantity: 12 }, { name: 'Hero Crest', quantity: 30 }]), gearFromSimc: true, upgradesReady: 0 };
    expect(crestLine(input, now)).toEqual({ text: 'Myth 12, Hero 30: no BiS upgrades affordable', tone: 'text-muted' });
  });

  it('says so when the paste had no crests at all', () => {
    expect(crestLine({ crests: crests([]), gearFromSimc: true, upgradesReady: 0 }, now).text).toBe('No crests: no BiS upgrades affordable');
  });

  it('counts one ready upgrade in the singular', () => {
    expect(crestLine({ crests: crests([{ name: 'Myth Crest', quantity: 12 }]), gearFromSimc: true, upgradesReady: 1 }, now))
      .toEqual({ text: 'Myth 12: 1 BiS upgrade ready', tone: 'text-upgrade' });
  });

  it('counts several ready upgrades in the plural', () => {
    expect(crestLine({ crests: crests([{ name: 'Myth Crest', quantity: 12 }]), gearFromSimc: true, upgradesReady: 3 }, now).text)
      .toBe('Myth 12: 3 BiS upgrades ready');
  });

  it('says how old the paste is when the gear itself came from Blizzard', () => {
    expect(crestLine({ crests: crests([{ name: 'Myth Crest', quantity: 12 }]), gearFromSimc: false, upgradesReady: 0 }, now).text)
      .toBe('Myth 12 (pasted 2 days ago): no BiS upgrades affordable');
  });
});
