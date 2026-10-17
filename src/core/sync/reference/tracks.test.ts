import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { setMeta } from '../../db/queries/meta';
import { DAY_MS } from '../freshness';
import { ensureTracks, readTracks, syncTracks } from './tracks';
import type { Track } from '../../types';

const tracks: Track[] = [{ bonusId: 1, name: 'Myth', step: 1, max: 6, group: 618, currencyId: null, currencyName: null, costPerStep: null }];
const data = { tracks, qualities: [{ bonusId: 12805, quality: 'EPIC' as const }] };
const failing = async (): Promise<typeof data> => { throw new Error('down'); };

describe('readTracks and syncTracks', () => {
  const TRACKS_ERROR = 'Upgrade track data couldn’t be loaded, so upgrade states may be wrong';

  it('reads loading on a fresh install, with no error', async () => {
    expect(await readTracks(await openTestDb(), 1)).toMatchObject({ status: 'loading', due: true, error: null });
  });

  it('reads failed with the error when the first load fails, and backs off an hour', async () => {
    const db = await openTestDb();
    expect(await syncTracks({ db, fetchRaidbots: failing, now: 1000 })).toBe(true);
    expect(await readTracks(db, 1000 + 59 * 60_000)).toMatchObject({ status: 'failed', due: false, error: TRACKS_ERROR });
    expect(await syncTracks({ db, fetchRaidbots: failing, now: 1000 + 59 * 60_000 })).toBe(false);
    expect((await readTracks(db, 1000 + 60 * 60_000)).due).toBe(true);
  });

  it('reads ready after a load, then stale without an error when a refresh fails', async () => {
    const db = await openTestDb();
    await syncTracks({ db, fetchRaidbots: async () => data, now: 1 });
    const ready = await readTracks(db, 2);
    expect(ready).toMatchObject({ status: 'ready', due: false, error: null });
    expect(ready.tracks.size).toBe(1);
    expect(ready.qualities.get(12805)).toBe('EPIC');
    expect((await readTracks(db, 1 + DAY_MS)).due).toBe(true);
    await syncTracks({ db, fetchRaidbots: failing, now: 1 + DAY_MS });
    const stale = await readTracks(db, 2 + DAY_MS);
    expect(stale).toMatchObject({ status: 'stale', due: false, error: null });
    expect(stale.tracks.size).toBe(1);
  });

  it('skips a sync when nothing is due', async () => {
    const db = await openTestDb();
    let calls = 0;
    const ok = async () => { calls++; return data; };
    expect(await syncTracks({ db, fetchRaidbots: ok, now: 1 })).toBe(true);
    expect(await syncTracks({ db, fetchRaidbots: ok, now: 2 })).toBe(false);
    expect(calls).toBe(1);
  });
});

describe('ensureTracks', () => {
  it('refreshes daily, stores qualities, and keeps old data on failure', async () => {
    const db = await openTestDb();
    let calls = 0;
    const ok = async () => { calls++; return data; };
    const first = await ensureTracks({ db, fetchRaidbots: ok, now: 1 });
    expect(first).toMatchObject({ error: null });
    expect(first.qualities.get(12805)).toBe('EPIC');
    await ensureTracks({ db, fetchRaidbots: ok, now: 2 });
    expect(calls).toBe(1);
    const stale = await ensureTracks({ db, fetchRaidbots: failing, now: 2 + DAY_MS });
    expect(stale.tracks.size).toBe(1);
    expect(stale.qualities.size).toBe(1);
    expect(stale.error).toBeNull();
  });

  it('refetches track data saved by an older version of the app', async () => {
    const db = await openTestDb();
    await setMeta(db, 'tracks.fetchedAt', '1', 1);
    let calls = 0;
    const result = await ensureTracks({ db, fetchRaidbots: async () => { calls++; return data; }, now: 2 });
    expect(calls).toBe(1);
    expect(result.tracks.get(1)?.group).toBe(618);
  });

  it('stores crest icon names and refetches over a fresh v2 cache', async () => {
    const db = await openTestDb();
    await setMeta(db, 'tracks.v2.fetchedAt', '1', 1);
    const withIcon = { ...data, tracks: [{ ...tracks[0]!, currencyId: 3446, currencyName: 'Myth Mistcrest', costPerStep: 20, currencyIcon: 'inv_121_crest_myth' }] };
    let calls = 0;
    const result = await ensureTracks({ db, fetchRaidbots: async () => { calls++; return withIcon; }, now: 2 });
    expect(calls).toBe(1);
    expect(result.tracks.get(1)?.currencyIcon).toBe('inv_121_crest_myth');
  });

  it('reports missing track data and waits an hour before retrying', async () => {
    const db = await openTestDb();
    let calls = 0;
    const counting = async () => { calls++; return failing(); };
    const first = await ensureTracks({ db, fetchRaidbots: counting, now: 1000 });
    expect(first.tracks.size).toBe(0);
    expect(first.error).toBe('Upgrade track data couldn’t be loaded, so upgrade states may be wrong');
    await ensureTracks({ db, fetchRaidbots: counting, now: 1000 + 59 * 60_000 });
    expect(calls).toBe(1);
    await ensureTracks({ db, fetchRaidbots: counting, now: 1000 + 61 * 60_000 });
    expect(calls).toBe(2);
  });
});
