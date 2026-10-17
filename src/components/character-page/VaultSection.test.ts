import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VaultSection } from './VaultSection';

const base = { id: 1, vault: [], vaultChoices: [], vaultChoicesAt: null, vaultHistoryBefore: null, now: 0 };

describe('VaultSection', () => {
  it('puts a gold vault icon in the heading and says plainly when there is no paste this week', () => {
    const html = renderToStaticMarkup(createElement(VaultSection, base));
    expect(html).toMatch(/<h2 class="flex items-center gap-2\.5[^"]*"><svg[^>]*aria-hidden="true"[^>]*class="shrink-0 text-gold"[^>]*>.*<\/svg>Great Vault<\/h2>/);
    expect(html).toContain('No SimC import with Great Vault data this week.');
    expect(html).toContain('Paste SimC to see your Great Vault choices.');
    expect(html).not.toContain('No item choices in the vault');
  });

  it('shows the history button only when an earlier week has a paste', () => {
    expect(renderToStaticMarkup(createElement(VaultSection, base))).not.toContain('Great Vault history');
    expect(renderToStaticMarkup(createElement(VaultSection, { ...base, vaultHistoryBefore: 1000 }))).toContain('Great Vault history');
  });
});
