import { describe, expect, it } from 'vitest';
import { anyPickName, fetchedLine, followsText, replaceText, methodPickName, orphanLabel, orphanText, pickColumn, rowButton, tabSub } from './editor-text';

describe('editor text', () => {
  it("says when the source's list was fetched or copied", () => {
    const view = { source: 'method' as const, fetchedAt: 0, copiedFrom: null, copiedAt: null };
    expect(fetchedLine(view, 3 * 3_600_000)).toBe('Method list fetched 3 h ago');
    expect(fetchedLine({ ...view, source: 'icyVeins', fetchedAt: null }, 0)).toBe('Icy Veins list not fetched');
    expect(fetchedLine({ ...view, source: 'manual', fetchedAt: null, copiedFrom: 'icyVeins', copiedAt: 0 }, 2 * 86_400_000)).toBe('Manual · copied from Icy Veins 2 days ago');
  });

  it('names the pick column and the untouched rows after the source', () => {
    expect(pickColumn('icyVeins', null)).toBe("Icy Veins's pick");
    expect(pickColumn('method', null)).toBe("Method's pick");
    expect(pickColumn('manual', null)).toBe('Copied pick');
    expect(pickColumn('manual', 'method')).toBe('Copied from Method');
    expect(followsText('method')).toBe('Follows Method');
    expect(followsText('manual')).toBe('Follows your copy');
    expect(replaceText('icyVeins', 'Head', null)).toBe("Replace Icy Veins's Head pick");
    expect(replaceText('manual', 'Head', null)).toBe('Replace the copied Head pick');
    expect(replaceText('manual', 'Head', 'method')).toBe('Replace the Head pick copied from Method');
  });

  it('says who dropped orphaned slots', () => {
    expect(orphanText('method')).toEqual({ heading: "No longer in Method's list", body: "Method dropped these slots. Your picks for them aren't applied." });
    expect(orphanText('manual')).toEqual({ heading: 'No longer in your copy', body: "These slots are gone from your copy. Your picks for them aren't applied." });
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
