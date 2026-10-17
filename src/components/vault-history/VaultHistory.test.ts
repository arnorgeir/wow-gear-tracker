import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VaultHistory } from './VaultHistory';

describe('VaultHistory', () => {
  it('starts with the button and no weeks', () => {
    const html = renderToStaticMarkup(createElement(VaultHistory, { id: 1, before: 1000, now: 2000 }));
    expect(html).toContain('Great Vault history');
    expect(html).not.toContain('Week of');
    expect(html).not.toContain('Marked against');
  });
});
