import type { SeasonLoot } from '@/core/types';

/** A ranked dungeon's artwork, looked up by challenge mode. A rank the season doesn't list keeps its place with the placeholder. */
export function dungeonArt(dungeons: SeasonLoot[], challengeModeId: number): { shortName: string; imageUrl: string | null } {
  const dungeon = dungeons.find((d) => d.challengeModeId === challengeModeId);
  return { shortName: dungeon?.shortName ?? '', imageUrl: dungeon?.imageUrl ?? null };
}
