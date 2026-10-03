import { fetchJson, type FetchFn } from '../http';

/** Midnight. The next expansion's ID is checked too, so a new expansion is found without a code change. */
export const CURRENT_EXPANSION_ID = 11;

export interface RawSeason {
  slug: string;
  name: string;
  is_main_season: boolean;
  starts: Record<string, string | null>;
  dungeons: { challenge_mode_id: number; name: string; short_name: string }[];
}

export interface MainSeason {
  slug: string;
  name: string;
  dungeons: { challengeModeId: number; name: string; shortName: string }[];
}

const staticDataUrl = (expansionId: number) => `https://raider.io/api/v1/mythic-plus/static-data?expansion_id=${expansionId}`;

const earliestStart = (starts: Record<string, string | null>): number | null => {
  const times = Object.values(starts ?? {}).filter((s): s is string => Boolean(s)).map(Date.parse).filter(Number.isFinite);
  return times.length > 0 ? Math.min(...times) : null;
};

/**
 * The newest main season that has started in any region. Variants like "Break the Meta" repeat a
 * main season's dungeons and are not main seasons, so they never win.
 */
export function pickMainSeason(seasons: RawSeason[], now: number): MainSeason | null {
  const started = seasons
    .filter((s) => s.is_main_season)
    .map((s) => ({ season: s, start: earliestStart(s.starts) }))
    .filter((s): s is { season: RawSeason; start: number } => s.start !== null && s.start <= now)
    .sort((a, b) => b.start - a.start);
  const best = started[0]?.season;
  if (!best) return null;
  return {
    slug: best.slug,
    name: best.name,
    dungeons: best.dungeons.map((d) => ({ challengeModeId: d.challenge_mode_id, name: d.name, shortName: d.short_name })),
  };
}

export async function fetchMainSeason(fetchFn: FetchFn, now: number): Promise<MainSeason> {
  const [current, next] = await Promise.all([
    fetchJson<{ seasons?: RawSeason[] }>(fetchFn, staticDataUrl(CURRENT_EXPANSION_ID)),
    fetchJson<{ seasons?: RawSeason[] }>(fetchFn, staticDataUrl(CURRENT_EXPANSION_ID + 1)).catch(() => ({ seasons: [] })),
  ]);
  const season = pickMainSeason([...(current.seasons ?? []), ...(next.seasons ?? [])], now);
  if (!season) throw new Error('Raider.IO lists no started main Mythic+ season');
  return season;
}
