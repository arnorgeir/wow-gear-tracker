import { describe, expect, it } from 'vitest';
import { parseEquipment, parseProfile, type RawEquipment, type RawProfile } from './parse';

const profile: RawProfile = {
  name: 'Birkibjörn',
  realm: { id: 1303, name: 'Tarren Mill', slug: 'tarren-mill' },
  character_class: { name: 'Druid' },
  active_spec: { name: 'Guardian' },
  race: { name: 'Troll' },
  faction: { type: 'HORDE' },
};

describe('parseProfile', () => {
  it('maps a full profile', () => {
    expect(parseProfile(profile)).toEqual({
      name: 'Birkibjörn', realmId: 1303, realmSlug: 'tarren-mill', realmName: 'Tarren Mill',
      className: 'Druid', specName: 'Guardian', raceName: 'Troll', faction: 'HORDE',
    });
  });

  it('leaves spec and race empty when Blizzard omits them', () => {
    const bare: RawProfile = { name: profile.name, realm: profile.realm, character_class: profile.character_class };
    expect(parseProfile(bare)).toMatchObject({ specName: '', raceName: '' });
  });

  it('keeps only the two real factions', () => {
    expect(parseProfile({ ...profile, faction: { type: 'ALLIANCE' } }).faction).toBe('ALLIANCE');
    expect(parseProfile({ ...profile, faction: { type: 'NEUTRAL' } }).faction).toBeNull();
    expect(parseProfile({ ...profile, faction: undefined }).faction).toBeNull();
  });
});

describe('parseEquipment', () => {
  it('keeps gear slots and drops cosmetic ones', () => {
    const raw: RawEquipment = {
      equipped_items: [
        { slot: { type: 'HEAD' }, item: { id: 1 }, name: 'Helm' },
        { slot: { type: 'TABARD' }, item: { id: 2 }, name: 'Tabard' },
        { slot: { type: 'SHIRT' }, item: { id: 3 }, name: 'Shirt' },
      ],
    };
    expect(parseEquipment(raw).map((g) => g.slot)).toEqual(['HEAD']);
  });

  it('fills defaults for anything Blizzard leaves out', () => {
    const [item] = parseEquipment({ equipped_items: [{ slot: { type: 'NECK' }, item: { id: 9 }, name: 'Chain' }] });
    expect(item).toEqual({ slot: 'NECK', itemId: 9, name: 'Chain', itemLevel: null, quality: 'COMMON', bonusIds: [], isTier: false });
  });

  it('reads level, quality, bonus IDs and set membership when present', () => {
    const [item] = parseEquipment({ equipped_items: [{
      slot: { type: 'CHEST' }, item: { id: 7 }, name: 'Robe', level: { value: 321 }, quality: { type: 'EPIC' }, bonus_list: [12850], set: {},
    }] });
    expect(item).toMatchObject({ itemLevel: 321, quality: 'EPIC', bonusIds: [12850], isTier: true });
  });

  it('returns nothing when no items are equipped', () => {
    expect(parseEquipment({})).toEqual([]);
  });
});
