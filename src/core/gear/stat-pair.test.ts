import { describe, expect, it } from 'vitest';
import { borrowStats, compareStats, decodeStats, encodeStats } from './stat-pair';

const HM = ['HASTE_RATING', 'MASTERY_RATING'];
const MV = ['MASTERY_RATING', 'VERSATILITY'];

describe('encodeStats and decodeStats', () => {
  it('stores a sorted, comma-joined pair and reads it back', () => {
    expect(encodeStats(['MASTERY_RATING', 'HASTE_RATING'])).toBe('HASTE_RATING,MASTERY_RATING');
    expect(decodeStats('HASTE_RATING,MASTERY_RATING')).toEqual(HM);
  });

  it('keeps no secondaries apart from unknown', () => {
    expect(encodeStats([])).toBe('');
    expect(decodeStats('')).toEqual([]);
    expect(encodeStats(null)).toBeNull();
    expect(encodeStats(undefined)).toBeNull();
    expect(decodeStats(null)).toBeNull();
  });
});

describe('compareStats', () => {
  it('is same for equal known pairs in any order', () => {
    expect(compareStats({ itemId: 1, stats: HM }, { itemId: 2, stats: ['MASTERY_RATING', 'HASTE_RATING'] })).toBe('same');
  });

  it('is different for known pairs that differ, even with equal item IDs', () => {
    expect(compareStats({ itemId: 1, stats: HM }, { itemId: 2, stats: MV })).toBe('different');
    expect(compareStats({ itemId: 271529, stats: MV }, { itemId: 271529, stats: HM })).toBe('different');
  });

  it('falls back to item IDs only when a pair is unknown', () => {
    expect(compareStats({ itemId: 7, stats: null }, { itemId: 7, stats: HM })).toBe('same');
    expect(compareStats({ itemId: 7, stats: HM }, { itemId: 7, stats: undefined })).toBe('same');
    expect(compareStats({ itemId: 7, stats: HM }, { itemId: 8, stats: null })).toBe('unknown');
  });

  it('treats no secondaries as a known pair', () => {
    expect(compareStats({ itemId: 1, stats: [] }, { itemId: 2, stats: [] })).toBe('same');
    expect(compareStats({ itemId: 1, stats: [] }, { itemId: 2, stats: HM })).toBe('different');
  });
});

describe('borrowStats', () => {
  const item = (itemId: number, bonusIds: number[], secondaryStats: string[] | null) => ({ itemId, bonusIds, secondaryStats });

  it('fills unknown pairs from an item with the same ID and bonus IDs, in any bonus order', () => {
    const pasted = [item(271528, [13696, 13698], null), item(271531, [13690], null)];
    const synced = [item(271528, [13698, 13696], HM), item(271531, [13691], MV)];
    expect(borrowStats(pasted, synced).map((i) => i.secondaryStats)).toEqual([HM, null]);
  });

  it('keeps a known pair', () => {
    expect(borrowStats([item(1, [], MV)], [item(1, [], HM)])[0]!.secondaryStats).toEqual(MV);
  });
});
