import { describe, expect, it } from 'vitest';
import { evaluateGear } from '../gear/evaluate';
import type { ArmorType, BisLists, BisRow, GearItem, LootItem, SeasonLoot, SlotType, Track } from '../types';
import { choosePriorityList } from './list';
import { rankDungeons, type PriorityCharacter } from './rank';

const track = (bonusId: number, name: string): Track => ({ bonusId, name, step: 1, max: 6, group: null, currencyId: null, currencyName: null, costPerStep: null });
const tracks = new Map<number, Track>([[1, track(1, 'Myth')], [2, track(2, 'Hero')], [3, track(3, 'Champion')], [4, track(4, 'Veteran')]]);

const gear = (slot: SlotType, itemId: number, bonus?: number, isTier = false, itemLevel = 300): GearItem =>
  ({ slot, itemId, name: `Item ${itemId}`, itemLevel, quality: 'EPIC', bonusIds: bonus ? [bonus] : [], isTier });
const named = (slots: SlotType[], itemId: number, isTier = false): BisRow =>
  ({ kind: 'item', slotLabel: slots[0]!, slots, itemId, name: `BiS ${itemId}`, bonusIds: [], isTier, isCatalyst: isTier, source: '' });
const anyRow = (slots: SlotType[], minItemLevel: number): BisRow => ({ kind: 'any', slotLabel: slots[0]!, slots, minItemLevel, source: '' });
const loot = (itemId: number, inventoryType: string | null = null, armorType: ArmorType | null = null): LootItem => ({ itemId, inventoryType, armorType });
const dungeon = (challengeModeId: number, name: string, items: LootItem[], split = false): SeasonLoot =>
  ({ challengeModeId, name, shortName: '', imageUrl: null, split, loot: items });

const character = (rows: BisRow[], equipped: GearItem[], className = 'Druid', id = 1, name = 'Birkibjörn'): PriorityCharacter =>
  ({ id, name, className, rows: evaluateGear({ equipped, bisRows: rows, tracks }), equipped, tracks });
const scores = (ranks: ReturnType<typeof rankDungeons>) => ranks.map((r) => [r.name, r.score]);

