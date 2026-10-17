import { describe, expect, it, vi } from 'vitest';
import { openTestDb } from '@/test/db';
import { DAY_MS } from '../freshness';
import { ensureClassIcons } from './class-icons';
import type { BlizzardClient } from '../../blizzard/client';

describe('ensureClassIcons', () => {
  function blizzardWith(fail = false) {
    const calls = { classes: 0 };
    const blizzard = {
      getClasses: async () => { calls.classes++; if (fail) throw new Error('down'); return [{ id: 11, name: 'Druid', specs: [] }, { id: 10, name: 'Monk', specs: [] }]; },
      getClassIconUrl: async (_region: string, id: number) => (id === 11 ? 'https://i/druid.jpg' : null),
    } as unknown as BlizzardClient;
    return { blizzard, calls };
  }

  it('fills the cache and serves it for 30 days', async () => {
    const db = await openTestDb();
    const { blizzard, calls } = blizzardWith();
    expect(await ensureClassIcons({ db, blizzard, now: 1 }, 'eu')).toEqual(new Map([['Druid', 'https://i/druid.jpg'], ['Monk', null]]));
    await ensureClassIcons({ db, blizzard, now: 1 + 29 * DAY_MS }, 'eu');
    expect(calls.classes).toBe(1);
    await ensureClassIcons({ db, blizzard, now: 1 + 30 * DAY_MS }, 'eu');
    expect(calls.classes).toBe(2);
  });

  it('keeps cached icons when some icon calls fail, and retries them later', async () => {
    const db = await openTestDb();
    await ensureClassIcons({ db, blizzard: blizzardWith().blizzard, now: 1 }, 'eu');
    let iconCalls = 0;
    const flaky = {
      getClasses: async () => [{ id: 11, name: 'Druid', specs: [] }, { id: 10, name: 'Monk', specs: [] }],
      getClassIconUrl: async () => { iconCalls++; throw new Error('timeout'); },
    } as unknown as BlizzardClient;
    const icons = await ensureClassIcons({ db, blizzard: flaky, now: 1 + 30 * DAY_MS }, 'eu');
    expect(icons.get('Druid')).toBe('https://i/druid.jpg');
    await ensureClassIcons({ db, blizzard: flaky, now: 1 + 30 * DAY_MS + 61 * 60_000 }, 'eu');
    expect(iconCalls).toBe(4);
  });

  it('waits an hour before retrying after a failure', async () => {
    const db = await openTestDb();
    const { blizzard, calls } = blizzardWith(true);
    await ensureClassIcons({ db, blizzard, now: 1000 }, 'eu');
    await ensureClassIcons({ db, blizzard, now: 1000 + 59 * 60_000 }, 'eu');
    expect(calls.classes).toBe(1);
    await ensureClassIcons({ db, blizzard, now: 1000 + 61 * 60_000 }, 'eu');
    expect(calls.classes).toBe(2);
  });

  it('shares one refresh between calls that arrive while it runs', async () => {
    const db = await openTestDb();
    const { blizzard, calls } = blizzardWith();
    const [a, b] = await Promise.all([ensureClassIcons({ db, blizzard, now: 1 }, 'eu'), ensureClassIcons({ db, blizzard, now: 1 }, 'eu')]);
    expect(calls.classes).toBe(1);
    expect(b).toEqual(a);
  });

  it('shares the refresh with another copy of this module, as Next bundles one per server chunk', async () => {
    const db = await openTestDb();
    const { blizzard, calls } = blizzardWith();
    vi.resetModules();
    const other = await import('./class-icons');
    expect(other.ensureClassIcons).not.toBe(ensureClassIcons);
    await Promise.all([ensureClassIcons({ db, blizzard, now: 1 }, 'eu'), other.ensureClassIcons({ db, blizzard, now: 1 }, 'eu')]);
    expect(calls.classes).toBe(1);
  });

  it('keeps the cache when Blizzard fails', async () => {
    const db = await openTestDb();
    await ensureClassIcons({ db, blizzard: blizzardWith().blizzard, now: 1 }, 'eu');
    const icons = await ensureClassIcons({ db, blizzard: blizzardWith(true).blizzard, now: 1 + 31 * DAY_MS }, 'eu');
    expect(icons.get('Druid')).toBe('https://i/druid.jpg');
  });
});
