import { REGIONS, type Region } from '../types';
import { nameKeyOf } from './name-key';

/**
 * A group member named by who it is rather than by database row, so a group link works on any install
 * and survives a character being removed and tracked again. Realm slugs always come from a stored
 * character (Blizzard's profile), never from a realm display name or a Raider.IO slug.
 */
export interface MemberKey { region: Region; realmSlug: string; nameKey: string }

export const MAX_GROUP_SIZE = 5;
export const GROUP_COOKIE = 'group';

const SLUG = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;
const NAME = /^\p{L}+$/u;

export function memberKeyOf(c: { region: Region; realmSlug: string; name: string }): MemberKey {
  return { region: c.region, realmSlug: c.realmSlug, nameKey: nameKeyOf(c.name) };
}

export const formatMemberKey = (key: MemberKey) => `${key.region}.${key.realmSlug}.${key.nameKey}`;

export function memberKeyFromParts(region: string, realmSlug: string, name: string): MemberKey | null {
  const r = region.toLowerCase();
  const slug = realmSlug.toLowerCase();
  if (!(REGIONS as readonly string[]).includes(r) || !SLUG.test(slug) || !NAME.test(name)) return null;
  return { region: r as Region, realmSlug: slug, nameKey: nameKeyOf(name) };
}

export function parseMemberKey(raw: string): MemberKey | null {
  const parts = raw.trim().split('.');
  return parts.length === 3 ? memberKeyFromParts(parts[0]!, parts[1]!, parts[2]!) : null;
}

/** A character page's address. The name is folded, so links read lowercase, as Raider.IO's do. */
export const characterHref = (c: { region: Region; realmSlug: string; name: string }) =>
  `/characters/${c.region}/${c.realmSlug}/${encodeURIComponent(nameKeyOf(c.name))}`;

/**
 * Route segments, decoded once more. Names and slugs never contain `%`, so decoding a segment Next
 * already decoded changes nothing. A segment that won't decode is no key.
 */
export function memberKeyFromPath(region: string, realm: string, name: string): MemberKey | null {
  try {
    return memberKeyFromParts(decodeURIComponent(region), decodeURIComponent(realm), decodeURIComponent(name));
  } catch {
    return null;
  }
}

/** A comma-separated list of keys. Keys that don't parse, and repeats, are dropped. */
export function parseMemberKeys(raw: string): MemberKey[] {
  const seen = new Set<string>();
  const keys: MemberKey[] = [];
  for (const part of raw.split(',')) {
    const key = parseMemberKey(part);
    if (!key || seen.has(formatMemberKey(key))) continue;
    seen.add(formatMemberKey(key));
    keys.push(key);
  }
  return keys;
}

/** Members share the first key's region, so keys from another region are dropped before the cap. */
export function selectGroup(keys: MemberKey[]): { members: MemberKey[]; dropped: MemberKey[] } {
  const region = keys[0]?.region;
  return {
    members: keys.filter((k) => k.region === region).slice(0, MAX_GROUP_SIZE),
    dropped: keys.filter((k) => k.region !== region),
  };
}

export function findByMemberKey<T extends { region: Region; realmSlug: string; name: string }>(rows: readonly T[], key: MemberKey): T | undefined {
  const wanted = formatMemberKey(key);
  return rows.find((row) => formatMemberKey(memberKeyOf(row)) === wanted);
}

export function addMember(keys: readonly string[], key: string): string[] {
  return keys.includes(key) || keys.length >= MAX_GROUP_SIZE ? [...keys] : [...keys, key];
}

export const removeMember = (keys: readonly string[], key: string) => keys.filter((k) => k !== key);

/** Commas stay readable; each key is encoded on its own so `ö` survives. */
export const groupHref = (keys: readonly string[]) => `/group?chars=${keys.map(encodeURIComponent).join(',')}`;

export const encodeGroupCookie = (keys: readonly string[]) => encodeURIComponent(keys.join(','));

/** Keys never contain `%`, so decoding a value Next already decoded changes nothing. A value that won't decode is no group. */
export function decodeGroupCookie(value: string | undefined): MemberKey[] {
  if (!value) return [];
  try {
    return parseMemberKeys(decodeURIComponent(value));
  } catch {
    return [];
  }
}
