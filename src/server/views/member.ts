import { pickQuality } from '@/core/bis/pick-quality';
import type { Db } from '@/core/db/client';
import type { CharacterRow } from '@/core/db/queries/characters';
import type { SnapshotItemInput } from '@/core/db/queries/snapshots';
import type { CrestCost } from '@/core/gear/crests';
import { evaluateGear, type GearRow } from '@/core/gear/evaluate';
import { choosePriorityList } from '@/core/priority/list';
import type { Credit, PriorityCharacter } from '@/core/priority/rank';
import { decodeTrack } from '@/core/raidbots/tracks';
import type { BisRow, ListType, Region, SlotType, TierTarget, Track } from '@/core/types';
import type { SpecBis } from './bis-lookup';
import { itemView } from './item-view';
import { loadGear, summarize, upgradeFor, type GearContext } from './summarize';
import type { BisView, CharacterSummary, GearRowView, PriorityCreditView, VaultChoiceView } from './types';

export interface MemberContext {
  db: Db;
  tracks: ReadonlyMap<number, Track>;
  /** BiS lists for a spec; the group page shares one lookup per spec across members. */
  bisFor: (specSlug: string, region: Region) => Promise<SpecBis>;
}

export interface MemberData {
  character: CharacterRow;
  summary: CharacterSummary;
  gear: GearContext;
  bis: SpecBis;
  choice: { listType: ListType; fellBack: boolean };
  /** Rows for the priority list in `choice`. */
  priorityRows: GearRow[];
  evaluate: (list: ListType) => GearRow[];
  vaultItems: SnapshotItemInput[];
}

/** One character's gear, BiS lists and priority rows: what the character page and the group page both start from. */
export async function loadMember(ctx: MemberContext, character: CharacterRow, classIcons: ReadonlyMap<string, string | null> = new Map()): Promise<MemberData> {
  const gear = await loadGear(ctx.db, character.id);
  const summary = summarize(character, gear.current, classIcons);
  const bis = await ctx.bisFor(summary.specSlug, character.region);
  const evaluate = (list: ListType) => evaluateGear({ equipped: gear.equipped, bisRows: bis.lists?.[list] ?? [], tracks: ctx.tracks, bagItemIds: gear.bagItemIds, targets: bis.targets, statsMatter: bis.statsMatter });
  const choice = choosePriorityList(bis.lists, bis.listType);
  return {
    character, summary, gear, bis, choice, evaluate,
    priorityRows: evaluate(choice.listType),
    vaultItems: gear.simc?.items.filter((i) => i.location === 'vault') ?? [],
  };
}

/** The source's pick for a row, as the character page and the settings editor show it. */
export function bisView(row: BisRow, icons: ReadonlyMap<number, string | null>, targets: ReadonlyMap<number, TierTarget>): BisView {
  return row.kind === 'item'
    ? {
        kind: 'item' as const,
        ...itemView({ itemId: row.itemId, name: row.name, itemLevel: null, quality: pickQuality(null), bonusIds: row.bonusIds }, icons, null),
        isTier: row.isTier,
        isCatalyst: row.isCatalyst,
        source: row.source,
        targetStats: row.isTier ? targets.get(row.itemId)?.secondaryStats ?? null : null,
        targetIsTierPiece: row.isTier && (targets.get(row.itemId)?.isTier ?? false),
      }
    : { kind: 'any' as const, minItemLevel: row.minItemLevel, source: row.source };
}

export function rowView(
  r: GearRow, icons: ReadonlyMap<number, string | null>, costs: ReadonlyMap<number, CrestCost>, balances: ReadonlyMap<number, number>,
  targets: ReadonlyMap<number, TierTarget>,
): GearRowView {
  return {
    slotLabel: r.row.slotLabel,
    slot: r.slot,
    state: r.state,
    equipped: r.equipped && itemView(r.equipped, icons, r.track),
    equippedStats: r.equipped?.secondaryStats ?? null,
    statsUnverified: r.statsUnverified,
    bis: bisView(r.row, icons, targets),
    upgrade: upgradeFor(r, costs, balances),
  };
}

/** Vault choices, each flagged when it would fill a row of `listRows`. */
export function vaultChoicesFor(items: SnapshotItemInput[], listRows: BisRow[], icons: ReadonlyMap<number, string | null>, tracks: ReadonlyMap<number, Track>): VaultChoiceView[] {
  const isBis = (item: SnapshotItemInput) => listRows.some((r) => r.kind === 'any'
    ? r.slots.includes(item.slot as SlotType) && (item.itemLevel ?? 0) >= r.minItemLevel
    : r.itemId === item.itemId || (r.isTier && item.isTier && r.slots.includes(item.slot as SlotType)));
  return items.map((item) => ({ ...itemView(item, icons, decodeTrack(item.bonusIds, tracks)), isBis: isBis(item) }));
}

export function creditView(cr: Credit, icons: ReadonlyMap<number, string | null>): PriorityCreditView {
  if (cr.kind === 'any') return cr;
  const item = itemView({ itemId: cr.itemId, name: cr.name, itemLevel: null, quality: pickQuality(null), bonusIds: cr.bonusIds }, icons, null);
  if (cr.kind === 'item') return { kind: 'item', slotLabel: cr.slotLabel, weight: cr.weight, item };
  return { kind: 'tier', slotLabel: cr.slotLabel, weight: cr.weight, fit: cr.fit, item, dropStats: cr.dropStats, targetName: cr.targetName, targetStats: cr.targetStats };
}

export const priorityCharacter = (m: MemberData, tracks: ReadonlyMap<number, Track>): PriorityCharacter => ({
  id: m.character.id, name: m.character.name, className: m.character.className, rows: m.priorityRows, equipped: m.gear.equipped, tracks, targets: m.bis.targets, statsMatter: m.bis.statsMatter,
});
