import { eq } from 'drizzle-orm';
import type { Db } from '../client';
import { meta } from '../schema';
import { withWriteLock } from './write-lock';

export async function getMeta(db: Db, key: string) {
  const row = await db.select().from(meta).where(eq(meta.key, key)).get();
  return row ? { value: row.value, updatedAt: row.updatedAt } : null;
}

export async function setMeta(db: Db, key: string, value: string, now: number) {
  await withWriteLock(db, () => db.insert(meta).values({ key, value, updatedAt: now })
    .onConflictDoUpdate({ target: meta.key, set: { value, updatedAt: now } }));
}
