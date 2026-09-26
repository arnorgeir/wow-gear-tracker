import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import {
  deleteCharacter, equippedGear, getBisLists, getCharacter, getItemIcons, getLatestSnapshot, getMeta, getTrackMap,
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
  it('stores tracks by bonus ID', async () => {
    const db = await openTestDb();
    await replaceTracks(db, [{ bonusId: 12850, name: 'Myth', step: 2, max: 6, currencyId: 3446, costPerStep: 20 }]);
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
