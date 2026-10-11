import { describe, expect, it } from 'vitest';
import { anyPickName, fetchedLine, methodPickName, orphanLabel, rowButton, tabSub } from './editor-text';

describe('editor text', () => {
  it('says when Method list was fetched', () => {
    expect(fetchedLine(0, 3 * 3_600_000)).toBe('Method list fetched 3 h ago');
    expect(fetchedLine(null, 0)).toBe('Method list not fetched');
  });

  it('labels the row button by what it does next', () => {
    expect(rowButton({ edited: true, open: false })).toBe('Reset');
    expect(rowButton({ edited: false, open: false })).toBe('Override');
    expect(rowButton({ edited: false, open: true })).toBe('Cancel');
  });

  it('puts the compared mark in the tab sub line on a phone', () => {
    expect(tabSub(0, false)).toBe('no edits');
    expect(tabSub(3, true)).toBe('Compared · 3 edited');
  });

  it('names an orphan old slot', () => {
    expect(orphanLabel('Ring#3')).toBe('Was your pick for Ring 3');
  });

  it('names Method pick, spelling out a catalyst base', () => {
    expect(methodPickName({ name: 'Spare Speaker’s Hood', isTier: true, isCatalyst: true })).toBe('Tier piece (catalyst Spare Speaker’s Hood)');
    expect(methodPickName({ name: 'Yoke of the Charging Bear', isTier: false, isCatalyst: false })).toBe('Yoke of the Charging Bear');
    expect(methodPickName({ name: 'Crown of Rites', isTier: true, isCatalyst: false })).toBe('Crown of Rites');
  });

  it('names an Any row by its item level', () => {
    expect(anyPickName(334)).toEqual({ name: 'Any 334', detail: 'Any item at item level 334 or higher' });
  });
});
