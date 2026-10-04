import { describe, expect, it } from 'vitest';
import { stateWord } from './state-word';

describe('stateWord', () => {
  it('gives each state one short word, in its state color', () => {
    expect(stateWord('done', false)).toEqual({ word: 'Done', className: 'text-gold' });
    expect(stateWord('mythUpgradable', false)).toEqual({ word: 'Crests', className: 'text-crest' });
    expect(stateWord('belowMyth', false)).toEqual({ word: 'Vault', className: 'text-vault' });
    expect(stateWord('inBags', false)).toEqual({ word: 'Bags', className: 'text-bags' });
    expect(stateWord('missing', false)).toEqual({ word: 'Need', className: 'text-missing' });
  });

  it('says Need tier for a missing tier piece, and only for missing', () => {
    expect(stateWord('missing', true).word).toBe('Need tier');
    expect(stateWord('done', true).word).toBe('Done');
  });
});
