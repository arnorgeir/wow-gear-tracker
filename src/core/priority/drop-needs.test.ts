import { describe, expect, it } from 'vitest';
import { evaluateGear } from '../gear/evaluate';
import type { ArmorType, BisRow, GearItem, LootItem, SlotType, TierTarget, Track } from '../types';
import { bisMatches, needsByDrop } from './drop-needs';
import type { PriorityCharacter } from './rank';

const tracks = new Map<number, Track>();
const gear = (slot: SlotType, itemId: number): GearItem => ({ slot, itemId, name: `Item ${itemId}`, itemLevel: 300, quality: 'EPIC', bonusIds: [], isTier: false });
const named = (slots: SlotType[], itemId: number, isTier = false): BisRow =>
  ({ kind: 'item', slotLabel: slots[0]!, slots, itemId, name: `BiS ${itemId}`, bonusIds: [], isTier, isCatalyst: isTier, source: '' });
const anyRow = (slots: SlotType[]): BisRow => ({ kind: 'any', slotLabel: slots[0]!, slots, minItemLevel: 280, source: '' });
const loot = (itemId: number, inventoryType: string | null = null, armorType: ArmorType | null = null, secondaryStats?: string[] | null): LootItem =>
  ({ itemId, name: `Loot ${itemId}`, inventoryType, armorType, secondaryStats });
const target = (secondaryStats: string[] | null): TierTarget => ({ secondaryStats, isTier: true }) as TierTarget;

function character(rows: BisRow[], equipped: GearItem[], opts: { name?: string; id?: number; targets?: Map<number, TierTarget>; statsMatter?: boolean } = {}): PriorityCharacter {
  const targets = opts.targets ?? new Map();
  const statsMatter = opts.statsMatter ?? true;
  return { id: opts.id ?? 1, name: opts.name ?? 'Birkibjörn', className: 'Druid', rows: evaluateGear({ equipped, bisRows: rows, tracks, targets, statsMatter }), equipped, tracks, targets, statsMatter };
}

describe('needsByDrop', () => {
  it('credits a missing item row and a wrong-stats item row to the named drop', () => {
    const c = character([named(['NECK'], 10), named(['BACK'], 20)], [gear('BACK', 20)]);
    const needs = needsByDrop([c], [loot(10), loot(20), loot(30)]);
    expect(needs.get(10)).toEqual([{ characterId: 1, characterName: 'Birkibjörn', slotLabel: 'NECK', via: 'drop', reason: 'missing' }]);
    expect(needs.has(20)).toBe(false);
    expect(needs.has(30)).toBe(false);
  });

  it('credits every slot drop of a tier row, on different bosses alike, by stat fit', () => {
    const targets = new Map([[80, target(['HASTE_RATING', 'MASTERY_RATING'])]]);
    const c = character([named(['CHEST'], 80, true)], [gear('CHEST', 81)], { targets });
    const needs = needsByDrop([c], [
      loot(901, 'CHEST', 'leather', ['HASTE_RATING', 'MASTERY_RATING']),
      loot(902, 'ROBE', 'leather', ['CRIT_RATING', 'VERSATILITY']),
      loot(903, 'CHEST', 'leather', null),
      loot(904, 'CHEST', 'plate', ['HASTE_RATING', 'MASTERY_RATING']),
    ]);
    expect(needs.get(901)![0]).toMatchObject({ via: 'catalyst', reason: 'missing', fit: 'bis' });
    expect(needs.get(902)![0]).toMatchObject({ via: 'catalyst', fit: 'alternative' });
    expect(needs.get(903)![0]).toMatchObject({ via: 'catalyst', fit: 'unverified' });
    expect(needs.has(904)).toBe(false);
  });

  it('gives fit any when stats do not matter', () => {
    const c = character([named(['CHEST'], 80, true)], [gear('CHEST', 81)], { statsMatter: false });
    expect(needsByDrop([c], [loot(902, 'CHEST', 'leather', ['CRIT_RATING', 'VERSATILITY'])]).get(902)![0]).toMatchObject({ fit: 'any' });
  });

  it('lets a wrong-stats tier row take only drops with the right stats', () => {
    const targets = new Map([[80, target(['HASTE_RATING', 'MASTERY_RATING'])]]);
    const c = character([named(['CHEST'], 80, true)], [{ ...gear('CHEST', 80), isTier: true, secondaryStats: ['CRIT_RATING', 'VERSATILITY'] }], { targets });
    expect(c.rows[0]!.state).toBe('wrongStats');
    const needs = needsByDrop([c], [loot(901, 'CHEST', 'leather', ['HASTE_RATING', 'MASTERY_RATING']), loot(902, 'CHEST', 'leather', ['CRIT_RATING', 'VERSATILITY']), loot(903, 'CHEST', 'leather', null)]);
    expect(needs.get(901)![0]).toMatchObject({ reason: 'wrongStats', fit: 'bis' });
    expect(needs.has(902)).toBe(false);
    expect(needs.has(903)).toBe(false);
  });

  it('adds nothing for Any rows', () => {
    const c = character([anyRow(['WRIST'])], []);
    expect(needsByDrop([c], [loot(1, 'WRIST', 'leather')]).size).toBe(0);
  });

  it('keeps one entry per character, ordered by name', () => {
    const rows = [named(['FINGER_1', 'FINGER_2'], 60), named(['FINGER_1', 'FINGER_2'], 61)];
    const b = character(rows, [], { id: 2, name: 'Zoey' });
    const a = character([...rows, named(['FINGER_1', 'FINGER_2'], 60)], [], { id: 1, name: 'Ásta' });
    const needs = needsByDrop([b, a], [loot(60, 'FINGER')]);
    expect(needs.get(60)!.map((n) => n.characterName)).toEqual(['Ásta', 'Zoey']);
  });
});

describe('bisMatches', () => {
  const stats = ['HASTE_RATING', 'MASTERY_RATING'];
  const targets = new Map([[80, target(stats)]]);
  const drops = [loot(10, 'NECK'), loot(901, 'CHEST', 'leather', stats), loot(902, 'CHEST', 'leather', ['CRIT_RATING', 'VERSATILITY']), loot(903, 'CHEST', 'leather', null), loot(904, 'CHEST', 'plate', stats)];

  it('matches an item row by id', () => {
    expect(bisMatches([named(['NECK'], 10)], new Map(), true, 'Druid', drops)).toEqual(new Set([10]));
  });

  it('matches a tier row only on the same verified stats and armor type', () => {
    expect(bisMatches([named(['CHEST'], 80, true)], targets, true, 'Druid', drops)).toEqual(new Set([901]));
  });

  it('matches every slot drop when stats do not matter', () => {
    expect(bisMatches([named(['CHEST'], 80, true)], targets, false, 'Druid', drops)).toEqual(new Set([901, 902, 903]));
  });

  it('follows an override that changes the target', () => {
    const changed = new Map([[80, target(['CRIT_RATING', 'VERSATILITY'])]]);
    expect(bisMatches([named(['CHEST'], 80, true)], changed, true, 'Druid', drops)).toEqual(new Set([902]));
  });

  it('ignores Any rows', () => {
    expect(bisMatches([anyRow(['NECK'])], new Map(), true, 'Druid', drops).size).toBe(0);
  });
});
