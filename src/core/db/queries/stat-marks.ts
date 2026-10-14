import { and, eq } from 'drizzle-orm';
import type { Db } from '../client';
import { tierStatMarks } from '../schema';
import type { SlotType, StatMark } from '../../types';
import { withWriteLock } from './write-lock';

const ofCharacter = (accountId: number, characterId: number) =>
  and(eq(tierStatMarks.accountId, accountId), eq(tierStatMarks.characterId, characterId));

export async function listStatMarks(db: Db, accountId: number, characterId: number): Promise<StatMark[]> {
  const rows = await db.select().from(tierStatMarks).where(ofCharacter(accountId, characterId));
  return rows.map((r) => ({ slot: r.slot, itemId: r.itemId, bonusIds: r.bonusIds, targetItemId: r.targetItemId, right: r.right }));
}

export async function setStatMark(db: Db, accountId: number, characterId: number, mark: StatMark) {
  const values = { itemId: mark.itemId, bonusIds: [...mark.bonusIds].sort((a, b) => a - b), targetItemId: mark.targetItemId, right: mark.right };
  await withWriteLock(db, () => db.insert(tierStatMarks).values({ accountId, characterId, slot: mark.slot, ...values })
    .onConflictDoUpdate({ target: [tierStatMarks.accountId, tierStatMarks.characterId, tierStatMarks.slot], set: values }));
}

export async function clearStatMark(db: Db, accountId: number, characterId: number, slot: SlotType) {
  await withWriteLock(db, () => db.delete(tierStatMarks).where(and(ofCharacter(accountId, characterId), eq(tierStatMarks.slot, slot))));
}
