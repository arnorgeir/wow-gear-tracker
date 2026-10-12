import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fakeFetch, on } from '@/test/fake-fetch';
import { isHttpError } from '../http';
import { createIcyVeinsSource, parseIcyVeinsHtml } from './icy-veins';
import { icyVeinsUrl } from './roles';

const page = (name: string) => readFileSync(new URL(`./__fixtures__/${name}.html`, import.meta.url), 'utf8');
const card = (slot: string, drop = 'Here') =>
  `<h3 id="overall-best-in-slot">Overall</h3><div class="bis_items_grid"><div class="bis_item"><span data-wowhead="item=5" class="q4">X</span><span class="bis_item_slot">${slot}</span><span class="bis_item_drop">${drop}</span></div></div>`;

describe('icyVeinsUrl', () => {
  it('puts the role in the path', () => {
    expect(icyVeinsUrl('frost-mage')).toBe('https://www.icy-veins.com/wow/frost-mage-pve-dps-gear-best-in-slot');
    expect(icyVeinsUrl('guardian-druid')).toBe('https://www.icy-veins.com/wow/guardian-druid-pve-tank-gear-best-in-slot');
    expect(icyVeinsUrl('restoration-shaman')).toBe('https://www.icy-veins.com/wow/restoration-shaman-pve-healing-gear-best-in-slot');
  });
});

describe('parseIcyVeinsHtml', () => {
  const lists = parseIcyVeinsHtml(page('frost-mage'));

  it('maps sections to lists, a missing one to an empty list', () => {
    expect(lists.overall.map((r) => r.slotLabel)).toEqual(['Head', 'Hands', 'Neck', 'Ring', 'Ring', 'Trinket', 'Trinket', 'Main Hand', 'Off Hand']);
    expect(lists.mythicPlus.map((r) => r.slotLabel)).toEqual(['Head', 'Ring', 'Wrist']);
    expect(lists.raid).toEqual([]);
  });

  it('gives rings and trinkets both slots, and ignores shirt and tabard', () => {
    expect(lists.overall.filter((r) => r.slotLabel === 'Ring').map((r) => r.slots)).toEqual([['FINGER_1', 'FINGER_2'], ['FINGER_1', 'FINGER_2']]);
    expect(lists.overall.filter((r) => r.slotLabel === 'Trinket').map((r) => r.slots)).toEqual([['TRINKET_1', 'TRINKET_2'], ['TRINKET_1', 'TRINKET_2']]);
  });

  it('reads the item, never a gem or enchant, with decoded bonus ids and name', () => {
    expect(lists.overall[2]).toEqual({
      kind: 'item', slotLabel: 'Neck', slots: ['NECK'], itemId: 268265, name: 'Pendant of Hrafnhildur\'s Watch',
      bonusIds: [13848, 13708], isTier: false, isCatalyst: false, source: 'Ula\'tek',
    });
    expect(lists.overall[8]).toMatchObject({ itemId: 245770, slots: ['OFF_HAND'], source: 'Crafted by Inscription' });
  });

  it('reads catalyst rows from original-item, whatever the drop text says', () => {
    expect(lists.overall[0]).toMatchObject({ itemId: 271564, bonusIds: [13846, 13848], isCatalyst: true, isTier: true, source: 'Vexmaw', name: 'Crown of the Frostbound Seer' });
    expect(lists.overall[1]).toMatchObject({ isCatalyst: true, isTier: true, source: 'Coiled Altar' });
  });

  it('strips a longer catalyst lead-in', () => {
    const html = card('Helm', '<a>Catalyst</a> on the head from <a>Nek&#39;vash</a>').replace('item=5', 'item=5&amp;original-item=6');
    expect(parseIcyVeinsHtml(html).overall[0]).toMatchObject({ isCatalyst: true, source: 'Nek\'vash' });
  });

  it('skips a card with an empty drop source', () => {
    expect(lists.mythicPlus.some((r) => r.kind === 'item' && r.itemId === 252004)).toBe(false);
  });

  it('keeps "Catalyst or X" as a plain row and drops placeholder off hands', () => {
    const g = parseIcyVeinsHtml(page('guardian-druid'));
    expect(g.overall[0]).toMatchObject({ isCatalyst: false, isTier: false, source: 'Catalyst or Thornmother' });
    expect(g.overall.map((r) => r.slotLabel)).toEqual(['Head', 'Waist', 'Main Hand']);
    expect(g.raid.map((r) => r.slotLabel)).toEqual(['Waist']);
    expect(g.mythicPlus).toEqual([]);
  });

  it('fails loudly on an unknown slot', () => {
    expect(() => parseIcyVeinsHtml(card('Wristlet'))).toThrow('Wristlet');
  });

  it('skips an unknown slot with no item instead of failing', () => {
    expect(parseIcyVeinsHtml(card('Wristlet', '')).overall).toEqual([]);
  });
});

describe('createIcyVeinsSource', () => {
  it('fetches the role URL and names itself', async () => {
    const { fn, calls } = fakeFetch([on('/wow/frost-mage-pve-dps-gear-best-in-slot', () => new Response(page('frost-mage')))]);
    const source = createIcyVeinsSource(fn);
    expect(source.name).toBe('Icy Veins');
    expect((await source.fetchLists('frost-mage')).mythicPlus).toHaveLength(3);
    expect(calls[0]!.url).toBe(icyVeinsUrl('frost-mage'));
  });

  it('throws an HttpError on a missing page', async () => {
    const { fn } = fakeFetch([]);
    const err = await createIcyVeinsSource(fn).fetchLists('frost-mage').catch((e: unknown) => e);
    expect(isHttpError(err) && err.status).toBe(404);
  });
});
