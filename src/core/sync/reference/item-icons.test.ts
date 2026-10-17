import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { ensureItemIcons } from './item-icons';
import type { BlizzardClient } from '../../blizzard/client';

describe('ensureItemIcons', () => {
  it('fetches only unknown icons and remembers items without one', async () => {
    const db = await openTestDb();
    const asked: number[] = [];
    const blizzard = {
      getItemIconUrl: async (_region: string, id: number) => { asked.push(id); return id === 1 ? 'https://i/1.jpg' : null; },
    } as unknown as BlizzardClient;
    const first = await ensureItemIcons({ db, blizzard, now: 1 }, 'eu', [1, 2, 1]);
    expect(first.get(1)).toBe('https://i/1.jpg');
    expect(first.get(2)).toBeNull();
    await ensureItemIcons({ db, blizzard, now: 2 }, 'eu', [1, 2]);
    expect(asked.sort()).toEqual([1, 2]);
  });

  it('skips icons that fail to load so they retry later', async () => {
    const db = await openTestDb();
    const blizzard = { getItemIconUrl: async () => { throw new Error('down'); } } as unknown as BlizzardClient;
    expect((await ensureItemIcons({ db, blizzard, now: 1 }, 'eu', [7])).has(7)).toBe(false);
  });
});
