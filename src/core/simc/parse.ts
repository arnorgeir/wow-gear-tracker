import type { ItemLocation, SlotType } from '../types';

export interface SimcItem {
  location: ItemLocation;
  slot: SlotType;
  itemId: number;
  name: string | null;
  itemLevel: number | null;
  bonusIds: number[];
}

export interface SimcCurrency {
  kind: 'upgrade' | 'catalyst';
  currencyId: number;
  quantity: number;
}

export interface SimcProfile {
  name: string;
  classToken: string;
  region: string;
  realmToken: string;
  specToken: string;
  items: SimcItem[];
  currencies: SimcCurrency[];
}

export class SimcParseError extends Error {
  constructor(message: string, public readonly line: number | null) {
    super(message);
    this.name = 'SimcParseError';
  }
}

// SimC slot names. Shirt, tabard and ammo are left out on purpose.
const SLOTS: Record<string, SlotType> = {
  head: 'HEAD', neck: 'NECK', shoulder: 'SHOULDER', back: 'BACK', chest: 'CHEST', wrist: 'WRIST', hands: 'HANDS',
  waist: 'WAIST', legs: 'LEGS', feet: 'FEET', finger1: 'FINGER_1', finger2: 'FINGER_2',
  trinket1: 'TRINKET_1', trinket2: 'TRINKET_2', main_hand: 'MAIN_HAND', off_hand: 'OFF_HAND',
};

type Section = ItemLocation | 'ignore' | 'info';

function sectionFor(header: string, current: Section): Section {
  if (/Gear from Bags/i.test(header)) return 'bag';
  if (/End of Weekly Reward Choices/i.test(header)) return 'ignore';
  if (/Weekly Reward Choices/i.test(header)) return 'vault';
  if (/Additional Character Info/i.test(header)) return 'info';
  if (/Merchant items|Linked gear/i.test(header)) return 'ignore';
  // Other headers, like "Offspec Loadouts", sit between the character lines and the gear.
  return current;
}

function parseItem(body: string, location: ItemLocation, pending: { name: string; itemLevel: number } | null, lineNo: number): SimcItem | null {
  const match = body.match(/^([a-z0-9_]+)=,?(.*)$/);
  if (!match) return null;
  const slot = SLOTS[match[1]!];
  if (!slot) return null;
  const options = new Map(match[2]!.split(',').filter(Boolean).map((part) => {
    const eq = part.indexOf('=');
    return eq === -1 ? [part, ''] as const : [part.slice(0, eq), part.slice(eq + 1)] as const;
  }));
  const itemId = Number(options.get('id'));
  if (!Number.isInteger(itemId) || itemId <= 0) throw new SimcParseError(`The ${match[1]} item on line ${lineNo} has no item id`, lineNo);
  const bonus = options.get('bonus_id');
  return {
    location,
    slot,
    itemId,
    name: pending?.name ?? null,
    itemLevel: pending?.itemLevel ?? null,
    bonusIds: bonus ? bonus.split('/').map(Number).filter((n) => Number.isInteger(n)) : [],
  };
}

function parseCurrencies(kind: SimcCurrency['kind'], value: string): SimcCurrency[] {
  return value.split('/').filter(Boolean).flatMap((entry) => {
    const parts = entry.split(':');
    if (kind === 'upgrade') {
      // Entries are c:<currency>:<qty> for currencies and i:<item>:<count> for items; keep currencies only.
      if (parts[0] !== 'c') return [];
      parts.shift();
    }
    const [currencyId, quantity] = parts.map(Number);
    return Number.isInteger(currencyId) && Number.isFinite(quantity) ? [{ kind, currencyId: currencyId!, quantity: quantity! }] : [];
  });
}

/** Parses the text from the SimulationCraft addon's /simc window. */
export function parseSimc(text: string): SimcProfile {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let section: Section = 'equipped';
  let name: string | null = null;
  let classToken = '';
  let region = '';
  let realmToken = '';
  let specToken = '';
  let pending: { name: string; itemLevel: number } | null = null;
  const items: SimcItem[] = [];
  const currencies: SimcCurrency[] = [];

  lines.forEach((raw, index) => {
    const line = raw.trim();
    const lineNo = index + 1;
    if (!line) { pending = null; return; }
    if (line.startsWith('###')) { section = sectionFor(line, section); pending = null; return; }

    if (line.startsWith('#')) {
      const body = line.slice(1).trim();
      const currency = body.match(/^(upgrade|catalyst)_currencies=(.*)$/);
      if (currency) { currencies.push(...parseCurrencies(currency[1] as SimcCurrency['kind'], currency[2]!)); return; }
      if (section === 'bag' || section === 'vault') {
        const item = parseItem(body, section, pending, lineNo);
        if (item) { items.push(item); pending = null; return; }
      }
      const named = body.match(/^(.+?)\s+\((\d+)\)$/);
      pending = named ? { name: named[1]!, itemLevel: Number(named[2]) } : null;
      return;
    }

    if (section !== 'equipped') return;
    const header = line.match(/^([a-z_]+)="(.+)"$/);
    if (header) {
      if (name === null) { classToken = header[1]!; name = header[2]!; }
      return;
    }
    const setting = line.match(/^([a-z_]+)=(.*)$/);
    if (!setting) return;
    if (setting[1] === 'region') region = setting[2]!;
    else if (setting[1] === 'server') realmToken = setting[2]!;
    else if (setting[1] === 'spec') specToken = setting[2]!;
    else {
      const item = parseItem(line, 'equipped', pending, lineNo);
      if (item) items.push(item);
      pending = null;
    }
  });

  if (name === null) {
    throw new SimcParseError('The character line is missing, for example druid="Name". Copy the whole text from the /simc window.', null);
  }
  if (!items.some((i) => i.location === 'equipped')) throw new SimcParseError('No equipped items found in the SimC text.', null);
  return { name, classToken, region, realmToken, specToken, items, currencies };
}
