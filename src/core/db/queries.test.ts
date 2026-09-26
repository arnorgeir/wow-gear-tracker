import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDb } from './client';
import { openTestDb } from '@/test/db';
import {
  deleteCharacter, getBonusQualityMap, replaceBonusQualities, equippedGear, getBisLists, getCharacter, getItemIcons, getLatestSnapshot, getMeta, getTrackMap,
  gearToSnapshotItems, insertCharacter, listCharacters, replaceBisLists, replaceTracks, saveSnapshotIfChanged,
  setMeta, updateCharacter, upsertItemIcons, type NewCharacter,
} from './queries';
import type { BisLists, GearItem } from '../types';

const newCharacter: NewCharacter = {
  region: 'eu', realmId: 1306, realmSlug: 'tarren-mill', realmName: 'Tarren Mill',
  name: 'Birkibjörn', className: 'Druid', specName: 'Guardian',
};

const gear: GearItem[] = [
  { slot: 'HEAD', itemId: 1, name: 'Helm', itemLevel: 321, quality: 'EPIC', bonusIds: [12850], isTier: true },
  { slot: 'NECK', itemId: 2, name: 'Neck', itemLevel: 318, quality: 'EPIC', bonusIds: [], isTier: false },
];

describe('characters', () => {
  it('inserts, lists, updates and deletes', async () => {
    const db = await openTestDb();
    const { id, created } = await insertCharacter(db, newCharacter, 100);
    expect(created).toBe(true);
    await updateCharacter(db, id, { specOverride: 'Feral', lastSyncedAt: 200 });
    expect(await getCharacter(db, id)).toMatchObject({ name: 'Birkibjörn', nameKey: 'birkibjörn', specOverride: 'Feral', lastSyncedAt: 200 });
    expect(await listCharacters(db)).toHaveLength(1);
    await deleteCharacter(db, id);
    expect(await getCharacter(db, id)).toBeUndefined();
  });

  it('returns the existing character when added again with different capitalization', async () => {
    const db = await openTestDb();
    const first = await insertCharacter(db, newCharacter, 100);
    const second = await insertCharacter(db, { ...newCharacter, name: 'BIRKIBJÖRN' }, 200);
    expect(second).toEqual({ id: first.id, created: false });
    expect(await listCharacters(db)).toHaveLength(1);
  });
});

describe('snapshots', () => {
  it('saves a snapshot only when the gear changed', async () => {
    const db = await openTestDb();
    const { id } = await insertCharacter(db, newCharacter, 1);
    const first = await saveSnapshotIfChanged(db, id, 'blizzard', gearToSnapshotItems(gear), 10);
    const again = await saveSnapshotIfChanged(db, id, 'blizzard', gearToSnapshotItems([...gear].reverse()), 20);
    expect(first.changed).toBe(true);
    expect(again).toEqual({ snapshotId: first.snapshotId, changed: false });

    const upgraded = gear.map((g) => (g.slot === 'NECK' ? { ...g, itemLevel: 321 } : g));
    const changed = await saveSnapshotIfChanged(db, id, 'blizzard', gearToSnapshotItems(upgraded), 30);
    expect(changed.changed).toBe(true);

    const latest = await getLatestSnapshot(db, id);
    expect(latest).toMatchObject({ id: changed.snapshotId, source: 'blizzard', createdAt: 30 });
    expect(equippedGear(latest!)).toEqual(expect.arrayContaining([expect.objectContaining({ slot: 'NECK', itemLevel: 321 })]));
  });

  it('returns null when a character has no snapshot', async () => {
    const db = await openTestDb();
    const { id } = await insertCharacter(db, newCharacter, 1);
    expect(await getLatestSnapshot(db, id)).toBeNull();
  });
});

describe('BiS lists', () => {
  const lists: BisLists = {
    overall: [{ slotLabel: 'Head', slots: ['HEAD'], itemId: 5, name: 'Helm', bonusIds: [], isTier: true, isCatalyst: true, source: 'Boss' }],
    raid: [],
    mythicPlus: [{ slotLabel: 'Ring', slots: ['FINGER_1', 'FINGER_2'], itemId: 6, name: 'Ring', bonusIds: [1, 2], isTier: false, isCatalyst: false, source: 'Dungeon' }],
  };

  it('replaces and reads lists in order', async () => {
    const db = await openTestDb();
    expect(await getBisLists(db, 'guardian-druid')).toBeNull();
    await replaceBisLists(db, 'guardian-druid', lists, 50);
    await replaceBisLists(db, 'guardian-druid', lists, 60);
    expect(await getBisLists(db, 'guardian-druid')).toEqual({ lists, fetchedAt: 60 });
  });
});

