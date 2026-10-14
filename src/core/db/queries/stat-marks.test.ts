import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { accounts } from '../schema';
import { deleteCharacter, insertCharacter, type NewCharacter } from './characters';
import { clearStatMark, listStatMarks, setStatMark } from './stat-marks';
import type { StatMark } from '../../types';

const base: NewCharacter = {
  region: 'eu', realmId: 1306, realmSlug: 'tarren-mill', realmName: 'Tarren Mill',
  name: 'Birkibjörn', className: 'Druid', specName: 'Guardian',
};
const mark: StatMark = { slot: 'HEAD', itemId: 100, bonusIds: [30, 10], targetItemId: 200, right: true };

describe('stat marks', () => {
  it('stores a mark with sorted bonus IDs and replaces it in the same slot', async () => {
    const db = await openTestDb();
    const { id } = await insertCharacter(db, base, 1);
    await setStatMark(db, 1, id, mark);
    expect(await listStatMarks(db, 1, id)).toEqual([{ ...mark, bonusIds: [10, 30] }]);
    await setStatMark(db, 1, id, { ...mark, itemId: 101, bonusIds: [], right: false });
    expect(await listStatMarks(db, 1, id)).toEqual([{ ...mark, itemId: 101, bonusIds: [], right: false }]);
  });

  it('clears a mark, and clearing an empty slot is fine', async () => {
    const db = await openTestDb();
    const { id } = await insertCharacter(db, base, 1);
    await clearStatMark(db, 1, id, 'HEAD');
    await setStatMark(db, 1, id, mark);
    await clearStatMark(db, 1, id, 'HEAD');
    expect(await listStatMarks(db, 1, id)).toEqual([]);
  });

  it('lists only this account and character', async () => {
    const db = await openTestDb();
    await db.insert(accounts).values({ id: 2, name: 'Second' });
    const { id } = await insertCharacter(db, base, 1);
    const other = await insertCharacter(db, { ...base, name: 'Skuggi' }, 2);
    await setStatMark(db, 2, id, mark);
    await setStatMark(db, 1, other.id, mark);
    expect(await listStatMarks(db, 1, id)).toEqual([]);
  });

  it('is removed with the character', async () => {
    const db = await openTestDb();
    const { id } = await insertCharacter(db, base, 1);
    await setStatMark(db, 1, id, mark);
    await deleteCharacter(db, id);
    expect(await listStatMarks(db, 1, id)).toEqual([]);
  });
});
