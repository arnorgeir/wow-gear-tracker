import { statPairLabel } from './stat-pair';

/**
 * What a tier row asks for, starting lowercase so it follows "Need: ". Method names either a base item to
 * catalyze, or the tier piece itself when a tier token buys it.
 */
export function tierTargetText(bis: { name: string; targetStats: string[] | null; targetIsTierPiece: boolean }): string {
  const pair = bis.targetStats ? `, ${statPairLabel(bis.targetStats)}` : '';
  return bis.targetIsTierPiece ? `${bis.name} (tier${pair})` : `tier${pair} (catalyst ${bis.name})`;
}
