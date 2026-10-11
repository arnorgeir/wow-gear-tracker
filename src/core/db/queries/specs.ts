import { asc, eq } from 'drizzle-orm';
import type { Db } from '../client';
import { specs } from '../schema';
import { withWriteLock } from './write-lock';

export interface SpecRow { methodSlug: string; classId: number; className: string; specName: string }

const toRow = (r: typeof specs.$inferSelect): SpecRow => ({ methodSlug: r.methodSlug, classId: r.classId, className: r.className, specName: r.specName });

export async function replaceSpecs(db: Db, rows: SpecRow[], now: number) {
  await withWriteLock(db, () => db.transaction(async (tx) => {
    await tx.delete(specs);
    if (rows.length > 0) await tx.insert(specs).values(rows.map((r) => ({ ...r, fetchedAt: now })));
  }));
}

export async function listSpecs(db: Db): Promise<SpecRow[]> {
  return (await db.select().from(specs).orderBy(asc(specs.className), asc(specs.specName))).map(toRow);
}

export async function getSpec(db: Db, methodSlug: string): Promise<SpecRow | null> {
  const row = await db.select().from(specs).where(eq(specs.methodSlug, methodSlug)).get();
  return row ? toRow(row) : null;
}
