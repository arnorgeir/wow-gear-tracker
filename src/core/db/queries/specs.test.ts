import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { getSpec, listSpecs, replaceSpecs } from './specs';

const FROST = { methodSlug: 'frost-mage', classId: 8, className: 'Mage', specName: 'Frost' };

describe('specs', () => {
  it('replaces the catalog', async () => {
    const db = await openTestDb();
    await replaceSpecs(db, [FROST, { methodSlug: 'fire-mage', classId: 8, className: 'Mage', specName: 'Fire' }], 1);
    await replaceSpecs(db, [FROST], 2);
    expect(await listSpecs(db)).toEqual([FROST]);
    expect(await getSpec(db, 'frost-mage')).toEqual(FROST);
    expect(await getSpec(db, 'nope')).toBeNull();
  });
});
