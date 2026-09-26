// Fetches and parses Method.gg BiS gear tables. No public API exists, so keep requests rare and cache results.

const TABLES = { overall: 'overall_table', raid: 'raid_table', mythicPlus: 'dungeon_table' };

// Method slot labels -> Blizzard slot types. Rings and trinkets can go in either slot.
const SLOT_MAP = {
  Head: ['HEAD'], Neck: ['NECK'], Shoulders: ['SHOULDER'], Cloak: ['BACK'], Back: ['BACK'],
  Chest: ['CHEST'], Wrist: ['WRIST'], Gloves: ['HANDS'], Hands: ['HANDS'], Belt: ['WAIST'], Waist: ['WAIST'],
  Legs: ['LEGS'], Boots: ['FEET'], Feet: ['FEET'],
  Ring: ['FINGER_1', 'FINGER_2'], Trinket: ['TRINKET_1', 'TRINKET_2'],
  Weapon: ['MAIN_HAND'], 'Main Hand': ['MAIN_HAND'], 'Off Hand': ['OFF_HAND'], 'Off-Hand': ['OFF_HAND'],
};

export async function fetchGearingHtml(specSlug) {
  const res = await fetch(`https://www.method.gg/guides/${specSlug}/gearing`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (personal gear tracker)' },
  });
  if (!res.ok) throw new Error(`Method request failed: ${res.status}`);
  return res.text();
}

const ENTITIES = { amp: '&', quot: '"', apos: "'", rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', nbsp: ' ', ndash: '–', mdash: '—' };
const decode = s => s
  .replace(/<[^>]+>/g, '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&(\w+);/g, (m, name) => ENTITIES[name] ?? m)
  .replace(/\s+/g, ' ')
  .trim();

/** Returns { overall, raid, mythicPlus }, each an array of { slot, slots, itemId, name, bonusIds, isTier, source, catalyst }. */
export function parseGearing(html) {
  const result = {};
  for (const [key, id] of Object.entries(TABLES)) {
    const start = html.indexOf(`id="${id}"`);
    if (start === -1) { result[key] = []; continue; }
    const end = html.indexOf('</table>', start);
    const table = html.slice(start, end);
    const rows = [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m => m[1]);
    result[key] = rows.flatMap(row => {
      const cells = [...row.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(m => m[1]);
      if (cells.length < 3) return []; // header row uses <th>
      const link = cells[1].match(/href="[^"]*item=(\d+)[^"?]*(?:\?bonus=([\d:]+))?"/);
      if (!link) return [];
      const slot = decode(cells[0]);
      const itemText = decode(cells[1]);
      const source = decode(cells[2]);
      return [{
        slot,
        slots: SLOT_MAP[slot] ?? [],
        itemId: Number(link[1]),
        name: itemText.replace(/\s*\(Tier Set\)\s*$/, ''),
        bonusIds: link[2] ? link[2].split(':').map(Number) : [],
        isTier: /\(Tier Set\)/.test(itemText),
        source: source.replace(/\s*\(Catalyst\)\s*$/, ''),
        catalyst: /\(Catalyst\)/.test(source),
      }];
    });
  }
  return result;
}
