import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { DAY_MS } from '../freshness';
import { listSpecs } from '../../db/queries/specs';
import { syncSpecs } from './specs';
import type { BlizzardClient } from '../../blizzard/client';

describe('syncSpecs', () => {
  const classes = async () => [{ id: 8, name: 'Mage', specs: ['Arcane', 'Fire', 'Frost'], specIds: [62, 63, 64] }];
  const icons = async (_r: string, id: number) => (id === 63 ? null : `https://render/spec-${id}.jpg`);
  it('stores one row per spec with its Method slug, then waits a day', async () => {
    const db = await openTestDb();
    const blizzard = { getClasses: classes, getSpecIconUrl: icons } as unknown as BlizzardClient;
    expect(await syncSpecs({ db, blizzard, now: 1 }, 'eu')).toBe(true);
    expect((await listSpecs(db)).map((s) => s.methodSlug)).toEqual(['arcane-mage', 'fire-mage', 'frost-mage']);
    expect(await syncSpecs({ db, blizzard, now: 2 }, 'eu')).toBe(false);
  });
  it('stores each spec icon, and null for a spec whose icon is missing or fails', async () => {
    const db = await openTestDb();
    const flaky = async (r: string, id: number) => { if (id === 64) throw new Error('down'); return icons(r, id); };
    await syncSpecs({ db, blizzard: { getClasses: classes, getSpecIconUrl: flaky } as unknown as BlizzardClient, now: 1 }, 'eu');
    expect((await listSpecs(db)).map((x) => [x.specName, x.iconUrl])).toEqual([['Arcane', 'https://render/spec-62.jpg'], ['Fire', null], ['Frost', null]]);
  });
  it('keeps old rows when Blizzard fails', async () => {
    const db = await openTestDb();
    await syncSpecs({ db, blizzard: { getClasses: classes, getSpecIconUrl: icons } as unknown as BlizzardClient, now: 1 }, 'eu');
    const failing = { getClasses: async () => { throw new Error('down'); } } as unknown as BlizzardClient;
    expect(await syncSpecs({ db, blizzard: failing, now: 1 + DAY_MS }, 'eu')).toBe(true);
    expect(await listSpecs(db)).toHaveLength(3);
  });
});
