import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import { openDb } from '../client';
import { openTestDb } from '@/test/db';
import type { BisLists, GearItem } from '../../types';
import { type NewCharacter, insertCharacter, getCharacter, updateCharacter } from './characters';
import { gearToSnapshotItems, saveSnapshotIfChanged, getLatestSnapshot } from './snapshots';
import { replaceBisLists, getBisLists } from './bis-lists';
import { replaceTracks, getTrackMap } from './tracks';

const newCharacter: NewCharacter = {
  region: 'eu', realmId: 1306, realmSlug: 'tarren-mill', realmName: 'Tarren Mill',
  name: 'Birkibjörn', className: 'Druid', specName: 'Guardian',
};

const gear: GearItem[] = [
  { slot: 'HEAD', itemId: 1, name: 'Helm', itemLevel: 321, quality: 'EPIC', bonusIds: [12850], isTier: true },
  { slot: 'NECK', itemId: 2, name: 'Neck', itemLevel: 318, quality: 'EPIC', bonusIds: [], isTier: false },
];

describe('concurrent writes', () => {
  it('serializes write transactions so parallel refreshes don’t collide', async () => {
    const db = await openTestDb();
    const { id } = await insertCharacter(db, newCharacter, 1);
    const lists: BisLists = { overall: [], raid: [], mythicPlus: [] };
    await Promise.all([
      replaceTracks(db, [{ bonusId: 1, name: 'Hero', step: 1, max: 6, group: null, currencyId: null, currencyName: null, costPerStep: null }]),
      replaceBisLists(db, 'guardian-druid', lists, 1),
      saveSnapshotIfChanged(db, id, 'blizzard', gearToSnapshotItems(gear), 2),
    ]);
    expect((await getTrackMap(db)).size).toBe(1);
    expect(await getBisLists(db, 'guardian-druid')).not.toBeNull();
    expect(await getLatestSnapshot(db, id)).not.toBeNull();
  });
});

describe('write lock across bundles', () => {
  it('serializes writers from two separately loaded copies of the module', async () => {
    const db = await openTestDb();
    vi.resetModules();
    const a = await import('./write-lock');
    vi.resetModules();
    const b = await import('./write-lock');
    expect(a).not.toBe(b);
    let running = 0;
    let overlapped = false;
    const task = async () => {
      running++;
      if (running > 1) overlapped = true;
      await new Promise((r) => setTimeout(r, 10));
      running--;
    };
    await Promise.all([a.withWriteLock(db, task), b.withWriteLock(db, task)]);
    expect(overlapped).toBe(false);
  });
});

describe('file database', () => {
  it('waits for another connection’s write instead of failing with SQLITE_BUSY', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'gear-tracker-'));
    const db = await openDb(`file:${path.join(dir, 'test.db').split(path.sep).join('/')}`);
    const { id } = await insertCharacter(db, newCharacter, 1);
    const tracks = Array.from({ length: 3000 }, (_, i) => ({ bonusId: i + 1, name: 'Hero', step: 1, max: 6, group: null, currencyId: null, currencyName: null, costPerStep: null }));
    await Promise.all([replaceTracks(db, tracks), updateCharacter(db, id, { lastSyncedAt: 5 })]);
    expect((await getCharacter(db, id))?.lastSyncedAt).toBe(5);
    expect((await getTrackMap(db)).size).toBe(3000);
  });
});
