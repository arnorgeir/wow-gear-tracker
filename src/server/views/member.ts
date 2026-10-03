import type { Db } from '@/core/db/client';
import type { CharacterRow } from '@/core/db/queries/characters';
import type { SnapshotItemInput } from '@/core/db/queries/snapshots';
import type { CrestCost } from '@/core/gear/crests';
import { evaluateGear, type GearRow } from '@/core/gear/evaluate';
import { choosePriorityList, type PriorityListType } from '@/core/priority/list';
import type { Credit, PriorityCharacter } from '@/core/priority/rank';
import { decodeTrack } from '@/core/raidbots/tracks';
import type { BisResult } from '@/core/sync/reference-sync';
import type { BisRow, ListType, SlotType, Track } from '@/core/types';
import { itemView } from './item-view';
import { loadGear, summarize, upgradeFor, type GearContext } from './summarize';
import type { CharacterSummary, GearRowView, PriorityCreditView, VaultChoiceView } from './types';

export interface MemberContext {
  db: Db;
  tracks: ReadonlyMap<number, Track>;
  /** BiS lists for a spec; the group page shares one lookup per spec across members. */
  bisFor: (specSlug: string) => Promise<BisResult>;
}

export interface MemberData {
  character: CharacterRow;
  summary: CharacterSummary;
  gear: GearContext;
  bis: BisResult;
  choice: { listType: PriorityListType; fellBack: boolean };
  /** Rows for the priority list in `choice`. */
  priorityRows: GearRow[];
  evaluate: (list: ListType) => GearRow[];
  vaultItems: SnapshotItemInput[];
}

/** One character's gear, BiS lists and priority rows: what the character page and the group page both start from. */
export async function loadMember(ctx: MemberContext, character: CharacterRow, classIcons: ReadonlyMap<string, string | null> = new Map()): Promise<MemberData> {
  const gear = await loadGear(ctx.db, character.id);
  const summary = summarize(character, gear.current, classIcons);
  const bis = await ctx.bisFor(summary.specSlug);
  const evaluate = (list: ListType) => evaluateGear({ equipped: gear.equipped, bisRows: bis.lists?.[list] ?? [], tracks: ctx.tracks, bagItemIds: gear.bagItemIds });
  const choice = choosePriorityList(bis.lists, character.priorityList);
  return {
    character, summary, gear, bis, choice, evaluate,
    priorityRows: evaluate(choice.listType),
    vaultItems: gear.simc?.items.filter((i) => i.location === 'vault') ?? [],
  };
}

export function rowView(r: GearRow, icons: ReadonlyMap<number, string | null>, costs: ReadonlyMap<number, CrestCost>, balances: ReadonlyMap<number, number>): GearRowView {
  return {
    slotLabel: r.row.slotLabel,
    slot: r.slot,
    state: r.state,
    equipped: r.equipped && itemView(r.equipped, icons, r.track),
    bis: r.row.kind === 'item'
      ? {
          kind: 'item' as const,
          ...itemView({ itemId: r.row.itemId, name: r.row.name, itemLevel: null, quality: 'EPIC', bonusIds: r.row.bonusIds }, icons, null),
          isTier: r.row.isTier,
          isCatalyst: r.row.isCatalyst,
          source: r.row.source,
        }
      : { kind: 'any' as const, minItemLevel: r.row.minItemLevel, source: r.row.source },
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
  return cr.kind === 'item'
    ? { kind: 'item', slotLabel: cr.slotLabel, weight: cr.weight,
        item: itemView({ itemId: cr.itemId, name: cr.name, itemLevel: null, quality: 'EPIC', bonusIds: cr.bonusIds }, icons, null) }
    : cr;
}

export const priorityCharacter = (m: MemberData, tracks: ReadonlyMap<number, Track>): PriorityCharacter => ({
  id: m.character.id, name: m.character.name, className: m.character.className, rows: m.priorityRows, equipped: m.gear.equipped, tracks,
});
