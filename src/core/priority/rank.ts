import type { GearRow } from '../gear/evaluate';
import { compareStats } from '../gear/stat-pair';
import { decodeTrack } from '../raidbots/tracks';
import type { ArmorType, BisItemRow, BisRow, GearItem, LootItem, SeasonLoot, SlotType, StatMatch, TierTarget, Track } from '../types';
import { ARMOR_SLOTS, armorTypeForClass, slotsForInventoryType } from './slots';

export interface PriorityCharacter {
  id: number;
  name: string;
  className: string;
  /** Rows evaluated for the character's priority list. */
  rows: GearRow[];
  equipped: GearItem[];
  tracks: ReadonlyMap<number, Track>;
  targets: ReadonlyMap<number, TierTarget>;
}

export type TierFit = 'bis' | 'unverified' | 'alternative';

export type Credit =
  | { kind: 'item'; slotLabel: string; weight: number; itemId: number; name: string; bonusIds: number[] }
  /** The dungeon's own drop, to catalyze; the target fields describe Method's row. */
  | { kind: 'tier'; slotLabel: string; weight: number; fit: TierFit; itemId: number; name: string; bonusIds: number[];
      dropStats: string[] | null; targetName: string; targetStats: string[] | null }
  | { kind: 'any'; slotLabel: string; weight: number; minItemLevel: number };

export interface CharacterCredits { characterId: number; characterName: string; credits: Credit[] }
export interface DungeonRank { challengeModeId: number; name: string; split: boolean; score: number; characters: CharacterCredits[] }

/** From the design spec: 3 for an empty slot or Veteran and below, 2 for Champion or no track, 1 for Hero or Myth. */
export function trackWeight(item: GearItem | null, tracks: ReadonlyMap<number, Track>): number {
  if (!item) return 3;
  const track = decodeTrack(item.bonusIds, tracks);
  if (!track) return 2;
  if (track.name === 'Hero' || track.name === 'Myth') return 1;
  if (track.name === 'Champion') return 2;
  return 3;
}

function weightOf(row: GearRow, bySlot: ReadonlyMap<SlotType, GearItem>, matchedSlots: ReadonlySet<SlotType>, tierCount: number, tracks: ReadonlyMap<number, Track>): number {
  // Rings and trinkets: the weaker of the two items not already BiS sets the weight.
  const open = row.row.slots.length > 1 ? row.row.slots.filter((s) => !matchedSlots.has(s)) : [];
  const base = open.length > 0 ? Math.max(...open.map((s) => trackWeight(bySlot.get(s) ?? null, tracks))) : trackWeight(row.equipped, tracks);
  const tierBonus = row.row.kind === 'item' && row.row.isTier && tierCount < 4 ? 2 : 0;
  return base + tierBonus;
}

interface Need { row: BisRow; weight: number; wrongStats: boolean }

const FIT: Record<StatMatch, TierFit> = { same: 'bis', unknown: 'unverified', different: 'alternative' };
const MATCH_RANK: Record<StatMatch, number> = { same: 1, unknown: 2, different: 3 };

/** A drop for one of the row's slots, in the character's armor type where the slot has one. */
function fitsSlot(row: BisRow, armor: ArmorType | null, l: LootItem): boolean {
  const armorSlot = row.slots.some((s) => ARMOR_SLOTS.has(s));
  return slotsForInventoryType(l.inventoryType).some((s) => row.slots.includes(s)) && (!armorSlot || (armor !== null && l.armorType === armor));
}

/** Whether a dungeon's loot can fill a named or Any row: the exact item, or for Any rows a slot drop. */
function dropsFor(row: BisRow, armor: ArmorType | null, dungeon: SeasonLoot): boolean {
  if (row.kind === 'item') return dungeon.loot.some((l) => l.itemId === row.itemId);
  return dungeon.loot.some((l) => fitsSlot(row, armor, l));
}

/**
 * A tier row's credit from one dungeon: its best compatible drop by stat pair, never another dungeon's item.
 * A tier piece with the wrong stats only wants drops with Method's stats, at weight 1.
 */
function tierCredit(row: BisItemRow, need: Need, armor: ArmorType | null, dungeon: SeasonLoot, targets: ReadonlyMap<number, TierTarget>): Credit | null {
  const targetStats = targets.get(row.itemId)?.secondaryStats ?? null;
  const best = dungeon.loot
    .filter((l) => fitsSlot(row, armor, l))
    .map((l) => {
      const match = compareStats({ itemId: row.itemId, stats: targetStats }, { itemId: l.itemId, stats: l.secondaryStats });
      return { l, match, rank: match === 'same' && l.itemId === row.itemId ? 0 : MATCH_RANK[match] };
    })
    .sort((a, b) => a.rank - b.rank || a.l.itemId - b.l.itemId)[0];
  if (!best || (need.wrongStats && best.match !== 'same')) return null;
  const fit = FIT[best.match];
  const weight = fit === 'alternative' ? Math.max(1, need.weight - 1) : need.weight;
  return { kind: 'tier', slotLabel: row.slotLabel, weight, fit, itemId: best.l.itemId, name: best.l.name, bonusIds: [],
    dropStats: best.l.secondaryStats ?? null, targetName: row.name, targetStats };
}

function creditFor(row: BisRow, weight: number): Credit {
  if (row.kind === 'any') return { kind: 'any', slotLabel: row.slotLabel, weight, minItemLevel: row.minItemLevel };
  return { kind: 'item', slotLabel: row.slotLabel, weight, itemId: row.itemId, name: row.name, bonusIds: row.bonusIds };
}

/** Ranks the season's dungeons by how much the characters need from each; ties go to more characters, then name. */
export function rankDungeons(characters: PriorityCharacter[], dungeons: SeasonLoot[]): DungeonRank[] {
  const needs = characters.map((character) => {
    const bySlot = new Map(character.equipped.map((item) => [item.slot, item]));
    const matchedSlots = new Set(character.rows.filter((r) => r.matched).map((r) => r.slot));
    const tierCount = character.equipped.filter((item) => item.isTier).length;
    return {
      character,
      armor: armorTypeForClass(character.className),
      missing: character.rows.filter((r) => r.state === 'missing' || r.state === 'wrongStats')
        .map((r): Need => r.state === 'wrongStats'
          ? { row: r.row, weight: 1, wrongStats: true }
          : { row: r.row, weight: weightOf(r, bySlot, matchedSlots, tierCount, character.tracks), wrongStats: false }),
    };
  });
  return dungeons.map((dungeon) => {
    const perCharacter = needs
      .map(({ character, armor, missing }) => ({
        characterId: character.id,
        characterName: character.name,
        credits: missing.flatMap((m) => {
          if (m.row.kind === 'item' && m.row.isTier) return tierCredit(m.row, m, armor, dungeon, character.targets) ?? [];
          return dropsFor(m.row, armor, dungeon) ? [creditFor(m.row, m.weight)] : [];
        }),
      }))
      .filter((c) => c.credits.length > 0);
    const score = perCharacter.reduce((sum, c) => sum + c.credits.reduce((s, credit) => s + credit.weight, 0), 0);
    return { challengeModeId: dungeon.challengeModeId, name: dungeon.name, split: dungeon.split, score, characters: perCharacter };
  }).sort((a, b) => b.score - a.score || b.characters.length - a.characters.length || a.name.localeCompare(b.name));
}