describe('rankDungeons', () => {
  it('credits a named item only to the dungeon that drops it, weighted by the current item', () => {
    const c = character(
      [named(['NECK'], 10), named(['BACK'], 20), named(['WRIST'], 30), named(['WAIST'], 40), named(['FEET'], 50)],
      [gear('NECK', 11, 2), gear('BACK', 21, 3), gear('WRIST', 31, 4), gear('FEET', 51)],
    );
    // Hero 1, Champion 2, Veteran 3, empty 3, no track 2.
    const ranks = rankDungeons([c], [
      dungeon(501, 'Alpha Hollow', [loot(10), loot(20)]),
      dungeon(502, 'Beta Spire', [loot(30), loot(40), loot(50)]),
      dungeon(503, 'Gamma Deep', [loot(999)]),
    ]);
    expect(scores(ranks)).toEqual([['Beta Spire', 8], ['Alpha Hollow', 3], ['Gamma Deep', 0]]);
    expect(ranks[1]!.characters[0]!.credits).toEqual([
      { kind: 'item', slotLabel: 'NECK', weight: 1, itemId: 10, name: 'BiS 10', bonusIds: [] },
      { kind: 'item', slotLabel: 'BACK', weight: 2, itemId: 20, name: 'BiS 20', bonusIds: [] },
    ]);
  });

  it('counts only missing rows', () => {
    const c = character([named(['NECK'], 10)], [gear('NECK', 10, 2)]);
    expect(scores(rankDungeons([c], [dungeon(501, 'Alpha Hollow', [loot(10)])]))).toEqual([['Alpha Hollow', 0]]);
  });

  it('weights a ring by the weaker of the two rings not already BiS', () => {
    const bothMissing = character([named(['FINGER_1', 'FINGER_2'], 60), named(['FINGER_1', 'FINGER_2'], 61)], [gear('FINGER_1', 70, 1), gear('FINGER_2', 71, 3)]);
    expect(rankDungeons([bothMissing], [dungeon(501, 'Alpha Hollow', [loot(60)])])[0]!.score).toBe(2);
    const oneMatched = character([named(['FINGER_1', 'FINGER_2'], 60), named(['FINGER_1', 'FINGER_2'], 61)], [gear('FINGER_1', 60, 4), gear('FINGER_2', 71, 2)]);
    expect(rankDungeons([oneMatched], [dungeon(501, 'Alpha Hollow', [loot(61)])])[0]!.score).toBe(1);
  });

  it('credits a tier row to slot drops in the armor type, with +2 below four tier pieces', () => {
    const tierPieces = [gear('HEAD', 90, undefined, true), gear('SHOULDER', 91, undefined, true), gear('HANDS', 92, undefined, true)];
    const three = character([named(['CHEST'], 80, true)], [gear('CHEST', 81, 3), ...tierPieces]);
    const dungeons = [
      dungeon(501, 'Alpha Hollow', [loot(900, 'ROBE', 'leather')]),
      dungeon(502, 'Beta Spire', [loot(901, 'CHEST', 'plate')]),
      dungeon(503, 'Gamma Deep', [loot(902, 'HEAD', 'leather')]),
    ];
    const ranks = rankDungeons([three], dungeons);
    expect(scores(ranks)).toEqual([['Alpha Hollow', 4], ['Beta Spire', 0], ['Gamma Deep', 0]]);
    expect(ranks[0]!.characters[0]!.credits).toEqual([{ kind: 'tier', slotLabel: 'CHEST', weight: 4 }]);
    const four = character([named(['CHEST'], 80, true)], [gear('CHEST', 81, 3), ...tierPieces, gear('LEGS', 93, undefined, true)]);
    expect(rankDungeons([four], dungeons)[0]!.score).toBe(2);
  });

  it('credits an any row to slot drops, filtering armor slots by armor type but not cloaks', () => {
    const c = character([anyRow(['SHOULDER'], 334), anyRow(['BACK'], 334)], [gear('SHOULDER', 5, undefined, false, 321)]);
    const ranks = rankDungeons([c], [
      dungeon(501, 'Alpha Hollow', [loot(1, 'SHOULDER', 'leather')]),
      dungeon(502, 'Beta Spire', [loot(2, 'SHOULDER', 'cloth'), loot(3, 'CLOAK', 'cloth')]),
    ]);
    expect(scores(ranks)).toEqual([['Beta Spire', 3], ['Alpha Hollow', 2]]);
    expect(ranks[1]!.characters[0]!.credits).toEqual([{ kind: 'any', slotLabel: 'SHOULDER', weight: 2, minItemLevel: 334 }]);
  });

  it('gives an unknown class no armor-slot credit, but still credits named items', () => {
    const c = character([named(['CHEST'], 80, true), anyRow(['SHOULDER'], 334), named(['NECK'], 10)], [], 'Tinkerer');
    const ranks = rankDungeons([c], [dungeon(501, 'Alpha Hollow', [loot(900, 'CHEST', 'leather'), loot(1, 'SHOULDER', 'leather'), loot(10)])]);
    expect(ranks[0]!.characters[0]!.credits.map((cr) => cr.kind)).toEqual(['item']);
  });

  it('scores a character with no gear yet: every slot empty at 3, tier +2', () => {
    const c = character([named(['NECK'], 10), named(['CHEST'], 80, true)], []);
    expect(rankDungeons([c], [dungeon(501, 'Alpha Hollow', [loot(10), loot(900, 'CHEST', 'leather')])])[0]!.score).toBe(3 + 5);
  });

  it('credits only named items from loot whose slot is unknown', () => {
    const c = character([named(['NECK'], 10), anyRow(['SHOULDER'], 334)], []);
    const ranks = rankDungeons([c], [dungeon(501, 'Alpha Hollow', [loot(10), loot(11)])]);
    expect(ranks[0]!.characters[0]!.credits.map((cr) => cr.kind)).toEqual(['item']);
  });

  it('carries the split flag, crediting both halves of a split dungeon', () => {
    const c = character([named(['NECK'], 10)], []);
    const ranks = rankDungeons([c], [dungeon(502, 'Streets of Beta', [loot(10)], true), dungeon(503, 'Beta Gambit', [loot(10)], true)]);
    expect(ranks.map((r) => [r.name, r.score, r.split])).toEqual([['Beta Gambit', 3, true], ['Streets of Beta', 3, true]]);
  });

  it('breaks ties by how many characters benefit, then by name', () => {
    const first = character([named(['NECK'], 10), named(['BACK'], 20), named(['WRIST'], 30)], [], 'Druid', 1, 'Birkibjörn');
    const second = character([named(['NECK'], 10)], [], 'Druid', 2, 'Grenibjörn');
    const ranks = rankDungeons([first, second], [
      dungeon(502, 'Beta Spire', [loot(20), loot(30)]),
      dungeon(501, 'Alpha Hollow', [loot(10)]),
      dungeon(504, 'Zeta Crypt', []),
      dungeon(503, 'Delta Mire', []),
    ]);
    expect(ranks.map((r) => [r.name, r.score, r.characters.length])).toEqual([
      ['Alpha Hollow', 6, 2], ['Beta Spire', 6, 1], ['Delta Mire', 0, 0], ['Zeta Crypt', 0, 0],
    ]);
  });
});

describe('choosePriorityList', () => {
  const lists = (overall: number, mythicPlus: number): BisLists =>
    ({ overall: Array.from({ length: overall }, (_, i) => named(['NECK'], i)), raid: [], mythicPlus: Array.from({ length: mythicPlus }, (_, i) => named(['NECK'], i)) });

  it('uses the chosen list when it has rows', () => {
    expect(choosePriorityList(lists(2, 2), 'mythicPlus')).toEqual({ listType: 'mythicPlus', fellBack: false });
    expect(choosePriorityList(lists(2, 2), 'overall')).toEqual({ listType: 'overall', fellBack: false });
  });

  it('falls back to Overall when the spec has no Mythic+ list', () => {
    expect(choosePriorityList(lists(2, 0), 'mythicPlus')).toEqual({ listType: 'overall', fellBack: true });
  });

  it('keeps the choice when there is nothing to fall back to', () => {
    expect(choosePriorityList(null, 'mythicPlus')).toEqual({ listType: 'mythicPlus', fellBack: false });
    expect(choosePriorityList(lists(0, 0), 'mythicPlus')).toEqual({ listType: 'mythicPlus', fellBack: false });
  });
});
