import type { Db } from '@/core/db/client';
import { equippedGear, getLatestSnapshot, type Snapshot } from '@/core/db/queries/snapshots';
import { type CharacterRow } from '@/core/db/queries/characters';
import { affordableUpgrade, summarizeCrests, type CrestCost } from '@/core/gear/crests';
import { type GearRow } from '@/core/gear/evaluate';
import { methodSpecSlug } from '@/core/method/method';
import { identityLine } from '@/core/characters/identity';
import { type GearItem } from '@/core/types';
import type { CrestView, CharacterSummary } from './types';

export interface GearContext {
  current: Snapshot | null;
  simc: Snapshot | null;
  equipped: GearItem[];
  bagItemIds: Set<number>;
  balances: Map<number, number>;
}

export async function loadGear(db: Db, characterId: number): Promise<GearContext> {
  const current = await getLatestSnapshot(db, characterId);
  const simc = current?.source === 'simc' ? current : await getLatestSnapshot(db, characterId, 'simc');
  return {
    current,
    simc,
    equipped: current ? equippedGear(current) : [],
    // Bag contents are only known while the current gear comes from a paste.
    bagItemIds: new Set(current?.source === 'simc' ? current.items.filter((i) => i.location === 'bag').map((i) => i.itemId) : []),
    // Crests only come from pastes, so the latest paste's balances stay useful after Blizzard takes over.
    balances: new Map((simc?.currencies ?? []).filter((c) => c.kind === 'upgrade').map((c) => [c.currencyId, c.quantity])),
  };
}

export function summarize(c: CharacterRow, snapshot: Snapshot | null, classIcons: ReadonlyMap<string, string | null> = new Map()): CharacterSummary {
  const spec = c.specOverride || c.specName;
  return {
    id: c.id, name: c.name, realmName: c.realmName, realmId: c.realmId, region: c.region, className: c.className,
    activeSpec: c.specName, spec, specSlug: methodSpecSlug(spec, c.className),
    status: c.status, lastSyncedAt: c.lastSyncedAt, lastSyncError: c.lastSyncError, priorityList: c.priorityList,
    snapshot: snapshot && { source: snapshot.source, createdAt: snapshot.createdAt },
    sourceAt: !snapshot ? null : snapshot.source === 'simc' ? snapshot.createdAt : c.lastSyncedAt ?? snapshot.createdAt,
    race: c.race,
    faction: c.faction,
    avatarUrl: c.avatarUrl,
    classIconUrl: classIcons.get(c.className) ?? null,
    identity: identityLine(c.race, spec, c.className),
  };
}

/** Only BiS items the character already wears on a track get a flag; crests spent elsewhere are wasted. */
export const upgradeFor = (row: GearRow, costs: ReadonlyMap<number, CrestCost>, balances: ReadonlyMap<number, number>) =>
  row.matched && (row.state === 'mythUpgradable' || row.state === 'belowMyth') ? affordableUpgrade(row.track, costs, balances) : null;

export const crestView = (gear: GearContext, costs: ReadonlyMap<number, CrestCost>): CrestView | null =>
  gear.simc ? { balances: summarizeCrests(gear.balances, costs), pastedAt: gear.simc.createdAt } : null;
