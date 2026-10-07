import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import type { BlizzardClient } from '@/core/blizzard/client';
import type { BisLists } from '@/core/types';
import { createBisLookup } from './bis-lookup';

const lists: BisLists = {
  overall: [],
  raid: [],
  mythicPlus: [{ kind: 'item', slotLabel: 'Head', slots: ['HEAD'], itemId: 10, name: 'Tier Helm', bonusIds: [], isTier: true, isCatalyst: false, source: 'Dungeon A' }],
};

describe('createBisLookup', () => {
  it('fetches Method once per spec when one spec is looked up in two regions at once', async () => {
    let fetches = 0;
    const regions: string[] = [];
    const deps = {
      db: await openTestDb(),
      blizzard: { getItemDetails: async (region: string) => { regions.push(region); return null; } } as unknown as BlizzardClient,
      bisSource: { name: 'Fake', fetchLists: async () => { fetches++; return lists; } },
    };
    const lookup = createBisLookup(deps, 1000);
    await Promise.all([lookup('druid-guardian', 'eu'), lookup('druid-guardian', 'us')]);
    expect(fetches).toBe(1);
    expect(regions.sort()).toEqual(['eu', 'us']);
  });
});