describe('tracks, meta and icons', () => {
  it('stores bonus qualities', async () => {
    const db = await openTestDb();
    await replaceBonusQualities(db, [{ bonusId: 12805, quality: 'EPIC' }, { bonusId: 4775, quality: 'RARE' }]);
    expect(await getBonusQualityMap(db)).toEqual(new Map([[12805, 'EPIC'], [4775, 'RARE']]));
  });

  it('stores tracks by bonus ID', async () => {
    const db = await openTestDb();
    await replaceTracks(db, [{ bonusId: 12850, name: 'Myth', step: 2, max: 6, group: 618, currencyId: 3446, currencyName: 'Myth Mistcrest', costPerStep: 20 }]);
    expect((await getTrackMap(db)).get(12850)?.name).toBe('Myth');
  });

  it('stores meta values', async () => {
    const db = await openTestDb();
    expect(await getMeta(db, 'x')).toBeNull();
    await setMeta(db, 'x', 'one', 1);
    await setMeta(db, 'x', 'two', 2);
    expect(await getMeta(db, 'x')).toEqual({ value: 'two', updatedAt: 2 });
  });

  it('stores icons, including known-missing ones', async () => {
    const db = await openTestDb();
    await upsertItemIcons(db, [{ itemId: 1, iconUrl: 'https://i/1.jpg' }, { itemId: 2, iconUrl: null }], 1);
    const icons = await getItemIcons(db, [1, 2, 3]);
    expect(new Map([...icons.entries()].sort())).toEqual(new Map([[1, 'https://i/1.jpg'], [2, null]]));
    expect((await getItemIcons(db, [])).size).toBe(0);
  });
});

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

describe('snapshot sources', () => {
  const bagBelt = { location: 'bag' as const, slot: 'WAIST', itemId: 9, name: 'Belt', itemLevel: 300, quality: 'EPIC' as const, bonusIds: [], isTier: false };
  const crests = [{ kind: 'upgrade' as const, currencyId: 3446, quantity: 85 }];

  it('keeps a newer SimC paste current until Blizzard’s own data changes', async () => {
    const db = await openTestDb();
    const { id } = await insertCharacter(db, newCharacter, 1);
    const blizzardGear = gearToSnapshotItems(gear);
    await saveSnapshotIfChanged(db, id, 'blizzard', blizzardGear, 10);
    const paste = await saveSnapshotIfChanged(db, id, 'simc', [...blizzardGear, bagBelt], 20, crests);
    expect(paste.changed).toBe(true);

    expect(await saveSnapshotIfChanged(db, id, 'blizzard', blizzardGear, 30)).toMatchObject({ changed: false });
    expect((await getLatestSnapshot(db, id))?.source).toBe('simc');

    const upgraded = gearToSnapshotItems(gear.map((g) => (g.slot === 'NECK' ? { ...g, itemLevel: 330 } : g)));
    expect(await saveSnapshotIfChanged(db, id, 'blizzard', upgraded, 40)).toMatchObject({ changed: true });
    expect((await getLatestSnapshot(db, id))?.source).toBe('blizzard');
  });

  it('makes a repeated paste current again after Blizzard took over', async () => {
    const db = await openTestDb();
    const { id } = await insertCharacter(db, newCharacter, 1);
    const pasted = [...gearToSnapshotItems(gear), bagBelt];
    await saveSnapshotIfChanged(db, id, 'simc', pasted, 10, crests);
    await saveSnapshotIfChanged(db, id, 'blizzard', gearToSnapshotItems(gear), 20);
    expect(await saveSnapshotIfChanged(db, id, 'simc', pasted, 30, crests)).toMatchObject({ changed: true });
    expect(await saveSnapshotIfChanged(db, id, 'simc', pasted, 40, crests)).toMatchObject({ changed: false });
  });

  it('stores currencies and reads the latest snapshot of one source', async () => {
    const db = await openTestDb();
    const { id } = await insertCharacter(db, newCharacter, 1);
    await saveSnapshotIfChanged(db, id, 'simc', gearToSnapshotItems(gear), 10, crests);
    await saveSnapshotIfChanged(db, id, 'blizzard', gearToSnapshotItems(gear.slice(0, 1)), 20);
    const simc = await getLatestSnapshot(db, id, 'simc');
    expect(simc).toMatchObject({ source: 'simc', createdAt: 10, currencies: crests });
    expect((await getLatestSnapshot(db, id))?.currencies).toEqual([]);
  });

  it('treats a change in crests alone as a new paste', async () => {
    const db = await openTestDb();
    const { id } = await insertCharacter(db, newCharacter, 1);
    await saveSnapshotIfChanged(db, id, 'simc', gearToSnapshotItems(gear), 10, crests);
    const more = [{ kind: 'upgrade' as const, currencyId: 3446, quantity: 105 }];
    expect(await saveSnapshotIfChanged(db, id, 'simc', gearToSnapshotItems(gear), 20, more)).toMatchObject({ changed: true });
  });
});
