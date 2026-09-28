import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { replaceTracks, getTrackMap, replaceBonusQualities, getBonusQualityMap } from './tracks';
import { getMeta, setMeta } from './meta';
import { upsertItemIcons, getItemIcons, upsertItemDetails, getItemDetailsMap, upsertClassIcons, getClassIconMap } from './media';

describe('tracks, meta and icons', () => {
  it('stores class icons by class name', async () => {
    const db = await openTestDb();
    await upsertClassIcons(db, [{ className: 'Druid', classId: 11, iconUrl: 'https://i/druid.jpg' }, { className: 'Monk', classId: 10, iconUrl: null }], 1);
    await upsertClassIcons(db, [{ className: 'Druid', classId: 11, iconUrl: 'https://i/druid2.jpg' }], 2);
    expect(await getClassIconMap(db)).toEqual(new Map([['Druid', 'https://i/druid2.jpg'], ['Monk', null]]));
  });

  it('stores item details', async () => {
    const db = await openTestDb();
    await upsertItemDetails(db, [{ itemId: 1, quality: 'EPIC', isTier: true }, { itemId: 2, quality: null, isTier: false }], 1);
    expect(await getItemDetailsMap(db, [1, 2, 3])).toEqual(new Map([[1, { quality: 'EPIC', isTier: true }], [2, { quality: null, isTier: false }]]));
    expect((await getItemDetailsMap(db, [])).size).toBe(0);
  });

  it('stores bonus qualities', async () => {
    const db = await openTestDb();
    await replaceBonusQualities(db, [{ bonusId: 12805, quality: 'EPIC' }, { bonusId: 4775, quality: 'RARE' }]);
    expect(await getBonusQualityMap(db)).toEqual(new Map([[12805, 'EPIC'], [4775, 'RARE']]));
  });

  it('stores tracks by bonus ID', async () => {
    const db = await openTestDb();
    await replaceTracks(db, [{ bonusId: 12850, name: 'Myth', step: 2, max: 6, group: 618, currencyId: 3446, currencyName: 'Myth Mistcrest', costPerStep: 20 }]);
    expect((await getTrackMap(db)).get(12850)?.name).toBe('Myth');
  });

  it('stores meta values', async () => {
    const db = await openTestDb();
    expect(await getMeta(db, 'x')).toBeNull();
    await setMeta(db, 'x', 'one', 1);
    await setMeta(db, 'x', 'two', 2);
    expect(await getMeta(db, 'x')).toEqual({ value: 'two', updatedAt: 2 });
  });

  it('stores icons, including known-missing ones', async () => {
    const db = await openTestDb();
    await upsertItemIcons(db, [{ itemId: 1, iconUrl: 'https://i/1.jpg' }, { itemId: 2, iconUrl: null }], 1);
    const icons = await getItemIcons(db, [1, 2, 3]);
    expect(new Map([...icons.entries()].sort())).toEqual(new Map([[1, 'https://i/1.jpg'], [2, null]]));
    expect((await getItemIcons(db, [])).size).toBe(0);
  });
});
