import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openTestDb } from '@/test/db';
import { characters, gearSnapshots } from './schema';

const character = {
  region: 'eu' as const, realmId: 1, realmSlug: 'test-realm', realmName: 'Test Realm',
  name: 'Testname', nameKey: 'testname', className: 'Druid', specName: 'Guardian', addedAt: 1,
};

describe('openDb', () => {
  it('creates the tables', async () => {
    const db = await openTestDb();
    const [row] = await db.insert(characters).values(character).returning();
    expect(row).toMatchObject({ id: 1, priorityList: 'mythicPlus', status: 'ok' });
  });

  it('rejects a duplicate character identity', async () => {
    const db = await openTestDb();
    await db.insert(characters).values(character);
    await expect(db.insert(characters).values(character)).rejects.toThrow();
  });

  it('deletes snapshots with their character', async () => {
    const db = await openTestDb();
    const [c] = await db.insert(characters).values(character).returning();
    await db.insert(gearSnapshots).values({ characterId: c!.id, source: 'blizzard', createdAt: 1, contentHash: 'x' });
    await db.delete(characters).where(eq(characters.id, c!.id));
    expect(await db.select().from(gearSnapshots)).toEqual([]);
  });
});
