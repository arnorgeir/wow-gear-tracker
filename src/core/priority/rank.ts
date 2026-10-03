import type { GearRow } from '../gear/evaluate';
import { decodeTrack } from '../raidbots/tracks';
import type { ArmorType, BisRow, GearItem, SeasonLoot, SlotType, Track } from '../types';
import { ARMOR_SLOTS, armorTypeForClass, slotsForInventoryType } from './slots';

export interface PriorityCharacter {
  id: number;
  name: string;
  className: string;
  /** Rows evaluated for the character's priority list. */
  rows: GearRow[];
  equipped: GearItem[];
  tracks: ReadonlyMap<number, Track>;
}

export type Credit =
  | { kind: 'item'; slotLabel: string; weight: number; itemId: number; name: string; bonusIds: number[] }
  | { kind: 'tier'; slotLabel: string; weight: number }
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

/** Whether a dungeon's loot can fill this row: the exact item, or for tier and Any rows, a slot drop in the right armor type. */
function dropsFor(row: BisRow, armor: ArmorType | null, dungeon: SeasonLoot): boolean {
  if (row.kind === 'item' && !row.isTier) return dungeon.loot.some((l) => l.itemId === row.itemId);
  const armorSlot = row.slots.some((s) => ARMOR_SLOTS.has(s));
  if (armorSlot && !armor) return false;
  return dungeon.loot.some((l) =>
    slotsForInventoryType(l.inventoryType).some((s) => row.slots.includes(s)) && (!armorSlot || l.armorType === armor));
}

function creditFor(row: BisRow, weight: number): Credit {
  if (row.kind === 'any') return { kind: 'any', slotLabel: row.slotLabel, weight, minItemLevel: row.minItemLevel };
  if (row.isTier) return { kind: 'tier', slotLabel: row.slotLabel, weight };
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
      missing: character.rows.filter((r) => r.state === 'missing')
        .map((r) => ({ row: r.row, weight: weightOf(r, bySlot, matchedSlots, tierCount, character.tracks) })),
    };
  });
  return dungeons.map((dungeon) => {
    const perCharacter = needs
      .map(({ character, armor, missing }) => ({
        characterId: character.id,
        characterName: character.name,
        credits: missing.filter((m) => dropsFor(m.row, armor, dungeon)).map((m) => creditFor(m.row, m.weight)),
      }))
      .filter((c) => c.credits.length > 0);
    const score = perCharacter.reduce((sum, c) => sum + c.credits.reduce((s, credit) => s + credit.weight, 0), 0);
    return { challengeModeId: dungeon.challengeModeId, name: dungeon.name, split: dungeon.split, score, characters: perCharacter };
  }).sort((a, b) => b.score - a.score || b.characters.length - a.characters.length || a.name.localeCompare(b.name));
}
