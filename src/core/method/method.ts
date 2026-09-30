import { fetchWithRetry, HttpError, type FetchFn } from '../http';
import type { BisLists, BisRow, BisSource, ListType, SlotType } from '../types';

const TABLE_IDS: Record<ListType, string> = { overall: 'overall_table', raid: 'raid_table', mythicPlus: 'dungeon_table' };

const SLOT_MAP: Record<string, SlotType[]> = {
  Head: ['HEAD'], Neck: ['NECK'], Shoulders: ['SHOULDER'], Shoulder: ['SHOULDER'], Cloak: ['BACK'], Back: ['BACK'],
  Chest: ['CHEST'], Wrist: ['WRIST'], Wrists: ['WRIST'], Gloves: ['HANDS'], Hands: ['HANDS'], Belt: ['WAIST'], Waist: ['WAIST'],
  Legs: ['LEGS'], Boots: ['FEET'], Feet: ['FEET'],
  Ring: ['FINGER_1', 'FINGER_2'], Trinket: ['TRINKET_1', 'TRINKET_2'],
  Weapon: ['MAIN_HAND'], 'Main Hand': ['MAIN_HAND'], 'Main-Hand': ['MAIN_HAND'], 'Off Hand': ['OFF_HAND'], 'Off-Hand': ['OFF_HAND'],
};

const ENTITIES: Record<string, string> = {
  amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—',
};

function decodeHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&(\w+);/g, (match, name: string) => ENTITIES[name] ?? match)
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTable(html: string, tableId: string): BisRow[] {
  const start = html.indexOf(`id="${tableId}"`);
  if (start === -1) return [];
  const end = html.indexOf('</table>', start);
  const table = html.slice(start, end === -1 ? undefined : end);
  const rows: BisRow[] = [];
  for (const [, rowHtml] of table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...rowHtml!.matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) => m[1]!);
    if (cells.length < 3) continue;
    const link = cells[1]!.match(/href="[^"]*?item=(\d+)[^"?]*(?:\?bonus=([\d:]+))?"/);
    const itemText = decodeHtml(cells[1]!);
    // Some rows name no item, only an item level: "Any 334" means any item for the slot at that level.
    const anyLevel = link ? null : itemText.match(/^Any (\d+)$/);
    if (!link && !anyLevel) continue;
    const slotLabel = decodeHtml(cells[0]!);
    const sourceText = decodeHtml(cells[2]!);
    const slots = SLOT_MAP[slotLabel] ?? [];
    if (anyLevel) {
      rows.push({ kind: 'any', slotLabel, slots, minItemLevel: Number(anyLevel[1]), source: sourceText === '-' ? '' : sourceText });
      continue;
    }
    rows.push({
      kind: 'item',
      slotLabel,
      slots,
      itemId: Number(link![1]),
      name: itemText.replace(/\s*\(Tier Set\)\s*$/i, ''),
      bonusIds: link![2] ? link![2].split(':').map(Number) : [],
      isTier: /\(Tier Set\)/i.test(itemText),
      isCatalyst: /\(Catalyst\)/i.test(sourceText),
      source: sourceText.replace(/\s*\(Catalyst\)\s*$/i, ''),
    });
  }
  return rows;
}

export function parseGearingHtml(html: string): BisLists {
  return {
    overall: parseTable(html, TABLE_IDS.overall),
    raid: parseTable(html, TABLE_IDS.raid),
    mythicPlus: parseTable(html, TABLE_IDS.mythicPlus),
  };
}

const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function methodSpecSlug(specName: string, className: string): string {
  return `${slugify(specName)}-${slugify(className)}`;
}

export function createMethodSource(fetchFn: FetchFn = fetch): BisSource {
  return {
    name: 'Method',
    async fetchLists(specSlug) {
      const url = `https://www.method.gg/guides/${specSlug}/gearing`;
      const res = await fetchWithRetry(fetchFn, url, { headers: { 'User-Agent': 'Mozilla/5.0 (personal gear tracker)' } });
      if (!res.ok) throw new HttpError(res.status, url, await res.text());
      return parseGearingHtml(await res.text());
    },
  };
}
