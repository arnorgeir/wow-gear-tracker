import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import { type NewCharacter, insertCharacter, listCharacters, getCharacter, findCharacterByKey, updateCharacter, deleteCharacter } from './characters';

const newCharacter: NewCharacter = {
  region: 'eu', realmId: 1306, realmSlug: 'tarren-mill', realmName: 'Tarren Mill',
  name: 'Birkibjörn', className: 'Druid', specName: 'Guardian',
};

describe('characters', () => {
  it('stores race, faction and avatar', async () => {
    const db = await openTestDb();
    const { id } = await insertCharacter(db, newCharacter, 1);
    expect(await getCharacter(db, id)).toMatchObject({ race: null, faction: null, avatarUrl: null });
    await updateCharacter(db, id, { race: 'Troll', faction: 'HORDE', avatarUrl: 'https://render/a.jpg' });
    expect(await getCharacter(db, id)).toMatchObject({ race: 'Troll', faction: 'HORDE', avatarUrl: 'https://render/a.jpg' });
  });

  it('inserts, lists, updates and deletes', async () => {
    const db = await openTestDb();
    const { id, created } = await insertCharacter(db, newCharacter, 100);
    expect(created).toBe(true);
    await updateCharacter(db, id, { specOverride: 'Feral', lastSyncedAt: 200 });
    expect(await getCharacter(db, id)).toMatchObject({ name: 'Birkibjörn', nameKey: 'birkibjörn', specOverride: 'Feral', lastSyncedAt: 200 });
    expect(await listCharacters(db)).toHaveLength(1);
    await deleteCharacter(db, id);
    expect(await getCharacter(db, id)).toBeUndefined();
  });

  it('returns the existing character when added again with different capitalization', async () => {
    const db = await openTestDb();
    const first = await insertCharacter(db, newCharacter, 100);
    const second = await insertCharacter(db, { ...newCharacter, name: 'BIRKIBJÖRN' }, 200);
    expect(second).toEqual({ id: first.id, created: false });
    expect(await listCharacters(db)).toHaveLength(1);
  });

  it('finds a character by region, realm slug and folded name', async () => {
    const db = await openTestDb();
    const { id } = await insertCharacter(db, newCharacter, 1);
    await insertCharacter(db, { ...newCharacter, realmId: 1096, realmSlug: 'argent-dawn', realmName: 'Argent Dawn' }, 2);
    expect((await findCharacterByKey(db, { region: 'eu', realmSlug: 'tarren-mill', nameKey: 'birkibjörn' }))?.id).toBe(id);
    expect(await findCharacterByKey(db, { region: 'eu', realmSlug: 'silvermoon', nameKey: 'birkibjörn' })).toBeUndefined();
    expect(await findCharacterByKey(db, { region: 'us', realmSlug: 'tarren-mill', nameKey: 'birkibjörn' })).toBeUndefined();
  });
});
