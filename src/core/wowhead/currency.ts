import { createLimiter, fetchJson, type FetchFn } from '../http';
import type { RaidbotsData } from '../raidbots/tracks';

// Undocumented: Wowhead's own tooltip script uses it. Only the icon name is read.
export const currencyTooltipUrl = (currencyId: number) => `https://nether.wowhead.com/tooltip/currency/${currencyId}`;
const ICON_NAME = /^[a-z0-9_]+$/;

/** The icon name in a tooltip answer, or null when it is missing or looks wrong. */
export function parseCurrencyIcon(data: unknown): string | null {
  const icon = (data as { icon?: unknown } | null)?.icon;
  return typeof icon === 'string' && ICON_NAME.test(icon) ? icon : null;
}

/** Looks up a currency's icon name. Never throws: a failed lookup is just a missing icon. */
export function createCurrencyIconFetcher(fetchFn: FetchFn = fetch) {
  return async (currencyId: number): Promise<string | null> => {
    try {
      return parseCurrencyIcon(await fetchJson<unknown>(fetchFn, currencyTooltipUrl(currencyId)));
    } catch {
      return null;
    }
  };
}

/** Wraps the Raidbots fetcher so each crest currency's icon name rides along with the tracks that cost it. */
export function withCurrencyIcons(
  fetchRaidbots: () => Promise<RaidbotsData>,
  fetchIcon: (currencyId: number) => Promise<string | null>,
): () => Promise<RaidbotsData> {
  return async () => {
    const data = await fetchRaidbots();
    const limit = createLimiter(4);
    const ids = [...new Set(data.tracks.flatMap((t) => (t.currencyId === null ? [] : [t.currencyId])))];
    const lookup = async (id: number) => {
      try {
        return [id, await fetchIcon(id)] as const;
      } catch {
        return [id, null] as const;
      }
    };
    const icons = new Map(await Promise.all(ids.map((id) => limit(() => lookup(id)))));
    return { ...data, tracks: data.tracks.map((t) => ({ ...t, currencyIcon: t.currencyId === null ? null : icons.get(t.currencyId) ?? null })) };
  };
}
