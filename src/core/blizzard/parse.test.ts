import { describe, expect, it } from 'vitest';
import {
  parseEquipment, parseProfile, parseItemInfo, parseKeystoneDungeon,
  parseJournalInstance, parseJournalEncounter, parseJournalInstanceIndex,
  type RawEquipment, type RawProfile,
} from './parse';

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

describe('parseItemInfo', () => {
  it('reads slot and armor type for armor', () => {
    expect(parseItemInfo({ quality: { type: 'EPIC' }, inventory_type: { type: 'ROBE' }, item_class: { id: 4 }, item_subclass: { id: 2 } }))
      .toEqual({ quality: 'EPIC', isTier: false, inventoryType: 'ROBE', armorType: 'leather' });
  });

  it('gives no armor type to weapons and to armor without a known subclass', () => {
    expect(parseItemInfo({ inventory_type: { type: 'WEAPON' }, item_class: { id: 2 }, item_subclass: { id: 15 } }).armorType).toBeNull();
    expect(parseItemInfo({ inventory_type: { type: 'FINGER' }, item_class: { id: 4 }, item_subclass: { id: 0 } }).armorType).toBeNull();
  });

  it('fills nulls when Blizzard omits fields', () => {
    expect(parseItemInfo({})).toEqual({ quality: null, isTier: false, inventoryType: null, armorType: null });
  });
});

describe('journal parsers', () => {
  it('maps a keystone dungeon to its map', () => {
    expect(parseKeystoneDungeon({ name: 'Alpha Hollow', map: { id: 11, name: 'Alpha Hollow' } })).toEqual({ name: 'Alpha Hollow', mapId: 11, mapName: 'Alpha Hollow' });
  });

  it('maps a journal instance to its map and encounters', () => {
    expect(parseJournalInstance({ id: 901, name: 'Alpha Hollow', map: { id: 11 }, encounters: [{ id: 1 }, { id: 2 }] }))
      .toEqual({ id: 901, name: 'Alpha Hollow', mapId: 11, encounterIds: [1, 2] });
    expect(parseJournalInstance({ id: 902, name: 'No Map' })).toEqual({ id: 902, name: 'No Map', mapId: null, encounterIds: [] });
  });

  it('maps an encounter to its items, and the index to ids and names', () => {
    expect(parseJournalEncounter({ id: 1, name: 'Hollow King', items: [{ item: { id: 100, name: 'Hollow Robe' } }] }))
      .toEqual({ id: 1, name: 'Hollow King', items: [{ itemId: 100, name: 'Hollow Robe' }] });
    expect(parseJournalInstanceIndex({ instances: [{ id: 901, name: 'Alpha Hollow' }] })).toEqual([{ id: 901, name: 'Alpha Hollow' }]);
  });
});
