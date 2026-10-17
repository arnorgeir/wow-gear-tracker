import { decodeHtml } from '../html';
import { fetchWithRetry, HttpError, type FetchFn } from '../http';
import { SOURCE_NAMES, type BisLists, type BisRow, type BisSource, type ListType, type SlotType } from '../types';
import { icyVeinsUrl } from './roles';

const SECTION_IDS: Record<ListType, string> = { overall: 'overall-best-in-slot', mythicPlus: 'best-gear-from-mythic', raid: 'best-gear-from-raid' };

// Icy Veins' slot names, with Method's labels where they differ.
const SLOTS: Record<string, { label: string; slots: SlotType[] }> = {
  Helm: { label: 'Head', slots: ['HEAD'] }, Neck: { label: 'Neck', slots: ['NECK'] }, Shoulders: { label: 'Shoulders', slots: ['SHOULDER'] },
  Cloak: { label: 'Back', slots: ['BACK'] }, Chest: { label: 'Chest', slots: ['CHEST'] }, Bracers: { label: 'Wrist', slots: ['WRIST'] },
  Hands: { label: 'Hands', slots: ['HANDS'] }, Waist: { label: 'Waist', slots: ['WAIST'] }, Legs: { label: 'Legs', slots: ['LEGS'] },
  Feet: { label: 'Feet', slots: ['FEET'] }, Ring: { label: 'Ring', slots: ['FINGER_1', 'FINGER_2'] },
  Trinket: { label: 'Trinket', slots: ['TRINKET_1', 'TRINKET_2'] },
  'Main Hand': { label: 'Main Hand', slots: ['MAIN_HAND'] }, 'Off Hand': { label: 'Off Hand', slots: ['OFF_HAND'] },
};
// Every list has these two, always empty.
const IGNORED = new Set(['Shirt', 'Tabard']);

function sectionHtml(html: string, list: ListType): string {
  const start = html.indexOf(`id="${SECTION_IDS[list]}"`);
  if (start === -1) return '';
  const next = Object.values(SECTION_IDS).map((id) => html.indexOf(`id="${id}"`, start + 1)).filter((i) => i > start);
  return html.slice(start, next.length > 0 ? Math.min(...next) : undefined);
}

function parseCard(card: string): BisRow | null {
  const slotAt = card.indexOf('class="bis_item_slot"');
  if (slotAt === -1) return null;
  const slotName = decodeHtml(card.slice(slotAt).match(/>([\s\S]*?)<\/span>/)?.[1] ?? '');
  if (IGNORED.has(slotName)) return null;
  // The item comes before the slot name; gems and enchants after it carry their own data-wowhead.
  const head = card.slice(0, slotAt);
  const attr = head.match(/data-wowhead="([^"]*)"/)?.[1];
  const drop = decodeHtml(card.match(/class="bis_item_drop">([\s\S]*?)<\/span>/)?.[1] ?? '');
  // Empty slots, and the placeholder Off Hand a two-handed spec gets: no item, or no drop source.
  if (!attr || drop === '') return null;
  const slot = SLOTS[slotName];
  if (!slot) throw new Error(`Unknown Icy Veins slot "${slotName}"`);
  const params = new URLSearchParams(decodeHtml(attr));
  const isCatalyst = params.has('original-item');
  const bonus = params.get('bonus');
  return {
    kind: 'item', slotLabel: slot.label, slots: slot.slots,
    itemId: Number(params.get('item')),
    name: decodeHtml(head.match(/class="q\d">([\s\S]*?)<\/span>/)?.[1] ?? ''),
    bonusIds: bonus ? bonus.split(':').map(Number) : [],
    // Tier pieces named directly carry no marker; the sync looks those up.
    isTier: isCatalyst, isCatalyst,
    source: isCatalyst ? drop.replace(/^Catalyst\b.*?\bfrom\s+/i, '') : drop,
  };
}

export function parseIcyVeinsHtml(html: string): BisLists {
  const parse = (list: ListType) => sectionHtml(html, list).split(/<div class="bis_item[ "]/).slice(1)
    .map(parseCard).filter((r): r is BisRow => r !== null);
  return { overall: parse('overall'), raid: parse('raid'), mythicPlus: parse('mythicPlus') };
}

export function createIcyVeinsSource(fetchFn: FetchFn): BisSource {
  return {
    name: SOURCE_NAMES.icyVeins,
    async fetchLists(specSlug) {
      const url = icyVeinsUrl(specSlug);
      const res = await fetchWithRetry(fetchFn, url, { headers: { 'User-Agent': 'Mozilla/5.0 (personal gear tracker)' } });
      if (!res.ok) throw new HttpError(res.status, url, await res.text());
      return parseIcyVeinsHtml(await res.text());
    },
  };
}
