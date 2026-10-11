import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { accounts } from '../schema';
import { LOCAL_ACCOUNT_ID } from '../../types';

describe('accounts', () => {
  it('seeds the local account', async () => {
    const db = await openTestDb();
    expect(await db.select().from(accounts)).toEqual([{ id: LOCAL_ACCOUNT_ID, name: 'Local' }]);
  });
});
