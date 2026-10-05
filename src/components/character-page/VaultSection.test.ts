import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VaultSection } from './VaultSection';

describe('VaultSection', () => {
  it('puts a gold vault icon in the heading and keeps the empty-paste wording', () => {
    const html = renderToStaticMarkup(createElement(VaultSection, { vault: [], vaultChoices: [], vaultChoicesAt: null, now: 0 }));
    expect(html).toMatch(/<h2 class="flex items-center gap-2\.5[^"]*"><svg[^>]*aria-hidden="true"[^>]*class="shrink-0 text-gold"[^>]*>.*<\/svg>Great Vault<\/h2>/);
    expect(html).toContain('Paste SimC to see your Great Vault choices.');
  });
});
