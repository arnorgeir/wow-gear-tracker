import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSimc, SimcParseError } from './parse';

const text = readFileSync(new URL('./__fixtures__/export.txt', import.meta.url), 'utf8');

describe('parseSimc', () => {
  const profile = parseSimc(text);

  it('reads the character header', () => {
    expect(profile).toMatchObject({ name: 'Testbear', classToken: 'druid', region: 'eu', realmToken: 'tarren_mill', specToken: 'guardian' });
  });

  it('reads equipped items with name and item level, and skips the shirt', () => {
    expect(profile.items.filter((i) => i.location === 'equipped')).toEqual([
      { location: 'equipped', slot: 'HEAD', itemId: 271528, name: 'Enigmatic Dreamwatcher\'s Somnolent Stare', itemLevel: 321, bonusIds: [13692, 13440, 6652, 13696, 13698, 12850] },
      { location: 'equipped', slot: 'NECK', itemId: 251173, name: 'Yoke of the Charging Bear', itemLevel: 318, bonusIds: [13440, 6652, 13668, 12699, 12845] },
      { location: 'equipped', slot: 'FINGER_1', itemId: 273792, name: 'Band of the Amani Warlord', itemLevel: 334, bonusIds: [13440, 6652, 13668, 12699, 12854] },
      { location: 'equipped', slot: 'TRINKET_1', itemId: 250256, name: 'Heart of Wind', itemLevel: 298, bonusIds: [13440, 40, 12699, 13654] },
      { location: 'equipped', slot: 'MAIN_HAND', itemId: 273783, name: 'Toxin-Coated Warstaff', itemLevel: 321, bonusIds: [13440, 6652, 12701, 12846] },
    ]);
  });

  it('reads bag and Great Vault items', () => {
    expect(profile.items.filter((i) => i.location === 'bag').map((i) => [i.slot, i.itemId, i.name, i.itemLevel])).toEqual([
      ['WAIST', 159301, 'Primal Dinomancer\'s Belt', 315],
      ['FINGER_1', 159459, 'Ritual Binder\'s Ring', 311],
    ]);
    expect(profile.items.filter((i) => i.location === 'vault').map((i) => [i.slot, i.itemId, i.itemLevel])).toEqual([['TRINKET_1', 250245, 324]]);
  });

  it('reads crests and catalyst charges, skipping item currencies', () => {
    expect(profile.currencies).toEqual([
      { kind: 'catalyst', currencyId: 3378, quantity: 2 },
      { kind: 'upgrade', currencyId: 3446, quantity: 85 },
      { kind: 'upgrade', currencyId: 3445, quantity: 140 },
    ]);
  });

  it('parses Windows line endings and indented lines the same way', () => {
    const messy = text.replace(/\r\n/g, '\n').split('\n').map((l) => `  ${l}`).join('\r\n');
    expect(parseSimc(messy)).toEqual(profile);
  });

  it('rejects text without a character line', () => {
    expect(() => parseSimc('head=,id=1\nneck=,id=2')).toThrow(SimcParseError);
    expect(() => parseSimc('')).toThrow(/character line is missing/);
  });

  it('rejects a paste that was cut off before the end', () => {
    const cut = text.slice(0, text.indexOf('### Gear from Bags'));
    expect(() => parseSimc(cut)).toThrow(/cut off/);
  });

  it('rejects an export with no equipped items', () => {
    expect(() => parseSimc('druid="Testbear"\nregion=eu\nserver=tarren_mill')).toThrow(/No equipped items/);
  });

  it('names the line of an item without an id', () => {
    try {
      parseSimc('druid="Testbear"\nregion=eu\nserver=tarren_mill\nhead=,bonus_id=1');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(SimcParseError);
      expect((err as SimcParseError).line).toBe(4);
    }
  });
});
