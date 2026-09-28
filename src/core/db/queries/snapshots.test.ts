import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import type { GearItem } from '../../types';
import { type NewCharacter, insertCharacter } from './characters';
import { gearToSnapshotItems, saveSnapshotIfChanged, getLatestSnapshot, equippedGear } from './snapshots';

const newCharacter: NewCharacter = {
  region: 'eu', realmId: 1306, realmSlug: 'tarren-mill', realmName: 'Tarren Mill',
  name: 'Birkibjörn', className: 'Druid', specName: 'Guardian',
};

const gear: GearItem[] = [
  { slot: 'HEAD', itemId: 1, name: 'Helm', itemLevel: 321, quality: 'EPIC', bonusIds: [12850], isTier: true },
  { slot: 'NECK', itemId: 2, name: 'Neck', itemLevel: 318, quality: 'EPIC', bonusIds: [], isTier: false },
];

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
