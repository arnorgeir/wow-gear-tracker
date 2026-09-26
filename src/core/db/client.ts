import path from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from './schema';

export function createDrizzle(url: string) {
  const client = createClient({ url });
  return { client, db: drizzle(client, { schema }) };
}

export type Db = ReturnType<typeof createDrizzle>['db'];

/** Opens the database, turns on foreign keys and applies pending migrations. */
export async function openDb(url: string, migrationsFolder = path.join(process.cwd(), 'drizzle')): Promise<Db> {
  const { client, db } = createDrizzle(url);
  await client.execute('PRAGMA foreign_keys = ON');
  // Wait up to 5 s for another connection's write lock instead of failing with SQLITE_BUSY.
  if (!url.includes(':memory:')) await client.execute('PRAGMA busy_timeout = 5000');
  await migrate(db, { migrationsFolder });
  return db;
}
