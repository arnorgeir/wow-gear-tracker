import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { ensureItemDetails } from './item-details';
import type { BlizzardClient } from '../../blizzard/client';

describe('ensureItemDetails', () => {
  it('fetches unknown items once and remembers items Blizzard doesn’t know', async () => {
    const db = await openTestDb();
    const asked: number[] = [];
    const blizzard = {
      getItemDetails: async (_region: string, id: number) => { asked.push(id); return id === 1 ? { quality: 'EPIC', isTier: true } : null; },
    } as unknown as BlizzardClient;
    const first = await ensureItemDetails({ db, blizzard, now: 1 }, 'eu', [1, 2, 1]);
    expect(first.get(1)).toEqual({ quality: 'EPIC', isTier: true });
    expect(first.get(2)).toEqual({ quality: null, isTier: false });
    await ensureItemDetails({ db, blizzard, now: 2 }, 'eu', [1, 2]);
    expect(asked.sort()).toEqual([1, 2]);
  });

  it('skips items that fail to load so they retry later', async () => {
    const db = await openTestDb();
    const blizzard = { getItemDetails: async () => { throw new Error('down'); } } as unknown as BlizzardClient;
    expect((await ensureItemDetails({ db, blizzard, now: 1 }, 'eu', [7])).has(7)).toBe(false);
  });
});
