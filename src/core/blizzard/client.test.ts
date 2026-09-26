import { describe, expect, it } from 'vitest';
import { createBlizzardClient } from './client';
import { fakeFetch, json, on } from '@/test/fake-fetch';
import { HttpError } from '../http';

const token = () => json({ access_token: 'tok', expires_in: 86_400 });

const equipment = {
  equipped_items: [
    { slot: { type: 'HEAD' }, item: { id: 111 }, name: 'Test Helm', level: { value: 321 }, quality: { type: 'EPIC' }, bonus_list: [1, 2], set: { item_set: { id: 9 } } },
    { slot: { type: 'SHIRT' }, item: { id: 222 }, name: 'Plain Shirt', level: { value: 1 }, quality: { type: 'COMMON' } },
    { slot: { type: 'TABARD' }, item: { id: 223 }, name: 'Guild Tabard', level: { value: 1 }, quality: { type: 'COMMON' } },
    { slot: { type: 'FINGER_1' }, item: { id: 333 }, name: 'Test Ring', level: { value: 311 }, quality: { type: 'RARE' } },
  ],
};

const profile = {
  name: 'Birkibjörn',
  realm: { id: 1306, name: 'Tarren Mill', slug: 'tarren-mill' },
  character_class: { name: 'Druid' },
  active_spec: { name: 'Guardian' },
  race: { name: 'Troll' },
  faction: { type: 'HORDE' },
};

function client(routes: Parameters<typeof fakeFetch>[0]) {
  const fake = fakeFetch([on('oauth.battle.net/token', token), ...routes]);
  return { ...fake, api: createBlizzardClient({ clientId: 'id', clientSecret: 'secret', fetchFn: fake.fn, sleep: async () => {} }) };
}

const ref = { region: 'eu' as const, realmSlug: 'tarren-mill', name: 'Birkibjörn' };

