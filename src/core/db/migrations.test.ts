import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDrizzle, openDb } from './client';
import { bisLists, bisOverrides, specSettings } from './schema';

const DRIZZLE = path.join(process.cwd(), 'drizzle');

/** A migrations folder holding only the first `count` migrations. */
function firstMigrations(count: number): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wgt-migrations-'));
  const journal = JSON.parse(fs.readFileSync(path.join(DRIZZLE, 'meta', '_journal.json'), 'utf8'));
  journal.entries = journal.entries.slice(0, count);
  fs.mkdirSync(path.join(dir, 'meta'));
  fs.writeFileSync(path.join(dir, 'meta', '_journal.json'), JSON.stringify(journal));
  for (const e of journal.entries) fs.copyFileSync(path.join(DRIZZLE, `${e.tag}.sql`), path.join(dir, `${e.tag}.sql`));
  return dir;
}

describe('bis sources migration', () => {
  it('keeps existing lists, overrides and settings as Method', async () => {
    const url = `file:${path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wgt-db-')), 'app.db').replaceAll('\\', '/')}`;
    await openDb(url, firstMigrations(13));
    const { client } = createDrizzle(url);
    await client.execute(`INSERT INTO bis_lists (spec_slug, list_type, fetched_at) VALUES ('frost-mage', 'raid', 5)`);
    await client.execute(`INSERT INTO bis_overrides (account_id, spec_slug, list_type, slot_key, item_id) VALUES (1, 'frost-mage', 'raid', 'Head#1', 100)`);
    await client.execute(`INSERT INTO spec_settings (account_id, spec_slug, list_type) VALUES (1, 'frost-mage', 'raid')`);
    client.close();

    const db = await openDb(url);
    expect(await db.select({ source: bisLists.source, fetchedAt: bisLists.fetchedAt }).from(bisLists)).toEqual([{ source: 'method', fetchedAt: 5 }]);
    expect(await db.select({ source: bisOverrides.source, itemId: bisOverrides.itemId }).from(bisOverrides)).toEqual([{ source: 'method', itemId: 100 }]);
    expect(await db.select({ source: specSettings.source, listType: specSettings.listType }).from(specSettings)).toEqual([{ source: 'method', listType: 'raid' }]);
  });
});
