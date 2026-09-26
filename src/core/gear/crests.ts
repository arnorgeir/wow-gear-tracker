import type { Track } from '../types';

export interface CrestCost {
  group: number;
  currencyId: number;
  currencyName: string;
  costPerStep: number;
}

export interface UpgradeOption {
  steps: number;
  currencyName: string;
  costPerStep: number;
}

export interface CrestBalance {
  currencyId: number;
  name: string;
  quantity: number;
  steps: number;
}

/** One cost per upgrade track group. Every step of a track costs the same crest amount. */
export function crestCostsByGroup(tracks: Iterable<Track>): Map<number, CrestCost> {
  const costs = new Map<number, CrestCost>();
  for (const track of tracks) {
    if (track.group === null || track.currencyId === null || track.costPerStep === null || costs.has(track.group)) continue;
    costs.set(track.group, {
      group: track.group,
      currencyId: track.currencyId,
      currencyName: track.currencyName ?? `Currency ${track.currencyId}`,
      costPerStep: track.costPerStep,
    });
  }
  return costs;
}

export function affordableUpgrade(
  track: Track | null, costs: ReadonlyMap<number, CrestCost>, balances: ReadonlyMap<number, number>,
): UpgradeOption | null {
  if (!track || track.group === null || track.step >= track.max) return null;
  const cost = costs.get(track.group);
  if (!cost) return null;
  const steps = Math.min(track.max - track.step, Math.floor((balances.get(cost.currencyId) ?? 0) / cost.costPerStep));
  return steps > 0 ? { steps, currencyName: cost.currencyName, costPerStep: cost.costPerStep } : null;
}

export function summarizeCrests(balances: ReadonlyMap<number, number>, costs: ReadonlyMap<number, CrestCost>): CrestBalance[] {
  const seen = new Set<number>();
  const summary: CrestBalance[] = [];
  // Higher groups are higher tracks within a season, so Myth comes before Hero.
  for (const cost of [...costs.values()].sort((a, b) => b.group - a.group)) {
    const quantity = balances.get(cost.currencyId);
    if (quantity === undefined || seen.has(cost.currencyId)) continue;
    seen.add(cost.currencyId);
    summary.push({ currencyId: cost.currencyId, name: cost.currencyName, quantity, steps: Math.floor(quantity / cost.costPerStep) });
  }
  return summary;
}
