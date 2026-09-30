import { describe, expect, it } from 'vitest';
import { nameKeyOf } from './name-key';

describe('nameKeyOf', () => {
  it('lowercases the name', () => {
    expect(nameKeyOf('Birkibjörn')).toBe('birkibjörn');
  });

  it('folds a non-ASCII capital the same way as its lowercase form', () => {
    expect(nameKeyOf('BIRKIBJÖRN')).toBe(nameKeyOf('birkibjörn'));
  });
});