describe('Blizzard client', () => {
  it('maps equipment, skipping shirt and tabard', async () => {
    const { api } = client([on('/equipment', () => json(equipment))]);
    expect(await api.getEquipment(ref)).toEqual([
      { slot: 'HEAD', itemId: 111, name: 'Test Helm', itemLevel: 321, quality: 'EPIC', bonusIds: [1, 2], isTier: true },
      { slot: 'FINGER_1', itemId: 333, name: 'Test Ring', itemLevel: 311, quality: 'RARE', bonusIds: [], isTier: false },
    ]);
  });

  it('lowercases and URL-encodes the character name', async () => {
    const { api, calls } = client([on('/equipment', () => json(equipment))]);
    await api.getEquipment(ref);
    const url = calls.find((c) => c.url.includes('/equipment'))!.url;
    expect(url).toContain('/profile/wow/character/tarren-mill/birkibj%C3%B6rn/equipment');
    expect(url).toContain('namespace=profile-eu');
    expect(url).toContain('locale=en_GB');
  });

  it('maps the profile', async () => {
    const { api } = client([on('/character/tarren-mill/', () => json(profile))]);
    expect(await api.getProfile(ref)).toEqual({
      name: 'Birkibjörn', realmId: 1306, realmSlug: 'tarren-mill', realmName: 'Tarren Mill',
      className: 'Druid', specName: 'Guardian', raceName: 'Troll', faction: 'HORDE',
    });
  });

  it('reuses the token across calls', async () => {
    const { api, calls } = client([on('/equipment', () => json(equipment))]);
    await api.getEquipment(ref);
    await api.getEquipment(ref);
    expect(calls.filter((c) => c.url.includes('oauth')).length).toBe(1);
  });

  it('gets a new token after a 401 and retries', async () => {
    let first = true;
    const { api, calls } = client([
      on('/equipment', () => {
        if (first) { first = false; return new Response('expired', { status: 401 }); }
        return json(equipment);
      }),
    ]);
    expect(await api.getEquipment(ref)).toHaveLength(2);
    expect(calls.filter((c) => c.url.includes('oauth')).length).toBe(2);
  });

  it('throws HttpError 404 for an unknown character', async () => {
    const { api } = client([on('/equipment', () => new Response('', { status: 404 }))]);
    await expect(api.getEquipment(ref)).rejects.toBeInstanceOf(HttpError);
    await expect(api.getEquipment(ref)).rejects.toMatchObject({ status: 404 });
  });

  it('returns the icon URL, or null when the item has no media', async () => {
    const { api } = client([
      on('/media/item/111', () => json({ assets: [{ key: 'icon', value: 'https://render.worldofwarcraft.com/eu/icons/56/x.jpg' }] })),
      on('/media/item/999', () => new Response('', { status: 404 })),
    ]);
    expect(await api.getItemIconUrl('eu', 111)).toBe('https://render.worldofwarcraft.com/eu/icons/56/x.jpg');
    expect(await api.getItemIconUrl('eu', 999)).toBeNull();
  });

  it('loads realms once per region', async () => {
    const { api, calls } = client([on('/realm/index', () => json({ realms: [{ id: 1306, name: 'Tarren Mill', slug: 'tarren-mill' }] }))]);
    expect(await api.getRealms('eu')).toEqual([{ id: 1306, name: 'Tarren Mill', slug: 'tarren-mill' }]);
    await api.getRealms('eu');
    expect(calls.filter((c) => c.url.includes('/realm/index')).length).toBe(1);
    expect(calls.find((c) => c.url.includes('/realm/index'))!.url).toContain('namespace=dynamic-eu');
  });

  it('loads classes with their specs', async () => {
    const { api } = client([
      on('/playable-class/index', () => json({ classes: [{ id: 11, name: 'Druid' }] })),
      on('/playable-class/11', () => json({ specializations: [{ name: 'Balance' }, { name: 'Guardian' }] })),
    ]);
    expect(await api.getClasses('eu')).toEqual([{ id: 11, name: 'Druid', specs: ['Balance', 'Guardian'] }]);
  });

  it('reads item quality and whether the item belongs to a set', async () => {
    const { api } = client([
      on('/data/wow/item/111', () => json({ quality: { type: 'EPIC' }, preview_item: { set: { item_set: { id: 2057 } } } })),
      on('/data/wow/item/222', () => json({ quality: { type: 'RARE' }, preview_item: {} })),
      on('/data/wow/item/999', () => new Response('', { status: 404 })),
    ]);
    expect(await api.getItemDetails('eu', 111)).toEqual({ quality: 'EPIC', isTier: true });
    expect(await api.getItemDetails('eu', 222)).toEqual({ quality: 'RARE', isTier: false });
    expect(await api.getItemDetails('eu', 999)).toBeNull();
  });

  it('treats a missing race and an unknown faction as empty', async () => {
    const { api } = client([on('/character/tarren-mill/', () => json({ ...profile, race: undefined, faction: { type: 'NEUTRAL' } }))]);
    expect(await api.getProfile(ref)).toMatchObject({ raceName: '', faction: null });
  });

  it('returns the character’s avatar URL, or null when Blizzard has none', async () => {
    const { api, calls } = client([
      on('/tarren-mill/birkibj%C3%B6rn/character-media', () => json({ assets: [{ key: 'avatar', value: 'https://render/a.jpg' }, { key: 'main-raw', value: 'https://render/m.png' }] })),
      on('/tarren-mill/nobody/character-media', () => new Response('', { status: 404 })),
    ]);
    expect(await api.getCharacterMedia(ref)).toBe('https://render/a.jpg');
    expect(calls.find((c) => c.url.includes('character-media'))!.url).toContain('namespace=profile-eu');
    expect(await api.getCharacterMedia({ ...ref, name: 'Nobody' })).toBeNull();
  });

  it('returns a class icon URL, or null when the class has none', async () => {
    const { api } = client([
      on('/media/playable-class/11', () => json({ assets: [{ key: 'icon', value: 'https://render/druid.jpg' }] })),
      on('/media/playable-class/99', () => new Response('', { status: 404 })),
    ]);
    expect(await api.getClassIconUrl('eu', 11)).toBe('https://render/druid.jpg');
    expect(await api.getClassIconUrl('eu', 99)).toBeNull();
  });
});
