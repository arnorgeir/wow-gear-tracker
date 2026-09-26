import path from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from './schema';

export function createDrizzle(url: string) {
  // timeout is SQLite's busy timeout, applied to every pooled connection of a file database:
  // a write waits up to 5 s for another connection's lock instead of failing with SQLITE_BUSY.
  const client = createClient({ url, timeout: 5000 });
  return { client, db: drizzle(client, { schema }) };
}

export type Db = ReturnType<typeof createDrizzle>['db'];

/** Opens the database, turns on foreign keys and applies pending migrations. */
export async function openDb(url: string, migrationsFolder = path.join(process.cwd(), 'drizzle')): Promise<Db> {
  const { client, db } = createDrizzle(url);
  await client.execute('PRAGMA foreign_keys = ON');
  await migrate(db, { migrationsFolder });
  return db;
}
