import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GroupVault } from './GroupVault';

describe('GroupVault', () => {
  it('keeps no paste, an empty paste and choices apart, with the paste age', () => {
    const html = renderToStaticMarkup(createElement(GroupVault, { now: 3 * 86_400_000, vault: [
      { key: 'a', name: 'Birkibjörn', pastedAt: null, choices: [] },
      { key: 'b', name: 'Sólrún', pastedAt: 0, choices: [] },
      { key: 'c', name: 'Gnúpur', pastedAt: 0, choices: [{ itemId: 61, name: 'Item 61', itemLevel: 330, quality: 'EPIC', bonusIds: [], iconUrl: null, trackLabel: null, isBis: true }] },
    ] })).replace(/<link[^>]*\/>/g, '');
    expect(html).toContain('No SimC paste yet.');
    expect(html).toContain('No item choices in the vault in the last paste.');
    expect(html).toContain('from SimC pasted');
    expect(html).toContain('>BiS<');
  });
});
