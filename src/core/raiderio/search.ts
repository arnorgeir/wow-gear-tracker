import { fetchJson, type FetchFn } from '../http';
import type { Region } from '../types';

export interface CharacterSearchResult {
  name: string;
  realmName: string;
  blizzardRealmId: number;
  region: Region;
  className: string;
  thumbnailUrl: string | null;
}

interface RawSearch {
  matches?: {
    type: string;
    data?: {
      name?: string;
      region?: { slug?: string };
      realm?: { name?: string; wowRealmId?: number };
      class?: { name?: string };
      thumbnail_url?: string;
    };
  }[];
}

/** Uses Raider.IO's undocumented site search. Only suggests characters; official APIs confirm them. */
export async function searchCharacters(fetchFn: FetchFn, region: Region, term: string): Promise<CharacterSearchResult[]> {
  const query = term.trim();
  if (query.length < 3) return [];
  const data = await fetchJson<RawSearch>(fetchFn, `https://raider.io/api/search?term=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (personal gear tracker)' },
  });
  return (data.matches ?? [])
    .filter((m) => m.type === 'character' && m.data?.region?.slug === region && typeof m.data.realm?.wowRealmId === 'number')
    .slice(0, 8)
    .map((m) => ({
      name: m.data!.name ?? '',
      realmName: m.data!.realm!.name ?? '',
      blizzardRealmId: m.data!.realm!.wowRealmId!,
      region,
      className: m.data!.class?.name ?? '',
      thumbnailUrl: m.data!.thumbnail_url ? `https:${m.data!.thumbnail_url}` : null,
    }));
}
