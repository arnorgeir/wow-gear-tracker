const WORDS: Record<string, string> = { CRIT_RATING: 'Crit', HASTE_RATING: 'Haste', MASTERY_RATING: 'Mastery', VERSATILITY: 'Vers' };

/** A stat pair in words, in stored order: "Haste/Mastery". */
export const statPairLabel = (stats: readonly string[]): string =>
  (stats.length === 0 ? 'no secondary stats' : stats.map((s) => WORDS[s] ?? s).join('/'));
