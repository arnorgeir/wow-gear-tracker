import { decodeHtml } from '../html';
import { fetchWithRetry, HttpError, type FetchFn } from '../http';
import { SOURCE_NAMES, type BisLists, type BisRow, type BisSource, type ListType, type SlotType } from '../types';

const TABLE_IDS: Record<ListType, string> = { overall: 'overall_table', raid: 'raid_table', mythicPlus: 'dungeon_table' };

const SLOT_MAP: Record<string, SlotType[]> = {
  Head: ['HEAD'], Neck: ['NECK'], Shoulders: ['SHOULDER'], Shoulder: ['SHOULDER'], Cloak: ['BACK'], Back: ['BACK'],
  Chest: ['CHEST'], Wrist: ['WRIST'], Wrists: ['WRIST'], Gloves: ['HANDS'], Hands: ['HANDS'], Belt: ['WAIST'], Waist: ['WAIST'],
  Legs: ['LEGS'], Boots: ['FEET'], Feet: ['FEET'],
  Ring: ['FINGER_1', 'FINGER_2'], Trinket: ['TRINKET_1', 'TRINKET_2'],
  // Arms labels its two-hander "Weapon"; no dual-wield spec uses the label. Adding OFF_HAND would make
  // dungeon ranking weigh a two-hander's empty off hand as a missing item.
  Weapon: ['MAIN_HAND'],
  'Main Hand': ['MAIN_HAND'], 'Main-Hand': ['MAIN_HAND'], 'Off Hand': ['OFF_HAND'], 'Off-Hand': ['OFF_HAND'],
};

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
    const slots = SLOT_MAP[slotLabel];
    if (!slots) console.warn(`Method slot label "${slotLabel}" is unknown; its row matches no slot`);
    if (anyLevel) {
      rows.push({ kind: 'any', slotLabel, slots: slots ?? [], minItemLevel: Number(anyLevel[1]), source: sourceText === '-' ? '' : sourceText });
      continue;
    }
    rows.push({
      kind: 'item',
      slotLabel,
      slots: slots ?? [],
      itemId: Number(link![1]),
      name: itemText.replace(/\s*\(Tier Set\)\s*$/i, ''),
      bonusIds: link![2] ? link![2].split(':').map(Number) : [],
      isTier: /\(Tier Set\)/i.test(itemText),
      isCatalyst: /\(Catalyst\)|\/\s*Catalyst\s*$/i.test(sourceText),
      source: sourceText.replace(/\s*(?:\(Catalyst\)|\/\s*Catalyst)\s*$/i, ''),
    });
  }
  if (rows.length === 0) throw new Error(`Method table "${tableId}" has no rows it can read`);
  return rows;
}

/** Some specs only have the overall table, so a missing table is fine; one Method renamed or reshaped is not. */
export function parseGearingHtml(html: string): BisLists {
  const known = new Set(Object.values(TABLE_IDS));
  const unknown = [...html.matchAll(/id="(\w+_table)"/g)].map((m) => m[1]!).find((id) => !known.has(id));
  if (unknown) throw new Error(`Method table "${unknown}" is unknown; a renamed table would leave its list empty`);
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
    name: SOURCE_NAMES.method,
    async fetchLists(specSlug) {
      const url = `https://www.method.gg/guides/${specSlug}/gearing`;
      const res = await fetchWithRetry(fetchFn, url, { headers: { 'User-Agent': 'Mozilla/5.0 (personal gear tracker)' } });
      if (!res.ok) throw new HttpError(res.status, url, await res.text());
      return parseGearingHtml(await res.text());
    },
  };
}
