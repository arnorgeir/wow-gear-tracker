import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../client';
import { characters } from '../schema';
import { type Region } from '../../types';
import { withWriteLock } from './write-lock';

export type CharacterRow = typeof characters.$inferSelect;

export interface NewCharacter {
  region: Region;
  realmId: number;
  realmSlug: string;
  realmName: string;
  name: string;
  className: string;
  specName: string;
}

const nameKeyOf = (name: string) => name.toLocaleLowerCase('en');

export function insertCharacter(db: Db, input: NewCharacter, now: number): Promise<{ id: number; created: boolean }> {
  return withWriteLock(db, async () => {
    const nameKey = nameKeyOf(input.name);
    const existing = await db.select({ id: characters.id }).from(characters)
      .where(and(eq(characters.region, input.region), eq(characters.realmId, input.realmId), eq(characters.nameKey, nameKey)))
      .get();
    if (existing) return { id: existing.id, created: false };
    const [row] = await db.insert(characters).values({ ...input, nameKey, addedAt: now }).returning({ id: characters.id });
    return { id: row!.id, created: true };
  });
}

export const listCharacters = (db: Db) => db.select().from(characters).orderBy(asc(characters.addedAt), asc(characters.id));

export const getCharacter = (db: Db, id: number) => db.select().from(characters).where(eq(characters.id, id)).get();

export async function updateCharacter(db: Db, id: number, patch: Partial<Omit<CharacterRow, 'id' | 'addedAt' | 'nameKey'>>) {
  await withWriteLock(db, () => db.update(characters).set(patch).where(eq(characters.id, id)));
}

export async function deleteCharacter(db: Db, id: number) {
  await withWriteLock(db, () => db.delete(characters).where(eq(characters.id, id)));
}
