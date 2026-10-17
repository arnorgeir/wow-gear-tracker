import { describe, expect, it } from 'vitest';
import type { CharacterCardView } from '@/server/views/types';
import { sortCards } from './sort-cards';
import type { SortKey } from './characters-sort';

type Card = Pick<CharacterCardView, 'name' | 'className' | 'spec' | 'realmName' | 'itemLevel' | 'lastSyncedAt' | 'counts' | 'total'>;
const counts = (done: number, myth = 0, below = 0) => ({ done, mythUpgradable: myth, belowMyth: below, wrongStats: 0, missing: 0, inBags: 0 }) as Card['counts'];
const card = (name: string, over: Partial<Card> = {}): Card => ({
  name, className: 'Druid', spec: 'Guardian', realmName: 'Kazzak', itemLevel: 700, lastSyncedAt: 1000, counts: counts(5), total: 10, ...over,
});
const names = (cards: Card[], key: SortKey, dir: 'asc' | 'desc') => sortCards(cards, { key, dir }).map((c) => c.name);

describe('sortCards', () => {
  const a = card('Birkibjörn', { className: 'Warrior', spec: 'Arms', realmName: 'Tarren Mill', itemLevel: 710, lastSyncedAt: 3000, counts: counts(8) });
  const b = card('Asgerður', { className: 'Druid', spec: 'Restoration', realmName: 'Kazzak', itemLevel: 690, lastSyncedAt: 1000, counts: counts(2) });
  const c = card('Cedrik', { className: 'Mage', spec: 'Frost', realmName: 'Draenor', itemLevel: 700, lastSyncedAt: 2000, counts: counts(5) });
  const input = [a, b, c];

  it('added keeps the input order, reversed when descending', () => {
    expect(names(input, 'added', 'asc')).toEqual(['Birkibjörn', 'Asgerður', 'Cedrik']);
    expect(names(input, 'added', 'desc')).toEqual(['Cedrik', 'Asgerður', 'Birkibjörn']);
  });
  it.each<[SortKey, string[]]>([
    ['name', ['Asgerður', 'Birkibjörn', 'Cedrik']],
    ['class', ['Asgerður', 'Cedrik', 'Birkibjörn']],
    ['spec', ['Birkibjörn', 'Cedrik', 'Asgerður']],
    ['itemLevel', ['Asgerður', 'Cedrik', 'Birkibjörn']],
    ['progress', ['Asgerður', 'Cedrik', 'Birkibjörn']],
    ['synced', ['Asgerður', 'Cedrik', 'Birkibjörn']],
    ['realm', ['Cedrik', 'Asgerður', 'Birkibjörn']],
  ])('%s ascending, and descending is the reverse', (key, asc) => {
    expect(names(input, key, 'asc')).toEqual(asc);
    expect(names(input, key, 'desc')).toEqual([...asc].reverse());
  });

  it('puts missing values last in either direction', () => {
    const none = card('Zed', { itemLevel: null, lastSyncedAt: null, counts: null });
    const zero = card('Yara', { total: 0 });
    for (const key of ['itemLevel', 'synced'] as const) {
      for (const dir of ['asc', 'desc'] as const) expect(names([none, a, b], key, dir).at(-1)).toBe('Zed');
    }
    for (const dir of ['asc', 'desc'] as const) expect(names([none, zero, a, b], 'progress', dir).slice(-2)).toEqual(['Yara', 'Zed']);
  });

  it('ranks progress by the headline count, not done alone', () => {
    const crests = card('Crest', { counts: counts(1, 6, 1) }); // 8 of 10 is BiS
    const done = card('Done', { counts: counts(5) });
    expect(names([done, crests], 'progress', 'desc')).toEqual(['Crest', 'Done']);
  });

  it('breaks ties by name, then input order', () => {
    const x = card('Dora'), y = card('Anna'), z1 = card('Anna', { realmName: 'Draenor' }), z2 = card('Anna', { realmName: 'Draenor' });
    expect(names([x, y], 'itemLevel', 'desc')).toEqual(['Anna', 'Dora']);
    const out = sortCards([z1, z2, y], { key: 'name', dir: 'asc' });
    expect(out).toEqual([z1, z2, y]);
    expect(out[0]).toBe(z1);
    expect(out[1]).toBe(z2);
  });

  it('breaks class ties by spec, then name', () => {
    const p = card('Ben', { spec: 'Guardian' }), q = card('Al', { spec: 'Restoration' }), r = card('Cy', { spec: 'Guardian' });
    expect(names([q, r, p], 'class', 'asc')).toEqual(['Ben', 'Cy', 'Al']);
  });

  it('sorts accented names with plain letters and ignores case', () => {
    const o = [card('Örn'), card('Orri'), card('birkibjörn'), card('Bjorn'), card('Zoe')];
    expect(names(o, 'name', 'asc')).toEqual(['birkibjörn', 'Bjorn', 'Örn', 'Orri', 'Zoe']);
  });

  it('does not change the input', () => {
    const copy = [...input];
    sortCards(input, { key: 'name', dir: 'desc' });
    expect(input).toEqual(copy);
  });
});
